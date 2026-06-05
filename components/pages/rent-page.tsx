'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { MobileHeader, formatStationRef } from '@/components/volt/mobile-header';
import {
  PowerdonLogo, ArrowRightIcon, ShieldCheckIcon, GiftIcon,
  XCircleIcon, RefreshIcon, CheckCircleIcon,
} from '@/components/volt/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { useAppState } from '@/lib/app-state';
import { formatCurrency } from '@/lib/session-store';
import { formatTime } from '@/lib/utils';
import { RentalCheckout } from '@/components/stripe/checkout';
import { isStripeCheckoutEnabled, isStripeMisconfigured } from '@/lib/services/config';
import { getPwaDataLayer } from '@/lib/data';
import { saveSessionToken, sessionAuthHeaders } from '@/lib/client/session-token';
import { formatDailyCapLabel, formatLadderRateLabel, LADDER_PRICING } from '@/lib/pwa/pricing-display';
import {
  PwaScreen, PwaBody, PwaScrollBody, PwaActionBar,
  PwaCenteredState, PwaListGroup, PwaListRow, PwaMetricHero, PWA_BTN_CLASS,
} from '@/components/pwa/pwa-screen';
import { PwaBottomSheet } from '@/components/pwa/pwa-bottom-sheet';
import { PwaLoadingScreen } from '@/components/pwa/pwa-states';

type RentStep = 'landing' | 'active_warning' | 'info' | 'payment' | 'unlocking' | 'success' | 'error';
type ErrorType = 'station_unavailable' | 'duplicate_session' | 'payment_failed' | 'network' | 'unlock_failed' | 'general';

interface RentPageProps {
  isOnline: boolean;
  onNavigate: (tab: 'rent' | 'status' | 'rewards' | 'support') => void;
}

interface ErrorConfig {
  title: string;
  description: string;
  action: string;
  canRetry: boolean;
}

const errorConfigs: Record<ErrorType, ErrorConfig> = {
  station_unavailable: {
    title: 'Station Unavailable',
    description: 'This charging station is currently offline or under maintenance. Please try a nearby station.',
    action: 'Try Again',
    canRetry: false,
  },
  duplicate_session: {
    title: 'Active Rental Found',
    description: 'You already have an active rental. Please return your current power bank before starting a new rental.',
    action: 'View Active Rental',
    canRetry: false,
  },
  payment_failed: {
    title: 'Payment Failed',
    description: 'Your payment could not be authorized. Please check your payment method and try again.',
    action: 'Try Again',
    canRetry: true,
  },
  network: {
    title: 'Connection Lost',
    description: 'Unable to connect to our servers. Please check your internet connection and try again.',
    action: 'Retry',
    canRetry: true,
  },
  unlock_failed: {
    title: 'Unlock Failed',
    description: 'The power bank could not be released. Please try again or contact support.',
    action: 'Try Again',
    canRetry: true,
  },
  general: {
    title: 'Something Went Wrong',
    description: 'An unexpected error occurred. Our team has been notified.',
    action: 'Try Again',
    canRetry: true,
  },
};

const btnClass = PWA_BTN_CLASS;

