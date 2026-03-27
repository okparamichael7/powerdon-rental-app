'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

  // Filter rewards by status
  const issuedRewards = rewards.filter(r => r.status === 'issued');
  const redeemedRewards = rewards.filter(r => r.status === 'redeemed');
  const expiredRewards = rewards.filter(r => r.status === 'expired');

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsRefreshing(false);
  };

  // Handle copy code
  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Handle redeem
  const handleRedeem = async (rewardId: string) => {
    setIsRedeeming(true);
    await redeemReward(rewardId);
    setIsRedeeming(false);
    setSelectedReward(null);
  };

  // Calculate time remaining
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

  // Determine what to show
  const hasActiveSession = !!activeSession;
  const hasIssuedRewards = issuedRewards.length > 0;
  const hasAnyRewards = rewards.length > 0;

  // If there's an active session but no rewards yet, show in-progress view
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

  // If there's a selected reward, show detail view
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

  // If no rewards at all, show empty state
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

  // Show rewards list
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

// No Rewards View
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col min-h-screen"
    >
      <MobileHeader subtitle="REWARDS" />
      
      <main className="flex-1 flex flex-col items-center justify-center px-5 py-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center mb-6"
        >
          <GiftIcon size={40} className="text-muted-foreground" />
        </motion.div>

        <div className="text-center max-w-sm mb-8">
          <h1 className="text-xl font-semibold text-foreground mb-2">No Rewards Yet</h1>
          <p className="text-muted-foreground">
            Start renting a power bank to earn rewards! Rent for at least 60 minutes to qualify for exclusive perks.
          </p>
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 w-full max-w-sm mb-8">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <GiftIcon size={18} className="text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">How to earn rewards</p>
              <p className="text-sm text-muted-foreground">
                Rent a power bank for 60+ minutes during a campaign to unlock exclusive vouchers and perks.
              </p>
            </div>
          </div>
        </div>

        <div className="w-full max-w-sm space-y-3">
          <Button 
            onClick={onStartRental}
            className="w-full h-12 text-[15px] font-medium rounded-lg"
          >
            <PowerDonLogo size={18} />
            Start Rental
          </Button>
          <Button
            variant="outline"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="w-full h-12 text-[15px] font-medium rounded-lg"
          >
            {isRefreshing ? (
              <>
                <Spinner className="w-5 h-5" />
                Checking...
              </>
            ) : (
              <>
                <RefreshIcon size={18} className="animate-none" />
                Refresh
              </>
            )}
          </Button>
        </div>
      </main>
    </motion.div>
  );
}

