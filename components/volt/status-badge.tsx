'use client';

import { cn } from '@/lib/utils';
import { getStatusBadgeConfig } from '@/lib/admin/status-config';

interface StatusBadgeProps {
  status: string;
  className?: string;
  size?: 'sm' | 'md';
  label?: string;
}

export function StatusBadge({ status, className, size = 'md', label }: StatusBadgeProps) {
  const config = getStatusBadgeConfig(String(status));

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-[11px]',
        config.className,
        className,
      )}
    >
      {label ?? config.label}
    </span>
  );
}

export function ConsentBadge({ optedIn }: { optedIn: boolean }) {
  return <StatusBadge status={optedIn ? 'opted_in' : 'opted_out'} />;
}
