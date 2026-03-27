'use client';

import { cn } from '@/lib/utils';
import { QRScanIcon, TimerIcon, GiftIcon, HeadphonesIcon } from './icons';

type NavTab = 'rent' | 'status' | 'rewards' | 'support';

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  className?: string;
}

const tabs: { id: NavTab; label: string; icon: typeof QRScanIcon; ariaLabel: string }[] = [
  { id: 'rent', label: 'Rent', icon: QRScanIcon, ariaLabel: 'Start a new rental' },
  { id: 'status', label: 'Status', icon: TimerIcon, ariaLabel: 'View active rental status' },
  { id: 'rewards', label: 'Rewards', icon: GiftIcon, ariaLabel: 'View your rewards' },
  { id: 'support', label: 'Support', icon: HeadphonesIcon, ariaLabel: 'Get help and support' },
];

export function BottomNav({ activeTab, onTabChange, className }: BottomNavProps) {
  return (
    <nav 
      className={cn(
        'fixed bottom-0 left-0 right-0 bg-background border-t border-border z-40',
        className
      )}
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-around h-16 max-w-md mx-auto safe-area-pb">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'relative flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
              aria-label={tab.ariaLabel}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={20} />
              <span className="text-xs font-medium">{tab.label}</span>
              {isActive && (
                <span 
                  className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" 
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