export function RentPage({ isOnline, onNavigate }: RentPageProps) {
  const { activeSession, currentStation, user, startRental, setUser, setActiveSession, loadStation } =
    useAppState();

  const [step, setStep] = useState<RentStep>('landing');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ErrorType | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // User info form state
  const [email, setEmail] = useState(user?.email || '');
  const [name, setName] = useState(user?.name || '');
  const [termsAccepted, setTermsAccepted] = useState(user?.termsAccepted || false);
  const [marketingConsent, setMarketingConsent] = useState(user?.marketingConsent || false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [isProcessing, setIsProcessing] = useState(false);

  // Unlocking state
  const [unlockProgress, setUnlockProgress] = useState(0);
  const [assignedSlot, setAssignedSlot] = useState<number | null>(null);

  // Initialize page based on state
  useEffect(() => {
    const initPage = async () => {
      setIsLoading(true);

      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const stationId = params.get('station') || params.get('stationId');
        if (stationId && !currentStation) {
          const loaded = await loadStation(stationId);
          if (!loaded.success) {
            setError('station_unavailable');
            setIsLoading(false);
            return;
          }
        }
      }

      if (!currentStation) {
        setError('station_unavailable');
        setIsLoading(false);
        return;
      }

      if (!isOnline) {
        setError('network');
        setIsLoading(false);
        return;
      }

      // Check for active session
      if (activeSession) {
        setStep('active_warning');
        setIsLoading(false);
        return;
      }

      // Pre-fill form if user exists
      if (user) {
        setEmail(user.email);
        setName(user.name || '');
        setTermsAccepted(user.termsAccepted);
        setMarketingConsent(user.marketingConsent);
      }

      setIsLoading(false);
    };

    initPage();
  }, [isOnline, activeSession, user]);

  // Validate email
  const validateEmail = (emailValue: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailValue);
  };

  // Handle form submission
  const handleInfoSubmit = () => {
    const errors: Record<string, string> = {};

    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!termsAccepted) {
      errors.terms = 'You must accept the terms to continue';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    setStep('payment');
  };

  const handleStripeCheckoutError = useCallback((msg: string) => {
    setErrorMessage(msg);
    setError('payment_failed');
    setStep('error');
  }, []);

  const handleStripeCheckoutSuccess = async (
    sessionCode: string,
    unlockToken?: string,
    sessionId?: string,
  ) => {
    if (!currentStation) return;
    setIsProcessing(true);
    setStep('unlocking');
    setUnlockProgress(40);

    try {
      if (unlockToken && sessionId) {
        saveSessionToken(sessionId, unlockToken);
      }
      const lookupId = sessionId || sessionCode;
      const res = await fetch(`/api/rentals/${encodeURIComponent(lookupId)}`, {
        headers: sessionAuthHeaders(sessionId || sessionCode),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setErrorMessage(body.error || 'Failed to confirm payment');
        setError('payment_failed');
        setStep('error');
        return;
      }

      setUnlockProgress(60);
      if (
        unlockToken &&
        sessionId &&
        currentStation &&
        ['pending', 'active'].includes(body.session?.status)
      ) {
        const unlockRes = await fetch(`/api/stations/${currentStation.id}/unlock`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...sessionAuthHeaders(sessionId),
          },
          body: JSON.stringify({
            sessionId,
            unlockToken,
            slotNumber: body.session?.pickupSlotNumber,
          }),
        });
        if (!unlockRes.ok) {
          const unlockBody = await unlockRes.json().catch(() => ({}));
          setErrorMessage(unlockBody.error || 'Unlock failed after payment');
          setError('unlock_failed');
          setStep('error');
          return;
        }
      }

      setUser({ email, name: name || undefined, termsAccepted, marketingConsent });
      const session = getPwaDataLayer().sessionFromCheckoutApi(body.session, currentStation);
      setAssignedSlot(session.slotNumber);
      setActiveSession(session);
      setUnlockProgress(100);
      setStep('success');
    } catch {
      setError('network');
      setStep('error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayment = async () => {
    setIsProcessing(true);
    setError(null);

    if (!isOnline) {
      setError('network');
      setStep('error');
      setIsProcessing(false);
      return;
    }

    if (!currentStation) {
      setErrorMessage('Station not loaded. Scan the QR code on the cabinet.');
      setError('station_unavailable');
      setStep('error');
      setIsProcessing(false);
      return;
    }

    setUser({
      email,
      name: name || undefined,
      termsAccepted,
      marketingConsent,
    });

    if (isStripeCheckoutEnabled()) {
      setIsProcessing(false);
      return;
    }

    setStep('unlocking');
    setUnlockProgress(20);

    const result = await startRental({
      email,
      name: name || undefined,
      termsAccepted,
      marketingConsent,
    });

    setUnlockProgress(100);

    if (result.success) {
      setStep('success');
    } else {
      setErrorMessage(result.error || 'Failed to start rental');
      if (result.error?.includes('active rental')) setError('duplicate_session');
      else if (result.error?.includes('Station')) setError('station_unavailable');
      else setError('general');
      setStep('error');
    }

    setIsProcessing(false);
  };

  // Handle error actions
  const handleErrorAction = () => {
    if (!error) return;

    const config = errorConfigs[error];

    if (error === 'duplicate_session') {
      onNavigate('status');
      return;
    }

    if (config.canRetry) {
      setError(null);
      setStep('landing');
    }
  };

  // Render loading state
  if (isLoading) {
    return <PwaLoadingScreen message="Finding your station..." />;
  }

  // Render error state (initial errors)
  if (error && step !== 'error') {
    const config = errorConfigs[error];
    return (
      <PwaScreen>
        <MobileHeader />
        <PwaCenteredState
          icon={<XCircleIcon size={28} className="text-muted-foreground" />}
          title={config.title}
          description={config.description}
        >
          <Button onClick={handleErrorAction} className={btnClass}>
            {config.action}
          </Button>
          <Button
            variant="outline"
            onClick={() => onNavigate('support')}
            className={btnClass}
          >
            Contact Support
          </Button>
        </PwaCenteredState>
      </PwaScreen>
    );
  }

  // Render step content
  if (step === 'active_warning') {
    return (
      <ActiveWarningStep
        onViewRental={() => onNavigate('status')}
        onContinueAnyway={() => setStep('landing')}
      />
    );
  }

  if (step === 'landing' && currentStation) {
    return (
      <LandingStep
        station={currentStation}
        onStart={() => setStep('info')}
      />
    );
  }

  if (step === 'info' && currentStation) {
    return (
      <InfoStep
        station={currentStation}
        email={email}
        setEmail={setEmail}
        name={name}
        setName={setName}
        termsAccepted={termsAccepted}
        setTermsAccepted={setTermsAccepted}
        marketingConsent={marketingConsent}
        setMarketingConsent={setMarketingConsent}
        formErrors={formErrors}
        onBack={() => setStep('landing')}
        onSubmit={handleInfoSubmit}
      />
    );
  }

  if (step === 'payment' && currentStation) {
    if (isStripeMisconfigured()) {
      return (
        <PwaScreen>
          <MobileHeader title="Payment" showBack onBack={() => setStep('info')} />
          <PwaBody>
            <p className="text-destructive font-medium">Payment is not configured</p>
            <p className="text-sm text-muted-foreground mt-2">
              Stripe secret key is set but NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing. Add the publishable key or remove STRIPE_SECRET_KEY for deposit-only mode.
            </p>
          </PwaBody>
        </PwaScreen>
      );
    }
    if (isStripeCheckoutEnabled()) {
      return (
        <PwaScreen>
          <MobileHeader title="Payment" showBack onBack={() => setStep('info')} />
          <PwaScrollBody>
            <RentalCheckout
              email={email}
              name={name || undefined}
              stationId={currentStation.id}
              campaignId={currentStation.campaignId || undefined}
              depositAmount={Math.round(currentStation.depositAmount * 100)}
              onSuccess={handleStripeCheckoutSuccess}
              onCancel={() => setStep('info')}
              onError={handleStripeCheckoutError}
            />
          </PwaScrollBody>
        </PwaScreen>
      );
    }
    return (
      <PaymentStep
        station={currentStation}
        isProcessing={isProcessing}
        onBack={() => setStep('info')}
        onSubmit={handlePayment}
      />
    );
  }

  if (step === 'unlocking' && currentStation) {
    return (
      <UnlockingStep
        station={currentStation}
        assignedSlot={activeSession?.slotNumber ?? assignedSlot ?? 1}
        progress={unlockProgress}
      />
    );
  }

  if (step === 'success' && currentStation && activeSession) {
    return (
      <SuccessStep
        station={currentStation}
        sessionCode={activeSession.sessionCode}
        assignedSlot={activeSession.slotNumber}
        startTime={activeSession.startTime}
        onContinue={() => onNavigate('status')}
      />
    );
  }

  if (step === 'error' && error) {
    return (
      <ErrorStep
        error={error}
        customMessage={errorMessage}
        onAction={handleErrorAction}
        onSupport={() => onNavigate('support')}
      />
    );
  }

  return null;
}

