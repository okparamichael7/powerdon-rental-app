'use client';

import { motion } from 'framer-motion';
import { MobileHeader } from '@/components/volt/mobile-header';
import { CheckCircleIcon, ShieldCheckIcon, WalletIcon, BuildingIcon, PowerDonLogo } from '@/components/volt/icons';
import { Button } from '@/components/ui/button';
import { useRental } from '@/lib/rental-context';

export function ReturnCompleteScreen() {
  const { flow, setFlow, elapsedMinutes, amountCharged, setRewardCode } = useRental();
  
  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;
  const isQualified = elapsedMinutes >= flow.rewardThreshold;
  const refundAmount = flow.depositAmount;

  const handleDone = () => {
    if (isQualified) {
      // Generate reward code
      setRewardCode(`SUNDANCE-POWERDON-${new Date().getFullYear()}`);
      setFlow((prev) => ({ ...prev, step: 'reward' }));
    } else {
      // Reset to landing
      setFlow((prev) => ({ ...prev, step: 'landing' }));
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <MobileHeader />
      
      <main className="flex-1 flex flex-col items-center px-5 py-6">
        {/* Event Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full mb-6"
        >
          <BuildingIcon size={14} className="text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {flow.campaignName.toUpperCase()} 2024
          </span>
        </motion.div>

        {/* Success Header */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-bold text-foreground mb-6">Return Complete</h1>
          
          {/* Success Icon */}
          <div className="relative mx-auto w-24 h-24 mb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-24 h-24 bg-primary rounded-2xl flex items-center justify-center shadow-lg"
            >
              <CheckCircleIcon size={48} className="text-primary-foreground" />
            </motion.div>
          </div>
          
          <p className="text-muted-foreground">
            Successfully returned to <span className="font-semibold text-foreground">Park City Main Hub</span>.
          </p>
        </motion.div>

        {/* Summary Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="w-full max-w-sm bg-card rounded-2xl border border-border overflow-hidden"
        >
          {/* Duration & Cost */}
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Total Duration</p>
                <p className="text-2xl font-bold text-foreground">{hours}h {minutes}m</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Amount Paid</p>
                <p className="text-2xl font-bold text-primary">€{amountCharged.toFixed(2)}</p>
              </div>
            </div>

            {/* Refund Info */}
            <div className="flex items-start gap-3 p-3 bg-muted rounded-xl">
              <div className="flex items-center justify-center w-10 h-10 bg-background rounded-lg">
                <WalletIcon size={18} className="text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-foreground">€{refundAmount.toFixed(2)} Refunded</p>
                <p className="text-sm text-muted-foreground">
                  Sent to Apple Pay. Your security deposit has been released.
                </p>
              </div>
            </div>

            {/* Transaction Details */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Payment Method</span>
                <span className="text-sm font-medium text-foreground flex items-center gap-1">
                  <span className="text-xs">iOS</span> Apple Pay
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Transaction ID</span>
                <span className="text-sm font-medium text-foreground font-mono">VR-882194B</span>
              </div>
            </div>
          </div>

          {/* Security Footer */}
          <div className="px-5 py-3 bg-muted/50 border-t border-border">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <ShieldCheckIcon size={14} />
              <span className="text-xs font-medium uppercase tracking-wide">PowerDon Secured</span>
            </div>
          </div>
        </motion.div>

        {/* Report Issue Link */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Report an Issue
        </motion.button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Done Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="w-full max-w-sm space-y-3 mt-8"
        >
          <Button 
            onClick={handleDone}
            className="w-full h-14 text-base font-semibold rounded-2xl bg-primary hover:bg-primary/90"
          >
            {isQualified ? 'View My Reward' : 'Done'}
          </Button>
          <p className="text-center text-xs text-muted-foreground font-mono">
            SESSION #882194-2024
          </p>
        </motion.div>
      </main>
    </div>
  );
}
