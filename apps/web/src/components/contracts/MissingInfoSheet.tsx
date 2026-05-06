// apps/web/src/components/contracts/MissingInfoSheet.tsx
// What: Admin popup for filling in missing employee PII before contract dispatch.
//       Triggered by 422 "missing_employment_data" from /api/contracts/send.
// Why:  ADR-0077 admin-on-behalf amendment — admin can fill fields the employee
//       hasn't submitted yet. Høy-PII groups require explicit confirmation dialog.
//       Uses <Dialog> (NOT nested Sheet) to avoid z-index stacking issues.
//
// ADR compliance:
//   - ADR-0077 (PII handling) — høy-PII ack dialog mandatory for identity/banking
//   - ADR-0078 (channel restriction) — text input only, voice not permitted
//   - ADR-0151 (forgery defence) — target_profile_id / workspace_id from parent, not form
//   - ADR-0242 (PII masking) — Lock icon on høy-PII inputs
//
// Telemetry: mount emits contract.send_blocked.missing_fields (Agent C registers in registry)

"use client";

import { useCallback, useState } from "react";
import { Lock } from "lucide-react";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emit, nonEmpty } from "@smartout/telemetry";
import { validatePersonnummer, validateNorwegianBankAccount } from "@smartout/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MissingField {
  field: string;
  label_no: string;
  section: string;
  tier: "lav" | "medium" | "hoy";
}

export interface MissingInfoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missing_fields: MissingField[];
  target_profile_id: string;
  target_display_name: string;
  workspace_id: string;
  actor_profile_id: string;
  /** Called after all field groups have been successfully saved. */
  on_filled: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Sections in desired display order */
const SECTION_ORDER = ["Ansettelse", "Personalia", "Økonomi", "Adresse"];

/** Field-group type — covers PII (identity/banking/address) + employment fields. */
type FieldGroup = "identity" | "banking" | "address" | "employment";

/** Map field name → validator that returns error string or null. Validators
 * from @smartout/utils return boolean — wrap to map false to a Norwegian error. */
const FIELD_VALIDATORS: Record<string, (v: string) => string | null> = {
  personal_number: (v) =>
    validatePersonnummer(v) ? null : "Ugyldig personnummer (sjekk 11 siffer + Modulus 11)",
  bank_account: (v) =>
    validateNorwegianBankAccount(v) ? null : "Ugyldig kontonummer (sjekk 11 siffer + Modulus 11)",
};

/** field_group mapping — which field belongs to which API group */
const FIELD_TO_GROUP: Record<string, FieldGroup> = {
  personal_number: "identity",
  bank_account: "banking",
  address: "address",
  address_line_1: "address",
  address_line_2: "address",
  postal_code: "address",
  city: "address",
  // Employment fields — Pontus 2026-05-06 popup scope
  position_title: "employment",
  start_date: "employment",
  hourly_rate: "employment",
  monthly_salary: "employment",
  employment_percentage: "employment",
  agreed_weekly_hours: "employment",
};

