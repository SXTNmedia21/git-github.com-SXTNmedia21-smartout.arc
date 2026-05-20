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
    className: "bg-success/10 text-success ring-success/20 ring-1",
  },
  hr: {
    label: "HR",
    className: "bg-info/10 text-info ring-info/20 ring-1",
  },
  safety: {
    label: "Sikkerhet",
    className: "bg-warning/10 text-warning ring-warning/20 ring-1",
  },
  access: {
    label: "Tilgang",
    className: "bg-primary/10 text-primary ring-primary/20 ring-1",
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
