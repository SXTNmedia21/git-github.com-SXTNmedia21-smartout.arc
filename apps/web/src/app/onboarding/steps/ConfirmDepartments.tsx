"use client";

/**
 * ConfirmDepartments — default department setup per ADR-0429.
 *
 * Renders three canonical departments (FoH / BoH / Admin) as editable cards.
 * Each card shows the department name in an input (rename-in-place), a tooltip
 * explaining what "avdeling" means, and a read-only position list for context.
 *
 * Size-conditional toggles at the bottom let the admin add Bar (splits Bartender
 * out of FoH) or Events (empty dept; admin defines positions later).
 */

import { useState, useId } from "react";
import { Sparkles, Info } from "lucide-react";
import type { WizardStepProps } from "@smartout/ui";
import type { OnboardingConfirmState } from "../types-v2";
import { useTranslation } from "@smartout/i18n";
import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useDepartmentsTools } from "./tools/departments-tools";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

// ── Bar dept positions: Barsjef / Bartender / Barback (ADR-0429 §size-conditional).
// When the Bar toggle is off, Bartender lives under FoH.
const BAR_POSITIONS = ["Barsjef", "Bartender", "Barback"];
const BAR_DEPT_ID = "extra-bar";
const EVENTS_DEPT_ID = "extra-events";

export function ConfirmDepartments({
  state,
  updateState,
  next,
  back,
  t,
}: WizardStepProps<OnboardingConfirmState>) {
  const tools = useDepartmentsTools(state, updateState, next, back);
  useRegisterTools("wizard-onboarding-departments", tools);

  const { t: tOrg } = useTranslation("org");

  // Stable id prefix for aria-describedby associations
  const tooltipIdPrefix = useId();

  const departments = state.departments;
  const selectedCount = departments.filter((d) => d.selected).length;

  // Derive toggle state from whether the extra depts exist in state
  const hasBar = departments.some((d) => d.id === BAR_DEPT_ID);
  const hasEvents = departments.some((d) => d.id === EVENTS_DEPT_ID);

  function renameDepartment(id: string, newName: string) {
    updateState({
      departments: departments.map((d) => (d.id === id ? { ...d, name: newName } : d)),
    });
  }

  function toggleBar(enabled: boolean) {
    if (enabled) {
      // Move Bartender position out of FoH into new Bar dept
      const depts = departments.map((d) => {
        if (d.id !== BAR_DEPT_ID && d.name === "FoH") {
          return {
            ...d,
            positions: d.positions.filter((p) => p.name !== "Bartender"),
          };
        }
        return d;
      });
      updateState({
        departments: [
          ...depts,
          {
            id: BAR_DEPT_ID,
            name: tOrg("avdeling.default_bar"),
            icon: "wine",
            selected: true,
            positions: BAR_POSITIONS.map((name, i) => ({
              id: `pos-bar-${i}`,
              name,
              slug: name.toLowerCase().replace(/\s+/g, "-"),
              isLeader: i === 0,
              selected: true,
            })),
          },
        ],
      });
    } else {
      // Restore Bartender to FoH; remove Bar dept
      const depts = departments
        .filter((d) => d.id !== BAR_DEPT_ID)
        .map((d) => {
          if (d.name === "FoH") {
            const alreadyHasBartender = d.positions.some((p) => p.name === "Bartender");
            if (alreadyHasBartender) return d;
            return {
              ...d,
              positions: [
                ...d.positions,
                {
                  id: "pos-foh-bartender",
                  name: "Bartender",
                  slug: "bartender",
                  isLeader: false,
                  selected: true,
                },
              ],
            };
          }
          return d;
        });
      updateState({ departments: depts });
    }
  }

  function toggleEvents(enabled: boolean) {
    if (enabled) {
      updateState({
        departments: [
          ...departments,
          {
            id: EVENTS_DEPT_ID,
            name: tOrg("avdeling.default_events"),
            icon: "calendar",
            selected: true,
            positions: [],
          },
        ],
      });
    } else {
      updateState({
        departments: departments.filter((d) => d.id !== EVENTS_DEPT_ID),
      });
    }
  }

  // Only show the 3 default depts (+ any extras) — no toggle-card for unselected suggestions
  const visibleDepts = departments.filter((d) => d.selected);

  return (
    <TooltipProvider>
      <div className="mx-auto w-full max-w-md space-y-6">
        {/* Step header */}
        <div>
          <h2 className="font-heading text-foreground text-2xl font-bold">
            {t("confirm.departments_title")}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("confirm.departments_description")}
          </p>
          <p className="text-brand-orange mt-2 flex items-center gap-1.5 text-xs">
            <Sparkles className="h-3 w-3" />
            {t("confirm.departments_selected_count", {
              selected: selectedCount,
              total: departments.length,
            })}
          </p>
        </div>

        {/* Department cards */}
        <div className="space-y-3">
          {visibleDepts.map((dept) => {
            const tooltipId = `${tooltipIdPrefix}-tooltip-${dept.id}`;
            return (
              <DepartmentCard
                key={dept.id}
                dept={dept}
                tooltipId={tooltipId}
                tooltipText={tOrg("avdeling.tooltip")}
                renamePlaceholder={tOrg("avdeling.rename_placeholder")}
                onRename={(name) => renameDepartment(dept.id, name)}
              />
            );
          })}
        </div>

        {/* Size-conditional toggles */}
        <div className="space-y-2 pt-2">
          <ToggleRow
            checked={hasBar}
            onChange={toggleBar}
            label={tOrg("avdeling.add_bar_toggle")}
            id="toggle-bar"
          />
          <ToggleRow
            checked={hasEvents}
            onChange={toggleEvents}
            label={tOrg("avdeling.add_events_toggle")}
            id="toggle-events"
          />
        </div>
      </div>
    </TooltipProvider>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

interface DeptShape {
  id: string;
  name: string;
  positions: { id: string; name: string }[];
}

function DepartmentCard({
  dept,
  tooltipId,
  tooltipText,
  renamePlaceholder,
  onRename,
}: {
  dept: DeptShape;
  tooltipId: string;
  tooltipText: string;
  renamePlaceholder: string;
  onRename: (name: string) => void;
}) {
  const [localName, setLocalName] = useState(dept.name);

  function commit(value: string) {
    const trimmed = value.trim();
    if (trimmed && trimmed !== dept.name) onRename(trimmed);
  }

  return (
    <div className="border-border bg-card space-y-3 rounded-xl border p-4">
      {/* Name input + tooltip trigger */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          placeholder={renamePlaceholder}
          aria-describedby={tooltipId}
          className="border-input bg-background text-foreground placeholder:text-muted-foreground flex-1 rounded-lg border px-3 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/40 focus-visible:outline-none"
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Hva er en avdeling?"
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring shrink-0 rounded p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <Info className="size-4" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent id={tooltipId} className="max-w-56 text-xs leading-snug">
            {tooltipText}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Position list — awareness only, not interactive */}
      {dept.positions.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Stillinger i avdeling">
          {dept.positions.map((pos) => (
            <li
              key={pos.id}
              className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] tracking-wide"
            >
              {pos.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ToggleRow({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  id: string;
}) {
  return (
    <label
      htmlFor={id}
      className="border-border flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 py-3 text-sm transition-colors hover:border-[var(--brand-orange)]/30 hover:bg-[var(--brand-orange)]/5"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 shrink-0 cursor-pointer rounded accent-[var(--brand-orange)]"
      />
      <span className="text-muted-foreground">{label}</span>
    </label>
  );
}
