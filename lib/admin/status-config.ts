/** Shared status badge labels/styles for admin and PWA UI. */
export const STATUS_BADGE_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-muted text-muted-foreground' },
  active: { label: 'Active', className: 'bg-foreground text-background' },
  completed: { label: 'Completed', className: 'bg-muted text-muted-foreground' },
  expired: { label: 'Expired', className: 'bg-muted text-muted-foreground' },
  failed: { label: 'Failed', className: 'bg-destructive/10 text-destructive' },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground' },
  online: { label: 'Online', className: 'bg-foreground text-background' },
  offline: { label: 'Offline', className: 'bg-muted text-muted-foreground' },
  maintenance: { label: 'Maintenance', className: 'bg-muted text-muted-foreground' },
  'low-battery': { label: 'Low Battery', className: 'bg-muted text-muted-foreground' },
  qualified: { label: 'Qualified', className: 'bg-muted text-muted-foreground' },
  issued: { label: 'Issued', className: 'bg-foreground text-background' },
  redeemed: { label: 'Redeemed', className: 'bg-muted text-muted-foreground' },
  authorized: { label: 'Authorized', className: 'bg-muted text-muted-foreground' },
  captured: { label: 'Captured', className: 'bg-foreground text-background' },
  refunded: { label: 'Refunded', className: 'bg-muted text-muted-foreground' },
}

export function getStatusBadgeConfig(status: string): { label: string; className: string } {
  return STATUS_BADGE_CONFIG[status] ?? { label: status, className: 'bg-muted text-muted-foreground' }
}
