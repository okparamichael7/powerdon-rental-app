'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MobileHeader } from '@/components/volt/mobile-header';
import { BottomNav } from '@/components/volt/bottom-nav';
import { PowerDonLogo, GiftIcon, MapPinIcon, PowerBankIcon } from '@/components/volt/icons';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useRental } from '@/lib/rental-context';

export function ActiveRentalScreen() {
  const { flow, setFlow, elapsedMinutes, setElapsedMinutes, setAmountCharged } = useRental();
  const [activeTab, setActiveTab] = useState<'rent' | 'status' | 'rewards' | 'support'>('status');

  // Simulate time passing
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedMinutes((prev) => {
        const newMinutes = prev + 1;
        // Calculate charge (€2/hour = €0.0333/minute)
        setAmountCharged(Math.min(newMinutes * (flow.hourlyRate / 60), 10)); // €10 daily cap
        return newMinutes;
      });
    }, 1000); // Speed up for demo (1 second = 1 minute)

    return () => clearInterval(interval);
  }, [flow.hourlyRate, setAmountCharged, setElapsedMinutes]);

  const rewardProgress = Math.min((elapsedMinutes / flow.rewardThreshold) * 100, 100);
  const isQualified = elapsedMinutes >= flow.rewardThreshold;
  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;

  const handleReturn = () => {
    setFlow((prev) => ({ ...prev, step: 'returning' }));
    // Simulate return process
    setTimeout(() => {
      setFlow((prev) => ({ ...prev, step: 'complete' }));
    }, 2000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <MobileHeader subtitle={`${flow.campaignName.toUpperCase()} • ACTIVE`} />
      
      <main className="flex-1 px-5 py-6 space-y-6">
        {/* Status Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium uppercase tracking-wide">Rental Active</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            {hours > 0 && `${hours}h `}{minutes}m
          </h1>
          <p className="text-muted-foreground mt-1">Session in progress</p>
        </motion.div>

        {/* Power Bank Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium tracking-wide text-white/60 uppercase">Power Bank</p>
              <p className="text-lg font-bold mt-1">PowerDon Pro 10000</p>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-xs font-medium">94% charged</span>
                </div>
              </div>
            </div>
            <PowerBankIcon size={48} className="text-white/20" />
          </div>
          
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
            <div>
              <p className="text-xs text-white/60">From Station</p>
              <p className="font-medium">{flow.stationName}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/60">Slot</p>
              <p className="font-medium">{flow.stationId}-{String(flow.slotNumber || 4).padStart(2, '0')}</p>
            </div>
          </div>
        </motion.div>

        {/* Reward Progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-2xl border border-border p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GiftIcon size={18} className="text-primary" />
              <span className="font-semibold text-foreground">Reward Progress</span>
            </div>
            {isQualified ? (
              <span className="text-xs font-medium px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full">
                Qualified!
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                {flow.rewardThreshold - elapsedMinutes} min left
              </span>
            )}
          </div>
          
          <div className="space-y-2">
            <Progress value={rewardProgress} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>0 min</span>
              <span className="text-primary font-medium">{flow.rewardThreshold} min goal</span>
            </div>
          </div>

          <div className="p-3 bg-secondary rounded-xl">
            <p className="text-sm">
              {isQualified ? (
                <span className="text-emerald-700 font-medium">
                  Congratulations! You&apos;ve qualified for a €10 merch voucher. Return your power bank to claim it.
                </span>
              ) : (
                <>
                  <span className="font-medium text-primary">Keep going!</span>{' '}
                  <span className="text-muted-foreground">
                    Rent for {flow.rewardThreshold - elapsedMinutes} more minutes to earn your €10 voucher.
                  </span>
                </>
              )}
            </p>
          </div>
        </motion.div>

        {/* Cost Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-2xl border border-border p-5"
        >
          <h3 className="font-semibold text-foreground mb-3">Current Charges</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Rental ({hours}h {minutes}m)</span>
              <span className="font-medium text-foreground">€{(elapsedMinutes * (flow.hourlyRate / 60)).toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Deposit (held)</span>
              <span className="font-medium text-primary">€{flow.depositAmount.toFixed(2)}</span>
            </div>
            <div className="border-t border-border pt-2 mt-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">On return</span>
                <span className="font-bold text-foreground">
                  €{Math.max(0, flow.depositAmount - (elapsedMinutes * (flow.hourlyRate / 60))).toFixed(2)} refund
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Return CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-3"
        >
          <Button 
            onClick={handleReturn}
            className="w-full h-14 text-base font-semibold rounded-2xl bg-primary hover:bg-primary/90"
          >
            <MapPinIcon size={18} />
            Find Return Station
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Return to any {flow.campaignName} station to end your rental
          </p>
        </motion.div>
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
