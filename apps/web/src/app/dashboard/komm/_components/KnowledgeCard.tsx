"use client";

import { FileText, BookOpen, HelpCircle, GraduationCap, CheckSquare, Map } from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_CONFIG: Record<string, { icon: typeof FileText; color: string; label: string }> = {
  procedure: { icon: FileText, color: "bg-orange-500/15 text-orange-500", label: "Prosedyre" },
  manual: { icon: BookOpen, color: "bg-blue-500/15 text-blue-500", label: "Manual" },
  quiz: { icon: HelpCircle, color: "bg-pink-500/15 text-pink-500", label: "Quiz" },
  training: { icon: GraduationCap, color: "bg-cyan-500/15 text-cyan-500", label: "Opplæring" },
  task: { icon: CheckSquare, color: "bg-green-500/15 text-green-500", label: "Oppgave" },
  roadmap: { icon: Map, color: "bg-muted text-muted-foreground", label: "Veikart" },
};

type SharedData = {
  shared_type: string;
  shared_id: string;
  title: string;
  description?: string;
};

type Props = {
  data: SharedData;
};

export function KnowledgeCard({ data }: Props) {
  const config = (TYPE_CONFIG[data.shared_type] ?? TYPE_CONFIG.manual)!;
  const Icon = config.icon;

  return (
    <div className="mt-1 w-56 overflow-hidden rounded-lg border">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <div className={cn("flex h-6 w-6 items-center justify-center rounded-md", config.color)}>
          <Icon className="h-3 w-3" />
        </div>
        <span
          className={cn(
            "text-[9px] font-semibold tracking-wide uppercase",
            config.color.split(" ")[1],
          )}
        >
          {config.label}
        </span>
      </div>
      <div className="px-3 py-2">
        <p className="text-xs font-semibold">{data.title}</p>
        {data.description && (
          <p className="text-muted-foreground mt-0.5 text-[10px]">{data.description}</p>
        )}
      </div>
      <div className="border-t px-3 py-1.5">
        <span className="text-primary text-[10px] font-medium">
          Åpne {config.label.toLowerCase()} →
        </span>
      </div>
    </div>
  );
}
