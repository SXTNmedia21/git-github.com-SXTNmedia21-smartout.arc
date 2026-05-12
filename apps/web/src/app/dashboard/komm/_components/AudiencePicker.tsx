"use client";

/**
 * AudiencePicker — 5-segment tab control for announcement audience targeting.
 *
 * Implements WCAG 2.1 tab pattern (role=tablist + role=tab + roving tabindex
 * + ArrowLeft/Right/Home/End keyboard navigation). Uses motion.button with
 * whileHover={{ y: -1 }} per Nordic Split animation spec — no Tailwind hover
 * translate, no transition-all.
 *
 * Drilldowns: DepartmentDrilldown (queries DB), RoleDrilldown (hardcoded 4
 * roles), IndividualsDrilldown (queries DB, scrollable list).
 */

import { useRef, type KeyboardEvent } from "react";
import { Globe, Clock, Building2, BadgeCheck, User, Check } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { motion } from "framer-motion";
import { useWorkspace } from "@/lib/workspace-context";
import type { AudienceInput } from "../_hooks/use-audience-resolver";

type AudiencePickerProps = {
  value: AudienceInput;
  onChange: (next: AudienceInput) => void;
};

const SEGMENTS = [
  { kind: "all" as const, icon: Globe, labelKey: "nyheter.audience_all" },
  { kind: "on_duty" as const, icon: Clock, labelKey: "nyheter.audience_on_duty" },
  { kind: "department" as const, icon: Building2, labelKey: "nyheter.audience_department" },
  { kind: "role" as const, icon: BadgeCheck, labelKey: "nyheter.audience_role" },
  { kind: "individuals" as const, icon: User, labelKey: "nyheter.audience_individuals" },
] as const;

