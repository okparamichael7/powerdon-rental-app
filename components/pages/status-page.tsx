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
      
      <main className="flex-1 flex flex-col items-center justify-center px-5 py-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 bg-muted rounded-2xl flex items-center justify-center mb-6"
        >
          <PowerBankIcon size={40} className="text-muted-foreground" />
        </motion.div>

        <div className="text-center max-w-sm mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">No Active Rental</h1>
          <p className="text-muted-foreground">
            You don&apos;t have any active power bank rentals right now. Start a new rental to stay charged.
          </p>
        </div>

        <div className="w-full max-w-sm space-y-3">
          <Button 
            onClick={onStartRental}
            className="w-full h-14 text-base font-semibold rounded-2xl bg-primary hover:bg-primary/90"
          >
            <PowerDonLogo size={18} />
            Start New Rental
          </Button>
          <Button
            variant="outline"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="w-full h-14 text-base font-semibold rounded-2xl"
          >
            {isRefreshing ? (
              <>
                <Spinner className="w-5 h-5" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshIcon size={18} className="animate-none" />
                Refresh Status
              </>
            )}
          </Button>
        </div>

        <div className="mt-8 p-4 bg-muted rounded-2xl w-full max-w-sm">
          <p className="text-sm text-muted-foreground text-center">
            <span className="font-medium text-foreground">Looking for your rental?</span>
            <br />
            Make sure you&apos;re using the same email address you registered with.
          </p>
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
      
      <main className="flex-1 px-5 py-6 space-y-6">
        {/* Connection Status Banner */}
        {!isOnline && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3"
          >
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <XCircleIcon size={16} className="text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">Connection Lost</p>
              <p className="text-xs text-amber-600">Your rental continues. Data will sync when reconnected.</p>
            </div>
          </motion.div>
        )}

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
          <h1 className="text-4xl font-bold text-foreground tabular-nums">
            {formatDuration(session.elapsedMinutes)}
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
                  <span className="text-xs font-medium">In use</span>
                </div>
              </div>
            </div>
            <PowerBankIcon size={48} className="text-white/20" />
          </div>
          
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
            <div>
              <p className="text-xs text-white/60">From Station</p>
              <p className="font-medium">{session.stationName}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/60">Slot</p>
              <p className="font-medium">{session.stationId}-{String(session.slotNumber).padStart(2, '0')}</p>
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
                {session.rewardThreshold - session.elapsedMinutes} min left
              </span>
            )}
          </div>
          
          <div className="space-y-2">
            <Progress value={rewardProgress} className="h-3" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>0 min</span>
              <span className="text-primary font-medium">{session.rewardThreshold} min goal</span>
            </div>
          </div>

          <div className={`p-3 rounded-xl ${isQualified ? 'bg-emerald-50' : 'bg-secondary'}`}>
            <p className="text-sm">
              {isQualified ? (
                <span className="text-emerald-700 font-medium">
                  Congratulations! You&apos;ve qualified for a {formatCurrency(10)} merch voucher. Return your power bank to claim it.
                </span>
              ) : (
                <>
                  <span className="font-medium text-primary">Keep going!</span>{' '}
                  <span className="text-muted-foreground">
                    Rent for {session.rewardThreshold - session.elapsedMinutes} more minutes to earn your {formatCurrency(10)} voucher.
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
              <span className="text-muted-foreground">Rental ({formatDuration(session.elapsedMinutes)})</span>
              <span className="font-medium text-foreground">{formatCurrency(currentCharge)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Deposit (held)</span>
              <span className="font-medium text-primary">{formatCurrency(session.depositAmount)}</span>
            </div>
            <div className="border-t border-border pt-2 mt-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">On return</span>
                <span className="font-bold text-emerald-600">
                  {formatCurrency(estimatedRefund)} refund
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Session Details Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-card rounded-2xl border border-border overflow-hidden"
        >
          <div className="px-4 py-3 bg-muted/50 border-b border-border flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Session Info</span>
            <button 
              onClick={onRefresh}
              disabled={isRefreshing}
              className="text-primary hover:text-primary/80 flex items-center gap-1 text-xs"
              aria-label="Refresh status"
            >
              {isRefreshing ? (
                <Spinner className="w-3 h-3" />
              ) : (
                <RefreshIcon size={12} className="animate-none" />
              )}
              <span>Refresh</span>
            </button>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Session ID</span>
              <span className="font-mono font-medium text-foreground">{session.sessionCode}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Started</span>
              <span className="text-foreground">{formatTime(session.startTime)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-600 font-medium">Live</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Last Sync</span>
              <span className="text-foreground">{formatTime(lastSync)}</span>
            </div>
          </div>
        </motion.div>

        {/* Session Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card rounded-2xl border border-border overflow-hidden"
        >
          <div className="px-4 py-3 bg-muted/50 border-b border-border">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Activity Timeline</span>
          </div>
          <div className="p-4">
            <div className="space-y-4">
              {/* Scan Event */}
              <div className="flex gap-3">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircleIcon size={14} className="text-emerald-600" />
                  </div>
                  <div className="absolute top-8 left-1/2 -translate-x-1/2 w-px h-4 bg-border" />
                </div>
                <div className="flex-1 pb-2">
                  <p className="text-sm font-medium text-foreground">QR Code Scanned</p>
                  <p className="text-xs text-muted-foreground">{formatTime(session.startTime)} at Station {session.stationId}</p>
                </div>
              </div>
              
              {/* Payment Event */}
              <div className="flex gap-3">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircleIcon size={14} className="text-emerald-600" />
                  </div>
                  <div className="absolute top-8 left-1/2 -translate-x-1/2 w-px h-4 bg-border" />
                </div>
                <div className="flex-1 pb-2">
                  <p className="text-sm font-medium text-foreground">Deposit Authorized</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(session.depositAmount)} hold placed</p>
                </div>
              </div>
              
              {/* Unlock Event */}
              <div className="flex gap-3">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircleIcon size={14} className="text-emerald-600" />
                  </div>
                  <div className="absolute top-8 left-1/2 -translate-x-1/2 w-px h-4 bg-border" />
                </div>
                <div className="flex-1 pb-2">
                  <p className="text-sm font-medium text-foreground">Power Bank Unlocked</p>
                  <p className="text-xs text-muted-foreground">Slot {session.slotNumber} at {session.stationName}</p>
                </div>
              </div>
              
              {/* In Progress Event */}
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <ClockIcon size={14} className="text-primary animate-pulse" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Rental In Progress</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDuration(session.elapsedMinutes)} elapsed • {formatCurrency(currentCharge)} accrued
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="space-y-3"
        >
          <Button 
            onClick={onReturn}
            className="w-full h-14 text-base font-semibold rounded-2xl bg-primary hover:bg-primary/90"
          >
            <MapPinIcon size={18} />
            Return Power Bank
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Return to any {session.campaignName} station to end your rental
          </p>
        </motion.div>

        {/* Help Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-muted/50 rounded-2xl p-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-background rounded-xl flex items-center justify-center flex-shrink-0">
              <HeadphonesIcon size={18} className="text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Need assistance?</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Our support team is available 24/7 to help with any issues.
              </p>
              <button
                onClick={onSupport}
                className="text-sm text-primary font-medium mt-2 hover:underline"
              >
                Contact Support
              </button>
            </div>
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
      
      <main className="flex-1 flex flex-col items-center justify-center px-5 py-8">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 mb-6"
        >
          <RefreshIcon size={64} className="text-primary" />
        </motion.div>

        <div className="text-center mb-8">
          <p className="text-xs font-medium tracking-wider text-primary uppercase mb-2">Processing Return</p>
          <h1 className="text-2xl font-bold text-foreground">Verifying Return...</h1>
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
          
          <div className="bg-card rounded-2xl border border-border p-4">
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
          <h1 className="text-2xl font-bold text-foreground">Return Complete!</h1>
          <p className="mt-1 text-muted-foreground">
            Thank you for using PowerDon. Your rental has been successfully completed.
          </p>
        </div>

        {/* Receipt Card */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
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
            className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-5 text-primary-foreground"
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
              className="w-full h-14 text-base font-semibold rounded-2xl bg-primary hover:bg-primary/90"
            >
              <GiftIcon size={18} />
              View My Reward
            </Button>
          ) : (
            <Button 
              onClick={onStartNew}
              className="w-full h-14 text-base font-semibold rounded-2xl bg-primary hover:bg-primary/90"
            >
              <PowerDonLogo size={18} />
              Start New Rental
            </Button>
          )}
          
          {qualifiedForReward && (
            <Button
              variant="outline"
              onClick={onStartNew}
              className="w-full h-14 text-base font-semibold rounded-2xl"
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
          className="w-20 h-20 bg-destructive/10 rounded-2xl flex items-center justify-center mb-6"
        >
          <XCircleIcon size={40} className="text-destructive" />
        </motion.div>

        <div className="text-center max-w-sm mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Something Went Wrong</h1>
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
            className="w-full h-14 text-base font-semibold rounded-2xl bg-primary hover:bg-primary/90"
          >
            <RefreshIcon size={18} />
            Try Again
          </Button>
          <Button
            variant="outline"
            onClick={onSupport}
            className="w-full h-14 text-base font-semibold rounded-2xl"
          >
            <HeadphonesIcon size={18} />
            Contact Support
          </Button>
        </div>
      </main>
    </motion.div>
  );
}
