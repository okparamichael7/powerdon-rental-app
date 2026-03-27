'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MobileHeader } from '@/components/volt/mobile-header';
import { 
  PowerDonLogo, ArrowRightIcon, ShieldCheckIcon, GiftIcon, 
  XCircleIcon, RefreshIcon, LightbulbIcon, CheckCircleIcon 
} from '@/components/volt/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { 
  mockStation, 
  formatCurrency,
  type StationInfo,
  type UserInfo,
  type ActiveSession,
} from '@/lib/session-store';

type RentStep = 'landing' | 'info' | 'payment' | 'unlocking' | 'success' | 'error';
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
  const [step, setStep] = useState<RentStep>('landing');
  const [station, setStation] = useState<StationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ErrorType | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // User info form state
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'apple_pay' | 'google_pay'>('card');
  const [isProcessing, setIsProcessing] = useState(false);

  // Unlocking state
  const [unlockProgress, setUnlockProgress] = useState(0);
  const [assignedSlot, setAssignedSlot] = useState<number | null>(null);

  // Load station data
  const loadStation = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));

      if (!isOnline) {
        throw new Error('network');
      }

      // Check for active session (demo: randomly simulate)
      const hasActiveSession = false; // In production, check API
      if (hasActiveSession) {
        setError('duplicate_session');
        setIsLoading(false);
        return;
      }

      // Simulate occasional station unavailability for demo
      if (retryCount === 0 && Math.random() < 0.1) {
        setError('station_unavailable');
        setIsLoading(false);
        return;
      }

      setStation(mockStation);
    } catch {
      setError('network');
    } finally {
      setIsLoading(false);
    }
  }, [isOnline, retryCount]);

  useEffect(() => {
    loadStation();
  }, [loadStation]);

  // Validate email
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
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

      // Simulate occasional payment failure for demo
      if (Math.random() < 0.1) {
        setError('payment_failed');
        setStep('error');
        return;
      }

      // Payment successful, proceed to unlocking
      setStep('unlocking');
      setAssignedSlot(Math.floor(Math.random() * 12) + 1);
      
      // Simulate unlock process
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        setUnlockProgress(progress);
        
        if (progress >= 100) {
          clearInterval(interval);
          // Simulate occasional unlock failure
          if (Math.random() < 0.05) {
            setError('unlock_failed');
            setStep('error');
          } else {
            setStep('success');
          }
        }
      }, 400);
    } catch {
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
      setRetryCount(prev => prev + 1);
      setError(null);
      if (step === 'error') {
        setStep('landing');
        loadStation();
      }
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

  // Render error state
  if (error && step !== 'error') {
    const config = errorConfigs[error];
    return (
      <div className="flex flex-col min-h-screen bg-background pb-20">
        <MobileHeader />
        <main className="flex-1 flex flex-col items-center justify-center px-5 py-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-20 h-20 bg-destructive/10 rounded-2xl flex items-center justify-center mb-6"
          >
            <XCircleIcon size={40} className="text-destructive" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-center max-w-sm"
          >
            <h1 className="text-2xl font-bold text-foreground mb-2">{config.title}</h1>
            <p className="text-muted-foreground">{config.description}</p>
          </motion.div>

          <div className="w-full max-w-sm space-y-3 mt-8">
            <Button 
              onClick={handleErrorAction}
              className="w-full h-14 text-base font-semibold rounded-2xl bg-primary hover:bg-primary/90"
            >
              {config.action}
            </Button>
            <Button
              variant="outline"
              onClick={() => onNavigate('support')}
              className="w-full h-14 text-base font-semibold rounded-2xl"
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
        {step === 'landing' && station && (
          <LandingStep
            key="landing"
            station={station}
            onStart={() => setStep('info')}
          />
        )}

        {step === 'info' && station && (
          <InfoStep
            key="info"
            station={station}
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

        {step === 'payment' && station && (
          <PaymentStep
            key="payment"
            station={station}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            isProcessing={isProcessing}
            onBack={() => setStep('info')}
            onSubmit={handlePayment}
          />
        )}

        {step === 'unlocking' && station && (
          <UnlockingStep
            key="unlocking"
            station={station}
            assignedSlot={assignedSlot || 4}
            progress={unlockProgress}
            onCancel={() => {
              setStep('landing');
              setUnlockProgress(0);
            }}
          />
        )}

        {step === 'success' && station && (
          <SuccessStep
            key="success"
            station={station}
            assignedSlot={assignedSlot || 4}
            onContinue={() => onNavigate('status')}
          />
        )}

        {step === 'error' && error && (
          <ErrorStep
            key="error"
            error={error}
            onAction={handleErrorAction}
            onSupport={() => onNavigate('support')}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Landing Step Component
function LandingStep({ 
  station, 
  onStart 
}: { 
  station: StationInfo; 
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

        <div className="flex-1 px-5 py-6 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-center"
          >
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Stay charged.</h1>
            <p className="mt-2 text-muted-foreground text-balance">
              Rent a high-capacity power bank in seconds and never miss a moment of {station.campaignName}.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card rounded-2xl border border-border p-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Festival Rate</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(station.hourlyRate)}
                  <span className="text-base font-normal text-muted-foreground">/hr</span>
                </p>
              </div>
              <div className="h-10 w-px bg-border" />
              <div className="text-right">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Deposit</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(station.depositAmount)}</p>
                <p className="text-xs font-medium text-primary uppercase">Refundable</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-primary text-primary-foreground rounded-2xl p-4"
          >
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-primary-foreground/10 rounded-xl flex-shrink-0">
                <GiftIcon size={20} />
              </div>
              <div>
                <p className="font-semibold">{station.campaignName} Merch Reward</p>
                <p className="text-sm text-primary-foreground/80">{station.rewardDescription}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-4"
          >
            <h2 className="text-xs font-medium tracking-wider text-muted-foreground uppercase text-center">
              How It Works
            </h2>
            <div className="space-y-4">
              {[
                { step: 1, title: 'Scan to Start', desc: "Scan the station QR or tap 'Start' to begin your rental journey." },
                { step: 2, title: 'Unlock Power Bank', desc: `Pick up your designated PowerDon power bank from the assigned slot.` },
                { step: 3, title: 'Return Anywhere', desc: `Drop the bank at any ${station.campaignName} station when you're done.` },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-foreground font-semibold text-sm flex-shrink-0">
                    {item.step}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center justify-center gap-6 py-2"
          >
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <ShieldCheckIcon size={16} />
              <span className="text-xs font-medium uppercase tracking-wide">Secure SSL</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <PowerDonLogo size={16} />
              <span className="text-xs font-medium uppercase tracking-wide">No Hidden Fees</span>
            </div>
          </motion.div>
        </div>

        <div className="sticky bottom-20 p-5 pb-8 bg-gradient-to-t from-background via-background to-transparent">
          <Button 
            onClick={onStart}
            className="w-full h-14 text-base font-semibold rounded-2xl bg-primary hover:bg-primary/90"
          >
            Start rental
            <ArrowRightIcon size={18} />
          </Button>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-muted-foreground">
              STATION {station.id} • {station.availableSlots} slots available
            </span>
          </div>
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
  station: StationInfo;
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
      
      <main className="flex-1 px-5 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Complete your profile</h1>
          <p className="mt-1 text-muted-foreground">
            Enter your details to start your rental at {station.campaignName}.
          </p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-xl">
              <PowerDonLogo size={24} className="text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Active Rate</span>
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Refundable Deposit</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-lg font-bold text-foreground">{formatCurrency(station.hourlyRate)}/hour</span>
                <span className="text-lg font-bold text-foreground">{formatCurrency(station.depositAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2 uppercase tracking-wide">
              Email Address
            </label>
            <Input
              id="email"
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`h-14 text-base rounded-xl ${formErrors.email ? 'border-destructive' : ''}`}
              aria-invalid={!!formErrors.email}
              aria-describedby={formErrors.email ? 'email-error' : undefined}
            />
            {formErrors.email && (
              <p id="email-error" className="mt-1 text-sm text-destructive">{formErrors.email}</p>
            )}
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2 uppercase tracking-wide">
              Full Name <span className="text-muted-foreground font-normal">(Optional)</span>
            </label>
            <Input
              id="name"
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-14 text-base rounded-xl"
            />
          </div>
        </div>

        <div className="bg-secondary rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-primary/20 rounded-xl flex-shrink-0">
              <GiftIcon size={18} className="text-primary" />
            </div>
            <p className="text-sm">
              <span className="font-semibold text-primary">Festival Reward:</span>{' '}
              <span className="text-muted-foreground">{station.rewardDescription}</span>
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="terms"
              checked={termsAccepted}
              onCheckedChange={(checked) => setTermsAccepted(checked === true)}
              className="mt-1"
              aria-describedby={formErrors.terms ? 'terms-error' : undefined}
            />
            <label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer">
              I agree to the <button type="button" className="text-primary hover:underline">Terms</button> and{' '}
              <button type="button" className="text-primary hover:underline">Privacy Policy</button>
            </label>
          </div>
          {formErrors.terms && (
            <p id="terms-error" className="text-sm text-destructive ml-7">{formErrors.terms}</p>
          )}

          <div className="flex items-start gap-3">
            <Checkbox
              id="marketing"
              checked={marketingConsent}
              onCheckedChange={(checked) => setMarketingConsent(checked === true)}
              className="mt-1"
            />
            <label htmlFor="marketing" className="text-sm text-muted-foreground cursor-pointer">
              Keep me updated with festival rewards and news
            </label>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <ShieldCheckIcon size={14} />
          <span className="text-xs font-medium uppercase tracking-wide">Secure Encrypted Transaction</span>
        </div>
      </main>

      <div className="sticky bottom-20 p-5 pb-8 bg-gradient-to-t from-background via-background to-transparent">
        <Button 
          onClick={onSubmit}
          className="w-full h-14 text-base font-semibold rounded-2xl bg-primary hover:bg-primary/90"
        >
          Continue to Payment
          <ArrowRightIcon size={18} />
        </Button>
      </div>
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
  station: StationInfo;
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
      <MobileHeader title="Secure Payment" showBack onBack={onBack} showSecure />
      
      <main className="flex-1 px-5 py-6 space-y-6">
        <div className="bg-secondary text-secondary-foreground rounded-full py-2 px-4 flex items-center justify-center gap-2">
          <ShieldCheckIcon size={16} className="text-primary" />
          <span className="text-sm font-medium uppercase tracking-wide">Refund Protection Enabled</span>
        </div>

        <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Order Summary</h2>
            <span className="text-xs font-medium px-2 py-1 bg-primary/10 text-primary rounded-full uppercase">Hold</span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Security Deposit</span>
              <span className="font-medium text-foreground">{formatCurrency(station.depositAmount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Processing Fee</span>
              <span className="font-medium text-primary uppercase">Free</span>
            </div>
            <div className="border-t border-dashed border-border pt-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">To Authorize</span>
                <span className="text-2xl font-bold text-foreground">{formatCurrency(station.depositAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-xl flex-shrink-0">
              <ShieldCheckIcon size={18} className="text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">100% Refundable Deposit</p>
              <p className="text-sm text-muted-foreground">
                This amount is temporarily held to unlock the power bank. It returns to your account instantly upon return.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-around py-2">
            {[
              { label: 'Return Bank', active: false },
              { label: 'To Station', active: false },
              { label: 'Instant Refund', active: true },
            ].map((step, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  step.active ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                }`}>
                  {i === 0 && <ArrowRightIcon size={16} className="rotate-180" />}
                  {i === 1 && <PowerDonLogo size={16} />}
                  {i === 2 && <CheckCircleIcon size={16} />}
                </div>
                <span className={`text-xs font-medium uppercase ${
                  step.active ? 'text-primary' : 'text-muted-foreground'
                }`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Current Rental Rates</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <PowerDonLogo size={14} className="text-primary" />
              </div>
              <div>
                <p className="font-bold text-foreground">{formatCurrency(station.hourlyRate)}</p>
                <p className="text-xs text-muted-foreground">per hour</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <GiftIcon size={14} className="text-primary" />
              </div>
              <div>
                <p className="font-bold text-foreground">{formatCurrency(station.dailyCap)}</p>
                <p className="text-xs text-muted-foreground">daily cap</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 text-muted-foreground">
          <div className="flex items-center gap-1">
            <ShieldCheckIcon size={12} />
            <span className="text-xs uppercase tracking-wide">Visa Secure</span>
          </div>
          <div className="flex items-center gap-1">
            <ShieldCheckIcon size={12} />
            <span className="text-xs uppercase tracking-wide">Mastercard ID</span>
          </div>
          <div className="flex items-center gap-1">
            <ShieldCheckIcon size={12} />
            <span className="text-xs uppercase tracking-wide">256-bit SSL</span>
          </div>
        </div>
      </main>

      <div className="sticky bottom-20 p-5 pb-8 bg-gradient-to-t from-background via-background to-transparent space-y-3">
        <Button 
          variant="outline"
          className="w-full h-14 text-base font-semibold rounded-2xl"
          onClick={() => setPaymentMethod('apple_pay')}
          disabled={isProcessing}
        >
          Apple Pay / Google Pay
        </Button>
        <Button 
          onClick={onSubmit}
          className="w-full h-14 text-base font-semibold rounded-2xl bg-primary hover:bg-primary/90"
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <Spinner className="w-5 h-5" />
              Processing...
            </>
          ) : (
            <>
              Authorize & Unlock
              <PowerDonLogo size={18} />
            </>
          )}
        </Button>
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <button type="button" className="hover:text-foreground">Credit Card</button>
          <span>|</span>
          <button type="button" className="hover:text-foreground">Google Pay</button>
        </div>
      </div>
    </motion.div>
  );
}

// Unlocking Step Component
function UnlockingStep({
  station,
  assignedSlot,
  progress,
  onCancel,
}: {
  station: StationInfo;
  assignedSlot: number;
  progress: number;
  onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col min-h-screen"
    >
      <MobileHeader title="Unlocking" />
      
      <main className="flex-1 flex flex-col items-center justify-center px-5 py-8">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 mb-6"
        >
          <RefreshIcon size={64} className="text-primary" />
        </motion.div>

        <div className="text-center mb-8">
          <p className="text-xs font-medium tracking-wider text-primary uppercase mb-2">Connecting</p>
          <h1 className="text-2xl font-bold text-foreground">Unlocking...</h1>
          <p className="mt-2 text-muted-foreground">
            Securely connecting to <span className="font-semibold text-foreground">{station.campaignName} Charging Station</span>. Stand by your slot.
          </p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-5 w-full max-w-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Station ID</p>
              <p className="text-xl font-bold text-primary">{station.id}</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-right">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Target Slot</p>
              <p className="text-xl font-bold text-primary">Slot {String(assignedSlot).padStart(2, '0')}</p>
            </div>
          </div>

          <div className="bg-secondary rounded-xl p-4">
            <div className="flex items-start gap-3">
              <LightbulbIcon size={20} className="text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">Look for the flashing light</p>
                <p className="text-sm text-muted-foreground">
                  The LED on Slot {String(assignedSlot).padStart(2, '0')} will pulse blue when your power bank is ready to pull.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 bg-muted rounded-full h-2 overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="mt-auto pt-8 w-full max-w-sm space-y-3">
          <p className="text-center text-sm text-muted-foreground">
            Taking too long? <button type="button" className="text-primary hover:underline">Try again</button>
          </p>
          <Button 
            variant="secondary"
            onClick={onCancel}
            className="w-full h-14 text-base font-semibold rounded-2xl bg-foreground text-background hover:bg-foreground/90"
          >
            <XCircleIcon size={18} />
            Cancel Request
          </Button>
          <button type="button" className="flex items-center justify-center gap-2 w-full text-muted-foreground hover:text-foreground">
            <span className="text-sm">Contact Support</span>
          </button>
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
  station: StationInfo;
  assignedSlot: number;
  onContinue: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col min-h-screen"
    >
      <MobileHeader />
      
      <main className="flex-1 flex flex-col items-center justify-center px-5 py-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-24 h-24 bg-emerald-100 rounded-3xl flex items-center justify-center mb-6"
        >
          <CheckCircleIcon size={48} className="text-emerald-600" />
        </motion.div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">Power Bank Unlocked!</h1>
          <p className="mt-2 text-muted-foreground">
            Pull your power bank from <span className="font-semibold text-foreground">Slot {String(assignedSlot).padStart(2, '0')}</span> at <span className="font-semibold text-foreground">{station.name}</span>.
          </p>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 w-full max-w-sm mb-8">
          <p className="text-sm text-emerald-800 text-center">
            Your rental has started. Enjoy your charge!
          </p>
        </div>

        <div className="w-full max-w-sm">
          <Button 
            onClick={onContinue}
            className="w-full h-14 text-base font-semibold rounded-2xl bg-primary hover:bg-primary/90"
          >
            View Active Rental
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
  onAction,
  onSupport,
}: {
  error: ErrorType;
  onAction: () => void;
  onSupport: () => void;
}) {
  const config = errorConfigs[error];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col min-h-screen"
    >
      <MobileHeader />
      
      <main className="flex-1 flex flex-col items-center justify-center px-5 py-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-20 h-20 bg-destructive/10 rounded-2xl flex items-center justify-center mb-6"
        >
          <XCircleIcon size={40} className="text-destructive" />
        </motion.div>

        <div className="text-center max-w-sm mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">{config.title}</h1>
          <p className="text-muted-foreground">{config.description}</p>
        </div>

        <div className="bg-muted rounded-xl p-4 w-full max-w-sm mb-8">
          <p className="text-xs font-mono text-muted-foreground">
            Error Code: {error.toUpperCase().replace('_', '-')}-001
          </p>
        </div>

        <div className="w-full max-w-sm space-y-3">
          <Button 
            onClick={onAction}
            className="w-full h-14 text-base font-semibold rounded-2xl bg-primary hover:bg-primary/90"
          >
            {config.action}
          </Button>
          <Button
            variant="outline"
            onClick={onSupport}
            className="w-full h-14 text-base font-semibold rounded-2xl"
          >
            Contact Support
          </Button>
        </div>
      </main>
    </motion.div>
  );
}
