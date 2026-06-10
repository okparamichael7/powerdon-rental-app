'use client';

import { useState, useEffect } from 'react';
import { MobileHeader } from '@/components/volt/mobile-header';
import {
  PwaScreen,
  PwaBody,
  PwaScrollBody,
  PwaActionBar,
  PwaCenteredState,
  PwaMetricHero,
  PwaListGroup,
  PwaListRow,
  PWA_BTN_CLASS,
} from '@/components/pwa/pwa-screen';
import {
  PowerdonLogo,
  GiftIcon,
  PowerBankIcon,
  CheckCircleIcon,
  XCircleIcon,
  RefreshIcon,
  HeadphonesIcon,
} from '@/components/volt/icons';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { useAppState } from '@/lib/app-state';
import { rentalSessionAuthHeaders } from '@/lib/client/session-token';
import { getPwaDataLayer } from '@/lib/data';
import { formatDuration, formatCurrency, calculateCharge, calculateRewardProgress } from '@/lib/session-store';
import { formatTime } from '@/lib/utils';

interface StatusPageProps {
  isOnline: boolean;
  onNavigate: (tab: 'rent' | 'status' | 'rewards' | 'support') => void;
}

export function StatusPage({ isOnline, onNavigate }: StatusPageProps) {
  const { activeSession, completedSession, completeRental, setCompletedSession, syncActiveSession, currentStation } = useAppState();
  const rewardValue = activeSession?.rewardValue ?? completedSession?.rewardValue ?? currentStation?.rewardValue ?? 0;

  const [isReturning, setIsReturning] = useState(false);
  const [returnProgress, setReturnProgress] = useState(0);
  const [returnComplete, setReturnComplete] = useState(false);
  const [qualifiedForReward, setQualifiedForReward] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [initialSyncDone, setInitialSyncDone] = useState(!!activeSession);
  const [isRetryingEject, setIsRetryingEject] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void syncActiveSession().finally(() => setInitialSyncDone(true));
  }, [syncActiveSession]);

  const handleRetryEject = async () => {
    if (!activeSession) return;
    setIsRetryingEject(true);
    setError(null);
    try {
      const unlockRes = await fetch(`/api/stations/${activeSession.stationId}/unlock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...rentalSessionAuthHeaders(activeSession.id, activeSession.sessionCode),
        },
        body: JSON.stringify({
          sessionId: activeSession.sessionCode,
          slotNumber: activeSession.slotNumber,
        }),
      });
      if (!unlockRes.ok) {
        const body = await unlockRes.json().catch(() => ({}));
        setError(body.error || 'Could not release power bank. Try again or contact support.');
        return;
      }
      await syncActiveSession();
    } catch {
      setError('Could not reach the station. Check your connection and try again.');
    } finally {
      setIsRetryingEject(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      await syncActiveSession();
    } catch {
      setError('Unable to refresh session. Check your connection.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleReturn = async () => {
    if (!activeSession) return;

    setIsReturning(true);
    setReturnProgress(5);
    setError(null);

    const progressInterval = setInterval(() => {
      setReturnProgress((prev) => Math.min(prev + 2, 90));
    }, 3000);

    try {
      const wait = await getPwaDataLayer().waitForSessionCompletion(activeSession.id, {
        intervalMs: 3000,
        maxAttempts: 100,
        sessionCode: activeSession.sessionCode,
      });

      clearInterval(progressInterval);
      setReturnProgress(95);

      if (!wait.completed) {
        setError(
          wait.timedOut
            ? 'Return not detected yet. Insert the power bank fully into any station slot, then try again.'
            : 'Return could not be confirmed. Contact support if the issue persists.',
        );
        return;
      }

      const result = await completeRental();
      setReturnProgress(100);
      if (result.success) {
        setQualifiedForReward(result.qualifiedForReward);
        setReturnComplete(true);
      } else {
        setError('Failed to finalize rental. Please contact support.');
      }
    } catch {
      clearInterval(progressInterval);
      setError('An error occurred while processing your return.');
    } finally {
      setIsReturning(false);
    }
  };

  const handleDismissCompleted = () => {
    setReturnComplete(false);
    setCompletedSession(null);
  };

  if (!activeSession && !returnComplete) {
    if (!initialSyncDone) {
      return (
        <PwaScreen>
          <PwaCenteredState
            icon={<PowerBankIcon size={26} className="text-muted-foreground" />}
            title="Loading Rental"
            description="Checking your rental status…"
          >
            <Spinner className="h-6 w-6" />
          </PwaCenteredState>
        </PwaScreen>
      );
    }
    return (
      <PwaScreen>
        <NoSessionView
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
          onStartRental={() => onNavigate('rent')}
        />
      </PwaScreen>
    );
  }

  if (isReturning) {
    return (
      <PwaScreen>
        <ReturningView session={activeSession!} progress={returnProgress} />
      </PwaScreen>
    );
  }

  if (returnComplete && completedSession) {
    return (
      <PwaScreen>
        <CompletedView
          session={completedSession}
          qualifiedForReward={qualifiedForReward}
          rewardValue={rewardValue}
          onViewRewards={() => {
            handleDismissCompleted();
            onNavigate('rewards');
          }}
          onStartNew={() => {
            handleDismissCompleted();
            onNavigate('rent');
          }}
        />
      </PwaScreen>
    );
  }

  if (error) {
    return (
      <PwaScreen>
        <ErrorView
          error={error}
          onRetry={() => {
            setError(null);
            handleReturn();
          }}
          onSupport={() => onNavigate('support')}
        />
      </PwaScreen>
    );
  }

  return (
    <PwaScreen>
      {activeSession && (
        <ActiveSessionView
          session={activeSession}
          isOnline={isOnline}
          isRefreshing={isRefreshing}
          isRetryingEject={isRetryingEject}
          onRefresh={handleRefresh}
          onRetryEject={handleRetryEject}
          onReturn={handleReturn}
          onSupport={() => onNavigate('support')}
          rewardValue={activeSession.rewardValue}
        />
      )}
    </PwaScreen>
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
    <>
      <MobileHeader statusBadge="Status" />
      <PwaCenteredState
        icon={<PowerBankIcon size={26} className="text-muted-foreground" />}
        title="No Active Rental"
        description="Start a rental to stay charged."
      >
        <Button onClick={onStartRental} className={PWA_BTN_CLASS}>
          Start Rental
        </Button>
        <Button
          variant="ghost"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="h-10 w-full text-sm"
        >
          {isRefreshing ? (
            <>
              <Spinner className="h-4 w-4" />
              Refreshing
            </>
          ) : (
            'Refresh'
          )}
        </Button>
      </PwaCenteredState>
    </>
  );
}

function ActiveSessionView({
  session,
  isOnline,
  isRefreshing,
  isRetryingEject,
  onRefresh,
  onRetryEject,
  onReturn,
  onSupport,
  rewardValue,
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
    status?: string;
    lastSyncTime?: Date;
  };
  isOnline: boolean;
  isRefreshing: boolean;
  isRetryingEject: boolean;
  onRefresh: () => void;
  onRetryEject: () => void;
  onReturn: () => void;
  onSupport: () => void;
  rewardValue: number;
}) {
  const isUnlocking = session.status === 'unlocking';
  const rewardProgress = calculateRewardProgress(session.elapsedMinutes, session.rewardThreshold);
  const isQualified = session.elapsedMinutes >= session.rewardThreshold;
  const currentCharge = calculateCharge(session.elapsedMinutes, session.hourlyRate, session.dailyCap);
  const estimatedRefund = Math.max(0, session.depositAmount - currentCharge);
  const lastSync = session.lastSyncTime || session.startTime;

  return (
    <>
      <MobileHeader
        stationContext={{ eventName: session.campaignName, stationId: session.stationId }}
        statusBadge={isUnlocking ? 'Unlocking' : 'Active'}
        statusBadgeVariant="active"
        showHelp
        onHelp={onSupport}
      />

      <PwaBody scroll className="gap-3 py-2">
        {isUnlocking && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <Spinner className="h-4 w-4 text-amber-700" />
            <p className="text-xs text-amber-900">
              Releasing power bank from slot {session.slotNumber}. If it does not eject, tap Retry below.
            </p>
          </div>
        )}
        {!isOnline && (
          <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
            <XCircleIcon size={14} className="shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Offline — data syncs when reconnected</p>
          </div>
        )}

        <PwaMetricHero
          label="Active"
          value={formatDuration(session.elapsedMinutes)}
          sublabel={`Started ${formatTime(session.startTime)}`}
        />

        <div className="rounded-xl bg-foreground p-4 text-background">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wider text-background/60">
                Powerdon Pro
              </p>
              <p className="mt-0.5 truncate text-sm font-medium">{session.stationName}</p>
              <p className="text-xs text-background/70">Slot {session.slotNumber}</p>
            </div>
            <PowerBankIcon size={28} className="shrink-0 text-background/25" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Reward progress</p>
            {isQualified ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                Qualified
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                {session.rewardThreshold - session.elapsedMinutes}m left
              </span>
            )}
          </div>
          <Progress value={rewardProgress} className="h-1.5" />
          {isQualified && (
            <p className="text-xs text-muted-foreground">
              Return to claim your {formatCurrency(rewardValue)} voucher.
            </p>
          )}
        </div>

        <PwaListGroup>
          <PwaListRow label="Current charge" value={formatCurrency(currentCharge)} />
          <PwaListRow label="Deposit held" value={formatCurrency(session.depositAmount)} />
          <PwaListRow label="Est. refund" value={formatCurrency(estimatedRefund)} />
          <PwaListRow
            label="Session"
            value={session.sessionCode}
            hint={
              isRefreshing
                ? 'Refreshing…'
                : `Updated ${formatTime(lastSync)} · tap to refresh`
            }
            onClick={onRefresh}
          />
        </PwaListGroup>
      </PwaBody>

      <PwaActionBar>
        {isUnlocking ? (
          <Button
            onClick={onRetryEject}
            disabled={isRetryingEject}
            className={PWA_BTN_CLASS}
          >
            {isRetryingEject ? (
              <>
                <Spinner className="h-4 w-4" />
                Releasing…
              </>
            ) : (
              'Retry Release'
            )}
          </Button>
        ) : (
          <Button onClick={onReturn} className={PWA_BTN_CLASS}>
            Return Power Bank
          </Button>
        )}
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          {isUnlocking
            ? 'Payment confirmed — waiting for the cabinet to eject your power bank'
            : 'Return at any station to end rental'}
        </p>
      </PwaActionBar>
    </>
  );
}

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
    <>
      <MobileHeader statusBadge="Returning" statusBadgeVariant="active" />
      <PwaCenteredState
        icon={<RefreshIcon size={28} className="animate-spin text-muted-foreground" />}
        title="Waiting for return"
        description="Insert your power bank fully into any available slot. We will detect the return automatically."
      >
        <div className="w-full space-y-4">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-[width] duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <PwaListGroup>
            <PwaListRow label="Session" value={session.sessionCode} />
            <PwaListRow label="Duration" value={formatDuration(session.elapsedMinutes)} />
          </PwaListGroup>
        </div>
      </PwaCenteredState>
    </>
  );
}

function CompletedView({
  session,
  qualifiedForReward,
  rewardValue,
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
  rewardValue: number;
  onViewRewards: () => void;
  onStartNew: () => void;
}) {
  const finalCharge = calculateCharge(session.elapsedMinutes, session.hourlyRate, session.dailyCap);
  const refundAmount = Math.max(0, session.depositAmount - finalCharge);
  const completedAt = new Date();

  return (
    <>
      <MobileHeader statusBadge="Completed" statusBadgeVariant="success" />

      <PwaScrollBody className="space-y-4 py-3">
        <div className="flex flex-col items-center pt-2 text-center">
          <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-volt-success/15">
            <CheckCircleIcon size={36} className="text-volt-success" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">Return Complete!</h1>
          <p className="mt-1 max-w-[280px] text-sm text-muted-foreground">
            Thank you for using Powerdon. Your rental has been successfully completed.
          </p>
        </div>

        <PwaListGroup>
          <PwaListRow label="Receipt" value={session.sessionCode} />
          <PwaListRow label="Completed" value={formatTime(completedAt)} />
          {session.stationName ? (
            <PwaListRow label="Returned at" value={session.stationName} />
          ) : null}
          <PwaListRow label="Total duration" value={formatDuration(session.elapsedMinutes)} />
          <PwaListRow label="Rental fee" value={formatCurrency(finalCharge)} />
          <PwaListRow label="Deposit held" value={formatCurrency(session.depositAmount)} />
          <PwaListRow
            label="Deposit refund"
            value={formatCurrency(refundAmount)}
            hint="Processing in 1–5 business days"
            className="bg-volt-success/10"
          />
        </PwaListGroup>

        {qualifiedForReward && (
          <div className="rounded-xl bg-gradient-to-br from-primary to-primary/80 p-4 text-primary-foreground">
            <div className="mb-2 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary-foreground/20">
                <GiftIcon size={22} />
              </div>
              <div className="min-w-0 text-left">
                <p className="text-[10px] font-medium uppercase tracking-wide text-primary-foreground/80">
                  Reward unlocked
                </p>
                <p className="font-semibold">{formatCurrency(rewardValue)} merch voucher</p>
              </div>
            </div>
            <p className="text-left text-xs text-primary-foreground/80">
              You&apos;ve earned a voucher for renting 60+ minutes. Check your rewards to claim it!
            </p>
          </div>
        )}
      </PwaScrollBody>

      <PwaActionBar>
        {qualifiedForReward ? (
          <>
            <Button onClick={onViewRewards} className="h-12 w-full text-sm font-medium">
              <GiftIcon size={18} />
              View My Reward
            </Button>
            <Button
              variant="outline"
              onClick={onStartNew}
              className="mt-2 h-12 w-full text-sm font-medium"
            >
              Start Another Rental
            </Button>
          </>
        ) : (
          <Button onClick={onStartNew} className="h-12 w-full text-sm font-medium">
            <PowerdonLogo size={18} />
            Start New Rental
          </Button>
        )}
      </PwaActionBar>
    </>
  );
}

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
    <>
      <MobileHeader statusBadge="Error" statusBadgeVariant="error" showHelp onHelp={onSupport} />
      <PwaCenteredState
        icon={<XCircleIcon size={32} className="text-destructive" />}
        title="Something Went Wrong"
        description={error || 'We encountered an error processing your request. Please try again.'}
      >
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-left text-xs text-muted-foreground">
          Reference: <span className="font-mono text-foreground">{errorCode}</span>
        </p>
        <Button onClick={onRetry} className="h-12 w-full text-sm font-medium">
          <RefreshIcon size={18} />
          Try Again
        </Button>
        <Button variant="outline" onClick={onSupport} className="h-12 w-full text-sm font-medium">
          <HeadphonesIcon size={18} />
          Contact Support
        </Button>
      </PwaCenteredState>
    </>
  );
}