// Active Warning Step
function ActiveWarningStep({
  onViewRental,
  onContinueAnyway,
}: {
  onViewRental: () => void;
  onContinueAnyway: () => void;
}) {
  return (
    <PwaScreen>
      <MobileHeader />
      <PwaCenteredState
        icon={<PowerdonLogo size={28} className="text-foreground" />}
        title="Active Rental"
        description="You have an active rental. View its status or continue browsing."
      >
        <Button onClick={onViewRental} className={btnClass}>
          View Active Rental
        </Button>
        <Button variant="outline" onClick={onContinueAnyway} className={btnClass}>
          Continue Browsing
        </Button>
      </PwaCenteredState>
    </PwaScreen>
  );
}

// Landing Step Component
function LandingStep({
  station,
  onStart
}: {
  station: { id: string; campaignName: string; hourlyRate: number; dailyCap: number; depositAmount: number; rewardDescription: string; availableSlots: number };
  onStart: () => void;
}) {
  return (
    <PwaScreen>
      <MobileHeader
        stationContext={{ eventName: station.campaignName, stationId: station.id }}
        showSecure
      />

      <PwaBody className="justify-between py-3">
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
            <PowerdonLogo size={28} className="text-foreground" />
          </div>

          <div className="text-center">
            <h1 className="text-xl font-semibold text-foreground">Stay charged</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Rent a power bank in seconds
            </p>
          </div>

          <PwaListGroup className="w-full">
            <PwaListRow
              label="Rate"
              hint={`First ${LADDER_PRICING.freeMinutes} min free`}
              value={formatLadderRateLabel()}
            />
            <PwaListRow
              label="Deposit"
              hint="Refundable"
              value={formatCurrency(station.depositAmount)}
            />
            <PwaListRow
              label="Daily cap"
              hint="Tax included"
              value={formatDailyCapLabel(station.dailyCap)}
            />
          </PwaListGroup>

          <div className="flex w-full items-center gap-2 rounded-xl bg-muted/60 px-3 py-2">
            <GiftIcon size={16} className="shrink-0 text-primary" />
            <p className="text-xs text-muted-foreground line-clamp-1">
              <span className="font-medium text-foreground">Reward:</span> {station.rewardDescription}
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            Scan → Unlock → Return at any station
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          {station.availableSlots} slots available
        </p>
      </PwaBody>

      <PwaActionBar>
        <Button onClick={onStart} className={btnClass}>
          Start rental
          <ArrowRightIcon size={16} />
        </Button>
      </PwaActionBar>
    </PwaScreen>
  );
}

