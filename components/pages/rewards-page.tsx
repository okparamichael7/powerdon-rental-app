'use client';

import { useState } from 'react';
import { MobileHeader } from '@/components/volt/mobile-header';
import {
  PwaScreen,
  PwaBody,
  PwaScrollBody,
  PwaActionBar,
  PwaCenteredState,
  PwaSection,
  PwaListGroup,
  PwaListRow,
} from '@/components/pwa/pwa-screen';
import {
  PowerDonLogo,
  GiftIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  CopyIcon,
  MapPinIcon,
  RefreshIcon,
} from '@/components/volt/icons';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { useAppState } from '@/lib/app-state';
import { formatDuration, formatCurrency, type UserReward } from '@/lib/session-store';
import { formatDate } from '@/lib/utils';

interface RewardsPageProps {
  isOnline: boolean;
  onNavigate: (tab: 'rent' | 'status' | 'rewards' | 'support') => void;
}

export function RewardsPage({ isOnline, onNavigate }: RewardsPageProps) {
  const { rewards, activeSession, redeemReward, syncActiveSession } = useAppState();

  const [selectedReward, setSelectedReward] = useState<UserReward | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const issuedRewards = rewards.filter((r) => r.status === 'issued');
  const redeemedRewards = rewards.filter((r) => r.status === 'redeemed');
  const expiredRewards = rewards.filter((r) => r.status === 'expired');

  const handleRefresh = async () => {
    if (!isOnline) return;
    setIsRefreshing(true);
    try {
      await syncActiveSession();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRedeem = async (rewardId: string, rewardCode: string) => {
    setIsRedeeming(true);
    await redeemReward(rewardId, rewardCode);
    setIsRedeeming(false);
    setSelectedReward(null);
  };

  const getTimeRemaining = (expiresAt: Date): string => {
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();

    if (diff <= 0) return 'Expired';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m left`;
    }
    return `${minutes}m left`;
  };

  const hasActiveSession = !!activeSession;
  const hasIssuedRewards = issuedRewards.length > 0;
  const hasAnyRewards = rewards.length > 0;

  if (hasActiveSession && !hasIssuedRewards) {
    return (
      <PwaScreen>
        <InProgressView
          elapsedMinutes={activeSession.elapsedMinutes}
          thresholdMinutes={activeSession.rewardThreshold}
          rewardValue={activeSession.rewardValue}
          rewardDescription={activeSession.rewardDescription}
          onViewStatus={() => onNavigate('status')}
        />
      </PwaScreen>
    );
  }

  if (selectedReward) {
    if (selectedReward.status === 'issued') {
      return (
        <PwaScreen>
          <IssuedDetailView
            reward={selectedReward}
            copied={copied}
            isRedeeming={isRedeeming}
            onCopy={handleCopy}
            onRedeem={handleRedeem}
            onBack={() => setSelectedReward(null)}
            getTimeRemaining={getTimeRemaining}
          />
        </PwaScreen>
      );
    }
    if (selectedReward.status === 'redeemed') {
      return (
        <PwaScreen>
          <RedeemedDetailView
            reward={selectedReward}
            onBack={() => setSelectedReward(null)}
            onStartRental={() => onNavigate('rent')}
          />
        </PwaScreen>
      );
    }
  }

  if (!hasAnyRewards) {
    return (
      <PwaScreen>
        <NoRewardsView
          onStartRental={() => onNavigate('rent')}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
      </PwaScreen>
    );
  }

  return (
    <PwaScreen>
      <RewardsListView
        issuedRewards={issuedRewards}
        redeemedRewards={redeemedRewards}
        expiredRewards={expiredRewards}
        onSelectReward={setSelectedReward}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        getTimeRemaining={getTimeRemaining}
      />
    </PwaScreen>
  );
}

function NoRewardsView({
  onStartRental,
  onRefresh,
  isRefreshing,
}: {
  onStartRental: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  return (
    <>
      <MobileHeader subtitle="REWARDS" />
      <PwaCenteredState
        icon={<GiftIcon size={26} className="text-muted-foreground" />}
        title="No Rewards Yet"
        description="Start renting a power bank to earn rewards! Rent for at least 60 minutes to qualify for exclusive perks."
      >
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-left">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <GiftIcon size={16} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">How to earn rewards</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Rent a power bank for 60+ minutes during a campaign to unlock exclusive vouchers and perks.
              </p>
            </div>
          </div>
        </div>
      </PwaCenteredState>
      <PwaActionBar>
        <Button onClick={onStartRental} className="h-12 w-full text-sm font-medium">
          <PowerDonLogo size={18} />
          Start Rental
        </Button>
        <Button
          variant="outline"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="mt-2 h-12 w-full text-sm font-medium"
        >
          {isRefreshing ? (
            <>
              <Spinner className="h-4 w-4" />
              Checking...
            </>
          ) : (
            <>
              <RefreshIcon size={18} className="animate-none" />
              Refresh
            </>
          )}
        </Button>
      </PwaActionBar>
    </>
  );
}

function InProgressView({
  elapsedMinutes,
  thresholdMinutes,
  rewardValue,
  rewardDescription,
  onViewStatus,
}: {
  elapsedMinutes: number;
  thresholdMinutes: number;
  rewardValue: number;
  rewardDescription: string;
  onViewStatus: () => void;
}) {
  const progress = Math.min((elapsedMinutes / thresholdMinutes) * 100, 100);
  const minutesRemaining = Math.max(0, thresholdMinutes - elapsedMinutes);
  const isQualified = elapsedMinutes >= thresholdMinutes;
  const radius = 48;
  const circumference = 2 * Math.PI * radius;

  return (
    <>
      <MobileHeader subtitle="REWARDS" />
      <PwaBody className="gap-4 py-3">
        <div className="text-center">
          <div
            className={`mb-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
              isQualified
                ? 'bg-volt-success/15 text-volt-success'
                : 'bg-amber-50 text-amber-700'
            }`}
          >
            {isQualified ? <CheckCircleIcon size={12} /> : <ClockIcon size={12} />}
            {isQualified ? 'Qualified!' : 'In Progress'}
          </div>
          <h1 className="text-lg font-semibold text-foreground">
            {isQualified ? 'You Did It!' : 'Almost There!'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isQualified
              ? 'Return your power bank to claim your reward.'
              : 'Keep your rental active to earn your reward.'}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="flex justify-center">
            <div className="relative size-28">
              <svg className="size-full -rotate-90">
                <circle
                  cx="56"
                  cy="56"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-muted"
                />
                <circle
                  cx="56"
                  cy="56"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - progress / 100)}
                  strokeLinecap="round"
                  className={isQualified ? 'text-volt-success' : 'text-primary'}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold tabular-nums text-foreground">
                  {Math.round(progress)}%
                </span>
                <span className="text-[11px] text-muted-foreground">complete</span>
              </div>
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">
              {isQualified ? (
                <>Return to claim your voucher</>
              ) : (
                <>{minutesRemaining} more minutes to qualify</>
              )}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {elapsedMinutes} of {thresholdMinutes} minutes completed
            </p>
          </div>

          <Progress value={progress} className="h-1.5" />
        </div>

        <div className="rounded-xl bg-gradient-to-br from-primary to-primary/80 p-4 text-primary-foreground">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/20">
              <GiftIcon size={20} />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-[10px] font-medium uppercase tracking-wide text-primary-foreground/80">
                {isQualified ? 'Ready to Claim' : 'Upcoming Reward'}
              </p>
              <p className="font-semibold">
                {rewardValue > 0
                  ? `${formatCurrency(rewardValue)} Merch Voucher`
                  : rewardDescription || 'Campaign reward'}
              </p>
            </div>
          </div>
        </div>
      </PwaBody>

      <PwaActionBar>
        <Button onClick={onViewStatus} className="h-12 w-full text-sm font-medium">
          {isQualified ? 'Return Power Bank' : 'View Active Rental'}
        </Button>
      </PwaActionBar>
    </>
  );
}

function RewardsListView({
  issuedRewards,
  redeemedRewards,
  expiredRewards,
  onSelectReward,
  onRefresh,
  isRefreshing,
  getTimeRemaining,
}: {
  issuedRewards: UserReward[];
  redeemedRewards: UserReward[];
  expiredRewards: UserReward[];
  onSelectReward: (reward: UserReward) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  getTimeRemaining: (date: Date) => string;
}) {
  return (
    <>
      <MobileHeader subtitle="REWARDS" />

      <PwaScrollBody className="space-y-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Your Rewards</h1>
            <p className="text-xs text-muted-foreground">
              {issuedRewards.length} active, {redeemedRewards.length} redeemed
            </p>
          </div>
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 text-muted-foreground hover:text-foreground"
            aria-label="Refresh rewards"
          >
            {isRefreshing ? (
              <Spinner className="h-5 w-5" />
            ) : (
              <RefreshIcon size={20} className="animate-none" />
            )}
          </button>
        </div>

        {issuedRewards.length > 0 && (
          <PwaSection title="Active">
            <PwaListGroup>
              {issuedRewards.map((reward) => (
                <PwaListRow
                  key={reward.id}
                  label={`${formatCurrency(reward.value)} ${reward.description}`}
                  hint={reward.campaignName}
                  value={
                    <span className="text-xs font-medium text-amber-600">
                      {getTimeRemaining(reward.expiresAt)}
                    </span>
                  }
                  onClick={() => onSelectReward(reward)}
                  className="min-h-14 [&>div>p:first-child]:font-medium [&>div>p:first-child]:text-foreground"
                />
              ))}
            </PwaListGroup>
          </PwaSection>
        )}

        {redeemedRewards.length > 0 && (
          <PwaSection title="Redeemed">
            <PwaListGroup>
              {redeemedRewards.map((reward) => (
                <PwaListRow
                  key={reward.id}
                  label={`${formatCurrency(reward.value)} ${reward.description}`}
                  hint={reward.campaignName}
                  value={<span className="text-xs font-medium text-volt-success">Used</span>}
                  onClick={() => onSelectReward(reward)}
                  className="min-h-14 opacity-80 [&>div>p:first-child]:font-medium [&>div>p:first-child]:text-foreground"
                />
              ))}
            </PwaListGroup>
          </PwaSection>
        )}

        {expiredRewards.length > 0 && (
          <PwaSection title="Expired">
            <PwaListGroup>
              {expiredRewards.map((reward) => (
                <PwaListRow
                  key={reward.id}
                  label={`${formatCurrency(reward.value)} ${reward.description}`}
                  hint={reward.campaignName}
                  value={<span className="text-xs font-medium text-muted-foreground">Expired</span>}
                  className="min-h-14 opacity-50 [&>div>p:first-child]:font-medium [&>div>p:first-child]:text-muted-foreground"
                />
              ))}
            </PwaListGroup>
          </PwaSection>
        )}
      </PwaScrollBody>
    </>
  );
}

function IssuedDetailView({
  reward,
  copied,
  isRedeeming,
  onCopy,
  onRedeem,
  onBack,
  getTimeRemaining,
}: {
  reward: UserReward;
  copied: boolean;
  isRedeeming: boolean;
  onCopy: (code: string) => void;
  onRedeem: (id: string, code: string) => void;
  onBack: () => void;
  getTimeRemaining: (date: Date) => string;
}) {
  const timeRemaining = getTimeRemaining(reward.expiresAt);
  const isExpiringSoon = reward.expiresAt.getTime() - Date.now() < 3 * 60 * 60 * 1000;

  return (
    <>
      <MobileHeader title="Your Reward" showBack onBack={onBack} />

      <PwaScrollBody className="space-y-4 py-3">
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-primary">
            <CheckCircleIcon size={14} />
            <span className="text-[11px] font-semibold uppercase tracking-wide">
              Goal Reached — {reward.actualMinutes} Min Session
            </span>
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-xl font-bold text-foreground">Reward Unlocked!</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enjoy your perk for supporting sustainable energy at {reward.campaignName}.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="relative flex h-28 items-center justify-center overflow-hidden bg-gradient-to-br from-primary to-primary/80">
            <div className="relative text-center text-primary-foreground">
              <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-primary-foreground/20 px-2 py-0.5 text-[10px] font-medium">
                Official Partnership
              </div>
              <p className="text-3xl font-bold tabular-nums">{formatCurrency(reward.value)}</p>
              <p className="text-xs font-medium uppercase tracking-wider opacity-80">
                {reward.description}
              </p>
            </div>
          </div>

          <div className="space-y-3 p-4">
            <p className="text-center text-xs text-muted-foreground">
              Present this code at any {reward.campaignName} merchandise station to redeem.
            </p>

            <div className="relative">
              <div className="rounded-xl bg-muted p-3 text-center">
                <p className="font-mono text-lg font-bold tracking-wider text-foreground">
                  {reward.code}
                </p>
              </div>
              <button
                onClick={() => onCopy(reward.code)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 hover:bg-background"
                aria-label="Copy code"
              >
                {copied ? (
                  <CheckCircleIcon size={18} className="text-volt-success" />
                ) : (
                  <CopyIcon size={18} className="text-muted-foreground" />
                )}
              </button>
            </div>

            <div
              className={`flex items-center justify-center gap-1.5 py-1 ${
                isExpiringSoon ? 'text-destructive' : 'text-muted-foreground'
              }`}
            >
              <ClockIcon size={12} />
              <span className="text-xs font-medium">{timeRemaining}</span>
            </div>
          </div>
        </div>
      </PwaScrollBody>

      <PwaActionBar>
        <Button
          onClick={() => onRedeem(reward.id, reward.code)}
          disabled={isRedeeming}
          className="h-12 w-full text-sm font-medium"
        >
          {isRedeeming ? (
            <>
              <Spinner className="h-4 w-4" />
              Redeeming...
            </>
          ) : (
            <>
              <MapPinIcon size={18} />
              Mark as Redeemed
            </>
          )}
        </Button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Tap after presenting to staff at merch booth
        </p>
      </PwaActionBar>
    </>
  );
}

function RedeemedDetailView({
  reward,
  onBack,
  onStartRental,
}: {
  reward: UserReward;
  onBack: () => void;
  onStartRental: () => void;
}) {
  return (
    <>
      <MobileHeader title="Reward Details" showBack onBack={onBack} />

      <PwaScrollBody className="space-y-4 py-3">
        <div className="flex flex-col items-center pt-2 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-volt-success/15">
            <CheckCircleIcon size={28} className="text-volt-success" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">Reward Redeemed</h1>
          <p className="mt-1 max-w-[280px] text-sm text-muted-foreground">
            {reward.redemptionLocation
              ? `You successfully used this voucher at ${reward.redemptionLocation}.`
              : 'This voucher has been marked as redeemed.'}
          </p>
        </div>

        <PwaListGroup>
          <PwaListRow label="Value" value={formatCurrency(reward.value)} />
          <PwaListRow label="Campaign" value={reward.campaignName} />
          <PwaListRow label="Session Duration" value={formatDuration(reward.actualMinutes)} />
          {reward.redeemedAt && (
            <PwaListRow label="Redeemed" value={formatDate(reward.redeemedAt)} />
          )}
        </PwaListGroup>

        <div className="rounded-xl bg-muted p-3">
          <p className="text-center text-xs text-muted-foreground">
            Rent again for 60+ minutes to earn another reward!
          </p>
        </div>
      </PwaScrollBody>

      <PwaActionBar>
        <Button onClick={onStartRental} className="h-12 w-full text-sm font-medium">
          <PowerDonLogo size={18} />
          Start New Rental
        </Button>
      </PwaActionBar>
    </>
  );
}
