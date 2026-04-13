"use client";

import { useTranslation } from "@smartout/i18n";
import {
  Image,
  CheckSquare,
  FileText,
  Link2,
  GraduationCap,
  HelpCircle,
  Map,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SHARE_OPTIONS = [
  {
    key: "bilder",
    labelKey: "attachment.images",
    icon: Image,
    color: "bg-komm-images/15 text-komm-images",
  },
  {
    key: "oppgave",
    labelKey: "attachment.task",
    icon: CheckSquare,
    color: "bg-komm-task/15 text-komm-task",
  },
  {
    key: "prosedyre",
    labelKey: "attachment.procedure",
    icon: FileText,
    color: "bg-komm-announcement/15 text-komm-announcement",
  },
  {
    key: "lenke",
    labelKey: "attachment.link",
    icon: Link2,
    color: "bg-komm-link/15 text-komm-link",
  },
  {
    key: "opplaering",
    labelKey: "attachment.training",
    icon: GraduationCap,
    color: "bg-komm-training/15 text-komm-training",
  },
  {
    key: "quiz",
    labelKey: "attachment.quiz",
    icon: HelpCircle,
    color: "bg-komm-quiz/15 text-komm-quiz",
  },
  {
    key: "veikart",
    labelKey: "attachment.roadmap",
    icon: Map,
    color: "bg-muted text-muted-foreground",
  },
  {
    key: "snarvei",
    labelKey: "attachment.shortcut",
    icon: Zap,
    color: "bg-muted text-muted-foreground",
  },
] as const;

type Props = {
  onSelect: (key: string) => void;
  onClose: () => void;
};

export function AttachmentPopup({ onSelect, onClose }: Props) {
  const { t } = useTranslation("komm");
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      {/* Popup */}
      <div className="bg-card absolute bottom-full left-0 z-50 mb-2 ml-2 grid grid-cols-4 gap-1 rounded-xl border p-2 shadow-lg">
        {SHARE_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          return (
            <button
              key={opt.key}
              onClick={() => {
                onSelect(opt.key);
                onClose();
              }}
              className="hover:bg-accent/50 flex flex-col items-center gap-1.5 rounded-lg p-2.5 transition-colors"
            >
              <div
                className={cn("flex h-9 w-9 items-center justify-center rounded-full", opt.color)}
              >
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-muted-foreground text-[10px] font-medium">
                {t(opt.labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
