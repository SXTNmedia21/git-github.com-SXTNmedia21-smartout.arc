import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      status: {
        trainee: "bg-status-trainee/15 text-status-trainee",
        active: "bg-status-active/15 text-status-active",
        inactive: "bg-status-inactive/15 text-status-inactive",
        offboarding: "bg-status-offboarding/15 text-status-offboarding",
      },
    },
    defaultVariants: {
      status: "active",
    },
  },
);

type StatusBadgeProps = VariantProps<typeof statusBadgeVariants> & {
  label: string;
  className?: string;
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return <span className={cn(statusBadgeVariants({ status }), className)}>{label}</span>;
}
