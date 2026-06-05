'use client';

import { PowerDonLogo, ArrowLeftIcon, HelpCircleIcon, ShieldCheckIcon } from './icons';
import { cn } from '@/lib/utils';

export interface StationContextProps {
  eventName: string;
  stationId?: string;
}

interface MobileHeaderProps {
  title?: string;
  /** @deprecated Prefer statusBadge or stationContext */
  subtitle?: string;
  stationContext?: StationContextProps;
  statusBadge?: string;
  statusBadgeVariant?: 'default' | 'success' | 'warning' | 'error' | 'active';
  showBack?: boolean;
  onBack?: () => void;
  showHelp?: boolean;
  onHelp?: () => void;
  showSecure?: boolean;
  className?: string;
}

/** Short, human-friendly station reference for headers (not the full UUID). */
export function formatStationRef(stationId: string): string {
  const normalized = stationId.trim();
  if (normalized.length <= 10) return normalized.toUpperCase();
  return normalized.replace(/-/g, '').slice(0, 8).toUpperCase();
}

function StatusBadge({
  label,
  variant = 'default',
}: {
  label: string;
  variant?: MobileHeaderProps['statusBadgeVariant'];
}) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider',
        variant === 'success' && 'border border-emerald-200/70 bg-emerald-50 text-emerald-700',
        variant === 'active' && 'border border-primary/20 bg-primary/10 text-primary',
        variant === 'warning' && 'border border-amber-200/70 bg-amber-50 text-amber-700',
        variant === 'error' && 'border border-destructive/20 bg-destructive/10 text-destructive',
        variant === 'default' && 'bg-muted text-muted-foreground',
      )}
    >
      {label}
    </span>
  );
}

function StationContextBar({ eventName, stationId }: StationContextProps) {
  const displayEvent = eventName.trim() || 'Event';

  return (
    <div className="flex items-center gap-3 border-t border-border/40 bg-muted/20 px-4 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Event
        </p>
        <p className="truncate text-sm font-medium leading-tight text-foreground">
          {displayEvent}
        </p>
      </div>
      {stationId ? (
        <div className="shrink-0 rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-right">
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Station
          </p>
          <p
            className="font-mono text-xs font-semibold tabular-nums tracking-wide text-foreground"
            title={stationId}
          >
            {formatStationRef(stationId)}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function MobileHeader({
  title,
  subtitle,
  stationContext,
  statusBadge,
  statusBadgeVariant = 'default',
  showBack = false,
  onBack,
  showHelp = false,
  onHelp,
  showSecure = false,
  className,
}: MobileHeaderProps) {
  const resolvedBadge = statusBadge ?? (!title && !stationContext ? subtitle : undefined);

  return (
    <header className={cn('shrink-0 border-b border-border/50 bg-background/95 backdrop-blur-md', className)}>
      <div className="flex h-[var(--pwa-header-height)] items-center justify-between px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {showBack ? (
            <button
              type="button"
              onClick={onBack}
              className="pwa-tap -ml-1 flex items-center justify-center rounded-full active:bg-muted/60"
              aria-label="Go back"
            >
              <ArrowLeftIcon size={22} className="text-foreground" />
            </button>
          ) : (
            <div className="flex shrink-0 items-center gap-2">
              <PowerDonLogo size={22} className="text-foreground" />
              <span className="text-[15px] font-semibold tracking-tight text-foreground">PowerDon</span>
            </div>
          )}
          {title && (
            <div className="flex min-w-0 flex-col justify-center">
              <span className="truncate text-[15px] font-semibold text-foreground">{title}</span>
              {subtitle && !stationContext && (
                <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {resolvedBadge && <StatusBadge label={resolvedBadge} variant={statusBadgeVariant} />}
          {showSecure && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <ShieldCheckIcon size={12} />
              <span className="text-[10px] font-medium uppercase tracking-wide">Secure</span>
            </div>
          )}
          {showHelp && (
            <button
              type="button"
              onClick={onHelp}
              className="pwa-tap flex items-center justify-center rounded-full active:bg-muted/60"
              aria-label="Help"
            >
              <HelpCircleIcon size={20} className="text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {stationContext && !showBack && (
        <StationContextBar
          eventName={stationContext.eventName}
          stationId={stationContext.stationId}
        />
      )}
    </header>
  );
}
