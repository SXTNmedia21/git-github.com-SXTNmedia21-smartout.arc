/**
 * PolicyTypeBadge — maps a policy_type enum value to a Norwegian label + OKLCH
 * accent color. Used in the policies table and any policy list view.
 *
 * No hardcoded color values — uses CSS variable-compatible Tailwind classes.
 */

type PolicyType = "operational" | "haccp" | "hr" | "safety" | "access" | "payroll" | "custom";

type BadgeConfig = {
  label: string;
  className: string;
};

const POLICY_TYPE_CONFIG: Record<PolicyType, BadgeConfig> = {
  operational: {
    label: "Drift",
    className: "bg-brand-orange/10 text-brand-orange ring-brand-orange/20 ring-1",
  },
  haccp: {
    label: "HACCP",
    className: "bg-emerald-500/10 text-emerald-500 ring-emerald-500/20 ring-1",
  },
  hr: {
    label: "HR",
    className: "bg-blue-400/10 text-blue-400 ring-blue-400/20 ring-1",
  },
  safety: {
    label: "Sikkerhet",
    className: "bg-amber-400/10 text-amber-400 ring-amber-400/20 ring-1",
  },
  access: {
    label: "Tilgang",
    className: "bg-violet-400/10 text-violet-400 ring-violet-400/20 ring-1",
  },
  payroll: {
    label: "Lønn",
    className: "bg-muted text-muted-foreground ring-border ring-1",
  },
  custom: {
    label: "Egendefinert",
    className: "bg-muted text-muted-foreground ring-border ring-1",
  },
};

export function PolicyTypeBadge({ type }: { type: string }) {
  const config =
    POLICY_TYPE_CONFIG[type as PolicyType] ??
    ({
      label: type,
      className: "bg-muted text-muted-foreground ring-border ring-1",
    } satisfies BadgeConfig);

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}

/**
 * Returns the Norwegian display label for a policy_type value.
 * Useful for aria-labels and toast messages.
 */
export function policyTypeLabel(type: string): string {
  return POLICY_TYPE_CONFIG[type as PolicyType]?.label ?? type;
}
