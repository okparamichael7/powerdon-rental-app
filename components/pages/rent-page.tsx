'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { MobileHeader } from '@/components/volt/mobile-header';
import {
  PowerDonLogo, ArrowRightIcon, ShieldCheckIcon, GiftIcon,
  XCircleIcon, RefreshIcon, CheckCircleIcon, ChevronLeftIcon, QRScanIcon
} from '@/components/volt/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { useAppState } from '@/lib/app-state';
import { formatCurrency } from '@/lib/session-store';
import { formatTime } from '@/lib/utils';

type RentStep = 'loading' | 'no_station' | 'landing' | 'active_warning' | 'info' | 'payment' | 'unlocking' | 'success' | 'error';
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
    action: 'Find Nearby',
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

export function RentPage({ isOnline, onNavigate }: RentPageProps) {
  const searchParams = useSearchParams();
  const { activeSession, currentStation, user, startRental, setUser, setActiveSession, loadStation, setCurrentStation } = useAppState();

  const [step, setStep] = useState<RentStep>('loading');
  const [isLoading, setIsLoading] = useState(true);
  const [stationError, setStationError] = useState<string | null>(null);
  const [error, setError] = useState<ErrorType | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // User info form state
  const [email, setEmail] = useState(user?.email || '');
  const [name, setName] = useState(user?.name || '');
  const [termsAccepted, setTermsAccepted] = useState(user?.termsAccepted || false);
  const [marketingConsent, setMarketingConsent] = useState(user?.marketingConsent || false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'apple_pay' | 'google_pay'>('card');
  const [isProcessing, setIsProcessing] = useState(false);

  // Unlocking state
  const [unlockProgress, setUnlockProgress] = useState(0);
  const [assignedSlot, setAssignedSlot] = useState<number | null>(null);

  // Initialize page - load station from URL parameter
  useEffect(() => {
    const initPage = async () => {
      setIsLoading(true);
      
      if (activeSession) {
        setStep('active_warning');
        setIsLoading(false);
        return;
      }

      if (currentStation) {
        setStep('landing');
        setIsLoading(false);
        return;
      }

      const stationId = searchParams.get('station');
      
      if (!stationId) {
        setStep('no_station');
        setIsLoading(false);
        return;
      }

      try {
        const station = await loadStation(stationId);
        
        if (!station) {
          setStationError(`Station "${stationId}" not found.`);
          setStep('no_station');
          setIsLoading(false);
          return;
        }
        
        if (station.status !== 'online') {
          setStationError(`Station "${stationId}" is currently ${station.status}.`);
          setStep('no_station');
          setIsLoading(false);
          return;
        }
        
        if (station.availableSlots === 0) {
          setStationError(`Station "${stationId}" has no available power banks.`);
          setStep('no_station');
          setIsLoading(false);
          return;
        }
        
        setStep('landing');
      } catch (err) {
        console.error('Failed to load station:', err);
        setStationError('Failed to load station. Please check your connection.');
        setStep('no_station');
      } finally {
        setIsLoading(false);
      }
    };

    initPage();
  }, [activeSession, currentStation, searchParams, loadStation]);

  useEffect(() => {
    if (user) {
      setEmail(user.email);
      setName(user.name || '');
      setTermsAccepted(user.termsAccepted);
      setMarketingConsent(user.marketingConsent);
    }
  }, [user]);

  const validateEmail = (emailValue: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailValue);
  };

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

  const handlePayment = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      if (!isOnline) {
        throw new Error('network');
      }

      setStep('unlocking');
      setAssignedSlot(Math.floor(Math.random() * 12) + 1);

      let progress = 0;
      const interval = setInterval(async () => {
        progress += 15;
        setUnlockProgress(progress);

        if (progress >= 100) {
          clearInterval(interval);

          const result = await startRental({
            email,
            name: name || undefined,
            termsAccepted,
            marketingConsent,
          });

          if (result.success) {
            setStep('success');
          } else {
            setErrorMessage(result.error || 'Failed to start rental');
            setError('general');
            setStep('error');
          }
        }
      }, 300);
    } catch (err) {
      setError('network');
      setStep('error');
    } finally {
      setIsProcessing(false);
    }
  };

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

  // Render current step
  const renderStep = () => {
    switch (step) {
      case 'loading':
        return <LoadingStep />;
      case 'no_station':
        return <NoStationStep error={stationError} />;
      case 'active_warning':
        return (
          <ActiveWarningStep
            onViewRental={() => onNavigate('status')}
            onContinueAnyway={() => setStep('landing')}
          />
        );
      case 'landing':
        return currentStation ? (
          <LandingStep station={currentStation} onStart={() => setStep('info')} />
        ) : null;
      case 'info':
        return currentStation ? (
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
        ) : null;
      case 'payment':
        return currentStation ? (
          <PaymentStep
            station={currentStation}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            isProcessing={isProcessing}
            onBack={() => setStep('info')}
            onSubmit={handlePayment}
          />
        ) : null;
      case 'unlocking':
        return currentStation ? (
          <UnlockingStep
            station={currentStation}
            assignedSlot={assignedSlot || 4}
            progress={unlockProgress}
          />
        ) : null;
      case 'success':
        return currentStation ? (
          <SuccessStep
            station={currentStation}
            assignedSlot={assignedSlot || 4}
            onContinue={() => onNavigate('status')}
          />
        ) : null;
      case 'error':
        return error ? (
          <ErrorStep
            error={error}
            customMessage={errorMessage}
            onAction={handleErrorAction}
            onSupport={() => onNavigate('support')}
          />
        ) : null;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      {renderStep()}
    </div>
  );
}

