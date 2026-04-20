import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type TaskRunnerProps = {
  title: string;
  description: string;
  ctaLabel: string;
  onCtaClick: () => void;
  showDefer?: boolean;
  onDefer?: () => void;
  icon?: LucideIcon;
  children: ReactNode;
  isLoading?: boolean;
  isDisabled?: boolean;
};
