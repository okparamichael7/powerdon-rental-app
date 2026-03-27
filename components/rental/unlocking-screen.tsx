'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MobileHeader } from '@/components/volt/mobile-header';
import { VoltLogo, LightbulbIcon, XCircleIcon, HeadphonesIcon } from '@/components/volt/icons';
import { Button } from '@/components/ui/button';
import { useRental } from '@/lib/rental-context';

export function UnlockingScreen() {
  const { flow, setFlow } = useRental();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Simulate unlocking progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          // Transition to active rental after unlock
          setTimeout(() => {
            setFlow((prev) => ({ ...prev, step: 'active' }));
          }, 500);
          return 100;
        }
        return prev + 2;
      });
    }, 60);

    return () => clearInterval(interval);
  }, [setFlow]);

  const handleCancel = () => {
    setFlow((prev) => ({ ...prev, step: 'payment' }));
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <MobileHeader 
        title="Unlocking"
      />
      
      <main className="flex-1 flex flex-col items-center justify-center px-5 py-8">
        {/* Unlock Animation */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative mb-8"
        >
          {/* Rotating rings */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-20 h-20"
          >
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className="text-muted"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${progress * 2.83} 283`}
                transform="rotate(-90 50 50)"
                className="text-primary transition-all duration-300"
              />
            </svg>
          </motion.div>
          <div className="absolute inset-0 flex items-center justify-center">
            <VoltLogo size={32} className="text-primary" />
          </div>
        </motion.div>

        {/* Status Text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center space-y-2 mb-12"
        >
          <p className="text-xs font-medium tracking-wider text-primary uppercase">Connecting</p>
          <h1 className="text-2xl font-bold text-foreground">Unlocking...</h1>
          <p className="text-muted-foreground">
            Securely connecting to <span className="font-semibold text-foreground">{flow.campaignName} Node</span>.
            <br />Stand by your slot.
          </p>
        </motion.div>

        {/* Station Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="w-full max-w-sm bg-card rounded-2xl border border-border p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Station ID</p>
              <p className="text-xl font-bold text-primary">{flow.stationId}</p>
            </div>
            <div className="h-10 w-px bg-border" />
            <div className="text-right">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Target Slot</p>
              <p className="text-xl font-bold text-primary">Slot {String(flow.slotNumber || 4).padStart(2, '0')}</p>
            </div>
          </div>

          {/* Instruction */}
          <div className="flex items-start gap-3 p-3 bg-secondary rounded-xl">
            <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-lg flex-shrink-0">
              <LightbulbIcon size={16} className="text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">Look for the flashing light</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                The LED on Slot {String(flow.slotNumber || 4).padStart(2, '0')} will pulse blue when your power bank is ready to pull.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom Actions */}
        <div className="w-full max-w-sm space-y-3 mt-8">
          <p className="text-center text-sm text-muted-foreground">
            Taking too long?{' '}
            <button className="font-medium text-primary hover:underline">Try again</button>
          </p>
          
          <Button
            variant="outline"
            onClick={handleCancel}
            className="w-full h-14 text-base font-semibold rounded-2xl bg-foreground text-background hover:bg-foreground/90 border-0"
          >
            <XCircleIcon size={18} />
            Cancel Request
          </Button>

          <button className="flex items-center justify-center gap-2 w-full py-3 text-muted-foreground hover:text-foreground transition-colors">
            <HeadphonesIcon size={18} />
            <span className="text-sm font-medium">Contact Support</span>
          </button>
        </div>
      </main>
    </div>
  );
}
