'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { formatDuration, formatCurrency } from '@/lib/session-store';

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
    answer: 'Find any PowerDon station at the venue, insert your power bank into an available slot, and wait for confirmation. The station will automatically detect your return and process your deposit refund.',
  },
  {
    question: 'When will I get my deposit back?',
    answer: 'Your deposit is refunded instantly upon successful return. Depending on your payment method, it may take 1-5 business days to appear in your account.',
  },
  {
    question: 'What if the station is full?',
    answer: 'If a station is full, try a nearby station. Use the "Find Stations" feature to locate other available stations at the venue. Your rental continues until you successfully return.',
  },
  {
    question: 'How do I earn rewards?',
    answer: 'Rent a power bank for at least 60 minutes during an active campaign to qualify for rewards. Your reward will be issued automatically upon return.',
  },
  {
    question: 'What happens if I don\'t return the power bank?',
    answer: 'If not returned within 24 hours, your security deposit will be charged as a replacement fee. We recommend returning as soon as possible to avoid charges.',
  },
  {
    question: 'Can I use multiple power banks at once?',
    answer: 'Each account can only have one active rental at a time. Please return your current power bank before starting a new rental.',
  },
];

const issueCategories: { id: IssueCategory; label: string; icon: typeof PowerBankIcon; description: string }[] = [
  { id: 'rental', label: 'Rental Issues', icon: PowerBankIcon, description: 'Problems starting or during a rental' },
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

  // Toggle FAQ
  const toggleFAQ = (index: number) => {
    setExpandedFAQ(expandedFAQ === index ? null : index);
  };

  // Handle session lookup
  const handleSessionLookup = async () => {
    if (!sessionLookup.trim()) {
      setLookupError('Please enter a session ID');
      return;
    }

    setIsLookingUp(true);
    setLookupError(null);
    setLookupResult(null);

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (!isOnline) {
        throw new Error('Network unavailable');
      }

      // Check if it matches active session
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

  // Validate email
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Handle contact form submission
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

    // Simulate submission
    await new Promise(resolve => setTimeout(resolve, 1500));
    setContactSubmitted(true);
    setIsSubmitting(false);
  };

  // Render issue detail view
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

  // Render contact form
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
      
      <main className="flex-1 px-5 py-6 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <HeadphonesIcon size={32} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">How can we help?</h1>
          <p className="mt-1 text-muted-foreground">
            Find answers or get in touch with our support team.
          </p>
        </motion.div>

        {/* Active Session Banner */}
        {activeSession && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <PowerBankIcon size={20} className="text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Active Rental</p>
                  <p className="text-sm text-muted-foreground">
                    Session {activeSession.sessionCode} - {formatDuration(activeSession.elapsedMinutes)}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate('status')}
                className="text-emerald-700"
              >
                View
              </Button>
            </div>
          </motion.div>
        )}

        {/* Session Lookup */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl border border-border p-4 space-y-3"
        >
          <h2 className="font-semibold text-foreground">Look up your session</h2>
          <p className="text-sm text-muted-foreground">
            Enter your session ID to view details and troubleshoot issues.
          </p>
          <div className="flex gap-2">
            <Input
              value={sessionLookup}
              onChange={(e) => {
                setSessionLookup(e.target.value);
                setLookupError(null);
                setLookupResult(null);
              }}
              placeholder="e.g., VR-882194B"
              className="h-12 rounded-xl font-mono"
              onKeyDown={(e) => e.key === 'Enter' && handleSessionLookup()}
            />
            <Button 
              onClick={handleSessionLookup}
              disabled={isLookingUp || !isOnline}
              className="h-12 px-6 rounded-xl"
            >
              {isLookingUp ? <Spinner className="w-5 h-5" /> : 'Look up'}
            </Button>
          </div>
          {lookupError && (
            <p className="text-sm text-destructive">{lookupError}</p>
          )}
          {lookupResult === 'found' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-emerald-50 text-emerald-800 rounded-xl p-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <CheckCircleIcon size={16} />
                <span className="text-sm">Session found!</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate('status')}
                className="text-emerald-700"
              >
                View Details
              </Button>
            </motion.div>
          )}
          {lookupResult === 'not_found' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-amber-50 text-amber-800 rounded-xl p-3 flex items-center gap-2"
            >
              <XCircleIcon size={16} />
              <span className="text-sm">Session not found. Please check the ID and try again.</span>
            </motion.div>
          )}
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex gap-3"
        >
          <button
            onClick={() => onNavigate('status')}
            className="flex-1 bg-card rounded-2xl border border-border p-4 text-left hover:bg-muted transition-colors"
          >
            <ClockIcon size={20} className="text-primary mb-2" />
            <p className="font-semibold text-foreground text-sm">Check Status</p>
            <p className="text-xs text-muted-foreground">View active rental</p>
          </button>
          <button
            onClick={() => setContactFormVisible(true)}
            className="flex-1 bg-card rounded-2xl border border-border p-4 text-left hover:bg-muted transition-colors"
          >
            <HeadphonesIcon size={20} className="text-primary mb-2" />
            <p className="font-semibold text-foreground text-sm">Contact Us</p>
            <p className="text-xs text-muted-foreground">Get direct help</p>
          </button>
        </motion.div>

        {/* Issue Categories */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          <h2 className="font-semibold text-foreground">What do you need help with?</h2>
          <div className="grid grid-cols-2 gap-3">
            {issueCategories.map((category) => {
              const Icon = category.icon;
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className="bg-card rounded-2xl border border-border p-4 text-left hover:bg-muted transition-colors"
                >
                  <Icon size={20} className="text-primary mb-2" />
                  <p className="font-semibold text-foreground text-sm">{category.label}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{category.description}</p>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-3"
        >
          <h2 className="font-semibold text-foreground">Frequently Asked Questions</h2>
          <div className="space-y-2">
            {faqItems.map((faq, index) => (
              <div
                key={index}
                className="bg-card rounded-xl border border-border overflow-hidden"
              >
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full flex items-center justify-between p-4 text-left"
                  aria-expanded={expandedFAQ === index}
                >
                  <span className="font-medium text-foreground text-sm pr-4">{faq.question}</span>
                  <ChevronDownIcon 
                    size={18} 
                    className={`text-muted-foreground flex-shrink-0 transition-transform ${
                      expandedFAQ === index ? 'rotate-180' : ''
                    }`} 
                  />
                </button>
                <AnimatePresence>
                  {expandedFAQ === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4">
                        <p className="text-sm text-muted-foreground">{faq.answer}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Contact CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-muted rounded-2xl p-5 text-center space-y-3"
        >
          <p className="text-sm text-muted-foreground">
            Still need help? Our support team is available 24/7.
          </p>
          <Button 
            onClick={() => setContactFormVisible(true)}
            variant="outline"
            className="rounded-xl"
          >
            <HeadphonesIcon size={16} />
            Contact Support
          </Button>
        </motion.div>
      </main>
    </div>
  );
}

// Issue Detail View
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
        'Check that your phone\'s Bluetooth and location services are enabled',
        'Make sure you have a stable internet connection',
        'Try refreshing the page and scanning the QR code again',
        'If the slot doesn\'t unlock, try a different available slot',
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
        'Check that your session is still active in the Status tab',
        'If all slots are occupied, try a different station',
      ],
      actions: [
        { label: 'View Active Session', action: () => onNavigate('status') },
      ],
    },
    payment: {
      title: 'Payment & Deposit Help',
      steps: [
        'Deposits are refunded automatically upon successful return',
        'Refunds typically appear within 1-5 business days',
        'Check your bank statement for pending transactions',
        'Ensure your payment method has sufficient funds',
        'Contact your bank if the refund doesn\'t appear after 5 days',
      ],
    },
    reward: {
      title: 'Rewards Help',
      steps: [
        'Rewards are issued automatically after returning your power bank',
        'You must rent for at least 60 minutes to qualify',
        'Check the Rewards tab for your voucher code',
        'Vouchers typically expire at midnight on the day of issue',
        'If your reward didn\'t appear, try refreshing the Rewards page',
      ],
      actions: [
        { label: 'View Rewards', action: () => onNavigate('rewards') },
      ],
    },
    station: {
      title: 'Station Issues',
      steps: [
        'If a station shows as offline, it may be under maintenance',
        'Try scanning the QR code on a different station',
        'Check that the station\'s LED indicators are active',
        'Report malfunctioning stations to help us maintain quality',
        'Use the map feature to find alternative nearby stations',
      ],
    },
    other: {
      title: 'General Support',
      steps: [
        'Check our FAQ section for common questions',
        'Use the session lookup feature to find specific rental details',
        'Our support team typically responds within 1 hour',
        'For urgent issues, include your session ID in your message',
      ],
    },
  };

  const info = troubleshootingSteps[category];
  const Icon = categoryInfo?.icon || HeadphonesIcon;

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <MobileHeader title={categoryInfo?.label || 'Support'} showBack onBack={onBack} />
      
      <main className="flex-1 px-5 py-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
            <Icon size={28} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{info.title}</h1>
            <p className="text-sm text-muted-foreground">{categoryInfo?.description}</p>
          </div>
        </motion.div>

        {!isOnline && (
          <div className="bg-amber-50 text-amber-800 rounded-xl p-4 flex items-center gap-3">
            <XCircleIcon size={20} />
            <p className="text-sm">You appear to be offline. Some actions may not work.</p>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl border border-border p-5 space-y-4"
        >
          <h2 className="font-semibold text-foreground">Try these steps:</h2>
          <ol className="space-y-3">
            {info.steps.map((step, index) => (
              <li key={index} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-foreground">
                  {index + 1}
                </span>
                <span className="text-sm text-muted-foreground pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </motion.div>

        {info.actions && info.actions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-3"
          >
            <h2 className="font-semibold text-foreground">Quick Actions</h2>
            {info.actions.map((action, index) => (
              <Button
                key={index}
                onClick={action.action}
                variant="outline"
                className="w-full h-12 justify-between rounded-xl"
              >
                {action.label}
                <ArrowRightIcon size={16} />
              </Button>
            ))}
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-muted rounded-2xl p-5 text-center space-y-3"
        >
          <p className="text-sm text-muted-foreground">
            Issue not resolved? Contact our support team for personalized help.
          </p>
          <Button onClick={onContactSupport} className="rounded-xl">
            <HeadphonesIcon size={16} />
            Contact Support
          </Button>
        </motion.div>
      </main>
    </div>
  );
}

// Contact Form View
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
        
        <main className="flex-1 flex flex-col items-center justify-center px-5 py-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mb-6"
          >
            <CheckCircleIcon size={40} className="text-emerald-600" />
          </motion.div>

          <div className="text-center max-w-sm">
            <h1 className="text-2xl font-bold text-foreground mb-2">Message Sent</h1>
            <p className="text-muted-foreground">
              We&apos;ve received your message and will get back to you within 1 hour. Check your email for updates.
            </p>
          </div>

          <div className="mt-8 bg-card rounded-xl border border-border p-4 w-full max-w-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Ticket Reference</span>
              <span className="font-mono font-medium text-foreground">{ticketId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <span className="text-sm font-medium text-emerald-600">Submitted</span>
            </div>
          </div>

          <Button 
            onClick={onBack}
            className="mt-8 rounded-xl"
          >
            Back to Support
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <MobileHeader title="Contact Support" showBack onBack={onBack} />
      
      <main className="flex-1 px-5 py-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-xl font-bold text-foreground mb-2">How can we help?</h1>
          <p className="text-sm text-muted-foreground">
            Describe your issue and we&apos;ll get back to you as soon as possible.
          </p>
        </motion.div>

        {activeSessionCode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-primary/5 border border-primary/20 rounded-xl p-3"
          >
            <p className="text-sm text-foreground">
              <span className="font-medium">Active session detected:</span>{' '}
              <span className="font-mono">{activeSessionCode}</span>
            </p>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Your Email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className={`h-12 rounded-xl ${formErrors.email ? 'border-destructive' : ''}`}
            />
            {formErrors.email && (
              <p className="mt-1 text-sm text-destructive">{formErrors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Your Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Please describe your issue in detail. Include your session ID if you have one."
              rows={6}
              className={`w-full px-4 py-3 bg-background border rounded-xl text-base resize-none focus:outline-none focus:ring-2 focus:ring-ring ${formErrors.message ? 'border-destructive' : 'border-input'}`}
            />
            {formErrors.message && (
              <p className="mt-1 text-sm text-destructive">{formErrors.message}</p>
            )}
          </div>

          <div className="bg-muted rounded-xl p-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Tip:</span> Including your session ID (e.g., VR-882194B) helps us resolve your issue faster.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Button 
            onClick={onSubmit}
            disabled={isSubmitting}
            className="w-full h-14 text-base font-semibold rounded-2xl"
          >
            {isSubmitting ? (
              <>
                <Spinner className="w-5 h-5" />
                Sending...
              </>
            ) : (
              'Send Message'
            )}
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center text-sm text-muted-foreground"
        >
          <p>Average response time: &lt; 1 hour</p>
          <p className="mt-1">Available 24/7 during festival hours</p>
        </motion.div>
      </main>
    </div>
  );
}
