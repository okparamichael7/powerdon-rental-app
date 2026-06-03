'use client';

import { useState } from 'react';
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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    setIsRefreshing(false);
  };

  const handleReturn = async () => {
    if (!activeSession) return;

    setIsReturning(true);
    setReturnProgress(0);
    setError(null);

    const interval = setInterval(() => {
      setReturnProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 15;
      });
    }, 250);

    await new Promise(resolve => setTimeout(resolve, 2000));

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

  const handleDismissCompleted = () => {
    setReturnComplete(false);
    setCompletedSession(null);
  };

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

  if (isReturning) {
    return (
      <div className="flex flex-col min-h-screen bg-background pb-20">
        <ReturningView session={activeSession!} progress={returnProgress} />
      </div>
    );
  }

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

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
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
    </div>
  );
}

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
    <div className="flex flex-col min-h-screen animate-in fade-in duration-150">
      <MobileHeader subtitle="STATUS" />
      
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-6">
          <PowerBankIcon size={24} className="text-muted-foreground" />
        </div>

        <div className="text-center max-w-xs mb-8">
          <h1 className="text-lg font-medium text-foreground mb-2">No Active Rental</h1>
          <p className="text-sm text-muted-foreground">Start a rental to stay charged.</p>
        </div>

        <div className="w-full max-w-xs space-y-3">
          <Button onClick={onStartRental} className="w-full h-12 text-sm font-medium">
            Start Rental
          </Button>
          <Button
            variant="ghost"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="w-full h-10 text-sm"
          >
            {isRefreshing ? <><Spinner className="w-4 h-4" /> Refreshing</> : 'Refresh'}
          </Button>
        </div>
      </main>
    </div>
  );
}

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

  return (
    <div className="flex flex-col min-h-screen animate-in fade-in duration-150">
      <MobileHeader subtitle={`${session.campaignName.toUpperCase()} • ACTIVE`} />
      
      <main className="flex-1 px-5 py-6 space-y-6">
        {!isOnline && (
          <div className="bg-muted rounded-md px-3 py-2 flex items-center gap-2">
            <XCircleIcon size={14} className="text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Offline - data will sync when reconnected</p>
          </div>
        )}

        <div className="text-center pt-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Active</p>
          <h1 className="text-4xl font-medium text-foreground tabular-nums">
            {formatDuration(session.elapsedMinutes)}
          </h1>
        </div>

        <div className="bg-foreground text-background rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-background/60 uppercase tracking-wide">Power Bank</p>
              <p className="text-sm font-medium mt-0.5">PowerDon Pro</p>
            </div>
            <PowerBankIcon size={28} className="text-background/20" />
          </div>
          <div className="mt-3 pt-3 border-t border-background/10 flex items-center justify-between text-sm">
            <span className="text-background/60">{session.stationName}</span>
            <span>Slot {session.slotNumber}</span>
          </div>
        </div>

        <div className="space-y-3">
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
          <Progress value={rewardProgress} className="h-1.5" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>0m</span>
            <span>{session.rewardThreshold}m</span>
          </div>
          {isQualified && (
            <p className="text-xs text-muted-foreground">
              Return to claim your {formatCurrency(10)} voucher.
            </p>
          )}
        </div>

        <div className="space-y-2 py-3 border-t border-border">
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
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Session</p>
            <button 
              onClick={onRefresh}
              disabled={isRefreshing}
              className="text-xs text-muted-foreground active:opacity-70 flex items-center gap-1"
            >
              {isRefreshing ? <Spinner className="w-3 h-3" /> : 'Refresh'}
            </button>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">ID</span>
              <span className="font-mono text-foreground">{session.sessionCode}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Started</span>
              <span className="text-foreground">{formatTime(session.startTime)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <Button onClick={onReturn} className="w-full h-12 text-sm font-medium">
            Return Power Bank
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Return at any station to end rental
          </p>
        </div>

        <div className="bg-muted rounded-lg p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Need help?</p>
            <button onClick={onSupport} className="text-sm text-foreground font-medium active:opacity-70">
              Contact Support
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function ReturningView({
  session,
  progress,
}: {
  session: { sessionCode: string; elapsedMinutes: number };
  progress: number;
}) {
  return (
    <div className="flex flex-col min-h-screen animate-in fade-in duration-150">
      <MobileHeader subtitle="RETURNING" />
      
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-12 h-12 mb-6">
          <Spinner className="w-full h-full text-primary" />
        </div>

        <div className="text-center mb-6">
          <h1 className="text-lg font-medium text-foreground">Processing return</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Please wait while we verify your return.
          </p>
        </div>

        <div className="w-full max-w-sm">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-primary transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <div className="bg-card rounded-lg border border-border p-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Session</span>
              <span className="font-mono text-foreground">{session.sessionCode}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Duration</span>
              <span className="text-foreground">{formatDuration(session.elapsedMinutes)}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

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
  };
  qualifiedForReward: boolean;
  onViewRewards: () => void;
  onStartNew: () => void;
}) {
  const finalCharge = calculateCharge(session.elapsedMinutes, session.hourlyRate, session.dailyCap);
  const refundAmount = Math.max(0, session.depositAmount - finalCharge);
  const completedAt = new Date();

  return (
    <div className="flex flex-col min-h-screen animate-in fade-in duration-150">
      <MobileHeader subtitle="COMPLETED" />
      
      <main className="flex-1 px-5 py-6 space-y-5">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
            <CheckCircleIcon size={32} className="text-emerald-600" />
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-xl font-semibold text-foreground">Return Complete!</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Thank you for using PowerDon.
          </p>
        </div>

        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/50 border-b border-border flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Receipt</span>
            <span className="font-mono text-xs text-foreground">{session.sessionCode}</span>
          </div>
          <div className="p-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Completed</span>
              <span className="text-foreground">{formatTime(completedAt)}</span>
            </div>
            {session.stationName && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Returned At</span>
                <span className="text-foreground">{session.stationName}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Duration</span>
              <span className="font-medium text-foreground">{formatDuration(session.elapsedMinutes)}</span>
            </div>
          </div>
          <div className="px-3 py-2.5 border-t border-border space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Rental Fee</span>
              <span className="text-foreground">{formatCurrency(finalCharge)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Deposit Held</span>
              <span className="text-foreground">{formatCurrency(session.depositAmount)}</span>
            </div>
          </div>
          <div className="px-3 py-3 bg-emerald-50 border-t border-emerald-100">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-emerald-700">Refund</span>
                <p className="text-lg font-semibold text-emerald-700">{formatCurrency(refundAmount)}</p>
              </div>
              <CheckCircleIcon size={20} className="text-emerald-600" />
            </div>
          </div>
        </div>

        {qualifiedForReward && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start gap-3">
              <GiftIcon size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Reward Earned!</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  You&apos;ve earned a {formatCurrency(10)} voucher.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3 pt-2">
          {qualifiedForReward ? (
            <Button onClick={onViewRewards} className="w-full h-12 text-sm font-medium">
              View My Rewards
            </Button>
          ) : (
            <Button onClick={onStartNew} className="w-full h-12 text-sm font-medium">
              Start New Rental
            </Button>
          )}
          {qualifiedForReward && (
            <Button variant="outline" onClick={onStartNew} className="w-full h-11 text-sm">
              Start New Rental
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}

function ErrorView({
  error,
  onRetry,
  onSupport,
}: {
  error: string;
  onRetry: () => void;
  onSupport: () => void;
}) {
  return (
    <div className="flex flex-col min-h-screen animate-in fade-in duration-150">
      <MobileHeader subtitle="ERROR" />
      
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-14 h-14 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
          <XCircleIcon size={24} className="text-destructive" />
        </div>

        <div className="text-center max-w-xs mb-8">
          <h1 className="text-lg font-medium text-foreground mb-2">Return Failed</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>

        <div className="w-full max-w-xs space-y-3">
          <Button onClick={onRetry} className="w-full h-12 text-sm font-medium">
            Try Again
          </Button>
          <Button variant="outline" onClick={onSupport} className="w-full h-11 text-sm">
            Contact Support
          </Button>
        </div>
      </main>
    </div>
  );
}
