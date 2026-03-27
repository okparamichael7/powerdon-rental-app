'use client';

import { cn } from '@/lib/utils';
import { QRScanIcon, TimerIcon, GiftIcon, HeadphonesIcon } from './icons';

type NavTab = 'rent' | 'status' | 'rewards' | 'support';

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  showStatusBadge?: boolean;
  rewardsBadgeCount?: number;
  className?: string;
}

const tabs: { id: NavTab; label: string; icon: typeof QRScanIcon; ariaLabel: string }[] = [
  { id: 'rent', label: 'Rent', icon: QRScanIcon, ariaLabel: 'Start a new rental' },
  { id: 'status', label: 'Status', icon: TimerIcon, ariaLabel: 'View active rental status' },
  { id: 'rewards', label: 'Rewards', icon: GiftIcon, ariaLabel: 'View your rewards' },
  { id: 'support', label: 'Support', icon: HeadphonesIcon, ariaLabel: 'Get help and support' },
];

export function BottomNav({ 
  activeTab, 
  onTabChange, 
  showStatusBadge = false,
  rewardsBadgeCount = 0,
  className 
}: BottomNavProps) {
  return (
    <nav 
      className={cn(
        'fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm z-40',
        className
      )}
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-around h-16 max-w-md mx-auto safe-area-pb">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const showBadge = (tab.id === 'status' && showStatusBadge) || 
                           (tab.id === 'rewards' && rewardsBadgeCount > 0);
          const badgeCount = tab.id === 'rewards' ? rewardsBadgeCount : 0;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'relative flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors',
                'focus:outline-none',
                isActive ? 'text-foreground' : 'text-muted-foreground'
              )}
              aria-label={tab.ariaLabel}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={isActive ? 2 : 1.5} />
                {showBadge && (
                  <span 
                    className={cn(
                      'absolute -top-0.5 -right-1 flex items-center justify-center rounded-full bg-foreground text-background text-[9px] font-medium',
                      badgeCount > 0 ? 'min-w-[14px] h-3.5 px-0.5' : 'w-1.5 h-1.5'
                    )}
                    aria-label={
                      tab.id === 'status' 
                        ? 'Active rental' 
                        : `${badgeCount} pending reward${badgeCount !== 1 ? 's' : ''}`
                    }
                  >
                    {badgeCount > 0 ? (badgeCount > 9 ? '9+' : badgeCount) : null}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
