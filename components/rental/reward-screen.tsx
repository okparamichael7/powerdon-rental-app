'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { MobileHeader } from '@/components/volt/mobile-header';
import { BottomNav } from '@/components/volt/bottom-nav';
import { PowerDonLogo, CopyIcon, CheckCircleIcon, ClockIcon, MapPinIcon, ReceiptIcon } from '@/components/volt/icons';
import { Button } from '@/components/ui/button';
import { useRental } from '@/lib/rental-context';

export function RewardScreen() {
  const { flow, elapsedMinutes, rewardCode } = useRental();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'rent' | 'status' | 'rewards' | 'support'>('rewards');

  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;

  const handleCopy = () => {
    navigator.clipboard.writeText(rewardCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <MobileHeader />
      
      <main className="flex-1 px-5 py-6 space-y-6">
        {/* Goal Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-primary rounded-full">
            <CheckCircleIcon size={16} />
            <span className="text-sm font-semibold uppercase tracking-wide">
              Goal Reached • {hours > 0 ? `${hours}h ` : ''}{minutes} Min Session
            </span>
          </div>
        </motion.div>

        {/* Success Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center"
        >
          <h1 className="text-3xl font-bold text-foreground">Reward Unlocked!</h1>
          <p className="mt-2 text-muted-foreground">
            Enjoy your perk for supporting sustainable energy at {flow.campaignName}.
          </p>
        </motion.div>

        {/* Voucher Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-2xl border border-border overflow-hidden"
        >
          {/* Voucher Header */}
          <div className="relative h-40 bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDBoNDBWNDBIMHoiLz48cGF0aCBkPSJNMjAgMjBMMjAgMTBNMjAgMjBMMTAgMjBNMjAgMjBMMjAgMzBNMjAgMjBMMzAgMjAiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9nPjwvc3ZnPg==')]" />
            </div>
            
            <div className="relative text-center text-white">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 rounded-full text-xs font-medium mb-2">
                Official Partnership
              </div>
              <p className="text-4xl font-bold">€10</p>
              <p className="text-sm font-medium tracking-wider uppercase opacity-80">Merch Voucher</p>
            </div>
          </div>

          {/* Voucher Body */}
          <div className="p-5 space-y-4">
            <p className="text-center text-muted-foreground">
              Present this code at any {flow.campaignName} merchandise station to redeem.
            </p>

            {/* QR Code Placeholder */}
            <div className="flex justify-center py-4">
              <div className="relative w-32 h-32 bg-muted rounded-xl flex items-center justify-center">
                {/* Simulated QR Pattern */}
                <div className="grid grid-cols-7 gap-1 p-3">
                  {[...Array(49)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-2.5 h-2.5 rounded-sm ${
                        Math.random() > 0.5 ? 'bg-foreground' : 'bg-transparent'
                      }`}
                    />
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 bg-background rounded flex items-center justify-center">
                    <PowerDonLogo size={16} className="text-primary" />
                  </div>
                </div>
              </div>
            </div>

            {/* Activation Code */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Activation Code
                </span>
                <div className="flex items-center gap-1 text-destructive">
                  <ClockIcon size={12} />
                  <span className="text-xs font-medium uppercase">Expires Midnight</span>
                </div>
              </div>
              
              <button
                onClick={handleCopy}
                className="w-full flex items-center justify-between p-4 bg-muted rounded-xl hover:bg-muted/80 transition-colors"
              >
                <span className="font-bold text-foreground tracking-wide">{rewardCode}</span>
                {copied ? (
                  <CheckCircleIcon size={18} className="text-emerald-600" />
                ) : (
                  <CopyIcon size={18} className="text-primary" />
                )}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-3"
        >
          <Button 
            className="w-full h-14 text-base font-semibold rounded-2xl bg-primary hover:bg-primary/90"
          >
            <MapPinIcon size={18} />
            Find Merch Booths
          </Button>
          <Button 
            variant="secondary"
            className="w-full h-14 text-base font-semibold rounded-2xl"
          >
            <ReceiptIcon size={18} />
            Transaction History
          </Button>
        </motion.div>

        {/* Protocol Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col items-center gap-2 pt-4"
        >
          <div className="flex items-center gap-2">
            <div className="h-px w-8 bg-border" />
            <PowerDonLogo size={12} className="text-muted-foreground" />
            <div className="h-px w-8 bg-border" />
          </div>
          <p className="text-xs text-muted-foreground font-mono tracking-wider">
            POWERDON V4.2 // ENCRYPTED REWARD
          </p>
        </motion.div>
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
