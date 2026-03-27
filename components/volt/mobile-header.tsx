'use client';

import { PowerDonLogo, ArrowLeftIcon, HelpCircleIcon, ShieldCheckIcon } from './icons';
import { cn } from '@/lib/utils';

interface MobileHeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  showHelp?: boolean;
  onHelp?: () => void;
  showSecure?: boolean;
  className?: string;
}

export function MobileHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  showHelp = true,
  onHelp,
  showSecure = false,
  className,
}: MobileHeaderProps) {
  return (
    <header className={cn('flex items-center justify-between px-5 py-4 border-b border-border bg-background', className)}>
      <div className="flex items-center gap-3">
        {showBack ? (
          <button
            onClick={onBack}
            className="flex items-center justify-center w-9 h-9 -ml-1.5 rounded-md hover:bg-muted transition-colors"
            aria-label="Go back"
          >
            <ArrowLeftIcon size={18} className="text-foreground" />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <PowerDonLogo size={22} className="text-primary" />
            <span className="font-semibold text-foreground tracking-tight text-[15px]">POWERDON</span>
          </div>
        )}
        {title && (
          <div className="flex flex-col">
            <span className="font-medium text-foreground text-[15px]">{title}</span>
            {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-3">
        {subtitle && !title && (
          <div className="text-right">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{subtitle}</p>
          </div>
        )}
        {showSecure && (
          <div className="flex items-center gap-1 text-primary">
            <ShieldCheckIcon size={13} />
            <span className="text-[11px] font-medium uppercase tracking-wide">Secure</span>
          </div>
        )}
        {showHelp && (
          <button
            onClick={onHelp}
            className="flex items-center justify-center w-9 h-9 rounded-md hover:bg-muted transition-colors"
            aria-label="Help"
          >
            <HelpCircleIcon size={18} className="text-muted-foreground" />
          </button>
        )}
      </div>
    </header>
  );
}
