'use client';

import { cn } from '@/lib/utils';
import type { SessionStatus, StationStatus, RewardStatus, PaymentStatus } from '@/lib/types';
import { getStatusBadgeConfig } from '@/lib/admin/status-config';

interface StatusBadgeProps {
  status: SessionStatus | StationStatus | RewardStatus | PaymentStatus;
  className?: string;
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { label: string; className: string }> = {
  // Session statuses
  pending: getStatusBadgeConfig('pending'),
  active: getStatusBadgeConfig('active'),
  completed: getStatusBadgeConfig('completed'),
  expired: getStatusBadgeConfig('expired'),
  failed: getStatusBadgeConfig('failed'),
  cancelled: getStatusBadgeConfig('cancelled'),
  
  // Station statuses
  online: getStatusBadgeConfig('online'),
  offline: getStatusBadgeConfig('offline'),
  maintenance: getStatusBadgeConfig('maintenance'),
  'low-battery': getStatusBadgeConfig('low-battery'),
  
  // Reward statuses
  qualified: getStatusBadgeConfig('qualified'),
  issued: getStatusBadgeConfig('issued'),
  redeemed: getStatusBadgeConfig('redeemed'),
  
  // Payment statuses
  authorized: getStatusBadgeConfig('authorized'),
  captured: getStatusBadgeConfig('captured'),
  refunded: getStatusBadgeConfig('refunded'),
};

export function StatusBadge({ status, className, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status] || getStatusBadgeConfig(String(status));
  
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
