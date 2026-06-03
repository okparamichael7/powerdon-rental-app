'use client';

import { useState } from 'react';
import { MobileHeader } from '@/components/volt/mobile-header';
import { 
  PowerDonLogo, HeadphonesIcon, ChevronDownIcon, 
  PowerBankIcon, WalletIcon, GiftIcon, MapPinIcon,
  CheckCircleIcon, ClockIcon, XCircleIcon, ArrowRightIcon
} from '@/components/volt/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useAppState } from '@/lib/app-state';
import { formatDuration } from '@/lib/session-store';

interface SupportPageProps {
  isOnline: boolean;
  onNavigate: (tab: 'rent' | 'status' | 'rewards' | 'support') => void;
}

type IssueCategory = 'rental' | 'return' | 'payment' | 'reward' | 'station' | 'other';

interface FAQItem {
  question: string;
  answer: string;
}

const faqItems: FAQItem[] = [
  {
    question: 'How do I return my power bank?',
    answer: 'Find any PowerDon station at the venue, insert your power bank into an available slot, and wait for confirmation.',
  },
  {
    question: 'When will I get my deposit back?',
    answer: 'Your deposit is refunded instantly upon successful return. Depending on your payment method, it may take 1-5 business days to appear.',
  },
  {
    question: 'What if the station is full?',
    answer: 'If a station is full, try a nearby station. Use the "Find Stations" feature to locate other available stations at the venue.',
  },
  {
    question: 'How do I earn rewards?',
    answer: 'Rent a power bank for at least 60 minutes during an active campaign to qualify for rewards.',
  },
  {
    question: 'What happens if I don\'t return the power bank?',
    answer: 'If not returned within 24 hours, your security deposit will be charged as a replacement fee.',
  },
  {
    question: 'Can I use multiple power banks at once?',
    answer: 'Each account can only have one active rental at a time. Return your current power bank before starting a new rental.',
  },
];

const issueCategories: { id: IssueCategory; label: string; icon: typeof PowerBankIcon; description: string }[] = [
  { id: 'rental', label: 'Rental Issues', icon: PowerBankIcon, description: 'Problems starting or during rental' },
  { id: 'return', label: 'Return Issues', icon: MapPinIcon, description: 'Unable to return power bank' },
  { id: 'payment', label: 'Payment & Deposits', icon: WalletIcon, description: 'Charges, refunds, or billing' },
  { id: 'reward', label: 'Rewards & Vouchers', icon: GiftIcon, description: 'Missing or expired rewards' },
  { id: 'station', label: 'Station Problems', icon: PowerDonLogo, description: 'Station offline or malfunctioning' },
  { id: 'other', label: 'Other', icon: HeadphonesIcon, description: 'General questions or feedback' },
];

