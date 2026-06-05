'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { PowerdonLogo } from '@/components/volt/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { useActiveCampaigns } from '@/hooks/use-services';
import { useStaffRole } from '@/hooks/use-staff-role';
import { AdminBreadcrumbs } from '@/components/admin/admin-breadcrumbs';
import { AdminProviders } from '@/components/admin/admin-providers';
import { AdminThemeProvider } from '@/components/admin/admin-theme-provider';
import { AdminThemeToggle } from '@/components/admin/admin-theme-toggle';
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
  LifeBuoy,
  ScrollText,
  Search,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navigationGroups: NavGroup[] = [
  {
    label: 'General',
    items: [{ name: 'Overview', href: '/admin', icon: LayoutDashboard }],
  },
  {
    label: 'Operations',
    items: [
      { name: 'Sessions', href: '/admin/sessions', icon: Zap },
      { name: 'Stations', href: '/admin/stations', icon: Radio },
      { name: 'Hardware', href: '/admin/hardware', icon: Cpu },
      { name: 'Ops', href: '/admin/ops', icon: Activity },
    ],
  },
  {
    label: 'Customers',
    items: [
      { name: 'Customers', href: '/admin/users', icon: Users },
      { name: 'Leads', href: '/admin/leads', icon: UserCircle },
      { name: 'Support', href: '/admin/support', icon: LifeBuoy },
    ],
  },
  {
    label: 'Growth',
    items: [
      { name: 'Campaigns', href: '/admin/campaigns', icon: Megaphone },
      { name: 'Rewards', href: '/admin/rewards', icon: Gift },
      { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Finance',
    items: [{ name: 'Billing', href: '/admin/billing', icon: CreditCard }],
  },
  {
    label: 'System',
    items: [
      { name: 'Staff', href: '/admin/staff', icon: Shield, adminOnly: true },
      { name: 'Audit Log', href: '/admin/audit', icon: ScrollText, adminOnly: true },
      { name: 'Settings', href: '/admin/settings', icon: Settings },
    ],
  },
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
  const { isAdmin } = useStaffRole();
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

  const visibleGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.adminOnly || isAdmin),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <AdminThemeProvider>
      <div className="min-h-screen bg-background">
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-foreground/20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
        )}

        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-border bg-background transition-transform duration-200 ease-in-out lg:translate-x-0',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex h-14 shrink-0 items-center justify-between px-5">
            <Link href="/admin" className="flex items-center gap-2">
              <PowerdonLogo size={20} className="text-foreground" />
              <span className="text-sm font-medium text-foreground">POWERDON</span>
            </Link>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded-md p-1.5 hover:bg-muted lg:hidden"
              aria-label="Close sidebar"
            >
              <X size={16} />
            </button>
          </div>

          <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-2">
            {visibleGroups.map((group) => (
              <div key={group.label}>
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== '/admin' && pathname.startsWith(item.href));
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          'relative flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors',
                          isActive
                            ? 'bg-primary/10 font-medium text-foreground'
                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                        )}
                      >
                        {isActive ? (
                          <span
                            className="absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-full bg-primary"
                            aria-hidden
                          />
                        ) : null}
                        <item.icon size={16} strokeWidth={isActive ? 2 : 1.5} />
                        {item.name}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {activeCampaign && (
            <div className="shrink-0 border-t border-border px-3 py-3">
              <Link
                href="/admin/campaigns"
                className="block rounded-md px-3 py-2 transition-colors hover:bg-muted/60"
              >
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Active campaign
                </p>
                <p className="truncate text-[13px] font-medium text-foreground">
                  {activeCampaign.name}
                </p>
              </Link>
            </div>
          )}
        </aside>

        <div className="lg:pl-56">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border bg-background/95 px-5 backdrop-blur-sm lg:px-8">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="rounded-md p-1.5 hover:bg-muted lg:hidden"
                aria-label="Open sidebar"
              >
                <Menu size={18} />
              </button>
              <div className="hidden min-w-0 sm:block">
                <AdminBreadcrumbs />
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="hidden h-8 gap-2 text-muted-foreground md:flex"
                onClick={() => {
                  window.dispatchEvent(
                    new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
                  );
                }}
              >
                <Search className="size-3.5" aria-hidden />
                <span className="text-xs">Search</span>
                <kbd className="pointer-events-none hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] lg:inline">
                  ⌘K
                </kbd>
              </Button>
              <AdminThemeToggle />
              <Badge variant="secondary" className="hidden font-normal sm:inline-flex">
                {isAdmin ? 'Admin' : 'Operator'}
              </Badge>
              <span className="hidden max-w-[160px] truncate text-[13px] text-muted-foreground md:block">
                {adminEmail ?? 'Admin'}
              </span>
              <Button variant="ghost" size="sm" className="gap-2 px-2" onClick={handleSignOut}>
                <LogOut size={16} aria-hidden />
                <span className="hidden text-[13px] md:inline">Sign out</span>
              </Button>
            </div>
          </header>

          <main className="p-5 lg:p-8">{children}</main>
        </div>

        <AdminProviders isAdmin={isAdmin} />
      </div>
    </AdminThemeProvider>
  );
}
