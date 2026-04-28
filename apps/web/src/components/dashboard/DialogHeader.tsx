import type { ReactNode } from "react";
import { X } from "lucide-react";

interface DialogHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  onClose: () => void;
  onBack?: () => void;
  backIcon?: ReactNode;
}

export function DialogHeader({
  title,
  subtitle,
  icon,
  onClose,
  onBack,
  backIcon,
}: DialogHeaderProps) {
  return (
    <div className="flex items-center justify-between px-7 pt-6 pb-5">
      <div className="flex items-center gap-3">
        {onBack && backIcon ? (
          <button
            type="button"
            onClick={onBack}
            className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-xl p-2.5 transition-colors"
          >
            {backIcon}
          </button>
        ) : icon ? (
          <div className="bg-brand-orange/10 ring-brand-orange/20 rounded-xl p-2.5 ring-1">
            {icon}
          </div>
        ) : null}
        <div>
          <h2 className="font-heading text-foreground text-2xl leading-tight tracking-tight">
            {title}
          </h2>
          {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
        </div>
      </div>
      <button
        onClick={onClose}
        className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-full p-2 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
