// ============================================
// runbook.ts — Engine-binding Runbook (pure)
//
// Reads a journey + steps + sibling triggers, validates each step,
// probes the DB for tables actually referenced, asks the model to refine
// the deterministic candidate, and applies regex/known-tables guardrails
// before returning the final binding.
//
// Pure function — no auth, no Next.js, no fetch from same-host endpoints.
// Both the platform-admin API route AND the journey-ops agent tool import
// this so the logic stays single-source.
//
// Connected to: apps/web/src/app/api/platform-admin/journeys/[id]/derive-engine-binding/route.ts
// Connected to: packages/ai/src/tools/journey-ops/run-runbook.ts
// ============================================

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";

// ─── Types ───────────────────────────────────────────────────

export type RunbookIssue = {
  level: "error" | "warn" | "info";
  field: string;
  message: string;
};

export type RunbookStepReport = {
  step_order: number;
  slug: string | null;
  title: string;
  ok: boolean;
  issues: RunbookIssue[];
};

export type RunbookBinding = {
  trigger_event: string;
  step_event_type: string;
  entity_type: string;
  confidence?: number;
  rationale?: string;
};

export type RunbookResult = {
  binding: RunbookBinding;
  deterministic_candidate: {
    trigger_event: string;
    step_event_type: string;
    entity_type: string;
  };
  step_reports: RunbookStepReport[];
  summary: {
    step_count: number;
    step_errors: number;
    step_warnings: number;
    sibling_triggers_seen: number;
    sibling_processes_seen: number;
    tables_indexed: number;
    ai_used: boolean;
    ai_error: string | null;
    guardrail_issues: string[];
  };
  evidence: {
    module_triggers_sample: string[];
    tables_in_writes: string[];
    tables_in_writes_unknown: string[];
    entity_type_reason: string;
    event_prefix_reason: string;
  };
};

const BindingSchema = z.object({
  trigger_event: z.string().min(1),
  step_event_type: z.string().min(1),
  entity_type: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
  rationale: z.string().optional(),
});

// ─── Conventions ─────────────────────────────────────────────

const SLUG_PATTERN = /^[a-z][a-z0-9_-]*$/;
const EVENT_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const ENTITY_PATTERN = /^[a-z][a-z0-9_]*$/;

const MODULE_ENTITY_FALLBACK: Record<string, string> = {
  onboarding: "profile",
  org: "company_member",
  scheduling: "schedule_shift",
  operations: "department_session",
  haccp: "deviation",
  training: "protocol",
  absence: "schedule_absence",
  payroll: "employee_payroll_profile",
  communication: "channel_event",
  reports: "engine_state",
  settings: "workspace",
  ai: "engine_state",
  season: "season_budget",
  governance: "policy",
  contracts: "employment_contract",
  certifications: "protocol",
  meta: "journey",
  core: "engine_state",
};

// ─── Step row (as fetched from DB) ───────────────────────────

type StepRow = {
  step_order: number;
  slug: string | null;
  title: string;
  action: string;
  expects: string | null;
  screen: string | null;
  component: string | null;
  data_reads: string[];
  data_writes: string[];
};

// ─── Validators / heuristics (pure) ──────────────────────────