export function AudiencePicker({ value, onChange }: AudiencePickerProps) {
  const { t } = useTranslation("komm");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Emit the correct discriminated union shape for the given kind
  function selectKind(kind: AudienceInput["kind"]) {
    if (kind === "all") onChange({ kind: "all" });
    else if (kind === "on_duty") onChange({ kind: "on_duty" });
    else if (kind === "department") onChange({ kind: "department", departmentIds: [] });
    else if (kind === "role") onChange({ kind: "role", roles: [] });
    else onChange({ kind: "individuals", profileIds: [] });
  }

  // WCAG 2.1 tab pattern — arrow keys move focus + selection, Home/End jump to ends
  function onTabKeyDown(e: KeyboardEvent<HTMLButtonElement>, currentIdx: number) {
    let nextIdx = currentIdx;
    if (e.key === "ArrowRight") nextIdx = (currentIdx + 1) % SEGMENTS.length;
    else if (e.key === "ArrowLeft") nextIdx = (currentIdx - 1 + SEGMENTS.length) % SEGMENTS.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = SEGMENTS.length - 1;
    else return;
    e.preventDefault();
    const next = tabRefs.current[nextIdx];
    if (next) {
      next.focus();
      selectKind(SEGMENTS[nextIdx]!.kind);
    }
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label={t("nyheter.audience_label")}
        aria-orientation="horizontal"
        className="bg-muted border-border grid grid-cols-5 gap-1 rounded-xl border p-1"
      >
        {SEGMENTS.map(({ kind, icon: Icon, labelKey }, idx) => {
          const active = value.kind === kind;
          return (
            <motion.button
              key={kind}
              ref={(el) => {
                tabRefs.current[idx] = el;
              }}
              role="tab"
              type="button"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => selectKind(kind)}
              onKeyDown={(e) => onTabKeyDown(e, idx)}
              whileHover={active ? undefined : { y: -1 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className={`flex flex-col items-center gap-1 rounded-lg px-1.5 py-2 text-xs font-medium ${
                active
                  ? "bg-card text-foreground font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={{ transitionProperty: "background-color, color, box-shadow" }}
            >
              <Icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} aria-hidden="true" />
              <span>{t(labelKey)}</span>
            </motion.button>
          );
        })}
      </div>

      {value.kind === "department" && <DepartmentDrilldown value={value} onChange={onChange} />}
      {value.kind === "role" && <RoleDrilldown value={value} onChange={onChange} />}
      {value.kind === "individuals" && <IndividualsDrilldown value={value} onChange={onChange} />}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  DepartmentDrilldown                                                        */
/* -------------------------------------------------------------------------- */

function DepartmentDrilldown({
  value,
  onChange,
}: {
  value: Extract<AudienceInput, { kind: "department" }>;
  onChange: (next: AudienceInput) => void;
}) {
  const { workspace } = useWorkspace();
  const wsId = workspace.workspace_id;

  const { data: departments } = useQuery({
    queryKey: ["dashboard", "departments", wsId],
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("department")
        .select("department_id, name")
        .eq("workspace_id", wsId)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  function toggle(id: string) {
    const has = value.departmentIds.includes(id);
    onChange({
      kind: "department",
      departmentIds: has
        ? value.departmentIds.filter((x) => x !== id)
        : [...value.departmentIds, id],
    });
  }

  return (
    <div data-testid="audience-drilldown-department" className="mt-2.5 grid grid-cols-2 gap-2">
      {(departments ?? []).map((d) => {
        const active = value.departmentIds.includes(d.department_id);
        return (
          <motion.button
            key={d.department_id}
            type="button"
            onClick={() => toggle(d.department_id)}
            whileHover={active ? undefined : { y: -1 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className={`bg-card flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left ${
              active
                ? "border-primary ring-primary/10 bg-primary/5 ring-2"
                : "border-border hover:border-border/80"
            }`}
            style={{
              transitionProperty: "border-color, background-color, box-shadow",
              transitionDuration: "200ms",
            }}
          >
            <span className="text-sm leading-none font-semibold">{d.name}</span>
            {active && <Check className="text-primary ml-auto h-4 w-4" aria-hidden="true" />}
          </motion.button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  RoleDrilldown                                                              */
/* -------------------------------------------------------------------------- */

function RoleDrilldown({
  value,
  onChange,
}: {
  value: Extract<AudienceInput, { kind: "role" }>;
  onChange: (next: AudienceInput) => void;
}) {
  const { t } = useTranslation("komm");

  // Hardcoded 4 roles — no DB query needed
  const ROLES: { id: string; labelKey: string }[] = [
    { id: "manager", labelKey: "nyheter.role_manager" },
    { id: "admin", labelKey: "nyheter.role_admin" },
    { id: "employee", labelKey: "nyheter.role_employee" },
    { id: "owner", labelKey: "nyheter.role_owner" },
  ];

  function toggle(id: string) {
    const has = value.roles.includes(id);
    onChange({
      kind: "role",
      roles: has ? value.roles.filter((x) => x !== id) : [...value.roles, id],
    });
  }

  return (
    <div data-testid="audience-drilldown-role" className="mt-2.5 grid grid-cols-2 gap-2">
      {ROLES.map((r) => {
        const active = value.roles.includes(r.id);
        return (
          <motion.button
            key={r.id}
            type="button"
            onClick={() => toggle(r.id)}
            whileHover={active ? undefined : { y: -1 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className={`bg-card flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left ${
              active
                ? "border-primary ring-primary/10 bg-primary/5 ring-2"
                : "border-border hover:border-border/80"
            }`}
            style={{
              transitionProperty: "border-color, background-color, box-shadow",
              transitionDuration: "200ms",
            }}
          >
            <span className="text-sm leading-none font-semibold">{t(r.labelKey)}</span>
            {active && <Check className="text-primary ml-auto h-4 w-4" aria-hidden="true" />}
          </motion.button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  IndividualsDrilldown                                                       */
/* -------------------------------------------------------------------------- */

function IndividualsDrilldown({
  value,
  onChange,
}: {
  value: Extract<AudienceInput, { kind: "individuals" }>;
  onChange: (next: AudienceInput) => void;
}) {
  const { workspace } = useWorkspace();
  const wsId = workspace.workspace_id;

  const { data: profiles } = useQuery({
    queryKey: ["dashboard", "profiles", wsId],
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profile")
        .select("profile_id, display_name")
        .eq("workspace_id", wsId)
        .eq("status", "active")
        .order("display_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  function toggle(id: string) {
    const has = value.profileIds.includes(id);
    onChange({
      kind: "individuals",
      profileIds: has ? value.profileIds.filter((x) => x !== id) : [...value.profileIds, id],
    });
  }

  return (
    <div data-testid="audience-drilldown-individuals" className="mt-2.5">
      <div className="border-border max-h-52 overflow-y-auto rounded-xl border p-1">
        {(profiles ?? []).map((p) => {
          const on = value.profileIds.includes(p.profile_id);
          return (
            <button
              key={p.profile_id}
              type="button"
              onClick={() => toggle(p.profile_id)}
              className="hover:bg-muted flex w-full items-center gap-2.5 rounded-md p-2 text-left"
            >
              <span className="flex-1 text-sm font-medium">{p.display_name}</span>
              <span
                data-on={on}
                className={`grid h-4.5 w-4.5 place-items-center rounded border ${
                  on ? "bg-primary border-primary text-primary-foreground" : "border-border bg-card"
                }`}
              >
                {on && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
