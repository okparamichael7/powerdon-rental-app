'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { VoltLogo, ChevronDownIcon } from '@/components/volt/icons';
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
          'fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-border">
            <Link href="/admin" className="flex items-center gap-2">
              <VoltLogo size={28} className="text-primary" />
              <span className="font-bold text-lg text-foreground">VOLT</span>
              <span className="text-xs font-medium text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                Admin
              </span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-md hover:bg-muted"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== '/admin' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <item.icon size={18} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Campaign Selector */}
          <div className="p-3 border-t border-border">
            <button className="w-full flex items-center justify-between p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
              <div className="text-left">
                <p className="text-xs text-muted-foreground">Active Campaign</p>
                <p className="font-medium text-foreground text-sm">Sundance 2024</p>
              </div>
              <ChevronDownIcon size={16} className="text-muted-foreground" />
            </button>
          </div>

          {/* Settings */}
          <div className="p-3 border-t border-border">
            <Link
              href="/admin/settings"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Settings size={18} />
              Settings
            </Link>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 bg-card border-b border-border lg:px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-md hover:bg-muted"
            >
              <Menu size={20} />
            </button>
            
            {/* Search */}
            <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-muted rounded-lg w-64">
              <Search size={16} className="text-muted-foreground" />
              <input
                type="text"
                placeholder="Search sessions, users..."
                className="bg-transparent text-sm outline-none flex-1 placeholder:text-muted-foreground"
              />
              <kbd className="text-xs text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border">
                ⌘K
              </kbd>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Notifications */}
            <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
              <Bell size={18} className="text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
            </button>

            {/* User menu */}
            <Button variant="ghost" className="gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-semibold text-primary">JD</span>
              </div>
              <span className="hidden md:block text-sm font-medium">John Doe</span>
              <ChevronDownIcon size={14} className="text-muted-foreground" />
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
