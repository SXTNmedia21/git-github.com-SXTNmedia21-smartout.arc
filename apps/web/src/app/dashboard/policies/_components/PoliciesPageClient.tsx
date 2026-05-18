"use client";

/**
 * PoliciesPageClient — client surface for /dashboard/policies.
 *
 * Receives `initialData` from the server Component shell (per ADR-0115 RSC
 * migration pattern). Renders KPI strip, tab nav, policies table, and the
 * PolicyCreateDialog trigger.
 *
 * No useEffect-on-mount fetch — server hands us hydrated data. After a
 * successful create the server action calls revalidatePath which triggers a
 * server re-render with fresh data.
 */

import { useState, useMemo, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { BookOpen, ShieldCheck, Users, Plus } from "lucide-react";
import { KpiAccentTile } from "@smartout/ui";
import { PageTabNav } from "@/components/dashboard/PageTabNav";
import { PEOPLE_TAB_DEFS } from "@/app/dashboard/_lib/people-tabs";
import { PolicyTypeBadge } from "./PolicyTypeBadge";
import { PolicyCreateDialog } from "./PolicyCreateDialog";
import type { PolicyRow, CreatePolicyInput } from "../_actions/policy-actions";
import { PoliciesToolsBridge } from "../_tools/policies-tools-bridge";

// ─── Types ──────────────────────────────────────────────────────

export type PoliciesPageInitialData = {
  policies: PolicyRow[];
};

// ─── Helpers ────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("nb-NO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function scopeLabel(scope: string): string {
  const map: Record<string, string> = {
    workspace: "Workspace",
    department: "Avdeling",
    team: "Team",
    location: "Lokasjon",
  };
  return map[scope] ?? scope;
}

function enforcementLabel(status: string): string {
  return status === "enforced" ? "Håndhevet" : "Aspirasjonell";
}

// ─── Component ─────────────────────────────────────────────────

