/** Shared status badge labels/styles for admin and PWA UI. */
export const STATUS_BADGE_CONFIG: Record<string, { label: string; className: string }> = {
  // Session
  pending: { label: 'Pending', className: 'bg-muted text-muted-foreground' },
  active: { label: 'Active', className: 'bg-foreground text-background' },
  completed: { label: 'Completed', className: 'bg-muted text-muted-foreground' },
  expired: { label: 'Expired', className: 'bg-muted text-muted-foreground' },
  failed: { label: 'Failed', className: 'bg-destructive/10 text-destructive' },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground' },

  // Station
  online: { label: 'Online', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  offline: { label: 'Offline', className: 'bg-muted text-muted-foreground' },
  maintenance: { label: 'Maintenance', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  'low-battery': { label: 'Low Battery', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  connected: { label: 'Connected', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  disconnected: { label: 'Disconnected', className: 'bg-muted text-muted-foreground' },

  // Reward
  qualified: { label: 'Qualified', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  issued: { label: 'Issued', className: 'bg-foreground text-background' },
  redeemed: { label: 'Redeemed', className: 'bg-muted text-muted-foreground' },

  // Payment / Stripe
  authorized: { label: 'Authorized', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  captured: { label: 'Captured', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  refunded: { label: 'Refunded', className: 'bg-muted text-muted-foreground' },
  succeeded: { label: 'Captured', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  requires_capture: { label: 'Authorized', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  processing: { label: 'Processing', className: 'bg-muted text-muted-foreground' },
  canceled: { label: 'Canceled', className: 'bg-muted text-muted-foreground' },
  requires_payment_method: { label: 'Failed', className: 'bg-destructive/10 text-destructive' },

  // Support tickets
  open: { label: 'Open', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  in_progress: { label: 'In Progress', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  resolved: { label: 'Resolved', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  closed: { label: 'Closed', className: 'bg-muted text-muted-foreground' },

  // Consent / marketing
  opted_in: { label: 'Opted In', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  opted_out: { label: 'Opted Out', className: 'bg-muted text-muted-foreground' },

  // Ops / health
  healthy: { label: 'Healthy', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  degraded: { label: 'Degraded', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  unhealthy: { label: 'Unhealthy', className: 'bg-destructive/10 text-destructive' },

  // Campaign
  live: { label: 'Live', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  scheduled: { label: 'Scheduled', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  ended: { label: 'Ended', className: 'bg-muted text-muted-foreground' },
  inactive: { label: 'Inactive', className: 'bg-muted text-muted-foreground' },
}

export function getStatusBadgeConfig(status: string): { label: string; className: string } {
  const key = status.toLowerCase().replace(/\s+/g, '_')
  return (
    STATUS_BADGE_CONFIG[key] ??
    STATUS_BADGE_CONFIG[status] ?? {
      label: status,
      className: 'bg-muted text-muted-foreground',
    }
  )
}

export function formatStatusLabel(status: string): string {
  return getStatusBadgeConfig(status).label
}
