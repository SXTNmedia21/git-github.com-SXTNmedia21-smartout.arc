"use client";

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
  { key: "bilder", label: "Bilder", icon: Image, color: "bg-blue-500/15 text-blue-500" },
  { key: "oppgave", label: "Oppgave", icon: CheckSquare, color: "bg-green-500/15 text-green-500" },
  {
    key: "prosedyre",
    label: "Prosedyre",
    icon: FileText,
    color: "bg-orange-500/15 text-orange-500",
  },
  { key: "lenke", label: "Lenke", icon: Link2, color: "bg-orange-500/15 text-orange-500" },
  {
    key: "opplaering",
    label: "Opplæring",
    icon: GraduationCap,
    color: "bg-cyan-500/15 text-cyan-500",
  },
  { key: "quiz", label: "Quiz", icon: HelpCircle, color: "bg-pink-500/15 text-pink-500" },
  { key: "veikart", label: "Veikart", icon: Map, color: "bg-muted text-muted-foreground" },
  { key: "snarvei", label: "Snarvei", icon: Zap, color: "bg-muted text-muted-foreground" },
] as const;

type Props = {
  onSelect: (key: string) => void;
  onClose: () => void;
};

export function AttachmentPopup({ onSelect, onClose }: Props) {
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
              <span className="text-muted-foreground text-[10px] font-medium">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
