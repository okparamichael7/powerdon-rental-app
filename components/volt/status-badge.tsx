'use client';

import { cn } from '@/lib/utils';
import type { SessionStatus, StationStatus, RewardStatus, PaymentStatus } from '@/lib/types';

interface StatusBadgeProps {
  status: SessionStatus | StationStatus | RewardStatus | PaymentStatus;
  className?: string;
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { label: string; className: string }> = {
  // Session statuses
  pending: { label: 'Pending', className: 'bg-muted text-muted-foreground' },
  active: { label: 'Active', className: 'bg-foreground text-background' },
  completed: { label: 'Completed', className: 'bg-muted text-muted-foreground' },
  expired: { label: 'Expired', className: 'bg-muted text-muted-foreground' },
  failed: { label: 'Failed', className: 'bg-destructive/10 text-destructive' },
  
  // Station statuses
  online: { label: 'Online', className: 'bg-foreground text-background' },
  offline: { label: 'Offline', className: 'bg-muted text-muted-foreground' },
  maintenance: { label: 'Maintenance', className: 'bg-muted text-muted-foreground' },
  'low-battery': { label: 'Low Battery', className: 'bg-muted text-muted-foreground' },
  
  // Reward statuses
  qualified: { label: 'Qualified', className: 'bg-muted text-muted-foreground' },
  issued: { label: 'Issued', className: 'bg-foreground text-background' },
  redeemed: { label: 'Redeemed', className: 'bg-muted text-muted-foreground' },
  
  // Payment statuses
  authorized: { label: 'Authorized', className: 'bg-muted text-muted-foreground' },
  captured: { label: 'Captured', className: 'bg-foreground text-background' },
  refunded: { label: 'Refunded', className: 'bg-muted text-muted-foreground' },
};

export function StatusBadge({ status, className, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-[11px]',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
