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
  className,
}: BottomNavProps) {
  return (
    <nav
      className={cn(
        'shrink-0 border-t border-border/80 bg-background/90 backdrop-blur-xl',
        className,
      )}
      aria-label="Main navigation"
    >
      <div
        className="mx-auto flex h-[var(--pwa-tab-bar-height)] max-w-md items-stretch px-1 safe-area-pb"
        style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const showBadge =
            (tab.id === 'status' && showStatusBadge) ||
            (tab.id === 'rewards' && rewardsBadgeCount > 0);
          const badgeCount = tab.id === 'rewards' ? rewardsBadgeCount : 0;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center gap-0.5 pwa-tap',
                'transition-colors duration-150',
                isActive ? 'text-foreground' : 'text-muted-foreground',
              )}
              aria-label={tab.ariaLabel}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <span
                  className="absolute top-1 h-0.5 w-8 rounded-full bg-foreground"
                  aria-hidden
                />
              )}
              <div className="relative mt-1">
                <Icon size={24} className={cn(!isActive && 'opacity-75')} />
                {showBadge && (
                  <span
                    className={cn(
                      'absolute -right-1 -top-0.5 flex items-center justify-center rounded-full bg-foreground font-medium text-background',
                      badgeCount > 0 ? 'min-w-[16px] h-4 px-1 text-[10px]' : 'size-2',
                    )}
                    aria-hidden
                  >
                    {badgeCount > 0 ? (badgeCount > 9 ? '9+' : badgeCount) : null}
                  </span>
                )}
              </div>
              <span className={cn('text-[10px] font-medium leading-none', isActive && 'font-semibold')}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