function validateStep(
  step: StepRow,
  knownTables: Set<string>,
  totalSteps: number,
  expectedOrder: number,
): RunbookStepReport {
  const issues: RunbookIssue[] = [];

  if (!step.slug) {
    issues.push({ level: "error", field: "slug", message: "missing — required for compile" });
  } else if (!SLUG_PATTERN.test(step.slug)) {
    issues.push({
      level: "error",
      field: "slug",
      message: `invalid format "${step.slug}" — expected kebab/snake_case starting with letter`,
    });
  }

  if (step.step_order !== expectedOrder) {
    issues.push({
      level: "warn",
      field: "step_order",
      message: `gap detected: got ${step.step_order}, expected ${expectedOrder} (1-based contiguous)`,
    });
  }

  if (!step.action?.trim()) {
    issues.push({ level: "warn", field: "action", message: "empty action summary" });
  }

  if (!step.expects?.trim()) {
    issues.push({ level: "warn", field: "expects", message: "no expects/assertion declared" });
  }

  for (const t of step.data_reads ?? []) {
    if (!knownTables.has(t)) {
      issues.push({
        level: "warn",
        field: "data_reads",
        message: `table "${t}" not found in public schema`,
      });
    }
  }
  for (const t of step.data_writes ?? []) {
    if (!knownTables.has(t)) {
      issues.push({
        level: "warn",
        field: "data_writes",
        message: `table "${t}" not found in public schema`,
      });
    }
  }

  if (
    totalSteps > 1 &&
    (step.data_reads?.length ?? 0) === 0 &&
    (step.data_writes?.length ?? 0) === 0
  ) {
    issues.push({
      level: "info",
      field: "data_writes",
      message: "no telemetry surface — step neither reads nor writes data",
    });
  }

  if (step.screen && !step.screen.startsWith("/") && !step.screen.startsWith("mobile:")) {
    issues.push({
      level: "info",
      field: "screen",
      message: `screen "${step.screen}" — expected route ("/...") or "mobile:<screen>"`,
    });
  }

  return {
    step_order: step.step_order,
    slug: step.slug,
    title: step.title,
    ok: !issues.some((i) => i.level === "error"),
    issues,
  };
}

function pickEntityType(
  steps: StepRow[],
  knownTables: Set<string>,
  module: string,
): { value: string; reason: string } {
  const writeFreq = new Map<string, number>();
  const readFreq = new Map<string, number>();

  for (const s of steps) {
    for (const t of s.data_writes ?? []) {
      if (knownTables.has(t)) writeFreq.set(t, (writeFreq.get(t) ?? 0) + 1);
    }
    for (const t of s.data_reads ?? []) {
      if (knownTables.has(t)) readFreq.set(t, (readFreq.get(t) ?? 0) + 1);
    }
  }

  const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  const fromWrites = top(writeFreq);
  if (fromWrites) return { value: fromWrites, reason: "most-frequent write target across steps" };

  const fromReads = top(readFreq);
  if (fromReads) return { value: fromReads, reason: "most-frequent read target across steps" };

  const fb = MODULE_ENTITY_FALLBACK[module] ?? module;
  return {
    value: fb,
    reason: "module fallback (no concrete table found in data_writes/data_reads)",
  };
}

