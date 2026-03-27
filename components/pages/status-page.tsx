'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MobileHeader } from '@/components/volt/mobile-header';
import { 
  PowerDonLogo, GiftIcon, MapPinIcon, PowerBankIcon, 
  CheckCircleIcon, XCircleIcon, RefreshIcon, ClockIcon,
  HeadphonesIcon
} from '@/components/volt/icons';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { useAppState } from '@/lib/app-state';
import { formatDuration, formatCurrency, calculateCharge, calculateRewardProgress } from '@/lib/session-store';
import { formatTime } from '@/lib/utils';

interface StatusPageProps {
  isOnline: boolean;
  onNavigate: (tab: 'rent' | 'status' | 'rewards' | 'support') => void;
}

export function StatusPage({ isOnline, onNavigate }: StatusPageProps) {
  const { activeSession, completedSession, completeRental, setCompletedSession } = useAppState();
  
  const [isReturning, setIsReturning] = useState(false);
  const [returnProgress, setReturnProgress] = useState(0);
  const [returnComplete, setReturnComplete] = useState(false);
  const [qualifiedForReward, setQualifiedForReward] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate refresh
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsRefreshing(false);
  };

  // Handle return initiation
  const handleReturn = async () => {
    if (!activeSession) return;

    setIsReturning(true);
    setReturnProgress(0);
    setError(null);

    // Simulate return progress
    const interval = setInterval(() => {
      setReturnProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 400);

    // Wait for progress to complete
    await new Promise(resolve => setTimeout(resolve, 4500));

    // Complete the rental
    try {
      const result = await completeRental();
      if (result.success) {
        setQualifiedForReward(result.qualifiedForReward);
        setReturnComplete(true);
      } else {
        setError('Failed to complete return. Please try again.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsReturning(false);
    }
  };

  // Handle dismissing completed view
  const handleDismissCompleted = () => {
    setReturnComplete(false);
    setCompletedSession(null);
  };

  // No session state
  if (!activeSession && !returnComplete) {
    return (
      <div className="flex flex-col min-h-screen bg-background pb-20">
        <NoSessionView
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
          onStartRental={() => onNavigate('rent')}
        />
      </div>
    );
  }

  // Returning state
  if (isReturning) {
    return (
      <div className="flex flex-col min-h-screen bg-background pb-20">
        <ReturningView
          session={activeSession!}
          progress={returnProgress}
        />
      </div>
    );
  }

  // Return complete state
  if (returnComplete && completedSession) {
    return (
      <div className="flex flex-col min-h-screen bg-background pb-20">
        <CompletedView
          session={completedSession}
          qualifiedForReward={qualifiedForReward}
          onViewRewards={() => {
            handleDismissCompleted();
            onNavigate('rewards');
          }}
          onStartNew={() => {
            handleDismissCompleted();
            onNavigate('rent');
          }}
        />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col min-h-screen bg-background pb-20">
        <ErrorView
          error={error}
          onRetry={() => {
            setError(null);
            handleReturn();
          }}
          onSupport={() => onNavigate('support')}
        />
      </div>
    );
  }

  // Active session state
  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <AnimatePresence mode="wait">
        {activeSession && (
          <ActiveSessionView
            session={activeSession}
            isOnline={isOnline}
            isRefreshing={isRefreshing}
            onRefresh={handleRefresh}
            onReturn={handleReturn}
            onSupport={() => onNavigate('support')}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// No Active Session View
function NoSessionView({
  isRefreshing,
  onRefresh,
  onStartRental,
}: {
  isRefreshing: boolean;
  onRefresh: () => void;
  onStartRental: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col min-h-screen"
    >
      <MobileHeader subtitle="STATUS" />
      
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-8"
        >
          <PowerBankIcon size={28} className="text-muted-foreground" />
        </motion.div>

        <div className="text-center max-w-xs mb-10">
          <h1 className="text-lg font-medium text-foreground mb-2">No Active Rental</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Start a rental to stay charged.
          </p>
        </div>

        <div className="w-full max-w-xs space-y-3">
          <Button 
            onClick={onStartRental}
            className="w-full h-12 text-sm font-medium"
          >
            Start Rental
          </Button>
          <Button
            variant="ghost"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="w-full h-10 text-sm"
          >
            {isRefreshing ? (
              <>
                <Spinner className="w-4 h-4" />
                Refreshing
              </>
            ) : (
              'Refresh'
            )}
          </Button>
        </div>
      </main>
    </motion.div>
  );
}

// Active Session View
function ActiveSessionView({
  session,
  isOnline,
  isRefreshing,
  onRefresh,
  onReturn,
  onSupport,
}: {
  session: {
    sessionCode: string;
    stationId: string;
    stationName: string;
    slotNumber: number;
    startTime: Date;
    elapsedMinutes: number;
    hourlyRate: number;
    dailyCap: number;
    depositAmount: number;
    rewardThreshold: number;
    campaignName: string;
    lastSyncTime?: Date;
  };
  isOnline: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  onReturn: () => void;
  onSupport: () => void;
}) {
  const rewardProgress = calculateRewardProgress(session.elapsedMinutes, session.rewardThreshold);
  const isQualified = session.elapsedMinutes >= session.rewardThreshold;
  const currentCharge = calculateCharge(session.elapsedMinutes, session.hourlyRate, session.dailyCap);
  const estimatedRefund = Math.max(0, session.depositAmount - currentCharge);
  const lastSync = session.lastSyncTime || session.startTime;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col min-h-screen"
    >
      <MobileHeader subtitle={`${session.campaignName.toUpperCase()} • ACTIVE`} />
      
      <main className="flex-1 px-6 py-8 space-y-8">
        {/* Connection Status Banner */}
        {!isOnline && (
          <div className="bg-muted rounded-md px-4 py-3 flex items-center gap-3">
            <XCircleIcon size={16} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Offline - data will sync when reconnected</p>
          </div>
        )}

        {/* Status Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center pt-4"
        >
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Active</p>
          <h1 className="text-4xl font-medium text-foreground tabular-nums">
            {formatDuration(session.elapsedMinutes)}
          </h1>
        </motion.div>

        {/* Power Bank Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-foreground text-background rounded-md p-5"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-background/60 uppercase tracking-wide">Power Bank</p>
              <p className="text-sm font-medium mt-1">PowerDon Pro</p>
            </div>
            <PowerBankIcon size={32} className="text-background/20" />
          </div>
          
          <div className="mt-4 pt-4 border-t border-background/10 flex items-center justify-between text-sm">
            <span className="text-background/60">{session.stationName}</span>
            <span>Slot {session.slotNumber}</span>
          </div>
        </motion.div>

        {/* Reward Progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Reward Progress</p>
            {isQualified ? (
              <span className="text-xs font-medium px-2 py-0.5 bg-foreground text-background rounded-full">
                Qualified
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                {session.rewardThreshold - session.elapsedMinutes}m left
              </span>
            )}
          </div>
          
          <div className="space-y-2">
            <Progress value={rewardProgress} className="h-1.5" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>0m</span>
              <span>{session.rewardThreshold}m</span>
            </div>
          </div>

          {isQualified && (
            <p className="text-xs text-muted-foreground">
              Return to claim your {formatCurrency(10)} voucher.
            </p>
          )}
        </motion.div>

        {/* Cost Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-3 py-4 border-t border-border"
        >
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Current charge</span>
            <span className="font-medium text-foreground tabular-nums">{formatCurrency(currentCharge)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Deposit held</span>
              <span className="text-foreground tabular-nums">{formatCurrency(session.depositAmount)}</span>
            </div>
            <div className="flex items-center justify-between text-sm pt-2 border-t border-border/50">
              <span className="text-muted-foreground">Est. refund</span>
              <span className="font-medium text-foreground tabular-nums">{formatCurrency(estimatedRefund)}</span>
            </div>
        </motion.div>

        {/* Session Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Session</p>
            <button 
              onClick={onRefresh}
              disabled={isRefreshing}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              aria-label="Refresh status"
            >
              {isRefreshing ? <Spinner className="w-3 h-3" /> : 'Refresh'}
            </button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">ID</span>
              <span className="font-mono text-foreground">{session.sessionCode}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Started</span>
              <span className="text-foreground">{formatTime(session.startTime)}</span>
            </div>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="space-y-3 pt-4"
        >
          <Button 
            onClick={onReturn}
            className="w-full h-12 text-sm font-medium"
          >
            Return Power Bank
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Return at any station to end rental
          </p>
        </motion.div>

        {/* Help Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-muted rounded-md p-4"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Need help?</p>
            <button
              onClick={onSupport}
              className="text-sm text-foreground font-medium hover:underline"
            >
              Contact Support
            </button>
          </div>
        </motion.div>
      </main>
    </motion.div>
  );
}

// Returning View
function ReturningView({
  session,
  progress,
}: {
  session: {
    sessionCode: string;
    elapsedMinutes: number;
  };
  progress: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col min-h-screen"
    >
      <MobileHeader subtitle="RETURNING" />
      
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 mb-8"
        >
          <RefreshIcon size={48} className="text-muted-foreground" />
        </motion.div>

        <div className="text-center mb-8">
          <h1 className="text-lg font-medium text-foreground">Processing return</h1>
          <p className="mt-2 text-muted-foreground">
            Please wait while we verify your power bank has been returned to the station.
          </p>
        </div>

        <div className="w-full max-w-sm">
          <div className="bg-muted rounded-full h-3 overflow-hidden mb-4">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
            />
          </div>
          
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Session</span>
              <span className="font-mono text-foreground">{session.sessionCode}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-muted-foreground">Duration</span>
              <span className="text-foreground">{formatDuration(session.elapsedMinutes)}</span>
            </div>
          </div>
        </div>
      </main>
    </motion.div>
  );
}

// Completed View
function CompletedView({
  session,
  qualifiedForReward,
  onViewRewards,
  onStartNew,
}: {
  session: {
    sessionCode: string;
    elapsedMinutes: number;
    hourlyRate: number;
    dailyCap: number;
    depositAmount: number;
    stationName?: string;
    startTime?: Date;
  };
  qualifiedForReward: boolean;
  onViewRewards: () => void;
  onStartNew: () => void;
}) {
  const finalCharge = calculateCharge(session.elapsedMinutes, session.hourlyRate, session.dailyCap);
  const refundAmount = Math.max(0, session.depositAmount - finalCharge);
  const completedAt = new Date();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col min-h-screen"
    >
      <MobileHeader subtitle="COMPLETED" />
      
      <main className="flex-1 px-5 py-6 space-y-6">
        {/* Success Animation */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="flex justify-center"
        >
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
            <CheckCircleIcon size={40} className="text-emerald-600" />
          </div>
        </motion.div>

        <div className="text-center">
          <h1 className="text-xl font-semibold text-foreground">Return Complete!</h1>
          <p className="mt-1 text-muted-foreground">
            Thank you for using PowerDon. Your rental has been successfully completed.
          </p>
        </div>

        {/* Receipt Card */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 bg-muted/50 border-b border-border flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Receipt</span>
            <span className="font-mono text-xs text-foreground">{session.sessionCode}</span>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Completed</span>
              <span className="text-foreground">{formatTime(completedAt)}</span>
            </div>
            {session.stationName && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Returned At</span>
                <span className="text-foreground">{session.stationName}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Duration</span>
              <span className="font-medium text-foreground">{formatDuration(session.elapsedMinutes)}</span>
            </div>
          </div>
          <div className="px-4 py-3 border-t border-border space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Rental Fee</span>
              <span className="text-foreground">{formatCurrency(finalCharge)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Deposit Held</span>
              <span className="text-foreground">{formatCurrency(session.depositAmount)}</span>
            </div>
          </div>
          <div className="px-4 py-4 bg-emerald-50 border-t border-emerald-100">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-emerald-800">Deposit Refund</span>
                <p className="text-xs text-emerald-600 mt-0.5">Processing in 1-5 business days</p>
              </div>
              <span className="font-bold text-emerald-700 text-xl">{formatCurrency(refundAmount)}</span>
            </div>
          </div>
        </div>

        {/* Reward Card */}
        {qualifiedForReward && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-primary to-primary/80 rounded-lg p-5 text-primary-foreground"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-primary-foreground/20 rounded-xl flex items-center justify-center">
                <GiftIcon size={24} />
              </div>
              <div>
                <p className="text-xs text-primary-foreground/80 uppercase tracking-wide">Reward Unlocked</p>
                <p className="font-bold text-lg">{formatCurrency(10)} Merch Voucher</p>
              </div>
            </div>
            <p className="text-sm text-primary-foreground/80">
              You&apos;ve earned a voucher for renting 60+ minutes. Check your rewards to claim it!
            </p>
          </motion.div>
        )}

        {/* Actions */}
        <div className="space-y-3 pt-4">
          {qualifiedForReward ? (
            <Button 
              onClick={onViewRewards}
              className="w-full h-12 text-sm font-medium"
            >
              <GiftIcon size={18} />
              View My Reward
            </Button>
          ) : (
            <Button 
              onClick={onStartNew}
              className="w-full h-12 text-sm font-medium"
            >
              <PowerDonLogo size={18} />
              Start New Rental
            </Button>
          )}
          
          {qualifiedForReward && (
            <Button
              variant="outline"
              onClick={onStartNew}
              className="w-full h-12 text-sm font-medium"
            >
              Start Another Rental
            </Button>
          )}
        </div>
      </main>
    </motion.div>
  );
}

// Error View
function ErrorView({
  error,
  onRetry,
  onSupport,
}: {
  error: string | null;
  onRetry: () => void;
  onSupport: () => void;
}) {
  const errorCode = `ERR-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col min-h-screen"
    >
      <MobileHeader subtitle="ERROR" />
      
      <main className="flex-1 flex flex-col items-center justify-center px-5 py-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-20 h-20 bg-destructive/10 rounded-lg flex items-center justify-center mb-6"
        >
          <XCircleIcon size={40} className="text-destructive" />
        </motion.div>

        <div className="text-center max-w-sm mb-6">
          <h1 className="text-xl font-semibold text-foreground mb-2">Something Went Wrong</h1>
          <p className="text-muted-foreground">
            {error || 'We encountered an error processing your request. Please try again.'}
          </p>
        </div>

        {/* Error Details */}
        <div className="w-full max-w-sm bg-muted/50 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Error Reference</span>
            <span className="font-mono text-foreground">{errorCode}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            If this issue persists, please contact support with this reference code for faster assistance.
          </p>
        </div>

        {/* Quick Troubleshooting */}
        <div className="w-full max-w-sm bg-card rounded-xl border border-border p-4 mb-6">
          <p className="text-sm font-medium text-foreground mb-3">Quick troubleshooting:</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary">1.</span>
              <span>Check your internet connection is stable</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">2.</span>
              <span>Ensure the power bank is fully inserted into the slot</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">3.</span>
              <span>Try a different slot if available</span>
            </li>
          </ul>
        </div>

        <div className="w-full max-w-sm space-y-3">
          <Button 
            onClick={onRetry}
            className="w-full h-12 text-sm font-medium"
          >
            <RefreshIcon size={18} />
            Try Again
          </Button>
          <Button
            variant="outline"
            onClick={onSupport}
            className="w-full h-12 text-sm font-medium"
          >
            <HeadphonesIcon size={18} />
            Contact Support
          </Button>
        </div>
      </main>
    </motion.div>
  );
}
