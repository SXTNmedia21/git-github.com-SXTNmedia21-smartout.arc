import { useId, type ReactNode } from "react";
import { X } from "lucide-react";

interface DialogHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  onClose: () => void;
  onBack?: () => void;
  backIcon?: ReactNode;
  titleId?: string;
  closeLabel?: string;
  backLabel?: string;
}

export function DialogHeader({
  title,
  subtitle,
  icon,
  onClose,
  onBack,
  backIcon,
  titleId,
  closeLabel = "Lukk",
  backLabel = "Tilbake",
}: DialogHeaderProps) {
  const generatedId = useId();
  const resolvedTitleId = titleId ?? generatedId;

  return (
    <div className="flex items-center justify-between px-7 pt-6 pb-5">
      <div className="flex items-center gap-3">
        {onBack && backIcon ? (
          <button
            type="button"
            onClick={onBack}
            aria-label={backLabel}
            className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/50 rounded-xl p-2.5 transition-colors outline-none focus-visible:ring-[3px]"
          >
            {backIcon}
          </button>
        ) : icon ? (
          <div
            aria-hidden="true"
            className="bg-brand-orange/10 ring-brand-orange/20 rounded-xl p-2.5 ring-1"
          >
            {icon}
          </div>
        ) : null}
        <div>
          <h2
            id={resolvedTitleId}
            className="font-heading text-foreground text-2xl leading-tight tracking-tight"
          >
            {title}
          </h2>
          {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/50 rounded-full p-2 transition-colors outline-none focus-visible:ring-[3px]"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