function pickEventDefaults(
  slug: string,
  module: string,
  siblings: { trigger: string[]; step: string[] },
): { trigger: string; step: string; reason: string } {
  const triggerCounts = new Map<string, number>();
  for (const t of siblings.trigger) {
    const prefix = t.split(".")[0];
    if (prefix) triggerCounts.set(prefix, (triggerCounts.get(prefix) ?? 0) + 1);
  }
  const dominantPrefix = [...triggerCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? module;

  const stepCounts = new Map<string, number>();
  for (const s of siblings.step) stepCounts.set(s, (stepCounts.get(s) ?? 0) + 1);
  const dominantStep =
    [...stepCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? `${module}.step.completed`;

  return {
    trigger: `${dominantPrefix}.${slug}.start`,
    step: dominantStep,
    reason: `prefix derived from ${siblings.trigger.length} sibling triggers in module="${module}"`,
  };
}

// ─── DB introspection ────────────────────────────────────────

async function probeTables(
  admin: SupabaseClient<Database>,
  candidates: Set<string>,
): Promise<Set<string>> {
  const probes = await Promise.all(
    [...candidates].map(async (table) => {
      const { error } = await admin
        // free-form table names; bypass literal-union typing.
        .from(table as unknown as "journey")
        .select("*", { head: true, count: "exact" })
        .limit(0);
      const exists = !error || error.code !== "PGRST205";
      return { table, exists };
    }),
  );
  return new Set<string>(probes.filter((p) => p.exists).map((p) => p.table));
}

// ─── AI refinement ───────────────────────────────────────────

const SYSTEM_PROMPT = `You are the engine-binding runbook for Smartout journeys.
Your job: given a journey spec and a deterministic candidate binding, output the FINAL binding.

Output STRICT JSON, no markdown, with keys:
- trigger_event: dot-namespaced event that starts the engine_process. Must match /^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$/.
- step_event_type: dot-namespaced event emitted as steps complete (consumed by wait_for_event). Same regex.
- entity_type: snake_case singular Postgres table name (e.g. "profile", "schedule_shift", "season_budget", "department_session").
- confidence: number 0..1 — how strong is the evidence?
- rationale: one short line.

Rules:
- Prefer the deterministic candidate when it is consistent with steps' data_writes and the module's existing triggers.
- Only override when steps' data_writes clearly point to a different entity_type, or when sibling triggers establish a different naming convention.
- entity_type MUST be a real public-schema table (the candidate set is provided).
- Be conservative — when in doubt, return the deterministic candidate.`;

async function aiRefine(
  openrouterKey: string,
  payload: unknown,
): Promise<{ binding: RunbookBinding | null; error: string | null }> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openrouterKey}`,
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4-20250514",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(payload) },
        ],
        response_format: { type: "json_object" },
        max_tokens: 500,
        temperature: 0.1,
      }),
    });

    if (!res.ok) return { binding: null, error: `OpenRouter ${res.status}` };

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) return { binding: null, error: "AI returned empty content" };

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { binding: null, error: "AI returned non-JSON" };
    }

    const valid = BindingSchema.safeParse(parsed);
    if (!valid.success) return { binding: null, error: "AI response failed schema validation" };

    return { binding: valid.data, error: null };
  } catch (err) {
    return { binding: null, error: err instanceof Error ? err.message : "AI call threw" };
  }
}

// ─── Main entry point ────────────────────────────────────────

export type RunRunbookOptions = {
  /** Skip the AI refinement pass; use deterministic candidate as-is. */
  skipAi?: boolean;
};

export async function runRunbook(
  admin: SupabaseClient<Database>,
  journeyId: string,
  openrouterKey: string | null,
  opts: RunRunbookOptions = {},
): Promise<RunbookResult | { error: string }> {
  // 1. Parallel-fetch journey + steps + sibling triggers
  const [journeyRes, stepsRes, triggersRes, processesRes] = await Promise.all([
    admin
      .from("journey")
      .select(
        "journey_id, slug, title, module, actor, platform, trigger_description, preconditions, outcomes_success, outcomes_empty, outcomes_error, doc_title, trigger_event, step_event_type, entity_type",
      )
      .eq("journey_id", journeyId)
      .single(),
    admin
      .from("journey_step")
      .select(
        "step_order, slug, title, action, expects, screen, component, data_reads, data_writes",
      )
      .eq("journey_id", journeyId)
      .order("step_order"),
    admin.from("engine_trigger").select("event_type").limit(500),
    admin.from("engine_process").select("id, name").limit(500),
  ]);

  if (journeyRes.error || !journeyRes.data) {
    return { error: "Journey not found" };
  }
  const journey = journeyRes.data;

  // 2. Probe tables referenced by this journey + module fallback.
  const candidateTables = new Set<string>();
  for (const s of stepsRes.data ?? []) {
    for (const t of s.data_reads ?? []) candidateTables.add(t);
    for (const t of s.data_writes ?? []) candidateTables.add(t);
  }
  candidateTables.add(MODULE_ENTITY_FALLBACK[journey.module] ?? journey.module);
  const knownTables = await probeTables(admin, candidateTables);

  // 3. Step validation
  const steps: StepRow[] = (stepsRes.data ?? []).map((s) => ({
    step_order: s.step_order,
    slug: s.slug,
    title: s.title,
    action: s.action,
    expects: s.expects,
    screen: s.screen,
    component: s.component,
    data_reads: s.data_reads ?? [],
    data_writes: s.data_writes ?? [],
  }));

  if (steps.length === 0) {
    return { error: "Journey has no steps — add steps first" };
  }

  const stepReports = steps.map((s, i) => validateStep(s, knownTables, steps.length, i + 1));
  const stepErrors = stepReports.flatMap((r) => r.issues.filter((i) => i.level === "error"));
  const stepWarns = stepReports.flatMap((r) => r.issues.filter((i) => i.level === "warn"));

  // 4. Sibling evidence by module
  const allTriggers = (triggersRes.data ?? []).map((t) => t.event_type).filter(Boolean);
  const allProcesses = (processesRes.data ?? []).map((p) => p.id);
  const moduleTriggers = allTriggers.filter((t) => t.startsWith(`${journey.module}.`));
  const moduleStepEvents = moduleTriggers.filter(
    (t) => t.includes(".step.") || t.endsWith(".step"),
  );

  // 5. Deterministic candidate
  const events = pickEventDefaults(journey.slug, journey.module, {
    trigger: moduleTriggers,
    step: moduleStepEvents,
  });
  const entity = pickEntityType(steps, knownTables, journey.module);

  const deterministic = {
    trigger_event: journey.trigger_event ?? events.trigger,
    step_event_type: journey.step_event_type ?? events.step,
    entity_type: journey.entity_type ?? entity.value,
  };

  // 6. Optional AI refinement
  let aiBinding: RunbookBinding | null = null;
  let aiError: string | null = null;

  if (!opts.skipAi && openrouterKey) {
    const aiPayload = {
      deterministic_candidate: deterministic,
      module: journey.module,
      slug: journey.slug,
      title: journey.title,
      actor: journey.actor,
      platform: journey.platform,
      trigger_description: journey.trigger_description,
      step_count: steps.length,
      validation_errors: stepErrors.length,
      validation_warnings: stepWarns.length,
      step_summary: steps.map((s) => ({
        order: s.step_order,
        slug: s.slug,
        title: s.title,
        action: s.action,
        data_reads: s.data_reads,
        data_writes: s.data_writes,
      })),
      sibling_triggers_in_module: moduleTriggers.slice(0, 50),
      candidate_tables_in_writes: [
        ...new Set(steps.flatMap((s) => s.data_writes).filter((t) => knownTables.has(t))),
      ],
    };
    const ai = await aiRefine(openrouterKey, aiPayload);
    aiBinding = ai.binding;
    aiError = ai.error;
  }

  // 7. Guardrails
  const finalCandidate: RunbookBinding = aiBinding ?? {
    trigger_event: deterministic.trigger_event,
    step_event_type: deterministic.step_event_type,
    entity_type: deterministic.entity_type,
    confidence: stepErrors.length === 0 ? 0.7 : 0.4,
    rationale: events.reason,
  };

  const guardrailIssues: string[] = [];
  if (!EVENT_PATTERN.test(finalCandidate.trigger_event)) {
    guardrailIssues.push(
      `trigger_event "${finalCandidate.trigger_event}" violates dot.case pattern — falling back`,
    );
    finalCandidate.trigger_event = deterministic.trigger_event;
  }
  if (!EVENT_PATTERN.test(finalCandidate.step_event_type)) {
    guardrailIssues.push(
      `step_event_type "${finalCandidate.step_event_type}" violates dot.case pattern — falling back`,
    );
    finalCandidate.step_event_type = deterministic.step_event_type;
  }
  if (
    !ENTITY_PATTERN.test(finalCandidate.entity_type) ||
    !knownTables.has(finalCandidate.entity_type)
  ) {
    guardrailIssues.push(
      `entity_type "${finalCandidate.entity_type}" not in public schema — falling back to "${deterministic.entity_type}"`,
    );
    finalCandidate.entity_type = deterministic.entity_type;
  }

  return {
    binding: finalCandidate,
    deterministic_candidate: deterministic,
    step_reports: stepReports,
    summary: {
      step_count: steps.length,
      step_errors: stepErrors.length,
      step_warnings: stepWarns.length,
      sibling_triggers_seen: moduleTriggers.length,
      sibling_processes_seen: allProcesses.length,
      tables_indexed: knownTables.size,
      ai_used: aiBinding !== null,
      ai_error: aiError,
      guardrail_issues: guardrailIssues,
    },
    evidence: {
      module_triggers_sample: moduleTriggers.slice(0, 10),
      tables_in_writes: [
        ...new Set(steps.flatMap((s) => s.data_writes).filter((t) => knownTables.has(t))),
      ],
      tables_in_writes_unknown: [
        ...new Set(steps.flatMap((s) => s.data_writes).filter((t) => !knownTables.has(t))),
      ],
      entity_type_reason: entity.reason,
      event_prefix_reason: events.reason,
    },
  };
}
