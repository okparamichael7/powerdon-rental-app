'use client';

import { useState, useEffect, useCallback } from 'react';
import { BottomNav } from '@/components/volt/bottom-nav';
import { RentPage } from '@/components/pages/rent-page';
import { StatusPage } from '@/components/pages/status-page';
import { RewardsPage } from '@/components/pages/rewards-page';
import { SupportPage } from '@/components/pages/support-page';
import { AppStateProvider, useAppState } from '@/lib/app-state';

type NavTab = 'rent' | 'status' | 'rewards' | 'support';

function AppContent() {
  const [activeTab, setActiveTab] = useState<NavTab>('rent');
  const [isOnline, setIsOnline] = useState(true);
  const { activeSession, rewards } = useAppState();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  const handleTabChange = useCallback((tab: NavTab) => {
    setActiveTab(tab);
  }, []);

  const hasActiveSession = !!activeSession;
  const pendingRewardsCount = rewards.filter(r => r.status === 'issued').length;

  const renderPage = () => {
    switch (activeTab) {
      case 'rent':
        return <RentPage isOnline={isOnline} onNavigate={handleTabChange} />;
      case 'status':
        return <StatusPage isOnline={isOnline} onNavigate={handleTabChange} />;
      case 'rewards':
        return <RewardsPage isOnline={isOnline} onNavigate={handleTabChange} />;
      case 'support':
        return <SupportPage isOnline={isOnline} onNavigate={handleTabChange} />;
      default:
        return <RentPage isOnline={isOnline} onNavigate={handleTabChange} />;
    }
  };

  return (
    <div className="relative mx-auto flex h-[100dvh] max-w-md flex-col overflow-hidden bg-background">
      {!isOnline && (
        <div
          className="absolute inset-x-0 top-0 z-50 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950"
          role="status"
        >
          You&apos;re offline — some features may be unavailable
        </div>
      )}

      <div
        className={`flex min-h-0 flex-1 flex-col overflow-hidden ${!isOnline ? 'pt-9' : ''}`}
      >
        {renderPage()}
      </div>

      <BottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        showStatusBadge={hasActiveSession}
        rewardsBadgeCount={pendingRewardsCount}
      />
    </div>
  );
}

export function AppShell() {
  return (
    <AppStateProvider>
      <AppContent />
    </AppStateProvider>
  );
}
