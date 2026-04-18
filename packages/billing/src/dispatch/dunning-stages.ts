// Dunning stage validator — shared contract between the B4 Deno handler
// (supabase/functions/engine-dispatch/handlers/scan-overdue-invoices.ts)
// and the Node-side B5 settings UI + tests.
//
// Deno cannot import @smartout/billing directly, so the handler inlines an
// identical copy of validateStages(). When one side changes, the other
// MUST change too — keep signatures + error messages aligned so the
// vitest contract test below covers both surfaces.
//
// Ref: Fase 3A spec §4.2, ADR-0143.

export type DunningStage = {
  // Days past invoice.due_at that trigger this stage.
  days: number;
  // NULL = matches invoices still at the initial dunning state (invoice
  // has never been escalated).
  from: string | null;
  // Target dunning_status value. Must be a value in the extended
  // dunning_status enum (reminder_1 / reminder_2 / collection_notice in
  // Fase 3A, or legacy reminder_sent / escalated).
  to: string;
};

export type ValidateStagesResult =
  | { ok: true; stages: DunningStage[] }
  | { ok: false; error: string };

export function validateDunningStages(raw: unknown): ValidateStagesResult {
  if (!Array.isArray(raw)) {
    return { ok: false, error: "stages must be an array" };
  }
  if (raw.length === 0) {
    return { ok: false, error: "stages cannot be empty" };
  }
  const stages: DunningStage[] = [];
  for (let i = 0; i < raw.length; i++) {
    const s = raw[i] as Record<string, unknown>;
    if (!s || typeof s !== "object") {
      return { ok: false, error: `stages[${i}] is not an object` };
    }
    if (typeof s.days !== "number" || !Number.isFinite(s.days) || s.days < 0) {
      return { ok: false, error: `stages[${i}].days must be a non-negative number` };
    }
    if (typeof s.to !== "string" || s.to.length === 0) {
      return { ok: false, error: `stages[${i}].to must be a non-empty string` };
    }
    if (s.from !== null && typeof s.from !== "string") {
      return { ok: false, error: `stages[${i}].from must be null or a string` };
    }
    stages.push({
      days: s.days,
      from: (s.from as string | null) ?? null,
      to: s.to as string,
    });
  }
  return { ok: true, stages };
}
