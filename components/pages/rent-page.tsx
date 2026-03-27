'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MobileHeader } from '@/components/volt/mobile-header';
import { 
  PowerDonLogo, ArrowRightIcon, ShieldCheckIcon, GiftIcon, 
  XCircleIcon, RefreshIcon, CheckCircleIcon, ChevronLeftIcon
} from '@/components/volt/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { useAppState } from '@/lib/app-state';
import { formatCurrency } from '@/lib/session-store';
import { formatTime } from '@/lib/utils';

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
  const { activeSession, currentStation, user, startRental, setUser, setActiveSession } = useAppState();
  
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

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'apple_pay' | 'google_pay'>('card');
  const [isProcessing, setIsProcessing] = useState(false);

  // Unlocking state
  const [unlockProgress, setUnlockProgress] = useState(0);
  const [assignedSlot, setAssignedSlot] = useState<number | null>(null);

  // Initialize page based on state
  useEffect(() => {
    const initPage = async () => {
      setIsLoading(true);
      
      // Simulate loading station data
      await new Promise(resolve => setTimeout(resolve, 500));
      
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

  // Handle payment authorization
  const handlePayment = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (!isOnline) {
        throw new Error('network');
      }

      // Proceed to unlocking
      setStep('unlocking');
      setAssignedSlot(Math.floor(Math.random() * 12) + 1);
      
      // Simulate unlock process
      let progress = 0;
      const interval = setInterval(async () => {
        progress += 10;
        setUnlockProgress(progress);
        
        if (progress >= 100) {
          clearInterval(interval);
          
          // Start the actual rental
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
      }, 400);
    } catch (err) {
      setError('network');
      setStep('error');
    } finally {
      setIsProcessing(false);
    }
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
    return (
      <div className="flex flex-col min-h-screen bg-background pb-20">
        <MobileHeader subtitle="Loading..." />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Spinner className="w-8 h-8 mx-auto text-primary" />
            <p className="text-muted-foreground">Finding your station...</p>
          </div>
        </div>
      </div>
    );
  }

  // Render error state (initial errors)
  if (error && step !== 'error') {
    const config = errorConfigs[error];
    return (
      <div className="flex flex-col min-h-screen bg-background pb-20">
        <MobileHeader />
        <main className="flex-1 flex flex-col items-center justify-center px-5 py-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-8"
          >
            <XCircleIcon size={28} className="text-muted-foreground" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-center max-w-xs"
          >
            <h1 className="text-lg font-medium text-foreground mb-2">{config.title}</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">{config.description}</p>
          </motion.div>

          <div className="w-full max-w-xs space-y-3 mt-10">
            <Button 
              onClick={handleErrorAction}
              className="w-full h-12 text-sm font-medium"
            >
              {config.action}
            </Button>
            <Button
              variant="outline"
              onClick={() => onNavigate('support')}
              className="w-full h-12 text-sm font-medium"
            >
              Contact Support
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Render step content
  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <AnimatePresence mode="wait">
        {step === 'active_warning' && (
          <ActiveWarningStep
            key="active_warning"
            onViewRental={() => onNavigate('status')}
            onContinueAnyway={() => setStep('landing')}
          />
        )}

        {step === 'landing' && currentStation && (
          <LandingStep
            key="landing"
            station={currentStation}
            onStart={() => setStep('info')}
          />
        )}

        {step === 'info' && currentStation && (
          <InfoStep
            key="info"
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
        )}

        {step === 'payment' && currentStation && (
          <PaymentStep
            key="payment"
            station={currentStation}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            isProcessing={isProcessing}
            onBack={() => setStep('info')}
            onSubmit={handlePayment}
          />
        )}

        {step === 'unlocking' && currentStation && (
          <UnlockingStep
            key="unlocking"
            station={currentStation}
            assignedSlot={assignedSlot || 4}
            progress={unlockProgress}
          />
        )}

        {step === 'success' && currentStation && (
          <SuccessStep
            key="success"
            station={currentStation}
            assignedSlot={assignedSlot || 4}
            onContinue={() => onNavigate('status')}
          />
        )}

        {step === 'error' && error && (
          <ErrorStep
            key="error"
            error={error}
            customMessage={errorMessage}
            onAction={handleErrorAction}
            onSupport={() => onNavigate('support')}
          />
        )}
      </AnimatePresence>
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col min-h-screen"
    >
      <MobileHeader />
      
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-8"
        >
          <PowerDonLogo size={28} className="text-foreground" />
        </motion.div>

        <div className="text-center max-w-xs mb-10">
          <h1 className="text-lg font-medium text-foreground mb-2">Active Rental</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You have an active rental. View its status or continue browsing.
          </p>
        </div>

        <div className="w-full max-w-sm space-y-3">
          <Button 
            onClick={onViewRental}
            className="w-full h-12 text-sm font-medium"
          >
            View Active Rental
          </Button>
          <Button
            variant="outline"
            onClick={onContinueAnyway}
            className="w-full h-12 text-sm font-medium"
          >
            Continue Browsing
          </Button>
        </div>
      </main>
    </motion.div>
  );
}

// Landing Step Component
function LandingStep({ 
  station, 
  onStart 
}: { 
  station: { id: string; campaignName: string; hourlyRate: number; depositAmount: number; rewardDescription: string; availableSlots: number };
  onStart: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col min-h-screen"
    >
      <MobileHeader subtitle={`${station.campaignName.toUpperCase()} • STATION ${station.id}`} />
      
      <main className="flex-1 flex flex-col">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative w-full aspect-[4/3] overflow-hidden"
        >
          <img 
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/powerbanks.png-n6OHfLGwW8PS0RkEAFHCgSp1h0fhk6.jpeg"
            alt="PowerDon power banks"
            className="w-full h-full object-cover"
          />
        </motion.div>

        <div className="flex-1 px-6 py-8 space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-center"
          >
            <h1 className="text-2xl font-medium text-foreground">Stay charged.</h1>
            <p className="mt-2 text-sm text-muted-foreground text-balance leading-relaxed">
              Rent a power bank in seconds.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between py-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Rate</p>
                <p className="text-xl font-medium text-foreground mt-1">
                  {formatCurrency(station.hourlyRate)}
                  <span className="text-sm font-normal text-muted-foreground">/hr</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Deposit</p>
                <p className="text-xl font-medium text-foreground mt-1">{formatCurrency(station.depositAmount)}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Refundable</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-muted rounded-md p-4"
          >
            <div className="flex items-start gap-3">
              <GiftIcon size={18} className="text-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Merch Reward</p>
                <p className="text-xs text-muted-foreground mt-0.5">{station.rewardDescription}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-4"
          >
            <div className="space-y-3">
              {[
                { step: 1, title: 'Scan', desc: 'Start your rental' },
                { step: 2, title: 'Unlock', desc: 'Pick up your power bank' },
                { step: 3, title: 'Return', desc: 'Drop at any station' },
              ].map((item) => (
                <div key={item.step} className="flex items-center gap-4">
                  <span className="w-6 h-6 rounded-full bg-foreground text-background text-xs font-medium flex items-center justify-center flex-shrink-0">
                    {item.step}
                  </span>
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

        </div>

        <div className="sticky bottom-20 px-6 pb-8 pt-4 bg-gradient-to-t from-background via-background to-transparent">
          <Button 
            onClick={onStart}
            className="w-full h-12 text-sm font-medium"
          >
            Start rental
            <ArrowRightIcon size={16} />
          </Button>
          <p className="text-center text-xs text-muted-foreground mt-3">
            {station.availableSlots} slots available
          </p>
        </div>
      </main>
    </motion.div>
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
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col min-h-screen"
    >
      <MobileHeader title="Your Info" showBack onBack={onBack} />
      
      <main className="flex-1 px-6 py-8 space-y-8">
        <div>
          <h1 className="text-lg font-medium text-foreground">Your details</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your email to continue.
          </p>
        </div>

        <div className="flex items-center justify-between py-4 border-b border-border/50">
          <div>
            <p className="text-xs text-muted-foreground">Rate</p>
            <p className="text-sm font-medium text-foreground">{formatCurrency(station.hourlyRate)}/hr</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Deposit</p>
            <p className="text-sm font-medium text-foreground">{formatCurrency(station.depositAmount)}</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-xs text-muted-foreground mb-2">
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={formErrors.email ? 'border-destructive' : ''}
              aria-invalid={!!formErrors.email}
              aria-describedby={formErrors.email ? 'email-error' : undefined}
            />
            {formErrors.email && (
              <p id="email-error" className="mt-1.5 text-xs text-destructive">{formErrors.email}</p>
            )}
          </div>

          <div>
            <label htmlFor="name" className="block text-xs text-muted-foreground mb-2">
              Name <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <Input
              id="name"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3">
              <Checkbox
                id="terms"
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                className="mt-0.5"
                aria-invalid={!!formErrors.terms}
              />
              <label htmlFor="terms" className="text-xs text-muted-foreground cursor-pointer leading-relaxed">
                I agree to the{' '}
                <a href="#" className="text-foreground underline">Terms</a>
                {' '}and{' '}
                <a href="#" className="text-foreground underline">Privacy Policy</a>
              </label>
            </div>
            {formErrors.terms && (
              <p className="text-xs text-destructive ml-7">{formErrors.terms}</p>
            )}

            <div className="flex items-start gap-3">
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

        <div className="pt-6">
          <Button 
            onClick={onSubmit}
            className="w-full h-12 text-sm font-medium"
          >
            Continue
            <ArrowRightIcon size={16} />
          </Button>
        </div>
      </main>
    </motion.div>
  );
}

// Payment Step Component
function PaymentStep({
  station,
  paymentMethod,
  setPaymentMethod,
  isProcessing,
  onBack,
  onSubmit,
}: {
  station: { depositAmount: number };
  paymentMethod: 'card' | 'apple_pay' | 'google_pay';
  setPaymentMethod: (v: 'card' | 'apple_pay' | 'google_pay') => void;
  isProcessing: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col min-h-screen"
    >
      <MobileHeader title="Payment" showBack onBack={onBack} />
      
      <main className="flex-1 px-5 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Authorize payment</h1>
          <p className="mt-1 text-muted-foreground">
            A hold will be placed on your card. You&apos;ll only be charged for actual usage.
          </p>
        </div>

        <div className="bg-card rounded-lg border border-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Security deposit</span>
            <span className="font-bold text-foreground">{formatCurrency(station.depositAmount)}</span>
          </div>
          <div className="border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              This amount will be held on your card and refunded when you return the power bank. 
              Actual charges will be calculated based on your rental duration.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-medium text-foreground uppercase tracking-wide">Payment Method</h2>
          
          <button
            onClick={() => setPaymentMethod('apple_pay')}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-colors ${
              paymentMethod === 'apple_pay' ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          >
            <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center text-white text-sm font-semibold">
              Pay
            </div>
            <div className="text-left">
              <p className="font-medium text-foreground">Apple Pay</p>
              <p className="text-sm text-muted-foreground">Fast and secure</p>
            </div>
            {paymentMethod === 'apple_pay' && (
              <CheckCircleIcon size={20} className="ml-auto text-primary" />
            )}
          </button>

          <button
            onClick={() => setPaymentMethod('google_pay')}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-colors ${
              paymentMethod === 'google_pay' ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          >
            <div className="w-10 h-10 bg-white border border-border rounded-lg flex items-center justify-center text-sm font-semibold">
              G
            </div>
            <div className="text-left">
              <p className="font-medium text-foreground">Google Pay</p>
              <p className="text-sm text-muted-foreground">Fast checkout</p>
            </div>
            {paymentMethod === 'google_pay' && (
              <CheckCircleIcon size={20} className="ml-auto text-primary" />
            )}
          </button>

          <button
            onClick={() => setPaymentMethod('card')}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-colors ${
              paymentMethod === 'card' ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          >
            <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
              <svg width="20" height="16" viewBox="0 0 20 16" fill="none" className="text-muted-foreground">
                <rect x="1" y="1" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
                <path d="M1 5H19" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <div className="text-left">
              <p className="font-medium text-foreground">Credit or Debit Card</p>
              <p className="text-sm text-muted-foreground">Visa, Mastercard, Amex</p>
            </div>
            {paymentMethod === 'card' && (
              <CheckCircleIcon size={20} className="ml-auto text-primary" />
            )}
          </button>
        </div>

        <div className="pt-4">
          <Button 
            onClick={onSubmit}
            disabled={isProcessing}
            className="w-full h-12 text-sm font-medium"
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
          <p className="text-center text-xs text-muted-foreground mt-3">
            <ShieldCheckIcon size={12} className="inline mr-1" />
            Secure payment powered by Stripe
          </p>
        </div>
      </main>
    </motion.div>
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col min-h-screen"
    >
      <MobileHeader subtitle="UNLOCKING" />
      
      <main className="flex-1 flex flex-col items-center justify-center px-5 py-8">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 mb-6"
        >
          <RefreshIcon size={64} className="text-primary" />
        </motion.div>

        <div className="text-center mb-8">
          <p className="text-xs font-medium tracking-wider text-primary uppercase mb-2">Unlocking Power Bank</p>
          <h1 className="text-xl font-semibold text-foreground">Please wait...</h1>
          <p className="mt-2 text-muted-foreground">
            The power bank at slot {assignedSlot} is being released.
          </p>
        </div>

        <div className="w-full max-w-sm">
          <div className="bg-muted rounded-full h-3 overflow-hidden mb-4">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
            />
          </div>
          
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Station</span>
              <span className="font-mono text-foreground">{station.id}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-muted-foreground">Slot</span>
              <span className="font-mono font-bold text-primary">{String(assignedSlot).padStart(2, '0')}</span>
            </div>
          </div>
        </div>
      </main>
    </motion.div>
  );
}

// Success Step Component
function SuccessStep({
  station,
  assignedSlot,
  onContinue,
}: {
  station: { id: string; campaignName: string };
  assignedSlot: number;
  onContinue: () => void;
}) {
  const sessionCode = `VR-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  const startTime = new Date();
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col min-h-screen"
    >
      <MobileHeader subtitle="CONFIRMED" />
      
      <main className="flex-1 flex flex-col items-center justify-center px-5 py-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6"
        >
          <CheckCircleIcon size={48} className="text-emerald-600" />
        </motion.div>

        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">You&apos;re all set!</h1>
          <p className="text-muted-foreground">
            Your power bank is ready. Pick it up from slot {assignedSlot} at station {station.id}.
          </p>
        </div>

        {/* Slot Collection Card */}
        <div className="bg-card rounded-lg border border-border overflow-hidden w-full max-w-sm mb-4">
          <div className="px-4 py-3 bg-muted/50 border-b border-border">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Collect from</span>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-emerald-600">Ready</span>
              </div>
            </div>
          </div>
          <div className="p-5 text-center">
            <p className="text-5xl font-bold text-primary">Slot {String(assignedSlot).padStart(2, '0')}</p>
            <p className="text-sm text-muted-foreground mt-2">Station {station.id} • {station.campaignName}</p>
          </div>
        </div>

        {/* Session Details */}
        <div className="bg-muted/50 rounded-xl p-3 w-full max-w-sm mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Session ID</span>
            <span className="font-mono font-medium text-foreground">{sessionCode}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-muted-foreground">Started</span>
            <span className="text-foreground">{formatTime(startTime)}</span>
          </div>
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 w-full max-w-sm mb-6">
          <div className="flex items-start gap-3">
            <GiftIcon size={20} className="text-primary flex-shrink-0 mt-0.5" />
            <p className="text-sm text-foreground">
              <span className="font-semibold">Remember:</span> Rent for at least 60 minutes to earn your free merch voucher!
            </p>
          </div>
        </div>

        <div className="w-full max-w-sm">
          <Button 
            onClick={onContinue}
            className="w-full h-12 text-sm font-medium"
          >
            View Rental Status
            <ArrowRightIcon size={18} />
          </Button>
        </div>
      </main>
    </motion.div>
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col min-h-screen"
    >
      <MobileHeader subtitle="ERROR" />
      
      <main className="flex-1 flex flex-col items-center justify-center px-5 py-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-20 h-20 bg-destructive/10 rounded-lg flex items-center justify-center mb-6"
        >
          <XCircleIcon size={40} className="text-destructive" />
        </motion.div>

        <div className="text-center max-w-sm mb-4">
          <h1 className="text-xl font-semibold text-foreground mb-2">{config.title}</h1>
          <p className="text-muted-foreground">{customMessage || config.description}</p>
        </div>

        {/* Error Reference */}
        <div className="bg-muted/50 rounded-lg px-3 py-2 mb-4">
          <span className="text-xs text-muted-foreground">Reference: </span>
          <span className="font-mono text-xs text-foreground">{errorCode}</span>
        </div>

        {/* Troubleshooting Tips */}
        <div className="bg-card rounded-xl border border-border p-4 w-full max-w-sm mb-6">
          <p className="text-sm font-medium text-foreground mb-3">Quick troubleshooting:</p>
          <ul className="space-y-2">
            {troubleshootingTips[error].map((tip, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-primary font-medium">{index + 1}.</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="w-full max-w-sm space-y-3">
          <Button 
            onClick={onAction}
            className="w-full h-12 text-sm font-medium"
          >
            <RefreshIcon size={18} />
            {config.action}
          </Button>
          <Button
            variant="outline"
            onClick={onSupport}
            className="w-full h-12 text-sm font-medium"
          >
            Contact Support
          </Button>
        </div>
      </main>
    </motion.div>
  );
}
