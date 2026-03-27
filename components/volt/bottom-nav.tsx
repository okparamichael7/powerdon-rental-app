'use client';

import { cn } from '@/lib/utils';
import { QRScanIcon, TimerIcon, GiftIcon, HeadphonesIcon } from './icons';

type NavTab = 'rent' | 'status' | 'rewards' | 'support';

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  className?: string;
}

const tabs: { id: NavTab; label: string; icon: typeof QRScanIcon }[] = [
  { id: 'rent', label: 'Rent', icon: QRScanIcon },
  { id: 'status', label: 'Status', icon: TimerIcon },
  { id: 'rewards', label: 'Rewards', icon: GiftIcon },
  { id: 'support', label: 'Support', icon: HeadphonesIcon },
];

export function BottomNav({ activeTab, onTabChange, className }: BottomNavProps) {
  return (
    <nav className={cn(
      'fixed bottom-0 left-0 right-0 bg-background border-t border-border pb-safe',
      className
    )}>
      <div className="flex items-center justify-around h-16 max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon size={20} />
              <span className="text-xs font-medium">{tab.label}</span>
              {isActive && (
                <span className="absolute bottom-14 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
