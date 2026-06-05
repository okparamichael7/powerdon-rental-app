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
import { getPwaDataLayer } from '@/lib/data';
import type { PublicSessionLookup } from '@/lib/data/pwa-api';
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
    answer: 'If a station is full, try another PowerDon station at the venue (look for QR codes on cabinets). Your rental continues until you successfully return.',
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
  const [lookupSession, setLookupSession] = useState<PublicSessionLookup | null>(null);
  const [contactCategory, setContactCategory] = useState<IssueCategory>('other');
  const [submittedTicketNumber, setSubmittedTicketNumber] = useState<string | null>(null);
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

    if (!isOnline) {
      setLookupError('You are offline. Connect to look up a session.');
      setIsLookingUp(false);
      return;
    }

    try {
      const result = await getPwaDataLayer().lookupSessionByCode(sessionLookup.trim());
      if (result.success && result.session) {
        setLookupSession(result.session);
        setLookupResult('found');
      } else {
        setLookupSession(null);
        setLookupResult('not_found');
      }
    } catch {
      setLookupError('Unable to look up session. Please try again.');
    } finally {
      setIsLookingUp(false);
    }
  };

  const mapCategoryToApi = (category: IssueCategory) => {
    const map: Record<IssueCategory, 'rental_issue' | 'return_issue' | 'payment_issue' | 'reward_issue' | 'station_issue' | 'other'> = {
      rental: 'rental_issue',
      return: 'return_issue',
      payment: 'payment_issue',
      reward: 'reward_issue',
      station: 'station_issue',
      other: 'other',
    };
    return map[category];
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

    if (!isOnline) {
      setFormErrors({ message: 'You are offline. Connect to submit a support request.' });
      return;
    }

    setFormErrors({});
    setIsSubmitting(true);

    try {
      const result = await getPwaDataLayer().submitSupportTicket({
        email: contactEmail.trim(),
        subject: `Support: ${issueCategories.find((c) => c.id === contactCategory)?.label ?? 'General'}`,
        description: contactMessage.trim(),
        category: mapCategoryToApi(contactCategory),
        sessionId: activeSession?.id,
        priority: 'medium',
      });
      if (!result.success) {
        setFormErrors({ message: result.error || 'Failed to submit. Please try again.' });
        return;
      }
      setSubmittedTicketNumber(result.ticketNumber ?? null);
      setContactSubmitted(true);
    } catch {
      setFormErrors({ message: 'Network error. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render issue detail view
  if (selectedCategory) {
    return (
      <IssueDetailView
        category={selectedCategory}
        onBack={() => setSelectedCategory(null)}
        onNavigate={onNavigate}
        onContactSupport={() => {
          setContactCategory(selectedCategory);
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
        ticketNumber={submittedTicketNumber}
        onBack={() => {
          setContactFormVisible(false);
          setContactSubmitted(false);
          setSubmittedTicketNumber(null);
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
          <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
            <HeadphonesIcon size={32} className="text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">How can we help?</h1>
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
            className="bg-emerald-50 border border-emerald-200 rounded-lg p-4"
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
          className="bg-card rounded-lg border border-border p-4 space-y-3"
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
                <span className="text-sm">
                  {lookupSession?.sessionCode} — {lookupSession?.status}
                  {lookupSession?.currentDurationMinutes != null &&
                    ` · ${formatDuration(lookupSession.currentDurationMinutes)}`}
                </span>
              </div>
              {activeSession?.sessionCode === lookupSession?.sessionCode && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigate('status')}
                  className="text-emerald-700"
                >
                  View active rental
                </Button>
              )}
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
            className="flex-1 bg-card rounded-lg border border-border p-4 text-left hover:bg-muted transition-colors"
          >
            <ClockIcon size={20} className="text-primary mb-2" />
            <p className="font-semibold text-foreground text-sm">Check Status</p>
            <p className="text-xs text-muted-foreground">View active rental</p>
          </button>
          <button
            onClick={() => {
              setContactCategory('other');
              setContactFormVisible(true);
            }}
            className="flex-1 bg-card rounded-lg border border-border p-4 text-left hover:bg-muted transition-colors"
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
                  className="bg-card rounded-lg border border-border p-4 text-left hover:bg-muted transition-colors"
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
          className="bg-muted rounded-lg p-5 text-center space-y-3"
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
          <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center">
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
          className="bg-card rounded-lg border border-border p-5 space-y-4"
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
          className="bg-muted rounded-lg p-5 text-center space-y-3"
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
  ticketNumber,
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
  ticketNumber?: string | null;
  onSubmit: () => void;
  onBack: () => void;
}) {
  if (submitted) {
    return (
      <div className="flex flex-col min-h-screen bg-background pb-20">
        <MobileHeader title="Contact Support" showBack onBack={onBack} />
        
        <main className="flex-1 flex flex-col items-center justify-center px-5 py-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="w-20 h-20 bg-emerald-100 rounded-lg flex items-center justify-center mb-6"
          >
            <CheckCircleIcon size={40} className="text-emerald-600" />
          </motion.div>

          <div className="text-center max-w-sm">
            <h1 className="text-xl font-semibold text-foreground mb-2">Message Sent</h1>
            <p className="text-muted-foreground">
              We&apos;ve received your message and will get back to you within 1 hour. Check your email for updates.
            </p>
          </div>

          <div className="mt-8 bg-card rounded-xl border border-border p-4 w-full max-w-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Ticket Reference</span>
              <span className="font-mono font-medium text-foreground">{ticketNumber ?? '—'}</span>
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
            className="w-full h-14 text-base font-semibold rounded-lg"
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

        {/* Response time and status */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-xl border border-border p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Avg. Response Time</span>
            <span className="text-sm font-medium text-foreground">&lt; 1 hour</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Support Status</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-sm font-medium text-emerald-600">Online</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Queue Position</span>
            <span className="text-sm font-medium text-foreground">~3 ahead</span>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
