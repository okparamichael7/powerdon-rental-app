'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { PowerDonLogo, ChevronDownIcon } from '@/components/volt/icons';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Zap,
  Megaphone,
  Radio,
  Gift,
  Users,
  BarChart3,
  Settings,
  Menu,
  X,
  Bell,
  Search,
} from 'lucide-react';

const navigation = [
  { name: 'Overview', href: '/admin', icon: LayoutDashboard },
  { name: 'Sessions', href: '/admin/sessions', icon: Zap },
  { name: 'Campaigns', href: '/admin/campaigns', icon: Megaphone },
  { name: 'Stations', href: '/admin/stations', icon: Radio },
  { name: 'Rewards', href: '/admin/rewards', icon: Gift },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-56 bg-background transform transition-transform duration-200 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-14 px-5">
            <Link href="/admin" className="flex items-center gap-2">
              <PowerDonLogo size={20} className="text-foreground" />
              <span className="font-medium text-foreground text-sm">POWERDON</span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-full hover:bg-muted"
            >
              <X size={16} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== '/admin' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-[13px] transition-colors',
                    isActive
                      ? 'bg-foreground text-background font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <item.icon size={16} strokeWidth={isActive ? 2 : 1.5} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Campaign Selector */}
          <div className="px-3 py-3">
            <button className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted transition-colors">
              <div className="text-left">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Campaign</p>
                <p className="font-medium text-foreground text-[13px]">Sundance 2024</p>
              </div>
              <ChevronDownIcon size={14} className="text-muted-foreground" />
            </button>
          </div>

          {/* Settings */}
          <div className="px-3 pb-4">
            <Link
              href="/admin/settings"
              className="flex items-center gap-3 px-3 py-2 rounded-md text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Settings size={16} strokeWidth={1.5} />
              Settings
            </Link>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-56">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-5 bg-background/95 backdrop-blur-sm lg:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-full hover:bg-muted"
            >
              <Menu size={18} />
            </button>
            
            {/* Search */}
            <div className="hidden md:flex items-center gap-2 text-muted-foreground">
              <Search size={14} />
              <span className="text-[13px]">Search</span>
              <kbd className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded ml-2">
                ⌘K
              </kbd>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Notifications */}
            <button className="relative p-2 rounded-full hover:bg-muted transition-colors">
              <Bell size={16} className="text-muted-foreground" />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-foreground rounded-full" />
            </button>

            {/* User menu */}
            <Button variant="ghost" size="sm" className="gap-2 px-2">
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                <span className="text-[11px] font-medium text-foreground">JD</span>
              </div>
              <span className="hidden md:block text-[13px]">John Doe</span>
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="p-5 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