// In Progress View
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col min-h-screen"
    >
      <MobileHeader subtitle="REWARDS" />
      
      <main className="flex-1 px-5 py-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 ${isQualified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'} rounded-full mb-4`}>
            {isQualified ? <CheckCircleIcon size={14} /> : <ClockIcon size={14} />}
            <span className="text-xs font-medium uppercase tracking-wide">
              {isQualified ? 'Qualified!' : 'In Progress'}
            </span>
          </div>
          <h1 className="text-xl font-semibold text-foreground">
            {isQualified ? 'You Did It!' : 'Almost There!'}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {isQualified 
              ? 'Return your power bank to claim your reward.'
              : 'Keep your rental active to earn your reward.'
            }
          </p>
        </motion.div>

        {/* Progress Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-lg border border-border p-6 space-y-6"
        >
          {/* Circular Progress Indicator */}
          <div className="flex justify-center">
            <div className="relative w-40 h-40">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="none"
                  className="text-muted"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray={2 * Math.PI * 70}
                  strokeDashoffset={2 * Math.PI * 70 * (1 - progress / 100)}
                  strokeLinecap="round"
                  className={`${isQualified ? 'text-emerald-500' : 'text-primary'} transition-all duration-500`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-foreground">{Math.round(progress)}%</span>
                <span className="text-sm text-muted-foreground">complete</span>
              </div>
            </div>
          </div>

          <div className="text-center">
            <p className="text-lg font-semibold text-foreground">
              {isQualified ? (
                <>Return to claim your voucher</>
              ) : (
                <>{minutesRemaining} more minutes to qualify</>
              )}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {elapsedMinutes} of {thresholdMinutes} minutes completed
            </p>
          </div>

          <Progress value={progress} className="h-2" />
        </motion.div>

        {/* Reward Preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg p-5 text-white"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
              <GiftIcon size={24} />
            </div>
            <div>
              <p className="text-xs text-white/60 uppercase tracking-wide">
                {isQualified ? 'Ready to Claim' : 'Upcoming Reward'}
              </p>
              <p className="font-bold text-lg">{formatCurrency(10)} Merch Voucher</p>
            </div>
          </div>
        </motion.div>

        <div className="pt-4">
          <Button 
            onClick={onViewStatus}
            className="w-full h-12 text-[15px] font-medium rounded-lg"
          >
            {isQualified ? 'Return Power Bank' : 'View Active Rental'}
          </Button>
        </div>
      </main>
    </motion.div>
  );
}

// Rewards List View
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col min-h-screen"
    >
      <MobileHeader subtitle="REWARDS" />
      
      <main className="flex-1 px-5 py-6 space-y-6">
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
            className="text-muted-foreground hover:text-foreground p-2"
            aria-label="Refresh rewards"
          >
            {isRefreshing ? (
              <Spinner className="w-5 h-5" />
            ) : (
              <RefreshIcon size={20} className="animate-none" />
            )}
          </button>
        </div>

        {/* Active Rewards */}
        {issuedRewards.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Active</h2>
            {issuedRewards.map(reward => (
              <button
                key={reward.id}
                onClick={() => onSelectReward(reward)}
                className="w-full bg-card rounded-lg border border-border p-4 text-left hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                    <GiftIcon size={24} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{formatCurrency(reward.value)} {reward.description}</p>
                    <p className="text-sm text-muted-foreground">{reward.campaignName}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-medium text-amber-600">
                      {getTimeRemaining(reward.expiresAt)}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Redeemed Rewards */}
        {redeemedRewards.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Redeemed</h2>
            {redeemedRewards.map(reward => (
              <button
                key={reward.id}
                onClick={() => onSelectReward(reward)}
                className="w-full bg-card rounded-lg border border-border p-4 text-left hover:bg-muted transition-colors opacity-70"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                    <CheckCircleIcon size={24} className="text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{formatCurrency(reward.value)} {reward.description}</p>
                    <p className="text-sm text-muted-foreground">{reward.campaignName}</p>
                  </div>
                  <span className="text-xs font-medium text-emerald-600">Used</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Expired Rewards */}
        {expiredRewards.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Expired</h2>
            {expiredRewards.map(reward => (
              <div
                key={reward.id}
                className="w-full bg-muted rounded-lg p-4 opacity-50"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-muted-foreground/10 rounded-xl flex items-center justify-center">
                    <XCircleIcon size={24} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-muted-foreground">{formatCurrency(reward.value)} {reward.description}</p>
                    <p className="text-sm text-muted-foreground">{reward.campaignName}</p>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">Expired</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </motion.div>
  );
}

// Issued Reward Detail View
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col min-h-screen"
    >
      <MobileHeader title="Your Reward" showBack onBack={onBack} />
      
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
              Goal Reached - {reward.actualMinutes} Min Session
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
            Enjoy your perk for supporting sustainable energy at {reward.campaignName}.
          </p>
        </motion.div>

        {/* Voucher Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-lg border border-border overflow-hidden"
        >
          {/* Voucher Header */}
          <div className="relative h-40 bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center overflow-hidden">
            <div className="relative text-center text-white">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 rounded-full text-xs font-medium mb-2">
                Official Partnership
              </div>
              <p className="text-4xl font-bold">{formatCurrency(reward.value)}</p>
              <p className="text-sm font-medium tracking-wider uppercase opacity-80">{reward.description}</p>
            </div>
          </div>

          {/* Voucher Body */}
          <div className="p-5 space-y-4">
            <p className="text-center text-muted-foreground">
              Present this code at any {reward.campaignName} merchandise station to redeem.
            </p>

            {/* Code Display */}
            <div className="relative">
              <div className="bg-muted rounded-xl p-4 text-center">
                <p className="font-mono text-xl font-bold tracking-wider text-foreground">
                  {reward.code}
                </p>
              </div>
              <button
                onClick={() => onCopy(reward.code)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-background rounded-lg transition-colors"
                aria-label="Copy code"
              >
                {copied ? (
                  <CheckCircleIcon size={20} className="text-emerald-500" />
                ) : (
                  <CopyIcon size={20} className="text-muted-foreground" />
                )}
              </button>
            </div>

            {/* Expiry Warning */}
            <div className={`flex items-center justify-center gap-2 py-2 ${isExpiringSoon ? 'text-destructive' : 'text-muted-foreground'}`}>
              <ClockIcon size={14} />
              <span className="text-sm font-medium">{timeRemaining}</span>
            </div>
          </div>
        </motion.div>

        {/* Redeem Button */}
        <div className="space-y-3">
          <Button 
            onClick={() => onRedeem(reward.id)}
            disabled={isRedeeming}
            className="w-full h-12 text-[15px] font-medium rounded-lg"
          >
            {isRedeeming ? (
              <>
                <Spinner className="w-5 h-5" />
                Redeeming...
              </>
            ) : (
              <>
                <MapPinIcon size={18} />
                Mark as Redeemed
              </>
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Tap after presenting to staff at merch booth
          </p>
        </div>
      </main>
    </motion.div>
  );
}

// Redeemed Reward Detail View
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col min-h-screen"
    >
      <MobileHeader title="Reward Details" showBack onBack={onBack} />
      
      <main className="flex-1 px-5 py-6 space-y-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex justify-center"
        >
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
            <CheckCircleIcon size={40} className="text-emerald-600" />
          </div>
        </motion.div>

        <div className="text-center">
          <h1 className="text-xl font-semibold text-foreground mb-2">Reward Redeemed</h1>
          <p className="text-muted-foreground">
            You successfully used this voucher at {reward.redemptionLocation}.
          </p>
        </div>

        <div className="bg-card rounded-lg border border-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Value</span>
            <span className="font-semibold text-foreground">{formatCurrency(reward.value)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Campaign</span>
            <span className="font-semibold text-foreground">{reward.campaignName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Session Duration</span>
            <span className="font-semibold text-foreground">{formatDuration(reward.actualMinutes)}</span>
          </div>
          {reward.redeemedAt && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Redeemed</span>
              <span className="font-semibold text-foreground">
                {formatDate(reward.redeemedAt)}
              </span>
            </div>
          )}
        </div>

        <div className="bg-muted rounded-lg p-4">
          <p className="text-sm text-muted-foreground text-center">
            Rent again for 60+ minutes to earn another reward!
          </p>
        </div>

        <Button 
          onClick={onStartRental}
          className="w-full h-12 text-[15px] font-medium rounded-lg"
        >
          <PowerDonLogo size={18} />
          Start New Rental
        </Button>
      </main>
    </motion.div>
  );
}