// Info Step Component
function InfoStep({
  station,
  email,
  setEmail,
  name,
  setName,
  termsAccepted,
  setTermsAccepted,
  marketingConsent,
  setMarketingConsent,
  formErrors,
  onBack,
  onSubmit,
}: {
  station: { campaignName: string; hourlyRate: number; depositAmount: number };
  email: string;
  setEmail: (v: string) => void;
  name: string;
  setName: (v: string) => void;
  termsAccepted: boolean;
  setTermsAccepted: (v: boolean) => void;
  marketingConsent: boolean;
  setMarketingConsent: (v: boolean) => void;
  formErrors: Record<string, string>;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <PwaScreen>
      <MobileHeader title="Your Info" showBack onBack={onBack} />

      <PwaBody scroll className="gap-4 py-3">
        <div>
          <h1 className="text-base font-semibold text-foreground">Your details</h1>
          <p className="text-xs text-muted-foreground">Enter your email to continue</p>
        </div>

        <PwaListGroup>
          <PwaListRow
            label="Rate"
            hint={`First ${LADDER_PRICING.freeMinutes} min free`}
            value={formatLadderRateLabel()}
          />
          <PwaListRow
            label="Deposit"
            value={formatCurrency(station.depositAmount)}
          />
        </PwaListGroup>

        <div className="space-y-3">
          <div>
            <label htmlFor="email" className="block text-xs text-muted-foreground mb-1.5">
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`h-11 rounded-xl ${formErrors.email ? 'border-destructive' : ''}`}
              aria-invalid={!!formErrors.email}
              aria-describedby={formErrors.email ? 'email-error' : undefined}
            />
            {formErrors.email && (
              <p id="email-error" className="mt-1 text-xs text-destructive">{formErrors.email}</p>
            )}
          </div>

          <div>
            <label htmlFor="name" className="block text-xs text-muted-foreground mb-1.5">
              Name <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <Input
              id="name"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>

          <div className="space-y-2.5">
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="terms"
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                className="mt-0.5"
                aria-invalid={!!formErrors.terms}
              />
              <label htmlFor="terms" className="text-xs text-muted-foreground cursor-pointer leading-relaxed">
                I agree to the{' '}
                <Link href="/terms" className="text-foreground underline">Terms</Link>
                {' '}and{' '}
                <Link href="/privacy" className="text-foreground underline">Privacy Policy</Link>
              </label>
            </div>
            {formErrors.terms && (
              <p className="text-xs text-destructive ml-6">{formErrors.terms}</p>
            )}

            <div className="flex items-start gap-2.5">
              <Checkbox
                id="marketing"
                checked={marketingConsent}
                onCheckedChange={(checked) => setMarketingConsent(checked === true)}
                className="mt-0.5"
              />
              <label htmlFor="marketing" className="text-xs text-muted-foreground cursor-pointer leading-relaxed">
                Send me updates about rewards
              </label>
            </div>
          </div>
        </div>
      </PwaBody>

      <PwaActionBar>
        <Button onClick={onSubmit} className={btnClass}>
          Continue
          <ArrowRightIcon size={16} />
        </Button>
      </PwaActionBar>
    </PwaScreen>
  );
}

