'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MobileHeader } from '@/components/volt/mobile-header';
import { 
  PowerDonLogo, GiftIcon, MapPinIcon, PowerBankIcon, 
  CheckCircleIcon, XCircleIcon, RefreshIcon, ClockIcon,
  ShieldCheckIcon, WalletIcon, HeadphonesIcon
} from '@/components/volt/icons';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { 
  type ActiveSession,
  type RentalState,
  createMockActiveSession,
  formatDuration,
  formatCurrency,
  calculateCharge,
  calculateRewardProgress,
} from '@/lib/session-store';
import { formatTime } from '@/lib/utils';

type StatusView = 'loading' | 'no_session' | 'active' | 'unlocking' | 'returning' | 'completed' | 'expired' | 'error';

interface StatusPageProps {
  isOnline: boolean;
  onNavigate: (tab: 'rent' | 'status' | 'rewards' | 'support') => void;
}

export function StatusPage({ isOnline, onNavigate }: StatusPageProps) {
  const [view, setView] = useState<StatusView>('loading');
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [returnProgress, setReturnProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Load session data
  const loadSession = useCallback(async (showLoading = true) => {
    if (showLoading) setView('loading');
    setError(null);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));

      if (!isOnline) {
        throw new Error('Network unavailable');
      }

      // For demo: randomly have a session or not
      const hasSession = Math.random() > 0.3;
      
      if (hasSession) {
        const mockSession = createMockActiveSession();
        setSession(mockSession);
        setView('active');
      } else {
        setSession(null);
        setView('no_session');
      }

      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
      setView('error');
    }
  }, [isOnline]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Auto-refresh session timer when active
  useEffect(() => {
    if (view !== 'active' || !session) return;

    const interval = setInterval(() => {
      setSession(prev => {
        if (!prev) return prev;
        const newElapsed = prev.elapsedMinutes + 1;
        return {
          ...prev,
          elapsedMinutes: newElapsed,
          currentCharge: calculateCharge(newElapsed, prev.hourlyRate, prev.dailyCap),
        };
      });
    }, 1000); // 1 second = 1 minute for demo

    return () => clearInterval(interval);
  }, [view, session]);

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadSession(false);
    setIsRefreshing(false);
  };

  // Handle return initiation
  const handleReturn = async () => {
    if (!session) return;

    setView('returning');
    setReturnProgress(0);

    // Simulate return process
    const interval = setInterval(() => {
      setReturnProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 500);

    // Complete return after progress
    setTimeout(() => {
      setSession(prev => prev ? { ...prev, status: 'completed' as RentalState } : prev);
      setView('completed');
    }, 5500);
  };

  // Render based on view
  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <AnimatePresence mode="wait">
        {view === 'loading' && (
          <LoadingView key="loading" />
        )}

        {view === 'no_session' && (
          <NoSessionView
            key="no_session"
            isRefreshing={isRefreshing}
            lastRefresh={lastRefresh}
            onRefresh={handleRefresh}
            onStartRental={() => onNavigate('rent')}
          />
        )}

        {view === 'active' && session && (
          <ActiveSessionView
            key="active"
            session={session}
            isOnline={isOnline}
            isRefreshing={isRefreshing}
            lastRefresh={lastRefresh}
            onRefresh={handleRefresh}
            onReturn={handleReturn}
            onSupport={() => onNavigate('support')}
          />
        )}

        {view === 'returning' && session && (
          <ReturningView
            key="returning"
            session={session}
            progress={returnProgress}
          />
        )}

        {view === 'completed' && session && (
          <CompletedView
            key="completed"
            session={session}
            onViewRewards={() => onNavigate('rewards')}
            onStartNew={() => onNavigate('rent')}
          />
        )}

        {view === 'error' && (
          <ErrorView
            key="error"
            error={error}
            onRetry={() => loadSession()}
            onSupport={() => onNavigate('support')}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Loading View
function LoadingView() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col"
    >
      <MobileHeader subtitle="Loading..." />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Spinner className="w-8 h-8 mx-auto text-primary" />
          <p className="text-muted-foreground">Checking your session...</p>
        </div>
      </div>
    </motion.div>
  );
}

// No Active Session View
function NoSessionView({
  isRefreshing,
  lastRefresh,
  onRefresh,
  onStartRental,
}: {
  isRefreshing: boolean;
  lastRefresh: Date | null;
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

        {lastRefresh && (
          <p className="text-xs text-muted-foreground mb-6">
            Last checked: {formatTime(lastRefresh)}
          </p>
        )}

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
  lastRefresh,
  onRefresh,
  onReturn,
  onSupport,
}: {
  session: ActiveSession;
  isOnline: boolean;
  isRefreshing: boolean;
  lastRefresh: Date | null;
  onRefresh: () => void;
  onReturn: () => void;
  onSupport: () => void;
}) {
  const rewardProgress = calculateRewardProgress(session.elapsedMinutes, session.rewardThreshold);
  const isQualified = session.elapsedMinutes >= session.rewardThreshold;
  const currentCharge = calculateCharge(session.elapsedMinutes, session.hourlyRate, session.dailyCap);
  const estimatedRefund = Math.max(0, session.depositAmount - currentCharge);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col min-h-screen"
    >
      <MobileHeader subtitle={`${session.campaignName.toUpperCase()} • ACTIVE`} />
      
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
          <h1 className="text-4xl font-bold text-foreground tabular-nums">
            {formatDuration(session.elapsedMinutes)}
          </h1>
          <p className="text-muted-foreground mt-1">Session in progress</p>
          
          {!isOnline && (
            <div className="mt-2 inline-flex items-center gap-1 text-amber-600 text-sm">
              <XCircleIcon size={14} />
              <span>Offline - data may be outdated</span>
            </div>
          )}
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
                  Congratulations! You&apos;ve qualified for a €10 merch voucher. Return your power bank to claim it.
                </span>
              ) : (
                <>
                  <span className="font-medium text-primary">Keep going!</span>{' '}
                  <span className="text-muted-foreground">
                    Rent for {session.rewardThreshold - session.elapsedMinutes} more minutes to earn your €10 voucher.
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

        {/* Session Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-muted rounded-2xl p-4"
        >
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Session ID</span>
            <span className="font-mono text-foreground">{session.sessionCode}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-muted-foreground">Started</span>
            <span className="text-foreground">{formatTime(session.startTime)}</span>
          </div>
          {lastRefresh && (
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-muted-foreground">Last sync</span>
              <div className="flex items-center gap-2">
                <span className="text-foreground">{formatTime(lastRefresh)}</span>
                <button 
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  className="text-primary hover:text-primary/80"
                  aria-label="Refresh status"
                >
                  {isRefreshing ? (
                    <Spinner className="w-4 h-4" />
                  ) : (
                    <RefreshIcon size={14} className="animate-none" />
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-3"
        >
          <Button 
            onClick={onReturn}
            className="w-full h-14 text-base font-semibold rounded-2xl bg-primary hover:bg-primary/90"
          >
            <MapPinIcon size={18} />
            Find Return Station
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Return to any {session.campaignName} station to end your rental
          </p>
          <button
            onClick={onSupport}
            className="flex items-center justify-center gap-2 w-full text-muted-foreground hover:text-foreground py-2"
          >
            <HeadphonesIcon size={16} />
            <span className="text-sm">Having issues? Get help</span>
          </button>
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
  session: ActiveSession;
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
  onViewRewards,
  onStartNew,
}: {
  session: ActiveSession;
  onViewRewards: () => void;
  onStartNew: () => void;
}) {
  const currentCharge = calculateCharge(session.elapsedMinutes, session.hourlyRate, session.dailyCap);
  const refundAmount = Math.max(0, session.depositAmount - currentCharge);
  const isQualified = session.elapsedMinutes >= session.rewardThreshold;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col min-h-screen"
    >
      <MobileHeader />
      
      <main className="flex-1 px-5 py-6 space-y-6">
        {/* Event Badge */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {session.campaignName}
            </span>
          </div>
        </div>

        {/* Success Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-3xl font-bold text-foreground">Return Complete</h1>
        </motion.div>

        {/* Success Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="flex justify-center"
        >
          <div className="w-24 h-24 bg-primary rounded-3xl flex items-center justify-center">
            <CheckCircleIcon size={48} className="text-primary-foreground" />
          </div>
        </motion.div>

        <p className="text-center text-muted-foreground">
          Successfully returned to <span className="font-semibold text-foreground">{session.stationName}</span>.
        </p>

        {/* Summary Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-2xl border border-border p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Total Duration</p>
              <p className="text-2xl font-bold text-foreground">{formatDuration(session.elapsedMinutes)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Amount Paid</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(currentCharge)}</p>
            </div>
          </div>

          <div className="bg-emerald-50 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <WalletIcon size={18} className="text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-emerald-800">{formatCurrency(refundAmount)} Refunded</p>
                <p className="text-sm text-emerald-700">
                  Sent to your payment method. Your security deposit has been released.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Payment Method</span>
              <span className="font-medium text-foreground">Apple Pay</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Transaction ID</span>
              <span className="font-mono text-foreground">{session.sessionCode}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 pt-2 border-t border-border">
            <ShieldCheckIcon size={14} className="text-primary" />
            <span className="text-xs font-medium text-primary uppercase tracking-wide">PowerDon Secured</span>
          </div>
        </motion.div>

        {/* Reward Notice */}
        {isQualified && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-primary text-primary-foreground rounded-2xl p-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-primary-foreground/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <GiftIcon size={18} />
              </div>
              <div>
                <p className="font-semibold">Reward Earned!</p>
                <p className="text-sm text-primary-foreground/80">
                  You qualified for a €10 merch voucher. Check your rewards to claim it.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-3 pt-4"
        >
          {isQualified ? (
            <Button 
              onClick={onViewRewards}
              className="w-full h-14 text-base font-semibold rounded-2xl bg-primary hover:bg-primary/90"
            >
              <GiftIcon size={18} />
              View Reward
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
          
          <button className="flex items-center justify-center gap-2 w-full text-muted-foreground hover:text-foreground py-2">
            <span className="text-sm">Report an Issue</span>
          </button>
        </motion.div>

        {/* Session ID Footer */}
        <p className="text-center text-xs text-muted-foreground font-mono">
          SESSION #{session.sessionCode}
        </p>
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
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col min-h-screen"
    >
      <MobileHeader />
      
      <main className="flex-1 flex flex-col items-center justify-center px-5 py-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-20 h-20 bg-destructive/10 rounded-2xl flex items-center justify-center mb-6"
        >
          <XCircleIcon size={40} className="text-destructive" />
        </motion.div>

        <div className="text-center max-w-sm mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">Unable to Load Status</h1>
          <p className="text-muted-foreground">
            {error || 'Something went wrong while loading your session status. Please try again.'}
          </p>
        </div>

        <div className="w-full max-w-sm space-y-3">
          <Button 
            onClick={onRetry}
            className="w-full h-14 text-base font-semibold rounded-2xl bg-primary hover:bg-primary/90"
          >
            <RefreshIcon size={18} className="animate-none" />
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
