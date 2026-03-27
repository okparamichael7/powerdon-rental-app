'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { MobileHeader } from '@/components/volt/mobile-header';
import { PowerDonLogo, ShieldCheckIcon, ArrowRightIcon, ClockIcon, CalendarIcon, WalletIcon } from '@/components/volt/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRental } from '@/lib/rental-context';

export function PaymentScreen() {
  const { flow, setFlow, setSessionId } = useRental();
  const [selectedMethod, setSelectedMethod] = useState<'apple' | 'google' | 'card'>('apple');

  const handleBack = () => {
    setFlow((prev) => ({ ...prev, step: 'info' }));
  };

  const handleAuthorize = () => {
    // Generate session ID
    const id = `SES-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    setSessionId(id);
    setFlow((prev) => ({ ...prev, step: 'unlocking' }));
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <MobileHeader 
        title="Secure Payment"
        showBack 
        onBack={handleBack}
        showHelp={false}
      />
      
      <div className="flex items-center justify-end px-4 -mt-2 mb-2">
        <div className="flex items-center gap-1.5 text-emerald-600">
          <ShieldCheckIcon size={14} />
          <span className="text-xs font-medium uppercase tracking-wide">Secure</span>
        </div>
      </div>

      <main className="flex-1 flex flex-col px-5">
        {/* Refund Protection Banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-2 py-3 px-4 bg-secondary rounded-xl mb-6"
        >
          <ShieldCheckIcon size={18} className="text-primary" />
          <span className="text-sm font-medium text-primary uppercase tracking-wide">
            Refund Protection Enabled
          </span>
        </motion.div>

        {/* Order Summary Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl border border-border p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Order Summary</h2>
            <Badge variant="outline" className="text-xs font-medium bg-secondary border-0">
              HOLD
            </Badge>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Security Deposit</span>
              <span className="font-semibold text-foreground">€{flow.depositAmount.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Processing Fee</span>
              <span className="font-semibold text-primary">FREE</span>
            </div>
            <div className="border-t border-dashed border-border my-2" />
            <div className="flex items-center justify-between">
              <span className="text-foreground font-medium">To Authorize</span>
              <span className="text-2xl font-bold text-foreground">€{flow.depositAmount.toFixed(2)}</span>
            </div>
          </div>
        </motion.div>

        {/* Deposit Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-4 bg-card rounded-2xl border border-border p-5 space-y-4"
        >
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-full">
              <span className="text-primary text-sm font-bold">i</span>
            </div>
            <div>
              <p className="font-semibold text-foreground">100% Refundable Deposit</p>
              <p className="text-sm text-muted-foreground mt-1">
                This amount is temporarily held to unlock the power bank. It returns to your account instantly upon return.
              </p>
            </div>
          </div>

          {/* Flow Steps */}
          <div className="flex items-center justify-between px-2 pt-2">
            {[
              { icon: ArrowRightIcon, label: 'Return Bank', active: false },
              { icon: PowerDonLogo, label: 'To Station', active: false },
              { icon: WalletIcon, label: 'Instant Refund', active: true },
            ].map((step, idx) => (
              <div key={step.label} className="flex flex-col items-center gap-2">
                <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${
                  step.active ? 'bg-secondary' : 'bg-muted'
                }`}>
                  <step.icon size={20} className={step.active ? 'text-primary' : 'text-muted-foreground'} />
                </div>
                <span className={`text-xs font-medium uppercase tracking-wide ${
                  step.active ? 'text-primary' : 'text-muted-foreground'
                }`}>
                  {step.label}
                </span>
                {idx < 2 && (
                  <div className="absolute translate-x-16 translate-y-6 text-muted-foreground/30">→</div>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Rental Rates */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-4"
        >
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase mb-3">
            Current Rental Rates
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 p-4 bg-card rounded-xl border border-border">
              <ClockIcon size={18} className="text-primary" />
              <div>
                <p className="text-lg font-bold text-foreground">€{flow.hourlyRate.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">per hour</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-card rounded-xl border border-border">
              <CalendarIcon size={18} className="text-primary" />
              <div>
                <p className="text-lg font-bold text-foreground">€10.00</p>
                <p className="text-xs text-muted-foreground">daily cap</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Security Badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-wrap items-center justify-center gap-4 mt-6 text-muted-foreground"
        >
          <div className="flex items-center gap-1.5">
            <ShieldCheckIcon size={14} />
            <span className="text-xs font-medium uppercase tracking-wide">Visa Secure</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheckIcon size={14} />
            <span className="text-xs font-medium uppercase tracking-wide">Mastercard Identity</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheckIcon size={14} />
            <span className="text-xs font-medium uppercase tracking-wide">256-bit SSL</span>
          </div>
        </motion.div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom CTA */}
        <div className="sticky bottom-0 pt-4 pb-8 bg-gradient-to-t from-background via-background to-transparent -mx-5 px-5 space-y-3">
          {/* Payment Method Toggle */}
          <Button
            variant="outline"
            className="w-full h-14 text-base font-semibold rounded-2xl bg-foreground text-background hover:bg-foreground/90 border-0"
            onClick={() => setSelectedMethod(selectedMethod === 'apple' ? 'google' : 'apple')}
          >
            {selectedMethod === 'apple' ? (
              <>
                <svg viewBox="0 0 24 24" className="w-5 h-5 mr-1" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
                Pay
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" className="w-5 h-5 mr-2" fill="currentColor">
                  <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
                </svg>
                Pay
              </>
            )}
          </Button>
          
          <Button 
            onClick={handleAuthorize}
            className="w-full h-14 text-base font-semibold rounded-2xl bg-primary hover:bg-primary/90"
          >
            Authorize & Unlock
            <PowerDonLogo size={18} />
          </Button>

          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <button className="font-medium hover:text-foreground transition-colors">Credit Card</button>
            <span className="text-border">|</span>
            <button className="font-medium hover:text-foreground transition-colors">Google Pay</button>
          </div>
        </div>
      </main>
    </div>
  );
}