// Payment Step Component (deposit-only mode — server authorizes via /api/rentals/start)
function PaymentStep({
  station,
  isProcessing,
  onBack,
  onSubmit,
}: {
  station: { depositAmount: number; dailyCap: number };
  isProcessing: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <PwaScreen>
      <MobileHeader title="Payment" showBack onBack={onBack} />

      <PwaBody className="justify-between gap-4 py-3">
        <div className="space-y-4">
          <div>
            <h1 className="text-base font-semibold text-foreground">Authorize deposit</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Usage is billed from the deposit hold on return.
            </p>
          </div>

          <PwaListGroup>
            <PwaListRow
              label="Deposit hold"
              value={formatCurrency(station.depositAmount)}
            />
            <PwaListRow
              label="Rate"
              hint={`First ${LADDER_PRICING.freeMinutes} min free`}
              value={formatLadderRateLabel()}
            />
            <PwaListRow
              label="Daily cap"
              value={formatDailyCapLabel(station.dailyCap)}
            />
            <PwaListRow
              label="Max rental"
              value={`${LADDER_PRICING.maxRentalHours} hours`}
            />
          </PwaListGroup>

          <p className="text-xs text-muted-foreground">
            You are only charged for actual usage. Unused deposit is refunded after return. Tax included.
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          <ShieldCheckIcon size={12} className="inline mr-1" />
          Deposit authorization processed securely on our servers
        </p>
      </PwaBody>

      <PwaActionBar>
        <Button
          onClick={onSubmit}
          disabled={isProcessing}
          className={btnClass}
        >
          {isProcessing ? (
            <>
              <Spinner className="w-5 h-5" />
              Authorizing...
            </>
          ) : (
            <>
              Authorize {formatCurrency(station.depositAmount)}
              <ArrowRightIcon size={18} />
            </>
          )}
        </Button>
      </PwaActionBar>
    </PwaScreen>
  );
}

// Unlocking Step Component
function UnlockingStep({
  station,
  assignedSlot,
  progress,
}: {
  station: { id: string };
  assignedSlot: number;
  progress: number;
}) {
  return (
    <PwaScreen>
      <MobileHeader
        stationContext={{ eventName: 'Rental', stationId: station.id }}
        statusBadge="Unlocking"
        statusBadgeVariant="active"
      />

      <PwaBody className="items-center justify-center text-center">
        <div className="mb-5 animate-spin">
          <RefreshIcon size={48} className="text-primary" />
        </div>

        <p className="text-[11px] font-medium uppercase tracking-wider text-primary">Unlocking Power Bank</p>
        <h1 className="mt-1 text-lg font-semibold text-foreground">Please wait…</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Slot {assignedSlot} is being released
        </p>

        <div className="mt-6 w-full max-w-xs">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-[width] duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <PwaListGroup className="mt-4">
            <PwaListRow
              label="Station"
              value={<span className="font-mono" title={station.id}>{formatStationRef(station.id)}</span>}
            />
            <PwaListRow
              label="Slot"
              value={<span className="font-mono font-bold text-primary">{String(assignedSlot).padStart(2, '0')}</span>}
            />
          </PwaListGroup>
        </div>
      </PwaBody>
    </PwaScreen>
  );
}

