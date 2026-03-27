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
  pending: { label: 'Pending', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  completed: { label: 'Completed', className: 'bg-slate-50 text-slate-600 border-slate-200' },
  expired: { label: 'Expired', className: 'bg-red-50 text-red-600 border-red-200' },
  failed: { label: 'Failed', className: 'bg-red-50 text-red-600 border-red-200' },
  
  // Station statuses
  online: { label: 'Online', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  offline: { label: 'Offline', className: 'bg-slate-50 text-slate-600 border-slate-200' },
  maintenance: { label: 'Maintenance', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  'low-battery': { label: 'Low Battery', className: 'bg-orange-50 text-orange-600 border-orange-200' },
  
  // Reward statuses
  qualified: { label: 'Qualified', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  issued: { label: 'Issued', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  redeemed: { label: 'Redeemed', className: 'bg-slate-50 text-slate-600 border-slate-200' },
  
  // Payment statuses
  authorized: { label: 'Authorized', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  captured: { label: 'Captured', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  refunded: { label: 'Refunded', className: 'bg-slate-50 text-slate-600 border-slate-200' },
};

export function StatusBadge({ status, className, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, className: 'bg-slate-50 text-slate-600 border-slate-200' };
  
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium border rounded-full',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        config.className,
        className
      )}
    >
      <span className={cn(
        'rounded-full mr-1.5',
        size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2',
        status === 'active' || status === 'online' || status === 'issued' || status === 'captured' ? 'bg-emerald-500' :
        status === 'pending' || status === 'maintenance' ? 'bg-amber-500' :
        status === 'qualified' || status === 'authorized' ? 'bg-blue-500' :
        status === 'expired' || status === 'failed' || status === 'offline' ? 'bg-slate-400' :
        status === 'low-battery' ? 'bg-orange-500' :
        'bg-slate-400'
      )} />
      {config.label}
    </span>
  );
}
