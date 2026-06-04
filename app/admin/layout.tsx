'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { PowerDonLogo } from '@/components/volt/icons';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useActiveCampaigns } from '@/hooks/use-services';
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
  Cpu,
  CreditCard,
  Activity,
  UserCircle,
  Shield,
  LogOut,
} from 'lucide-react';

const navigation = [
  { name: 'Overview', href: '/admin', icon: LayoutDashboard },
  { name: 'Sessions', href: '/admin/sessions', icon: Zap },
  { name: 'Campaigns', href: '/admin/campaigns', icon: Megaphone },
  { name: 'Stations', href: '/admin/stations', icon: Radio },
  { name: 'Hardware', href: '/admin/hardware', icon: Cpu },
  { name: 'Rewards', href: '/admin/rewards', icon: Gift },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Leads', href: '/admin/leads', icon: UserCircle },
  { name: 'Billing', href: '/admin/billing', icon: CreditCard },
  { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  { name: 'Ops', href: '/admin/ops', icon: Activity },
  { name: 'Staff', href: '/admin/staff', icon: Shield },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const { data: campaigns } = useActiveCampaigns();
  const activeCampaign = campaigns?.[0];

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setAdminEmail(user?.email ?? null);
    });
  }, []);

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  };

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

          {activeCampaign && (
            <div className="px-3 py-3">
              <Link
                href="/admin/campaigns"
                className="block px-3 py-2 rounded-md hover:bg-muted transition-colors"
              >
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Active campaign</p>
                <p className="font-medium text-foreground text-[13px] truncate">{activeCampaign.name}</p>
              </Link>
            </div>
          )}

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
            
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:block text-[13px] text-muted-foreground truncate max-w-[200px]">
              {adminEmail ?? 'Admin'}
            </span>
            <Button variant="ghost" size="sm" className="gap-2 px-2" onClick={handleSignOut}>
              <LogOut size={16} />
              <span className="hidden md:inline text-[13px]">Sign out</span>
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="p-5 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
