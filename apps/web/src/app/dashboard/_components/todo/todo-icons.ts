import {
  Building2,
  Users,
  Scale,
  TrendingUp,
  ShieldCheck,
  CalendarDays,
  FileText,
  MessageSquare,
} from "lucide-react";
import type { TaskGroup } from "@smartout/types";
import type { LucideIcon } from "lucide-react";

export const groupIcons: Record<TaskGroup, LucideIcon> = {
  departments: Building2,
  staff: Users,
  framework: Scale,
  budget: TrendingUp,
  governance: ShieldCheck,
  schedule: CalendarDays,
  contracts: FileText,
  messages: MessageSquare,
};
