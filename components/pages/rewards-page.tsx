'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MobileHeader } from '@/components/volt/mobile-header';
import { 
  PowerDonLogo, GiftIcon, CheckCircleIcon, XCircleIcon, 
  ClockIcon, CopyIcon, MapPinIcon, ReceiptIcon, RefreshIcon
} from '@/components/volt/icons';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { 
  type UserReward,
  type RewardState,
  createMockReward,
  formatDuration,
  formatCurrency,
} from '@/lib/session-store';

type RewardsView = 'loading' | 'no_rewards' | 'in_progress' | 'qualified' | 'issued' | 'redeemed' | 'expired' | 'error';

interface RewardsPageProps {
  isOnline: boolean;
  onNavigate: (tab: 'rent' | 'status' | 'rewards' | 'support') => void;
}

export function RewardsPage({ isOnline, onNavigate }: RewardsPageProps) {
  const [view, setView] = useState<RewardsView>('loading');
  const [rewards, setRewards] = useState<UserReward[]>([]);
  const [selectedReward, setSelectedReward] = useState<UserReward | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Current progress tracking (for in-progress state)
  const [currentProgress, setCurrentProgress] = useState({
    elapsedMinutes: 45,
    thresholdMinutes: 60,
  });

  // Load rewards
  const loadRewards = useCallback(async (showLoading = true) => {
    if (showLoading) setView('loading');
    setError(null);

    try {
      await new Promise(resolve => setTimeout(resolve, 800));

      if (!isOnline) {
        throw new Error('Network unavailable');
      }

      // Simulate different reward states for demo
      const scenario = Math.random();
      
      if (scenario < 0.15) {
        // No rewards
        setRewards([]);
        setView('no_rewards');
      } else if (scenario < 0.3) {
        // In progress (has active rental)
        setRewards([]);
        setCurrentProgress({ elapsedMinutes: 45, thresholdMinutes: 60 });
        setView('in_progress');
      } else if (scenario < 0.45) {
        // Qualified but not yet issued
        setRewards([]);
        setView('qualified');
      } else if (scenario < 0.7) {
        // Has issued reward
        const reward = createMockReward('SES-123');
        reward.status = 'issued';
        setRewards([reward]);
        setSelectedReward(reward);
        setView('issued');
      } else if (scenario < 0.85) {
        // Redeemed reward
        const reward = createMockReward('SES-123');
        reward.status = 'redeemed';
        reward.redeemedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
        reward.redemptionLocation = 'Merch Booth A';
        setRewards([reward]);
        setSelectedReward(reward);
        setView('redeemed');
      } else {
        // Expired reward
        const reward = createMockReward('SES-123');
        reward.status = 'expired';
        reward.expiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
        setRewards([reward]);
        setSelectedReward(reward);
        setView('expired');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rewards');
      setView('error');
    }
  }, [isOnline]);

  useEffect(() => {
    loadRewards();
  }, [loadRewards]);

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadRewards(false);
    setIsRefreshing(false);
  };

  // Handle copy code
  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <AnimatePresence mode="wait">
        {view === 'loading' && <LoadingView key="loading" />}
        
        {view === 'no_rewards' && (
          <NoRewardsView
            key="no_rewards"
            onStartRental={() => onNavigate('rent')}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          />
        )}
        
        {view === 'in_progress' && (
          <InProgressView
            key="in_progress"
            elapsedMinutes={currentProgress.elapsedMinutes}
            thresholdMinutes={currentProgress.thresholdMinutes}
            onViewStatus={() => onNavigate('status')}
          />
        )}
        
        {view === 'qualified' && (
          <QualifiedView
            key="qualified"
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          />
        )}
        
        {view === 'issued' && selectedReward && (
          <IssuedView
            key="issued"
            reward={selectedReward}
            copied={copied}
            onCopy={handleCopy}
            getTimeRemaining={getTimeRemaining}
          />
        )}
        
        {view === 'redeemed' && selectedReward && (
          <RedeemedView
            key="redeemed"
            reward={selectedReward}
            onStartRental={() => onNavigate('rent')}
          />
        )}
        
        {view === 'expired' && selectedReward && (
          <ExpiredView
            key="expired"
            reward={selectedReward}
            onStartRental={() => onNavigate('rent')}
          />
        )}
        
        {view === 'error' && (
          <ErrorView
            key="error"
            error={error}
            onRetry={() => loadRewards()}
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
      <MobileHeader subtitle="REWARDS" />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Spinner className="w-8 h-8 mx-auto text-primary" />
          <p className="text-muted-foreground">Loading your rewards...</p>
        </div>
      </div>
    </motion.div>
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
          className="w-20 h-20 bg-muted rounded-2xl flex items-center justify-center mb-6"
        >
          <GiftIcon size={40} className="text-muted-foreground" />
        </motion.div>

        <div className="text-center max-w-sm mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">No Rewards Yet</h1>
          <p className="text-muted-foreground">
            Start renting a power bank to earn rewards! Rent for at least 60 minutes to qualify for exclusive perks.
          </p>
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 w-full max-w-sm mb-8">
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
            className="w-full h-14 text-base font-semibold rounded-2xl bg-primary hover:bg-primary/90"
          >
            <PowerDonLogo size={18} />
            Start Rental
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
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full mb-4">
            <ClockIcon size={14} />
            <span className="text-xs font-medium uppercase tracking-wide">In Progress</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Almost There!</h1>
          <p className="mt-2 text-muted-foreground">
            Keep your rental active to earn your reward.
          </p>
        </motion.div>

        {/* Progress Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl border border-border p-6 space-y-6"
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
                  className="text-primary transition-all duration-500"
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
              {minutesRemaining > 0 ? (
                <>{minutesRemaining} more minutes to qualify</>
              ) : (
                <>Qualified! Return to claim</>
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
          className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
              <GiftIcon size={24} />
            </div>
            <div>
              <p className="text-xs text-white/60 uppercase tracking-wide">Upcoming Reward</p>
              <p className="font-bold text-lg">€10 Merch Voucher</p>
            </div>
          </div>
        </motion.div>

        <div className="pt-4">
          <Button 
            onClick={onViewStatus}
            className="w-full h-14 text-base font-semibold rounded-2xl bg-primary hover:bg-primary/90"
          >
            View Active Rental
          </Button>
        </div>
      </main>
    </motion.div>
  );
}

// Qualified View (awaiting issuance)
function QualifiedView({
  onRefresh,
  isRefreshing,
}: {
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
          className="w-20 h-20 bg-amber-50 rounded-2xl flex items-center justify-center mb-6"
        >
          <ClockIcon size={40} className="text-amber-600" />
        </motion.div>

        <div className="text-center max-w-sm mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full mb-4">
            <CheckCircleIcon size={14} />
            <span className="text-xs font-medium uppercase tracking-wide">Qualified</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Reward Processing</h1>
          <p className="text-muted-foreground">
            Congratulations! You&apos;ve qualified for a reward. We&apos;re generating your voucher code now. This usually takes less than a minute.
          </p>
        </div>

        <div className="bg-muted rounded-2xl p-4 w-full max-w-sm mb-8">
          <div className="flex items-center gap-3">
            <Spinner className="w-5 h-5 text-primary" />
            <p className="text-sm text-muted-foreground">
              Generating your unique voucher code...
            </p>
          </div>
        </div>

        <div className="w-full max-w-sm">
          <Button
            variant="outline"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="w-full h-14 text-base font-semibold rounded-2xl"
          >
            {isRefreshing ? (
              <>
                <Spinner className="w-5 h-5" />
                Checking...
              </>
            ) : (
              <>
                <RefreshIcon size={18} className="animate-none" />
                Check Status
              </>
            )}
          </Button>
        </div>
      </main>
    </motion.div>
  );
}

// Issued View (active voucher)
function IssuedView({
  reward,
  copied,
  onCopy,
  getTimeRemaining,
}: {
  reward: UserReward;
  copied: boolean;
  onCopy: (code: string) => void;
  getTimeRemaining: (date: Date) => string;
}) {
  const timeRemaining = getTimeRemaining(reward.expiresAt);
  const isExpiringSoon = reward.expiresAt.getTime() - Date.now() < 3 * 60 * 60 * 1000; // Less than 3 hours

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col min-h-screen"
    >
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
              Goal Reached • {reward.actualMinutes} Min Session
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
          className="bg-card rounded-2xl border border-border overflow-hidden"
        >
          {/* Voucher Header */}
          <div className="relative h-40 bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDBoNDBWNDBIMHoiLz48cGF0aCBkPSJNMjAgMjBMMjAgMTBNMjAgMjBMMTAgMjBNMjAgMjBMMjAgMzBNMjAgMjBMMzAgMjAiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9nPjwvc3ZnPg==')]" />
            </div>
            
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

            {/* QR Code Placeholder */}
            <div className="flex justify-center py-4">
              <div className="relative w-32 h-32 bg-muted rounded-xl flex items-center justify-center">
                <div className="grid grid-cols-7 gap-1 p-3">
                  {[...Array(49)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-2.5 h-2.5 rounded-sm ${
                        [0, 1, 2, 4, 5, 6, 7, 13, 14, 20, 21, 27, 28, 34, 35, 41, 42, 43, 44, 46, 47, 48].includes(i)
                          ? 'bg-foreground'
                          : 'bg-transparent'
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
                <div className={`flex items-center gap-1 ${isExpiringSoon ? 'text-destructive' : 'text-amber-600'}`}>
                  <ClockIcon size={12} />
                  <span className="text-xs font-medium uppercase">{timeRemaining}</span>
                </div>
              </div>
              
              <button
                onClick={() => onCopy(reward.code)}
                className="w-full flex items-center justify-between p-4 bg-muted rounded-xl hover:bg-muted/80 transition-colors"
                aria-label="Copy activation code"
              >
                <span className="font-bold text-foreground tracking-wide font-mono">{reward.code}</span>
                {copied ? (
                  <CheckCircleIcon size={18} className="text-emerald-600" />
                ) : (
                  <CopyIcon size={18} className="text-primary" />
                )}
              </button>
              {copied && (
                <p className="text-xs text-emerald-600 text-center">Code copied to clipboard!</p>
              )}
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
    </motion.div>
  );
}

// Redeemed View
function RedeemedView({
  reward,
  onStartRental,
}: {
  reward: UserReward;
  onStartRental: () => void;
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full mb-4">
            <CheckCircleIcon size={14} />
            <span className="text-xs font-medium uppercase tracking-wide">Redeemed</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Reward Used</h1>
        </motion.div>

        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center"
        >
          <div className="w-24 h-24 bg-emerald-100 rounded-3xl flex items-center justify-center">
            <CheckCircleIcon size={48} className="text-emerald-600" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-2xl border border-border p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Reward</span>
            <span className="font-semibold text-foreground">{reward.description}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Code</span>
            <span className="font-mono text-foreground">{reward.code}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Redeemed at</span>
            <span className="text-foreground">{reward.redemptionLocation}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Redeemed on</span>
            <span className="text-foreground">{reward.redeemedAt?.toLocaleDateString()}</span>
          </div>
        </motion.div>

        <div className="bg-muted rounded-2xl p-4">
          <p className="text-sm text-muted-foreground text-center">
            Want more rewards? Start another rental and keep the perks coming!
          </p>
        </div>

        <Button 
          onClick={onStartRental}
          className="w-full h-14 text-base font-semibold rounded-2xl bg-primary hover:bg-primary/90"
        >
          <PowerDonLogo size={18} />
          Start New Rental
        </Button>
      </main>
    </motion.div>
  );
}

// Expired View
function ExpiredView({
  reward,
  onStartRental,
}: {
  reward: UserReward;
  onStartRental: () => void;
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
          className="w-20 h-20 bg-muted rounded-2xl flex items-center justify-center mb-6"
        >
          <XCircleIcon size={40} className="text-muted-foreground" />
        </motion.div>

        <div className="text-center max-w-sm mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-muted text-muted-foreground rounded-full mb-4">
            <ClockIcon size={14} />
            <span className="text-xs font-medium uppercase tracking-wide">Expired</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Reward Expired</h1>
          <p className="text-muted-foreground">
            Unfortunately, this reward has expired and can no longer be redeemed. Start a new rental to earn more rewards!
          </p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 w-full max-w-sm mb-8">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Reward</span>
            <span className="text-foreground line-through">{reward.description}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-muted-foreground">Code</span>
            <span className="font-mono text-muted-foreground line-through">{reward.code}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-muted-foreground">Expired</span>
            <span className="text-destructive">{reward.expiresAt.toLocaleDateString()}</span>
          </div>
        </div>

        <div className="w-full max-w-sm">
          <Button 
            onClick={onStartRental}
            className="w-full h-14 text-base font-semibold rounded-2xl bg-primary hover:bg-primary/90"
          >
            <PowerDonLogo size={18} />
            Earn New Reward
          </Button>
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
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-20 h-20 bg-destructive/10 rounded-2xl flex items-center justify-center mb-6"
        >
          <XCircleIcon size={40} className="text-destructive" />
        </motion.div>

        <div className="text-center max-w-sm mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">Unable to Load Rewards</h1>
          <p className="text-muted-foreground">
            {error || 'Something went wrong while loading your rewards. Please try again.'}
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
            Contact Support
          </Button>
        </div>
      </main>
    </motion.div>
  );
}
