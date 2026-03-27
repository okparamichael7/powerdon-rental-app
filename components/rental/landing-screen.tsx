'use client';

import { motion } from 'framer-motion';
import { MobileHeader } from '@/components/volt/mobile-header';
import { VoltLogo, ArrowRightIcon, ShieldCheckIcon, GiftIcon } from '@/components/volt/icons';
import { Button } from '@/components/ui/button';
import { useRental } from '@/lib/rental-context';

export function LandingScreen() {
  const { flow, setFlow } = useRental();

  const handleStart = () => {
    setFlow((prev) => ({ ...prev, step: 'info' }));
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <MobileHeader 
        subtitle={`${flow.campaignName.toUpperCase()} • STATION ${flow.stationId}`}
      />
      
      <main className="flex-1 flex flex-col">
        {/* Hero Image */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative w-full aspect-[4/3] bg-gradient-to-b from-slate-900 to-slate-800 overflow-hidden"
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              {/* Simulated power bank image */}
              <div className="w-20 h-40 bg-gradient-to-b from-slate-700 to-slate-900 rounded-xl shadow-2xl border border-slate-600">
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center">
                  <span className="text-slate-400 text-xs font-medium tracking-widest">VOLT</span>
                </div>
              </div>
              {/* Glow effect */}
              <div className="absolute inset-0 bg-primary/20 blur-3xl -z-10 scale-150" />
            </div>
          </div>
        </motion.div>

        {/* Content */}
        <div className="flex-1 px-5 py-6 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-center"
          >
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Stay charged.</h1>
            <p className="mt-2 text-muted-foreground text-balance">
              Rent a high-capacity power bank in seconds and never miss a moment of {flow.campaignName}.
            </p>
          </motion.div>

          {/* Pricing Card */}
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
                  €{flow.hourlyRate.toFixed(2)}
                  <span className="text-base font-normal text-muted-foreground">/hr</span>
                </p>
              </div>
              <div className="h-10 w-px bg-border" />
              <div className="text-right">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Deposit</p>
                <p className="text-2xl font-bold text-foreground">€{flow.depositAmount.toFixed(2)}</p>
                <p className="text-xs font-medium text-primary uppercase">Refundable</p>
              </div>
            </div>
          </motion.div>

          {/* Reward Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-primary text-primary-foreground rounded-2xl p-4"
          >
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-primary-foreground/10 rounded-xl">
                <GiftIcon size={20} />
              </div>
              <div>
                <p className="font-semibold">Sundance Merch Reward</p>
                <p className="text-sm text-primary-foreground/80">{flow.rewardDescription}</p>
              </div>
            </div>
          </motion.div>

          {/* How it works */}
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
                { step: 2, title: 'Unlock Bank', desc: `Pick up your designated Volt power bank from slot ${flow.stationId}-${flow.slotNumber || '04'}.` },
                { step: 3, title: 'Return Anywhere', desc: 'Drop the bank at any Sundance station when you\'re done.' },
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

          {/* Trust badges */}
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
              <VoltLogo size={16} />
              <span className="text-xs font-medium uppercase tracking-wide">No Hidden Fees</span>
            </div>
          </motion.div>
        </div>

        {/* Bottom CTA */}
        <div className="sticky bottom-0 p-5 pb-8 bg-gradient-to-t from-background via-background to-transparent">
          <Button 
            onClick={handleStart}
            className="w-full h-14 text-base font-semibold rounded-2xl bg-primary hover:bg-primary/90"
          >
            Start rental
            <ArrowRightIcon size={18} />
          </Button>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-muted-foreground">
              STATION {flow.stationId} • ONLINE
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
