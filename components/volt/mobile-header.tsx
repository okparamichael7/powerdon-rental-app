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
    <header className={cn('flex items-center justify-between px-5 h-14 bg-background', className)}>
      <div className="flex items-center gap-3">
        {showBack ? (
          <button
            onClick={onBack}
            className="flex items-center justify-center w-8 h-8 -ml-2 rounded-full hover:bg-muted/60 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeftIcon size={18} className="text-foreground" />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <PowerDonLogo size={20} className="text-foreground" />
            <span className="font-medium text-foreground tracking-tight text-sm">POWERDON</span>
          </div>
        )}
        {title && (
          <div className="flex flex-col">
            <span className="font-medium text-foreground text-sm">{title}</span>
            {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        {subtitle && !title && (
          <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{subtitle}</p>
        )}
        {showSecure && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <ShieldCheckIcon size={12} />
            <span className="text-[10px] font-medium uppercase tracking-wide">Secure</span>
          </div>
        )}
        {showHelp && (
          <button
            onClick={onHelp}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-muted/60 transition-colors"
            aria-label="Help"
          >
            <HelpCircleIcon size={18} className="text-muted-foreground" />
          </button>
        )}
      </div>
    </header>
  );
}