export function PoliciesPageClient({ initialData }: { initialData: PoliciesPageInitialData }) {
  const [isCompact, setIsCompact] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogPolicyType, setDialogPolicyType] = useState<
    CreatePolicyInput["policy_type"] | undefined
  >(undefined);
  const router = useRouter();
  const pathname = usePathname();

  // Bridge callbacks — forwarded to PoliciesToolsBridge so Botsson can
  // open the create dialog (optionally pre-selecting a type) or highlight
  // a policy by id. Detail navigation is a no-op in Phase 1.
  const openCreateDialog = useCallback((policyType?: CreatePolicyInput["policy_type"]) => {
    setDialogPolicyType(policyType);
    setIsDialogOpen(true);
  }, []);

  const openPolicyById = useCallback((_policyId: string) => {
    // Phase 1: no detail view yet. No-op — tool returns found: true with summary.
  }, []);

  // Policies are provided by server — after createPolicy calls revalidatePath
  // the server re-renders with fresh data. No client-side re-fetch needed.
  const policies = initialData.policies;

  const hrCount = useMemo(() => policies.filter((p) => p.policy_type === "hr").length, [policies]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setIsCompact(e.currentTarget.scrollTop > 60);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      {/* Page header */}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-foreground text-3xl leading-tight tracking-tight">
            Policies
          </h1>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">
            <span>
              <span className="text-foreground font-mono font-semibold tabular-nums">
                {policies.length}
              </span>{" "}
              policies i workspace
            </span>
          </div>
        </div>

        {/* + Ny policy — brand-orange CTA, mirrors Invite-button placement */}
        <button
          type="button"
          onClick={() => setIsDialogOpen(true)}
          className="bg-brand-orange hover:bg-brand-orange/90 ring-brand-orange/30 text-primary-foreground flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-[var(--shadow-cta-lg)] ring-1 transition-[transform,box-shadow] hover:scale-[1.02] hover:shadow-[var(--shadow-cta-lg-hover)] active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          Ny policy
        </button>
      </div>

      {/* Page tab nav — People-module pill row */}
      <PageTabNav
        tabs={PEOPLE_TAB_DEFS.map((t) => ({ key: t.key, label: t.label, icon: t.icon }))}
        active={pathname ?? "/dashboard/policies"}
        onChange={(href) => router.push(href)}
        ariaLabel="Ansatte-seksjoner"
      />

      {/* KPI strip */}
      <div
        className={`grid origin-top grid-cols-1 gap-3 transition-all duration-500 ease-in-out sm:grid-cols-3 ${
          isCompact ? "h-0 overflow-hidden opacity-0" : "opacity-100"
        }`}
      >
        <KpiAccentTile
          compact
          title="Totalt"
          icon={BookOpen}
          accent="orange"
          primary={{ label: "Totalt", value: policies.length }}
        />
        <KpiAccentTile
          compact
          title="Aktive"
          icon={ShieldCheck}
          accent="emerald"
          primary={{ label: "Aktive", value: policies.filter((p) => p.is_active).length }}
        />
        <KpiAccentTile
          compact
          title="HR"
          icon={Users}
          accent="blue"
          primary={{ label: "HR", value: hrCount }}
          secondary={{
            label: "av totalt",
            value: policies.length,
          }}
        />
      </div>

      {/* Policies table */}
      <div
        className="relative flex min-h-0 flex-1 flex-col overflow-auto rounded-2xl"
        onScroll={handleScroll}
      >
        {policies.length === 0 ? (
          <EmptyState onNew={() => setIsDialogOpen(true)} />
        ) : (
          <PoliciesTable policies={policies} />
        )}
      </div>

      {/* Create dialog */}
      <PolicyCreateDialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setDialogPolicyType(undefined);
        }}
      />

      {/* Botsson harness bridge — registers page-scoped tools on mount.
          ADR-0238: policies is not a chat surface, owns_chat_surface = false. */}
      <PoliciesToolsBridge
        policies={policies}
        openCreateDialog={openCreateDialog}
        openPolicyById={openPolicyById}
      />
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16">
      <div className="bg-brand-orange/10 ring-brand-orange/20 rounded-2xl p-5 ring-1">
        <BookOpen className="text-brand-orange h-8 w-8" />
      </div>
      <div className="text-center">
        <p className="text-foreground text-sm font-semibold">Ingen policies ennå</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Opprett din første policy for å definere arbeidsplassregler.
        </p>
      </div>
      <button
        type="button"
        onClick={onNew}
        className="bg-brand-orange hover:bg-brand-orange/90 ring-brand-orange/30 text-primary-foreground flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-[var(--shadow-cta-lg)] ring-1 transition-[transform,box-shadow] hover:scale-[1.02] active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" />
        Ny policy
      </button>
    </div>
  );
}

// ─── Policies Table ─────────────────────────────────────────────

function PoliciesTable({ policies }: { policies: PolicyRow[] }) {
  return (
    <div className="border-border overflow-hidden rounded-2xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/60 text-muted-foreground">
            <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase">
              Navn
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase">
              Type
            </th>
            <th className="hidden px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase sm:table-cell">
              Scope
            </th>
            <th className="hidden px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase md:table-cell">
              Enforcement
            </th>
            <th className="hidden px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase lg:table-cell">
              Opprettet
            </th>
          </tr>
        </thead>
        <tbody>
          {policies.map((policy) => (
            <PolicyRow key={policy.policy_id} policy={policy} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Policy Row ─────────────────────────────────────────────────

function PolicyRow({ policy }: { policy: PolicyRow }) {
  return (
    <tr
      className="border-border hover:bg-accent/40 group cursor-default border-t transition-colors"
      // Click is no-op in Phase 1 — detail view is Phase 2.
      // aria-label for screen readers.
      aria-label={`Policy: ${policy.name}`}
    >
      <td className="px-4 py-3">
        <span className="text-foreground font-medium">{policy.name}</span>
      </td>
      <td className="px-4 py-3">
        <PolicyTypeBadge type={policy.policy_type} />
      </td>
      <td className="hidden px-4 py-3 sm:table-cell">
        <span className="text-muted-foreground text-xs">{scopeLabel(policy.policy_scope)}</span>
      </td>
      <td className="hidden px-4 py-3 md:table-cell">
        <span className="text-muted-foreground text-xs">
          {enforcementLabel(policy.enforcement_status)}
        </span>
      </td>
      <td className="hidden px-4 py-3 lg:table-cell">
        <span className="text-muted-foreground font-mono text-xs">
          {formatDate(policy.created_at)}
        </span>
      </td>
    </tr>
  );
}
