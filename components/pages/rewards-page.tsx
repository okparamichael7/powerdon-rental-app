'use client';

import { useState } from 'react';
import { MobileHeader } from '@/components/volt/mobile-header';
import { 
  PowerDonLogo, GiftIcon, CheckCircleIcon, XCircleIcon, 
  ClockIcon, CopyIcon, MapPinIcon, RefreshIcon
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
  const { rewards, activeSession, redeemReward } = useAppState();
  
  const [selectedReward, setSelectedReward] = useState<UserReward | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const issuedRewards = rewards.filter(r => r.status === 'issued');
  const redeemedRewards = rewards.filter(r => r.status === 'redeemed');
  const expiredRewards = rewards.filter(r => r.status === 'expired');

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    setIsRefreshing(false);
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRedeem = async (rewardId: string) => {
    setIsRedeeming(true);
    await redeemReward(rewardId);
    setIsRedeeming(false);
    setSelectedReward(null);
  };

  const getTimeRemaining = (expiresAt: Date): string => {
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  const hasActiveSession = !!activeSession;
  const hasIssuedRewards = issuedRewards.length > 0;
  const hasAnyRewards = rewards.length > 0;

  if (hasActiveSession && !hasIssuedRewards) {
    return (
      <div className="flex flex-col min-h-screen bg-background pb-20">
        <InProgressView
          elapsedMinutes={activeSession.elapsedMinutes}
          thresholdMinutes={activeSession.rewardThreshold}
          onViewStatus={() => onNavigate('status')}
        />
      </div>
    );
  }

  if (selectedReward) {
    if (selectedReward.status === 'issued') {
      return (
        <div className="flex flex-col min-h-screen bg-background pb-20">
          <IssuedDetailView
            reward={selectedReward}
            copied={copied}
            isRedeeming={isRedeeming}
            onCopy={handleCopy}
            onRedeem={handleRedeem}
            onBack={() => setSelectedReward(null)}
            getTimeRemaining={getTimeRemaining}
          />
        </div>
      );
    }
    if (selectedReward.status === 'redeemed') {
      return (
        <div className="flex flex-col min-h-screen bg-background pb-20">
          <RedeemedDetailView
            reward={selectedReward}
            onBack={() => setSelectedReward(null)}
            onStartRental={() => onNavigate('rent')}
          />
        </div>
      );
    }
  }

  if (!hasAnyRewards) {
    return (
      <div className="flex flex-col min-h-screen bg-background pb-20">
        <NoRewardsView
          onStartRental={() => onNavigate('rent')}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <RewardsListView
        issuedRewards={issuedRewards}
        redeemedRewards={redeemedRewards}
        expiredRewards={expiredRewards}
        onSelectReward={setSelectedReward}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        getTimeRemaining={getTimeRemaining}
      />
    </div>
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
    <div className="flex flex-col min-h-screen animate-in fade-in duration-150">
      <MobileHeader subtitle="REWARDS" />
      
      <main className="flex-1 flex flex-col items-center justify-center px-5 py-8">
        <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mb-5">
          <GiftIcon size={32} className="text-muted-foreground" />
        </div>

        <div className="text-center max-w-sm mb-6">
          <h1 className="text-xl font-semibold text-foreground mb-2">No Rewards Yet</h1>
          <p className="text-sm text-muted-foreground">
            Rent for 60+ minutes to earn exclusive vouchers.
          </p>
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 w-full max-w-sm mb-6">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <GiftIcon size={16} className="text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground text-sm">How to earn</p>
              <p className="text-xs text-muted-foreground">
                Rent 60+ minutes during a campaign to unlock rewards.
              </p>
            </div>
          </div>
        </div>

        <div className="w-full max-w-sm space-y-3">
          <Button onClick={onStartRental} className="w-full h-12 text-sm font-medium gap-2">
            <PowerDonLogo size={16} />
            Start Rental
          </Button>
          <Button
            variant="outline"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="w-full h-11 text-sm"
          >
            {isRefreshing ? <><Spinner className="w-4 h-4" /> Checking...</> : 'Refresh'}
          </Button>
        </div>
      </main>
    </div>
  );
}

function InProgressView({
  elapsedMinutes,
  thresholdMinutes,
  onViewStatus,
}: {
  elapsedMinutes: number;
  thresholdMinutes: number;
  onViewStatus: () => void;
}) {
  const progress = Math.min((elapsedMinutes / thresholdMinutes) * 100, 100);
  const minutesRemaining = Math.max(0, thresholdMinutes - elapsedMinutes);
  const isQualified = elapsedMinutes >= thresholdMinutes;

  return (
    <div className="flex flex-col min-h-screen animate-in fade-in duration-150">
      <MobileHeader subtitle="REWARDS" />
      
      <main className="flex-1 px-5 py-6 space-y-5">
        <div className="text-center">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 ${isQualified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'} rounded-full mb-3`}>
            {isQualified ? <CheckCircleIcon size={12} /> : <ClockIcon size={12} />}
            <span className="text-xs font-medium uppercase tracking-wide">
              {isQualified ? 'Qualified!' : 'In Progress'}
            </span>
          </div>
          <h1 className="text-xl font-semibold text-foreground">
            {isQualified ? 'You Did It!' : 'Almost There!'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isQualified ? 'Return your power bank to claim your reward.' : 'Keep your rental active to earn your reward.'}
          </p>
        </div>

        <div className="bg-card rounded-lg border border-border p-5 space-y-5">
          <div className="flex justify-center">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="10" fill="none" className="text-muted" />
                <circle
                  cx="64" cy="64" r="56"
                  stroke="currentColor" strokeWidth="10" fill="none"
                  strokeDasharray={2 * Math.PI * 56}
                  strokeDashoffset={2 * Math.PI * 56 * (1 - progress / 100)}
                  strokeLinecap="round"
                  className={`${isQualified ? 'text-emerald-500' : 'text-primary'}`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-foreground">{Math.round(progress)}%</span>
                <span className="text-xs text-muted-foreground">complete</span>
              </div>
            </div>
          </div>

          <div className="text-center">
            <p className="text-base font-semibold text-foreground">
              {isQualified ? 'Return to claim your voucher' : `${minutesRemaining} more minutes to qualify`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {elapsedMinutes} of {thresholdMinutes} minutes
            </p>
          </div>

          <Progress value={progress} className="h-1.5" />
        </div>

        <div className="bg-foreground rounded-lg p-4 text-background">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-background/10 rounded-lg flex items-center justify-center">
              <GiftIcon size={20} />
            </div>
            <div>
              <p className="text-xs text-background/60 uppercase tracking-wide">
                {isQualified ? 'Ready to Claim' : 'Upcoming Reward'}
              </p>
              <p className="font-bold">{formatCurrency(10)} Merch Voucher</p>
            </div>
          </div>
        </div>

        <Button onClick={onViewStatus} className="w-full h-12 text-sm font-medium">
          {isQualified ? 'Return Power Bank' : 'View Active Rental'}
        </Button>
      </main>
    </div>
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
    <div className="flex flex-col min-h-screen animate-in fade-in duration-150">
      <MobileHeader subtitle="REWARDS" />
      
      <main className="flex-1 px-5 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Your Rewards</h1>
            <p className="text-muted-foreground text-sm">
              {issuedRewards.length} active, {redeemedRewards.length} redeemed
            </p>
          </div>
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="text-muted-foreground active:opacity-70 p-2"
          >
            {isRefreshing ? <Spinner className="w-5 h-5" /> : <RefreshIcon size={18} />}
          </button>
        </div>

        {issuedRewards.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Active</h2>
            {issuedRewards.map(reward => (
              <button
                key={reward.id}
                onClick={() => onSelectReward(reward)}
                className="w-full bg-card rounded-lg border border-border p-3 text-left active:bg-muted"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <GiftIcon size={20} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{formatCurrency(reward.value)} {reward.description}</p>
                    <p className="text-xs text-muted-foreground">{reward.campaignName}</p>
                  </div>
                  <span className="text-xs font-medium text-amber-600">{getTimeRemaining(reward.expiresAt)}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {redeemedRewards.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Redeemed</h2>
            {redeemedRewards.map(reward => (
              <button
                key={reward.id}
                onClick={() => onSelectReward(reward)}
                className="w-full bg-card rounded-lg border border-border p-3 text-left active:bg-muted opacity-70"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                    <CheckCircleIcon size={20} className="text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{formatCurrency(reward.value)} {reward.description}</p>
                    <p className="text-xs text-muted-foreground">{reward.campaignName}</p>
                  </div>
                  <span className="text-xs font-medium text-emerald-600">Used</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {expiredRewards.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Expired</h2>
            {expiredRewards.map(reward => (
              <div key={reward.id} className="w-full bg-muted rounded-lg p-3 opacity-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted-foreground/10 rounded-lg flex items-center justify-center">
                    <XCircleIcon size={20} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-muted-foreground">{formatCurrency(reward.value)} {reward.description}</p>
                    <p className="text-xs text-muted-foreground">{reward.campaignName}</p>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">Expired</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
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
  onRedeem: (id: string) => void;
  onBack: () => void;
  getTimeRemaining: (date: Date) => string;
}) {
  const timeRemaining = getTimeRemaining(reward.expiresAt);
  const isExpiringSoon = reward.expiresAt.getTime() - Date.now() < 3 * 60 * 60 * 1000;

  return (
    <div className="flex flex-col min-h-screen animate-in slide-in-from-right-4 duration-200">
      <MobileHeader title="Your Reward" showBack onBack={onBack} />
      
      <main className="flex-1 px-5 py-6 space-y-5">
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-primary rounded-full">
            <CheckCircleIcon size={14} />
            <span className="text-xs font-semibold uppercase tracking-wide">
              Goal Reached - {reward.actualMinutes} Min
            </span>
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Reward Unlocked!</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enjoy your perk for supporting sustainable energy.
          </p>
        </div>

        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="relative h-32 bg-foreground flex items-center justify-center">
            <div className="text-center text-background">
              <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-background/20 rounded-full text-xs font-medium mb-1">
                Official Partnership
              </div>
              <p className="text-3xl font-bold">{formatCurrency(reward.value)}</p>
              <p className="text-xs font-medium tracking-wider uppercase opacity-80">{reward.description}</p>
            </div>
          </div>

          <div className="p-4 space-y-3">
            <p className="text-center text-xs text-muted-foreground">
              Present this code at any {reward.campaignName} merchandise station.
            </p>

            <div className="relative">
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="font-mono text-lg font-bold tracking-wider text-foreground">{reward.code}</p>
              </div>
              <button
                onClick={() => onCopy(reward.code)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 active:opacity-70"
              >
                {copied ? (
                  <CheckCircleIcon size={18} className="text-emerald-500" />
                ) : (
                  <CopyIcon size={18} className="text-muted-foreground" />
                )}
              </button>
            </div>

            <div className={`flex items-center justify-center gap-1.5 py-1 ${isExpiringSoon ? 'text-destructive' : 'text-muted-foreground'}`}>
              <ClockIcon size={12} />
              <span className="text-xs font-medium">{timeRemaining}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Button 
            onClick={() => onRedeem(reward.id)}
            disabled={isRedeeming}
            className="w-full h-12 text-sm font-medium gap-2"
          >
            {isRedeeming ? (
              <><Spinner className="w-4 h-4" /> Redeeming...</>
            ) : (
              <><MapPinIcon size={16} /> Mark as Redeemed</>
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Tap after presenting to staff
          </p>
        </div>
      </main>
    </div>
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
    <div className="flex flex-col min-h-screen animate-in slide-in-from-right-4 duration-200">
      <MobileHeader title="Reward Details" showBack onBack={onBack} />
      
      <main className="flex-1 px-5 py-6 space-y-5">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
            <CheckCircleIcon size={32} className="text-emerald-600" />
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-xl font-semibold text-foreground mb-1">Reward Redeemed</h1>
          <p className="text-sm text-muted-foreground">
            You used this voucher at {reward.redemptionLocation}.
          </p>
        </div>

        <div className="bg-card rounded-lg border border-border p-4 space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Value</span>
            <span className="font-medium text-foreground">{formatCurrency(reward.value)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Campaign</span>
            <span className="font-medium text-foreground">{reward.campaignName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Session Duration</span>
            <span className="font-medium text-foreground">{formatDuration(reward.actualMinutes)}</span>
          </div>
          {reward.redeemedAt && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Redeemed</span>
              <span className="font-medium text-foreground">{formatDate(reward.redeemedAt)}</span>
            </div>
          )}
        </div>

        <div className="bg-muted rounded-lg p-3">
          <p className="text-xs text-muted-foreground text-center">
            Rent again for 60+ minutes to earn another reward!
          </p>
        </div>

        <Button onClick={onStartRental} className="w-full h-12 text-sm font-medium gap-2">
          <PowerDonLogo size={16} />
          Start New Rental
        </Button>
      </main>
    </div>
  );
}
