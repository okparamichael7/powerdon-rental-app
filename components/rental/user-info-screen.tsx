'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { MobileHeader } from '@/components/volt/mobile-header';
import { VoltLogo, ArrowRightIcon, GiftIcon, ShieldCheckIcon } from '@/components/volt/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useRental } from '@/lib/rental-context';

export function UserInfoScreen() {
  const { 
    flow, 
    setFlow, 
    userEmail, 
    setUserEmail, 
    userName, 
    setUserName,
    termsAccepted,
    setTermsAccepted,
    marketingConsent,
    setMarketingConsent,
  } = useRental();
  
  const [emailError, setEmailError] = useState('');

  const handleBack = () => {
    setFlow((prev) => ({ ...prev, step: 'landing' }));
  };

  const handleContinue = () => {
    if (!userEmail || !userEmail.includes('@')) {
      setEmailError('Please enter a valid email address');
      return;
    }
    if (!termsAccepted) {
      return;
    }
    setEmailError('');
    setFlow((prev) => ({ ...prev, step: 'payment' }));
  };

  const isValid = userEmail.includes('@') && termsAccepted;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <MobileHeader 
        title="Your Info"
        showBack 
        onBack={handleBack}
      />
      
      <main className="flex-1 flex flex-col px-5 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div>
            <h1 className="text-2xl font-bold text-foreground">Complete your profile</h1>
            <p className="mt-1 text-muted-foreground">
              Enter your details to start your rental at {flow.campaignName}.
            </p>
          </div>

          {/* Rate Summary */}
          <div className="flex items-center gap-4 p-4 bg-card rounded-2xl border border-border">
            <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-xl">
              <VoltLogo size={24} className="text-primary" />
            </div>
            <div className="flex-1 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Active Rate</p>
                <p className="text-lg font-bold text-foreground">€{flow.hourlyRate.toFixed(2)}/hour</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Refundable Deposit</p>
                <p className="text-lg font-bold text-foreground">€{flow.depositAmount.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Email Address
              </label>
              <div className="relative">
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={userEmail}
                  onChange={(e) => {
                    setUserEmail(e.target.value);
                    setEmailError('');
                  }}
                  className="h-14 text-base rounded-xl bg-muted/50 border-0 pr-12"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
              </div>
              {emailError && (
                <p className="text-sm text-destructive">{emailError}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Full Name <span className="text-muted-foreground/60">(Optional)</span>
              </label>
              <Input
                type="text"
                placeholder="John Doe"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="h-14 text-base rounded-xl bg-muted/50 border-0"
              />
            </div>
          </div>

          {/* Reward Reminder */}
          <div className="flex items-start gap-3 p-4 bg-secondary rounded-xl">
            <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
              <GiftIcon size={18} className="text-primary" />
            </div>
            <p className="text-sm text-foreground">
              <span className="font-semibold text-primary">Festival Reward:</span> Rent for {flow.rewardThreshold} minutes and receive a{' '}
              <span className="font-semibold text-primary">€10 voucher</span> for official merch.
            </p>
          </div>

          {/* Consent */}
          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                className="mt-0.5"
              />
              <span className="text-sm text-foreground">
                I agree to the{' '}
                <button className="font-medium text-primary hover:underline">Terms</button>
                {' '}and{' '}
                <button className="font-medium text-primary hover:underline">Privacy Policy</button>
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={marketingConsent}
                onCheckedChange={(checked) => setMarketingConsent(checked === true)}
                className="mt-0.5"
              />
              <span className="text-sm text-foreground">
                Keep me updated with festival rewards and news
              </span>
            </label>
          </div>

          {/* Security Note */}
          <div className="flex items-center justify-center gap-2 py-2 text-muted-foreground">
            <ShieldCheckIcon size={16} />
            <span className="text-xs font-medium uppercase tracking-wide">Secure Encrypted Transaction</span>
          </div>
        </motion.div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom CTA */}
        <div className="sticky bottom-0 pt-4 pb-8 bg-gradient-to-t from-background via-background to-transparent -mx-5 px-5">
          <Button 
            onClick={handleContinue}
            disabled={!isValid}
            className="w-full h-14 text-base font-semibold rounded-2xl bg-primary hover:bg-primary/90 disabled:opacity-50"
          >
            Continue to Payment
            <ArrowRightIcon size={18} />
          </Button>
        </div>
      </main>
    </div>
  );
}
