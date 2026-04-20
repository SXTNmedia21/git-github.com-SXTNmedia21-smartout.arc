"use client";

import { useTranslation } from "@smartout/i18n";
import { FileText, BookOpen, HelpCircle, GraduationCap, CheckSquare, Map } from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_CONFIG: Record<string, { icon: typeof FileText; color: string; labelKey: string }> = {
  procedure: {
    icon: FileText,
    color: "bg-komm-announcement/15 text-komm-announcement",
    labelKey: "knowledge.procedure",
  },
  manual: {
    icon: BookOpen,
    color: "bg-komm-manual/15 text-komm-manual",
    labelKey: "knowledge.manual",
  },
  quiz: { icon: HelpCircle, color: "bg-komm-quiz/15 text-komm-quiz", labelKey: "knowledge.quiz" },
  training: {
    icon: GraduationCap,
    color: "bg-komm-training/15 text-komm-training",
    labelKey: "knowledge.training",
  },
  task: { icon: CheckSquare, color: "bg-komm-task/15 text-komm-task", labelKey: "knowledge.task" },
  roadmap: { icon: Map, color: "bg-muted text-muted-foreground", labelKey: "knowledge.roadmap" },
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
  const { t } = useTranslation("komm");
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
          {t(config.labelKey)}
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
          {t("knowledge.open_action", { type: t(config.labelKey).toLowerCase() })}
        </span>
      </div>
    </div>
  );
}