// Success Step Component
function SuccessStep({
  station,
  sessionCode,
  assignedSlot,
  startTime,
  onContinue,
}: {
  station: { id: string; campaignName: string; rewardDescription: string; rewardThreshold: number };
  sessionCode: string;
  assignedSlot: number;
  startTime: Date;
  onContinue: () => void;
}) {
  return (
    <PwaScreen>
      <MobileHeader
        stationContext={{ eventName: station.campaignName, stationId: station.id }}
        statusBadge="Confirmed"
        statusBadgeVariant="success"
      />

      <PwaBody className="items-center justify-center gap-4 py-3">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <CheckCircleIcon size={32} className="text-primary" />
        </div>

        <div className="text-center">
          <h1 className="text-lg font-semibold text-foreground">You&apos;re all set!</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick up from slot {assignedSlot} at {formatStationRef(station.id)}
          </p>
        </div>

        <PwaMetricHero
          label="Collect from"
          value={String(assignedSlot).padStart(2, '0')}
          sublabel={`Station ${formatStationRef(station.id)} · ${station.campaignName}`}
        />

        <PwaListGroup className="w-full max-w-xs">
          <PwaListRow label="Session ID" value={<span className="font-mono text-xs">{sessionCode}</span>} />
          <PwaListRow label="Started" value={formatTime(startTime)} />
          <PwaListRow
            label="Status"
            value={
              <span className="flex items-center gap-1.5 text-primary">
                <span className="size-1.5 rounded-full bg-primary" />
                Ready
              </span>
            }
          />
        </PwaListGroup>

        <div className="flex w-full max-w-xs items-start gap-2 rounded-xl bg-muted/60 px-3 py-2.5">
          <GiftIcon size={16} className="shrink-0 text-primary mt-0.5" />
          <p className="text-xs text-muted-foreground text-left">
            <span className="font-medium text-foreground">Remember:</span>{' '}
            {station.rewardDescription || `Rent for at least ${station.rewardThreshold ?? 60} minutes to earn your reward.`}
          </p>
        </div>
      </PwaBody>

      <PwaActionBar>
        <Button onClick={onContinue} className={btnClass}>
          View Rental Status
          <ArrowRightIcon size={18} />
        </Button>
      </PwaActionBar>
    </PwaScreen>
  );
}

// Error Step Component
function ErrorStep({
  error,
  customMessage,
  onAction,
  onSupport,
}: {
  error: ErrorType;
  customMessage?: string;
  onAction: () => void;
  onSupport: () => void;
}) {
  const [tipsOpen, setTipsOpen] = useState(false);
  const config = errorConfigs[error];
  const errorCode = `ERR-${Date.now().toString(36).toUpperCase().slice(-6)}`;

  const troubleshootingTips: Record<ErrorType, string[]> = {
    station_unavailable: [
      'Check if the station LED is lit',
      'Try scanning the QR code again',
      'Look for another nearby station',
    ],
    duplicate_session: [
      'Return your current power bank first',
      'Check your active session in Status tab',
    ],
    payment_failed: [
      'Verify your card details are correct',
      'Ensure sufficient funds available',
      'Try a different payment method',
    ],
    network: [
      'Check your internet connection',
      'Move closer to a WiFi access point',
      'Wait a moment and try again',
    ],
    unlock_failed: [
      'Ensure you are near the station',
      'Try a different slot if available',
      'Wait 10 seconds and try again',
    ],
    general: [
      'Try refreshing the page',
      'Check your internet connection',
      'Contact support if issue persists',
    ],
  };

  return (
    <PwaScreen>
      <MobileHeader statusBadge="Error" statusBadgeVariant="error" />

      <PwaCenteredState
        icon={<XCircleIcon size={28} className="text-destructive" />}
        title={config.title}
        description={customMessage || config.description}
      >
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-left text-xs text-muted-foreground">
          Reference: <span className="font-mono text-foreground">{errorCode}</span>
        </p>
        <Button variant="outline" onClick={() => setTipsOpen(true)} className={btnClass}>
          Troubleshooting tips
        </Button>
      </PwaCenteredState>

      <PwaBottomSheet
        open={tipsOpen}
        onOpenChange={setTipsOpen}
        title="Quick troubleshooting"
        description="Try these steps before contacting support."
      >
        <ol className="space-y-3 pb-2">
          {troubleshootingTips[error].map((tip, index) => (
            <li key={index} className="flex gap-3 text-sm text-muted-foreground">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
                {index + 1}
              </span>
              <span className="pt-0.5">{tip}</span>
            </li>
          ))}
        </ol>
      </PwaBottomSheet>

      <PwaActionBar>
        <Button onClick={onAction} className={btnClass}>
          <RefreshIcon size={18} />
          {config.action}
        </Button>
        <Button variant="outline" onClick={onSupport} className={btnClass}>
          Contact Support
        </Button>
      </PwaActionBar>
    </PwaScreen>
  );
}