export function SupportPage({ isOnline, onNavigate }: SupportPageProps) {
  const { activeSession } = useAppState();
  
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<IssueCategory | null>(null);
  const [sessionLookup, setSessionLookup] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<'found' | 'not_found' | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [contactFormVisible, setContactFormVisible] = useState(false);
  const [contactMessage, setContactMessage] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const toggleFAQ = (index: number) => {
    setExpandedFAQ(expandedFAQ === index ? null : index);
  };

  const handleSessionLookup = async () => {
    if (!sessionLookup.trim()) {
      setLookupError('Please enter a session ID');
      return;
    }

    setIsLookingUp(true);
    setLookupError(null);
    setLookupResult(null);

    try {
      await new Promise(resolve => setTimeout(resolve, 500));

      if (!isOnline) throw new Error('Network unavailable');

      if (activeSession && sessionLookup.toUpperCase() === activeSession.sessionCode) {
        setLookupResult('found');
      } else if (sessionLookup.toUpperCase().startsWith('VR-')) {
        setLookupResult('found');
      } else {
        setLookupResult('not_found');
      }
    } catch {
      setLookupError('Unable to look up session. Please try again.');
    } finally {
      setIsLookingUp(false);
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleContactSubmit = async () => {
    const errors: Record<string, string> = {};
    
    if (!contactEmail.trim()) {
      errors.email = 'Email is required';
    } else if (!validateEmail(contactEmail)) {
      errors.email = 'Please enter a valid email';
    }
    
    if (!contactMessage.trim()) {
      errors.message = 'Please describe your issue';
    } else if (contactMessage.trim().length < 10) {
      errors.message = 'Please provide more details';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setContactSubmitted(true);
    setIsSubmitting(false);
  };

  if (selectedCategory) {
    return (
      <IssueDetailView
        category={selectedCategory}
        onBack={() => setSelectedCategory(null)}
        onNavigate={onNavigate}
        onContactSupport={() => {
          setSelectedCategory(null);
          setContactFormVisible(true);
        }}
        isOnline={isOnline}
      />
    );
  }

  if (contactFormVisible) {
    return (
      <ContactFormView
        email={contactEmail}
        setEmail={setContactEmail}
        message={contactMessage}
        setMessage={setContactMessage}
        submitted={contactSubmitted}
        isSubmitting={isSubmitting}
        formErrors={formErrors}
        onSubmit={handleContactSubmit}
        activeSessionCode={activeSession?.sessionCode}
        onBack={() => {
          setContactFormVisible(false);
          setContactSubmitted(false);
          setContactMessage('');
          setContactEmail('');
          setFormErrors({});
        }}
      />
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <MobileHeader subtitle="SUPPORT" />
      
      <main className="flex-1 px-5 py-6 space-y-5 animate-in fade-in duration-150">
        <div className="text-center">
          <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
            <HeadphonesIcon size={28} className="text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">How can we help?</h1>
          <p className="mt-1 text-sm text-muted-foreground">Find answers or contact our team.</p>
        </div>

        {activeSession && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <PowerBankIcon size={18} className="text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">Active Rental</p>
                  <p className="text-xs text-muted-foreground">
                    {activeSession.sessionCode} - {formatDuration(activeSession.elapsedMinutes)}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('status')} className="text-emerald-700">
                View
              </Button>
            </div>
          </div>
        )}

        <div className="bg-card rounded-lg border border-border p-3 space-y-2">
          <h2 className="font-medium text-foreground text-sm">Look up session</h2>
          <div className="flex gap-2">
            <Input
              value={sessionLookup}
              onChange={(e) => {
                setSessionLookup(e.target.value);
                setLookupError(null);
                setLookupResult(null);
              }}
              placeholder="e.g., VR-882194B"
              className="h-10 font-mono text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleSessionLookup()}
            />
            <Button 
              onClick={handleSessionLookup}
              disabled={isLookingUp || !isOnline}
              className="h-10 px-4"
            >
              {isLookingUp ? <Spinner className="w-4 h-4" /> : 'Look up'}
            </Button>
          </div>
          {lookupError && <p className="text-xs text-destructive">{lookupError}</p>}
          {lookupResult === 'found' && (
            <div className="bg-emerald-50 text-emerald-800 rounded-lg p-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CheckCircleIcon size={14} />
                <span className="text-xs">Session found!</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('status')} className="text-emerald-700 h-7 text-xs">
                View
              </Button>
            </div>
          )}
          {lookupResult === 'not_found' && (
            <div className="bg-amber-50 text-amber-800 rounded-lg p-2 flex items-center gap-1.5">
              <XCircleIcon size={14} />
              <span className="text-xs">Session not found. Check the ID.</span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onNavigate('status')}
            className="flex-1 bg-card rounded-lg border border-border p-3 text-left active:bg-muted"
          >
            <ClockIcon size={18} className="text-primary mb-1.5" />
            <p className="font-medium text-foreground text-sm">Check Status</p>
            <p className="text-xs text-muted-foreground">View active rental</p>
          </button>
          <button
            onClick={() => setContactFormVisible(true)}
            className="flex-1 bg-card rounded-lg border border-border p-3 text-left active:bg-muted"
          >
            <HeadphonesIcon size={18} className="text-primary mb-1.5" />
            <p className="font-medium text-foreground text-sm">Contact Us</p>
            <p className="text-xs text-muted-foreground">Get direct help</p>
          </button>
        </div>

        <div className="space-y-2">
          <h2 className="font-medium text-foreground text-sm">What do you need help with?</h2>
          <div className="grid grid-cols-2 gap-2">
            {issueCategories.map((category) => {
              const Icon = category.icon;
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className="bg-card rounded-lg border border-border p-3 text-left active:bg-muted"
                >
                  <Icon size={18} className="text-primary mb-1.5" />
                  <p className="font-medium text-foreground text-sm">{category.label}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">{category.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="font-medium text-foreground text-sm">FAQ</h2>
          <div className="space-y-1.5">
            {faqItems.map((faq, index) => (
              <div key={index} className="bg-card rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full flex items-center justify-between p-3 text-left"
                >
                  <span className="font-medium text-foreground text-sm pr-3">{faq.question}</span>
                  <ChevronDownIcon 
                    size={16} 
                    className={`text-muted-foreground flex-shrink-0 transition-transform duration-150 ${expandedFAQ === index ? 'rotate-180' : ''}`} 
                  />
                </button>
                {expandedFAQ === index && (
                  <div className="px-3 pb-3">
                    <p className="text-sm text-muted-foreground">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-muted rounded-lg p-4 text-center space-y-2">
          <p className="text-xs text-muted-foreground">Still need help? Available 24/7.</p>
          <Button onClick={() => setContactFormVisible(true)} variant="outline" size="sm" className="gap-1.5">
            <HeadphonesIcon size={14} />
            Contact Support
          </Button>
        </div>
      </main>
    </div>
  );
}

function IssueDetailView({
  category,
  onBack,
  onNavigate,
  onContactSupport,
  isOnline,
}: {
  category: IssueCategory;
  onBack: () => void;
  onNavigate: (tab: 'rent' | 'status' | 'rewards' | 'support') => void;
  onContactSupport: () => void;
  isOnline: boolean;
}) {
  const categoryInfo = issueCategories.find(c => c.id === category);
  
  const troubleshootingSteps: Record<IssueCategory, { title: string; steps: string[]; actions?: { label: string; action: () => void }[] }> = {
    rental: {
      title: 'Rental Troubleshooting',
      steps: [
        'Ensure you are within range of the station (within 1 meter)',
        'Check Bluetooth and location services are enabled',
        'Make sure you have a stable internet connection',
        'Try refreshing and scanning the QR code again',
        'If the slot doesn\'t unlock, try a different slot',
      ],
      actions: [
        { label: 'Check Active Rental', action: () => onNavigate('status') },
        { label: 'Start New Rental', action: () => onNavigate('rent') },
      ],
    },
    return: {
      title: 'Return Troubleshooting',
      steps: [
        'Make sure the power bank is fully inserted into the slot',
        'Wait for the LED indicator to turn green (up to 10 seconds)',
        'If the slot doesn\'t accept the bank, try a different slot',
        'Check that your session is still active',
        'If all slots are occupied, try a different station',
      ],
      actions: [{ label: 'View Active Session', action: () => onNavigate('status') }],
    },
    payment: {
      title: 'Payment & Deposit Help',
      steps: [
        'Deposits are refunded automatically upon successful return',
        'Refunds typically appear within 1-5 business days',
        'Check your bank statement for pending transactions',
        'Ensure your payment method has sufficient funds',
        'Contact your bank if refund doesn\'t appear after 5 days',
      ],
    },
    reward: {
      title: 'Rewards Help',
      steps: [
        'Rewards are issued automatically after returning',
        'You must rent for at least 60 minutes to qualify',
        'Check the Rewards tab for your voucher code',
        'Vouchers expire at midnight on the day of issue',
        'If your reward didn\'t appear, try refreshing',
      ],
      actions: [{ label: 'View Rewards', action: () => onNavigate('rewards') }],
    },
    station: {
      title: 'Station Issues',
      steps: [
        'If a station shows offline, it may be under maintenance',
        'Try scanning the QR code on a different station',
        'Check that the station\'s LED indicators are active',
        'Report malfunctioning stations to help us maintain quality',
        'Use the map feature to find alternative stations',
      ],
    },
    other: {
      title: 'General Support',
      steps: [
        'Check our FAQ section for common questions',
        'Use the session lookup to find rental details',
        'Our support team responds within 1 hour',
        'For urgent issues, include your session ID',
      ],
    },
  };

  const info = troubleshootingSteps[category];
  const Icon = categoryInfo?.icon || HeadphonesIcon;

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <MobileHeader title={categoryInfo?.label || 'Support'} showBack onBack={onBack} />
      
      <main className="flex-1 px-5 py-6 space-y-5 animate-in slide-in-from-right-4 duration-200">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
            <Icon size={24} className="text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">{info.title}</h1>
            <p className="text-xs text-muted-foreground">{categoryInfo?.description}</p>
          </div>
        </div>

        {!isOnline && (
          <div className="bg-amber-50 text-amber-800 rounded-lg p-3 flex items-center gap-2">
            <XCircleIcon size={16} />
            <p className="text-xs">You appear to be offline. Some actions may not work.</p>
          </div>
        )}

        <div className="bg-card rounded-lg border border-border p-4 space-y-3">
          <h2 className="font-medium text-foreground text-sm">Try these steps:</h2>
          <ol className="space-y-2">
            {info.steps.map((step, index) => (
              <li key={index} className="flex gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground">
                  {index + 1}
                </span>
                <span className="text-sm text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {info.actions && info.actions.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-medium text-foreground text-sm">Quick Actions</h2>
            {info.actions.map((action, index) => (
              <Button
                key={index}
                onClick={action.action}
                variant="outline"
                className="w-full h-11 justify-between"
              >
                {action.label}
                <ArrowRightIcon size={14} />
              </Button>
            ))}
          </div>
        )}

        <div className="bg-muted rounded-lg p-4 text-center space-y-2">
          <p className="text-xs text-muted-foreground">Issue not resolved?</p>
          <Button onClick={onContactSupport} size="sm" className="gap-1.5">
            <HeadphonesIcon size={14} />
            Contact Support
          </Button>
        </div>
      </main>
    </div>
  );
}

function ContactFormView({
  email,
  setEmail,
  message,
  setMessage,
  submitted,
  isSubmitting,
  formErrors,
  activeSessionCode,
  onSubmit,
  onBack,
}: {
  email: string;
  setEmail: (v: string) => void;
  message: string;
  setMessage: (v: string) => void;
  submitted: boolean;
  isSubmitting: boolean;
  formErrors: Record<string, string>;
  activeSessionCode?: string;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const ticketId = `SUP-${Date.now().toString(36).toUpperCase()}`;

  if (submitted) {
    return (
      <div className="flex flex-col min-h-screen bg-background pb-20">
        <MobileHeader title="Contact Support" showBack onBack={onBack} />
        
        <main className="flex-1 flex flex-col items-center justify-center px-5 py-8 animate-in fade-in duration-150">
          <div className="w-16 h-16 bg-emerald-100 rounded-lg flex items-center justify-center mb-5">
            <CheckCircleIcon size={32} className="text-emerald-600" />
          </div>

          <div className="text-center max-w-sm">
            <h1 className="text-xl font-semibold text-foreground mb-1">Message Sent</h1>
            <p className="text-sm text-muted-foreground">
              We&apos;ll get back to you within 1 hour.
            </p>
          </div>

          <div className="mt-6 bg-card rounded-lg border border-border p-3 w-full max-w-sm space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Ticket</span>
              <span className="font-mono font-medium text-foreground">{ticketId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium text-emerald-600">Submitted</span>
            </div>
          </div>

          <Button onClick={onBack} className="mt-6">
            Back to Support
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <MobileHeader title="Contact Support" showBack onBack={onBack} />
      
      <main className="flex-1 px-5 py-6 space-y-5 animate-in slide-in-from-right-4 duration-200">
        <div>
          <h1 className="text-lg font-bold text-foreground mb-1">How can we help?</h1>
          <p className="text-sm text-muted-foreground">
            Describe your issue and we&apos;ll respond within 1 hour.
          </p>
        </div>

        {activeSessionCode && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5">
            <p className="text-xs text-foreground">
              <span className="font-medium">Active session:</span>{' '}
              <span className="font-mono">{activeSessionCode}</span>
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Your Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className={`h-11 ${formErrors.email ? 'border-destructive' : ''}`}
            />
            {formErrors.email && <p className="mt-1 text-xs text-destructive">{formErrors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Your Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your issue. Include your session ID if you have one."
              rows={5}
              className={`w-full px-3 py-2.5 bg-background border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring ${formErrors.message ? 'border-destructive' : 'border-input'}`}
            />
            {formErrors.message && <p className="mt-1 text-xs text-destructive">{formErrors.message}</p>}
          </div>

          <div className="bg-muted rounded-lg p-3">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Tip:</span> Including your session ID helps us resolve issues faster.
            </p>
          </div>
        </div>

        <Button 
          onClick={onSubmit}
          disabled={isSubmitting}
          className="w-full h-12 text-sm font-medium"
        >
          {isSubmitting ? <><Spinner className="w-4 h-4" /> Sending...</> : 'Send Message'}
        </Button>

        <div className="bg-card rounded-lg border border-border p-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Avg. Response</span>
            <span className="font-medium text-foreground">&lt; 1 hour</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="font-medium text-emerald-600">Online</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