/** Høy-tier groups requiring explicit confirmation before submit */
const HIGH_PII_GROUPS = new Set<string>(["identity", "banking"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupFieldsBySection(fields: MissingField[]): Record<string, MissingField[]> {
  const grouped: Record<string, MissingField[]> = {};
  for (const f of fields) {
    if (!grouped[f.section]) grouped[f.section] = [];
    grouped[f.section]!.push(f);
  }
  return grouped;
}

function resolveFieldGroup(field: string): FieldGroup {
  return FIELD_TO_GROUP[field] ?? "address";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MissingInfoSheet({
  open,
  onOpenChange,
  missing_fields,
  target_profile_id,
  target_display_name,
  workspace_id,
  actor_profile_id,
  on_filled,
}: MissingInfoSheetProps) {
  // Form state: field name → current value
  const [values, setValues] = useState<Record<string, string>>({});
  // Field-level validation errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Submission state per field_group
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Confirmation dialog for høy-PII groups
  const [pendingHighPiiGroup, setPendingHighPiiGroup] = useState<{
    group: "identity" | "banking";
    groupValues: Record<string, string>;
  } | null>(null);

  // Emit mount event so ContractDispatchDrawer retry can track the block
  // (Agent C will register this event in registry.ts — skip-emit-on-missing-registry)
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next && !open) {
        // Opening — emit block event
        void emit({
          event: "contract.send_blocked.missing_fields" as never,
          workspace_id: nonEmpty(workspace_id, "workspace_id"),
          actor_id: nonEmpty(actor_profile_id, "actor_id"),
          properties: {
            entity: { entity_type: "profile", entity_id: target_profile_id },
            data: {
              field_count: missing_fields.length,
              sections: [...new Set(missing_fields.map((f) => f.section))],
            },
          } as never,
        });
      }
      onOpenChange(next);
    },
    [open, onOpenChange, workspace_id, actor_profile_id, target_profile_id, missing_fields],
  );

  // Per-field blur validation
  const handleBlur = useCallback(
    (fieldName: string) => {
      const validator = FIELD_VALIDATORS[fieldName];
      if (!validator) return;
      const val = values[fieldName] ?? "";
      if (!val) return; // Only validate non-empty on blur
      const error = validator(val);
      setFieldErrors((prev) =>
        error
          ? { ...prev, [fieldName]: error }
          : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== fieldName)),
      );
    },
    [values],
  );

  const handleChange = useCallback((fieldName: string, value: string) => {
    setValues((prev) => ({ ...prev, [fieldName]: value }));
    // Clear error on change
    setFieldErrors((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([k]) => k !== fieldName)),
    );
  }, []);

  // Submit a single field_group to the API.
  // Branches on group: PII groups → /admin-fill-pii; employment → /admin-fill-employment.
  const submitGroup = useCallback(
    async (
      group: FieldGroup,
      groupValues: Record<string, string>,
      highPiiAcknowledged: boolean,
    ) => {
      if (group === "employment") {
        // Unified write path: same /api/contracts/employment/upsert endpoint as
        // people-page Ansettelse-section. Popup captures 5 of 17 §14-6 fields;
        // the rest get sensible defaults at this layer (admin can refine on
        // people-page later). contract_id null → upsert auto-finds existing
        // draft for this profile (idempotent — no dupe drafts).
        const todayIso = new Date().toISOString().split("T")[0];
        const hourlyRate = groupValues.hourly_rate ? Number(groupValues.hourly_rate) : null;
        const employmentPct = groupValues.employment_percentage
          ? Number(groupValues.employment_percentage)
          : 100;
        const weeklyHours = groupValues.agreed_weekly_hours
          ? Number(groupValues.agreed_weekly_hours)
          : 37.5;

        const res = await fetch("/api/contracts/employment/upsert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contract_id: null,
            profile_id: target_profile_id,
            // Popup-captured (5)
            position_title: groupValues.position_title ?? "",
            start_date: groupValues.start_date ?? todayIso,
            hourly_rate: hourlyRate,
            employment_percentage: employmentPct,
            agreed_weekly_hours: weeklyHours,
            // Defaults (12) — admin refines on people-page
            employment_form: "permanent",
            working_hours_scheme: "shiftWork",
            end_date: null,
            end_date_reason: null,
            monthly_salary: null,
            remuneration_type: "hourlyWage",
            trial_period_months: null,
            notice_period_months: 1,
            break_minutes_per_day: 30,
            training_rights: null,
          }),
        });

        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          throw new Error(body.error ?? "Kunne ikke lagre ansettelse");
        }
        return;
      }

      // PII groups — identity / banking / address
      const res = await fetch("/api/contracts/admin-fill-pii", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_profile_id,
          field_group: group,
          values: groupValues,
          high_pii_acknowledged: highPiiAcknowledged,
        }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string; code?: string };
        if (body.code === "high_pii_required") {
          // Should not reach here — UI gates this, but surface if it does
          throw new Error("Bekreftelse kreves — lukk og prøv igjen.");
        }
        throw new Error(body.error ?? "Lagring feilet");
      }
    },
    [target_profile_id],
  );

  // Main submit handler — runs per section/group
  const handleSubmit = useCallback(async () => {
    setSaveError(null);

    // Validate all filled fields before submit
    let hasErrors = false;
    const newErrors: Record<string, string> = {};
    for (const field of missing_fields) {
      const val = values[field.field] ?? "";
      if (!val) continue; // Empty = skip group (only submit filled groups)
      const validator = FIELD_VALIDATORS[field.field];
      if (validator) {
        const err = validator(val);
        if (err) {
          newErrors[field.field] = err;
          hasErrors = true;
        }
      }
    }
    if (hasErrors) {
      setFieldErrors(newErrors);
      return;
    }

    // Determine which groups have at least one filled value
    const groupsWithValues = new Map<FieldGroup, Record<string, string>>();
    for (const field of missing_fields) {
      const val = values[field.field];
      if (!val) continue;
      const group = resolveFieldGroup(field.field);
      const existing = groupsWithValues.get(group) ?? {};
      existing[field.field] = val;
      groupsWithValues.set(group, existing);
    }

    if (groupsWithValues.size === 0) {
      setSaveError("Fyll inn minst ett felt før du lagrer.");
      return;
    }

    // Check if any høy-PII group needs confirmation
    for (const [group] of groupsWithValues) {
      if (HIGH_PII_GROUPS.has(group)) {
        // Trigger confirmation dialog for the first høy-PII group
        // After confirmation, submitAllGroups is called with ack=true
        setPendingHighPiiGroup({
          group: group as "identity" | "banking",
          groupValues: groupsWithValues.get(group)!,
        });
        return;
      }
    }

    // No høy-PII — submit all groups directly
    await submitAllGroups(groupsWithValues, false);
  }, [missing_fields, values]);

  // Submit all pending groups after any required confirmation
  const submitAllGroups = useCallback(
    async (
      groupsWithValues: Map<FieldGroup, Record<string, string>>,
      highPiiAcknowledged: boolean,
    ) => {
      setSaving(true);
      setSaveError(null);
      try {
        for (const [group, groupValues] of groupsWithValues) {
          await submitGroup(group, groupValues, highPiiAcknowledged);
        }
        onOpenChange(false);
        on_filled();
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Ukjent feil");
      } finally {
        setSaving(false);
      }
    },
    [submitGroup, onOpenChange, on_filled],
  );

  // Called when user confirms høy-PII dialog
  const handleHighPiiConfirm = useCallback(async () => {
    if (!pendingHighPiiGroup) return;
    setPendingHighPiiGroup(null);

    // Rebuild all groups — include the confirmed høy-PII group
    const groupsWithValues = new Map<FieldGroup, Record<string, string>>();
    for (const field of missing_fields) {
      const val = values[field.field];
      if (!val) continue;
      const group = resolveFieldGroup(field.field);
      const existing = groupsWithValues.get(group) ?? {};
      existing[field.field] = val;
      groupsWithValues.set(group, existing);
    }

    await submitAllGroups(groupsWithValues, true);
  }, [pendingHighPiiGroup, missing_fields, values, submitAllGroups]);

  const grouped = groupFieldsBySection(missing_fields);
  const orderedSections = SECTION_ORDER.filter((s) => !!grouped[s]);

  return (
    <>
      {/* Main info-fill dialog — uses Dialog NOT Sheet to avoid z-index stacking */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manglende opplysninger</DialogTitle>
            <DialogDescription>
              Fyll inn manglende opplysninger for{" "}
              <span className="font-medium">{target_display_name}</span> for å sende kontrakten.
              Alle endringer logges i audit-trail.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {orderedSections.map((section) => (
              <div key={section} className="space-y-3">
                <h3 className="text-foreground text-sm font-semibold">{section}</h3>
                {grouped[section]!.map((field) => {
                  const isHigh = field.tier === "hoy";
                  const error = fieldErrors[field.field];
                  return (
                    <div key={field.field} className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Label htmlFor={`pii-${field.field}`} className="text-sm">
                          {field.label_no}
                        </Label>
                        {isHigh && (
                          <Lock
                            className="text-muted-foreground h-3 w-3"
                            aria-label="Sensitiv opplysning — krever bekreftelse"
                          />
                        )}
                      </div>
                      {isHigh && (
                        <p className="text-muted-foreground text-xs">
                          Krever bekreftelse — ansatt må ha gitt eksplisitt tillatelse.
                        </p>
                      )}
                      <Input
                        id={`pii-${field.field}`}
                        type={
                          field.field === "start_date"
                            ? "date"
                            : field.field === "hourly_rate" ||
                                field.field === "monthly_salary" ||
                                field.field === "employment_percentage" ||
                                field.field === "agreed_weekly_hours"
                              ? "number"
                              : "text"
                        }
                        step={
                          field.field === "agreed_weekly_hours"
                            ? "0.5"
                            : field.field === "employment_percentage"
                              ? "1"
                              : "any"
                        }
                        min={
                          field.field === "hourly_rate" ||
                          field.field === "monthly_salary" ||
                          field.field === "employment_percentage" ||
                          field.field === "agreed_weekly_hours"
                            ? "0"
                            : undefined
                        }
                        max={
                          field.field === "employment_percentage"
                            ? "100"
                            : field.field === "agreed_weekly_hours"
                              ? "168"
                              : undefined
                        }
                        value={values[field.field] ?? ""}
                        onChange={(e) => handleChange(field.field, e.target.value)}
                        onBlur={() => handleBlur(field.field)}
                        placeholder={field.label_no}
                        aria-invalid={!!error}
                        aria-describedby={error ? `pii-${field.field}-error` : undefined}
                      />
                      {error && (
                        <p
                          id={`pii-${field.field}-error`}
                          className="text-destructive text-xs"
                          role="alert"
                        >
                          {error}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {saveError && (
              <p className="text-destructive text-sm" role="alert">
                {saveError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Avbryt
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Lagrer…" : "Lagre og send kontrakt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Høy-PII confirmation dialog — nested above main dialog */}
      <AlertDialog
        open={!!pendingHighPiiGroup}
        onOpenChange={(next) => {
          if (!next) setPendingHighPiiGroup(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bekreft sensitiv opplysning</AlertDialogTitle>
            <AlertDialogDescription>
              Bekreft at <span className="font-medium">{target_display_name}</span> har gitt
              eksplisitt tillatelse til at du legger inn følgende sensitive opplysninger på vegne av
              dem.
              <br />
              <br />
              Handlingen logges i audit-trail med ditt navn og tidspunkt (ADR-0077, GDPR Art
              6(1)(b), Pol §10, Aml §14-6).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingHighPiiGroup(null)}>
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleHighPiiConfirm}>Bekreft og lagre</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
