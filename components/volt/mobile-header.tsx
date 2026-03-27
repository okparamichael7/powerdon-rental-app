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
    <header className={cn('flex items-center justify-between px-4 py-3 border-b border-border bg-background', className)}>
      <div className="flex items-center gap-3">
        {showBack ? (
          <button
            onClick={onBack}
            className="flex items-center justify-center w-10 h-10 -ml-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Go back"
          >
            <ArrowLeftIcon size={20} className="text-foreground" />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <PowerDonLogo size={24} className="text-primary" />
            <span className="font-semibold text-foreground tracking-tight">POWERDON</span>
          </div>
        )}
        {title && (
          <div className="flex flex-col">
            <span className="font-semibold text-foreground">{title}</span>
            {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        {subtitle && !title && (
          <div className="text-right mr-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{subtitle}</p>
          </div>
        )}
        {showSecure && (
          <div className="flex items-center gap-1 text-primary">
            <ShieldCheckIcon size={14} />
            <span className="text-xs font-medium uppercase tracking-wide">Secure</span>
          </div>
        )}
        {showHelp && (
          <button
            onClick={onHelp}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-muted hover:bg-muted/80 transition-colors"
            aria-label="Help"
          >
            <HelpCircleIcon size={20} className="text-muted-foreground" />
          </button>
        )}
      </div>
    </header>
  );
}
