'use client';

import { useState } from 'react';
import { MobileHeader } from '@/components/volt/mobile-header';
import {
  PwaScreen,
  PwaBody,
  PwaScrollBody,
  PwaActionBar,
  PwaCenteredState,
  PwaSection,
  PwaListGroup,
  PwaListRow,
} from '@/components/pwa/pwa-screen';
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

function PwaNavRow({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: typeof PowerBankIcon;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full min-h-[44px] items-center gap-3 px-4 py-3 text-left active:bg-muted/60 transition-colors"
    >
      <Icon size={18} className="shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <ArrowRightIcon size={16} className="shrink-0 text-muted-foreground" />
    </button>
  );
}

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
    <PwaScreen>
      <MobileHeader statusBadge="Support" />

      <PwaScrollBody className="space-y-4 py-3">
        <div>
          <h1 className="text-base font-semibold text-foreground">How can we help?</h1>
          <p className="text-xs text-muted-foreground">
            Find answers or get in touch with our support team.
          </p>
        </div>

        {activeSession && (
          <button
            type="button"
            onClick={() => onNavigate('status')}
            className="flex w-full items-center gap-3 rounded-xl border border-volt-success/25 bg-volt-success/10 px-3 py-2.5 text-left active:bg-volt-success/15 transition-colors"
          >
            <PowerBankIcon size={16} className="shrink-0 text-volt-success" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Active rental</p>
              <p className="text-xs text-muted-foreground">
                {activeSession.sessionCode} · {formatDuration(activeSession.elapsedMinutes)}
              </p>
            </div>
            <ArrowRightIcon size={14} className="shrink-0 text-muted-foreground" />
          </button>
        )}

        <PwaSection title="Session lookup">
          <div className="flex gap-2">
            <Input
              value={sessionLookup}
              onChange={(e) => {
                setSessionLookup(e.target.value);
                setLookupError(null);
                setLookupResult(null);
              }}
              placeholder="e.g., VR-882194B"
              className="h-10 flex-1 rounded-xl font-mono text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleSessionLookup()}
            />
            <Button
              onClick={handleSessionLookup}
              disabled={isLookingUp || !isOnline}
              className="h-10 shrink-0 rounded-xl px-4 text-sm"
            >
              {isLookingUp ? <Spinner className="size-4" /> : 'Look up'}
            </Button>
          </div>
          {lookupError && (
            <p className="px-1 text-xs text-destructive">{lookupError}</p>
          )}
          {lookupResult === 'found' && (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-volt-success/10 px-3 py-2.5 text-volt-success">
              <div className="flex min-w-0 items-center gap-2">
                <CheckCircleIcon size={14} className="shrink-0" />
                <span className="truncate text-xs">
                  {lookupSession?.sessionCode} — {lookupSession?.status}
                  {lookupSession?.currentDurationMinutes != null &&
                    ` · ${formatDuration(lookupSession.currentDurationMinutes)}`}
                </span>
              </div>
              {activeSession?.sessionCode === lookupSession?.sessionCode && (
                <button
                  type="button"
                  onClick={() => onNavigate('status')}
                  className="shrink-0 text-xs font-medium underline-offset-2 hover:underline"
                >
                  View
                </button>
              )}
            </div>
          )}
          {lookupResult === 'not_found' && (
            <div className="flex items-center gap-2 rounded-xl bg-volt-warning/10 px-3 py-2.5 text-volt-warning">
              <XCircleIcon size={14} className="shrink-0" />
              <span className="text-xs">Session not found. Check the ID and try again.</span>
            </div>
          )}
        </PwaSection>

        <PwaSection title="Quick actions">
          <PwaListGroup>
            <PwaNavRow
              icon={ClockIcon}
              label="Check Status"
              hint="View active rental"
              onClick={() => onNavigate('status')}
            />
            <PwaNavRow
              icon={HeadphonesIcon}
              label="Contact Us"
              hint="Get direct help"
              onClick={() => {
                setContactCategory('other');
                setContactFormVisible(true);
              }}
            />
          </PwaListGroup>
        </PwaSection>

        <PwaSection title="What do you need help with?">
          <PwaListGroup>
            {issueCategories.map((category) => (
              <PwaNavRow
                key={category.id}
                icon={category.icon}
                label={category.label}
                hint={category.description}
                onClick={() => setSelectedCategory(category.id)}
              />
            ))}
          </PwaListGroup>
        </PwaSection>

        <PwaSection title="Frequently asked questions">
          <PwaListGroup>
            {faqItems.map((faq, index) => (
              <div key={index}>
                <button
                  type="button"
                  onClick={() => toggleFAQ(index)}
                  className="flex w-full min-h-[44px] items-center justify-between gap-3 px-4 py-3 text-left active:bg-muted/60 transition-colors"
                  aria-expanded={expandedFAQ === index}
                >
                  <span className="text-sm font-medium text-foreground">{faq.question}</span>
                  <ChevronDownIcon
                    size={16}
                    className={`shrink-0 text-muted-foreground transition-transform duration-200 ${
                      expandedFAQ === index ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {expandedFAQ === index && (
                  <div className="border-t border-border/60 px-4 pb-3 pt-2">
                    <p className="text-xs leading-relaxed text-muted-foreground">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </PwaListGroup>
        </PwaSection>

        <div className="pb-2 text-center">
          <p className="text-xs text-muted-foreground">Still need help? Our team is available 24/7.</p>
          <Button
            onClick={() => setContactFormVisible(true)}
            variant="ghost"
            size="sm"
            className="mt-1 h-9 text-sm"
          >
            <HeadphonesIcon size={14} />
            Contact Support
          </Button>
        </div>
      </PwaScrollBody>
    </PwaScreen>
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

  return (
    <PwaScreen>
      <MobileHeader title={categoryInfo?.label || 'Support'} showBack onBack={onBack} />

      <PwaScrollBody className="space-y-4 py-3">
        <div>
          <h1 className="text-base font-semibold text-foreground">{info.title}</h1>
          <p className="text-xs text-muted-foreground">{categoryInfo?.description}</p>
        </div>

        {!isOnline && (
          <div className="flex items-center gap-2 rounded-xl bg-volt-warning/10 px-3 py-2.5">
            <XCircleIcon size={14} className="shrink-0 text-volt-warning" />
            <p className="text-xs text-volt-warning">You appear to be offline. Some actions may not work.</p>
          </div>
        )}

        <PwaSection title="Try these steps">
          <PwaListGroup>
            {info.steps.map((step, index) => (
              <div key={index} className="flex gap-3 px-4 py-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-foreground">
                  {index + 1}
                </span>
                <span className="text-xs leading-relaxed text-muted-foreground">{step}</span>
              </div>
            ))}
          </PwaListGroup>
        </PwaSection>

        {info.actions && info.actions.length > 0 && (
          <PwaSection title="Quick actions">
            <PwaListGroup>
              {info.actions.map((action, index) => (
                <PwaListRow
                  key={index}
                  label={action.label}
                  onClick={action.action}
                  value={<ArrowRightIcon size={14} className="text-muted-foreground" />}
                />
              ))}
            </PwaListGroup>
          </PwaSection>
        )}
      </PwaScrollBody>

      <PwaActionBar>
        <Button onClick={onContactSupport} className="h-12 w-full text-sm font-medium">
          <HeadphonesIcon size={16} />
          Contact Support
        </Button>
      </PwaActionBar>
    </PwaScreen>
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
      <PwaScreen>
        <MobileHeader title="Contact Support" showBack onBack={onBack} />
        <PwaCenteredState
          icon={<CheckCircleIcon size={28} className="text-volt-success" />}
          title="Message Sent"
          description="We've received your message and will get back to you within 1 hour. Check your email for updates."
        >
          <PwaListGroup>
            <PwaListRow
              label="Ticket reference"
              value={<span className="font-mono text-xs">{ticketNumber ?? '—'}</span>}
            />
            <PwaListRow
              label="Status"
              value={
                <span className="text-volt-success">Submitted</span>
              }
            />
          </PwaListGroup>
          <Button onClick={onBack} className="h-12 w-full text-sm font-medium">
            Back to Support
          </Button>
        </PwaCenteredState>
      </PwaScreen>
    );
  }

  return (
    <PwaScreen>
      <MobileHeader title="Contact Support" showBack onBack={onBack} />

      <PwaBody scroll className="gap-4 py-3">
        <div>
          <h1 className="text-base font-semibold text-foreground">How can we help?</h1>
          <p className="text-xs text-muted-foreground">
            Describe your issue and we&apos;ll get back to you as soon as possible.
          </p>
        </div>

        {activeSessionCode && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
            <p className="text-xs text-foreground">
              <span className="font-medium">Active session:</span>{' '}
              <span className="font-mono">{activeSessionCode}</span>
            </p>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label htmlFor="support-email" className="mb-1.5 block text-xs text-muted-foreground">
              Your email
            </label>
            <Input
              id="support-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className={`h-11 rounded-xl ${formErrors.email ? 'border-destructive' : ''}`}
            />
            {formErrors.email && (
              <p className="mt-1 text-xs text-destructive">{formErrors.email}</p>
            )}
          </div>

          <div>
            <label htmlFor="support-message" className="mb-1.5 block text-xs text-muted-foreground">
              Your message
            </label>
            <textarea
              id="support-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your issue. Include your session ID if you have one."
              rows={5}
              className={`w-full resize-none rounded-xl border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${formErrors.message ? 'border-destructive' : 'border-input'}`}
            />
            {formErrors.message && (
              <p className="mt-1 text-xs text-destructive">{formErrors.message}</p>
            )}
          </div>

          <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Tip:</span> Including your session ID (e.g., VR-882194B) helps us resolve your issue faster.
          </p>
        </div>
      </PwaBody>

      <PwaActionBar>
        <Button
          onClick={onSubmit}
          disabled={isSubmitting}
          className="h-12 w-full text-sm font-medium"
        >
          {isSubmitting ? (
            <>
              <Spinner className="size-4" />
              Sending…
            </>
          ) : (
            'Send Message'
          )}
        </Button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Typical response time under 1 hour
        </p>
      </PwaActionBar>
    </PwaScreen>
  );
}
