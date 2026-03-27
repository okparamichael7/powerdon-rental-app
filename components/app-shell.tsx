'use client';

import { useState, useEffect, useCallback } from 'react';
import { BottomNav } from '@/components/volt/bottom-nav';
import { RentPage } from '@/components/pages/rent-page';
import { StatusPage } from '@/components/pages/status-page';
import { RewardsPage } from '@/components/pages/rewards-page';
import { SupportPage } from '@/components/pages/support-page';

type NavTab = 'rent' | 'status' | 'rewards' | 'support';

export function AppShell() {
  const [activeTab, setActiveTab] = useState<NavTab>('rent');
  const [isOnline, setIsOnline] = useState(true);

  // Network status detection
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

  // Render the active page
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
    <div className="min-h-screen bg-background max-w-md mx-auto relative">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-950 text-center py-2 text-sm font-medium">
          You are offline. Some features may not work.
        </div>
      )}

      {/* Page Content */}
      <div className={!isOnline ? 'pt-8' : ''}>
        {renderPage()}
      </div>

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  );
}