// Loading Step
function LoadingStep() {
  return (
    <div className="flex flex-col min-h-screen animate-in fade-in duration-150">
      <MobileHeader />
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <Spinner className="w-8 h-8 mb-4" />
        <p className="text-sm text-muted-foreground">Loading station...</p>
      </main>
    </div>
  );
}

// No Station Step
function NoStationStep({ error }: { error: string | null }) {
  return (
    <div className="flex flex-col min-h-screen animate-in fade-in duration-150">
      <MobileHeader />
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="relative w-24 h-24 mb-6">
          <div className="absolute inset-0 bg-muted rounded-2xl flex items-center justify-center">
            <QRScanIcon size={40} className="text-foreground" />
          </div>
        </div>

        <div className="text-center max-w-xs mb-6">
          <h1 className="text-xl font-medium text-foreground mb-2">Scan to Rent</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Use your phone&apos;s camera to scan the QR code on any PowerDon station.
          </p>
        </div>

        {error && (
          <div className="w-full max-w-sm bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-6">
            <div className="flex items-start gap-3">
              <XCircleIcon size={16} className="text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-destructive font-medium">Error</p>
                <p className="text-xs text-destructive/80 mt-0.5">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="w-full max-w-sm space-y-4">
          <div className="space-y-2 text-sm">
            {[
              { step: 1, title: 'Scan QR code', desc: 'On the station' },
              { step: 2, title: 'Enter details', desc: 'Email & payment' },
              { step: 3, title: 'Grab & go', desc: 'Slot unlocks' },
            ].map((item) => (
              <div key={item.step} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-muted text-foreground text-xs font-medium flex items-center justify-center flex-shrink-0">
                  {item.step}
                </span>
                <p className="text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center pt-2">
            First 5 min free, then €1/15min
          </p>
        </div>
      </main>
    </div>
  );
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
    <div className="flex flex-col min-h-screen animate-in fade-in duration-150">
      <MobileHeader />
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-6">
          <PowerDonLogo size={24} className="text-foreground" />
        </div>

        <div className="text-center max-w-xs mb-8">
          <h1 className="text-lg font-medium text-foreground mb-2">Active Rental</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You have an active rental. View its status or continue browsing.
          </p>
        </div>

        <div className="w-full max-w-sm space-y-3">
          <Button onClick={onViewRental} className="w-full h-12 text-sm font-medium">
            View Active Rental
          </Button>
          <Button variant="outline" onClick={onContinueAnyway} className="w-full h-12 text-sm font-medium">
            Continue Browsing
          </Button>
        </div>
      </main>
    </div>
  );
}

// Landing Step
function LandingStep({
  station,
  onStart
}: {
  station: { id: string; campaignName: string; hourlyRate: number; depositAmount: number; dailyCap?: number; rewardDescription: string; availableSlots: number };
  onStart: () => void;
}) {
  return (
    <div className="flex flex-col min-h-screen animate-in fade-in duration-150">
      <MobileHeader subtitle={`${station.campaignName.toUpperCase()} • STATION ${station.id}`} />

      <main className="flex-1 flex flex-col">
        <div className="relative w-full aspect-[4/3] overflow-hidden">
          <img
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/powerbanks.png-n6OHfLGwW8PS0RkEAFHCgSp1h0fhk6.jpeg"
            alt="PowerDon power banks"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex-1 px-5 py-6 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-medium text-foreground">Stay charged.</h1>
            <p className="mt-1 text-sm text-muted-foreground">Rent a power bank in seconds.</p>
          </div>

          <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Rate</p>
                <p className="text-lg font-medium text-foreground mt-0.5">
                  €1.00<span className="text-sm font-normal text-muted-foreground">/15min</span>
                </p>
                <p className="text-[10px] text-muted-foreground">First 5 min free</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Deposit</p>
                <p className="text-lg font-medium text-foreground mt-0.5">{formatCurrency(station.depositAmount)}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Refundable</p>
              </div>
            </div>
            <div className="text-xs text-muted-foreground border-t border-border/50 pt-3">
              Max €27.00/day • Tax included
            </div>
          </div>

          <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-start gap-3">
              <GiftIcon size={18} className="text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Reward Available</p>
                <p className="text-xs text-muted-foreground mt-0.5">{station.rewardDescription}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-20 px-5 py-4 bg-background border-t border-border">
          <Button onClick={onStart} className="w-full h-12 text-sm font-medium gap-2">
            Start Rental <ArrowRightIcon size={16} />
          </Button>
        </div>
      </main>
    </div>
  );
}

// Info Step
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
  station: { id: string; depositAmount: number };
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
    <div className="flex flex-col min-h-screen animate-in slide-in-from-right-4 duration-200">
      <MobileHeader subtitle={`STATION ${station.id}`} />

      <main className="flex-1 px-5 py-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground mb-4 active:opacity-70"
        >
          <ChevronLeftIcon size={16} />
          Back
        </button>

        <h1 className="text-xl font-medium text-foreground mb-1">Your Details</h1>
        <p className="text-sm text-muted-foreground mb-6">We&apos;ll send your receipt here.</p>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Email *</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={`mt-1.5 h-11 ${formErrors.email ? 'border-destructive' : ''}`}
            />
            {formErrors.email && (
              <p className="text-xs text-destructive mt-1">{formErrors.email}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Name (optional)</label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="mt-1.5 h-11"
            />
          </div>

          <div className="pt-2 space-y-3">
            <div className="flex items-start gap-3">
              <Checkbox
                id="terms"
                checked={termsAccepted}
                onCheckedChange={(v) => setTermsAccepted(v === true)}
                className="mt-0.5"
              />
              <label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed">
                I agree to the <a href="#" className="underline text-foreground">Terms of Service</a> and{' '}
                <a href="#" className="underline text-foreground">Privacy Policy</a> *
              </label>
            </div>
            {formErrors.terms && (
              <p className="text-xs text-destructive ml-7">{formErrors.terms}</p>
            )}

            <div className="flex items-start gap-3">
              <Checkbox
                id="marketing"
                checked={marketingConsent}
                onCheckedChange={(v) => setMarketingConsent(v === true)}
                className="mt-0.5"
              />
              <label htmlFor="marketing" className="text-sm text-muted-foreground leading-relaxed">
                Send me offers and updates
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-6 p-3 bg-muted/50 rounded-lg">
          <ShieldCheckIcon size={16} className="text-muted-foreground flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Your data is encrypted and secure
          </p>
        </div>
      </main>

      <div className="sticky bottom-20 px-5 py-4 bg-background border-t border-border">
        <Button onClick={onSubmit} className="w-full h-12 text-sm font-medium gap-2">
          Continue to Payment <ArrowRightIcon size={16} />
        </Button>
      </div>
    </div>
  );
}

// Payment Step
function PaymentStep({
  station,
  paymentMethod,
  setPaymentMethod,
  isProcessing,
  onBack,
  onSubmit,
}: {
  station: { id: string; depositAmount: number };
  paymentMethod: 'card' | 'apple_pay' | 'google_pay';
  setPaymentMethod: (v: 'card' | 'apple_pay' | 'google_pay') => void;
  isProcessing: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex flex-col min-h-screen animate-in slide-in-from-right-4 duration-200">
      <MobileHeader subtitle={`STATION ${station.id}`} />

      <main className="flex-1 px-5 py-6">
        <button
          onClick={onBack}
          disabled={isProcessing}
          className="flex items-center gap-1 text-sm text-muted-foreground mb-4 active:opacity-70 disabled:opacity-50"
        >
          <ChevronLeftIcon size={16} />
          Back
        </button>

        <h1 className="text-xl font-medium text-foreground mb-1">Payment</h1>
        <p className="text-sm text-muted-foreground mb-6">Authorize your deposit to continue.</p>

        <div className="bg-card rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Deposit</span>
            <span className="font-bold text-foreground">{formatCurrency(station.depositAmount)}</span>
          </div>
          <div className="space-y-2 text-xs text-muted-foreground border-t border-border pt-3">
            <div className="flex justify-between">
              <span>Rate</span>
              <span>€1.00/15min (first 5 min free)</span>
            </div>
            <div className="flex justify-between">
              <span>Daily cap</span>
              <span>€27.00</span>
            </div>
            <p className="pt-2">
              This amount will be held and you&apos;ll only be charged for actual usage.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <p className="text-sm font-medium text-foreground">Payment Method</p>
          {(['apple_pay', 'google_pay', 'card'] as const).map((method) => (
            <button
              key={method}
              onClick={() => setPaymentMethod(method)}
              disabled={isProcessing}
              className={`w-full p-3 rounded-lg border text-left flex items-center gap-3 transition-colors ${
                paymentMethod === method
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card'
              } disabled:opacity-50`}
            >
              <div className="w-8 h-8 bg-muted rounded flex items-center justify-center text-xs font-medium">
                {method === 'apple_pay' ? '' : method === 'google_pay' ? 'G' : '💳'}
              </div>
              <span className="text-sm font-medium text-foreground">
                {method === 'apple_pay' ? 'Apple Pay' : method === 'google_pay' ? 'Google Pay' : 'Card'}
              </span>
            </button>
          ))}
        </div>
      </main>

      <div className="sticky bottom-20 px-5 py-4 bg-background border-t border-border">
        <Button
          onClick={onSubmit}
          disabled={isProcessing}
          className="w-full h-12 text-sm font-medium gap-2"
        >
          {isProcessing ? (
            <>
              <Spinner className="w-4 h-4" />
              Processing...
            </>
          ) : (
            <>
              Authorize {formatCurrency(station.depositAmount)}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// Unlocking Step
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
    <div className="flex flex-col min-h-screen animate-in fade-in duration-150">
      <MobileHeader subtitle={`STATION ${station.id}`} />

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-16 h-16 mb-6">
          <Spinner className="w-full h-full text-primary" />
        </div>

        <h1 className="text-xl font-medium text-foreground mb-2">Unlocking Slot {assignedSlot}</h1>
        <p className="text-sm text-muted-foreground mb-8">Please wait...</p>

        <div className="w-full max-w-xs">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center mt-3">{progress}% complete</p>
        </div>
      </main>
    </div>
  );
}

// Success Step
function SuccessStep({
  station,
  assignedSlot,
  onContinue,
}: {
  station: { id: string };
  assignedSlot: number;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-col min-h-screen animate-in fade-in duration-150">
      <MobileHeader subtitle={`STATION ${station.id}`} />

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <CheckCircleIcon size={32} className="text-primary" />
        </div>

        <h1 className="text-xl font-medium text-foreground mb-2">Slot {assignedSlot} is Open</h1>
        <p className="text-sm text-muted-foreground text-center max-w-xs mb-8">
          Take your power bank now. Your rental timer starts when you remove it.
        </p>

        <div className="w-full max-w-sm bg-card border border-border rounded-lg p-4 mb-8">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Station</span>
            <span className="font-medium text-foreground">{station.id}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-muted-foreground">Slot</span>
            <span className="font-medium text-foreground">{assignedSlot}</span>
          </div>
        </div>

        <Button onClick={onContinue} className="w-full max-w-sm h-12 text-sm font-medium">
          View Rental Status
        </Button>
      </main>
    </div>
  );
}

// Error Step
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
  const config = errorConfigs[error];

  return (
    <div className="flex flex-col min-h-screen animate-in fade-in duration-150">
      <MobileHeader />

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-14 h-14 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
          <XCircleIcon size={24} className="text-destructive" />
        </div>

        <h1 className="text-lg font-medium text-foreground mb-2">{config.title}</h1>
        <p className="text-sm text-muted-foreground text-center max-w-xs mb-8">
          {customMessage || config.description}
        </p>

        <div className="w-full max-w-sm space-y-3">
          <Button onClick={onAction} className="w-full h-12 text-sm font-medium">
            {config.action}
          </Button>
          <Button variant="outline" onClick={onSupport} className="w-full h-12 text-sm font-medium">
            Contact Support
          </Button>
        </div>
      </main>
    </div>
  );
}
