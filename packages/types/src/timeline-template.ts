// packages/types/src/timeline-template.ts
//
// What:  Zod schemas and TypeScript types for the `timeline_template` feature.
//        Covers the items_json discriminated union (6 item kinds), BFF body
//        validation schemas (save + apply), and the DB row shape.
//
// Why:   Single source of truth for the items_json JSONB column shape, shared
//        across T2 capability tools, T3 BFF routes, and T5 UI hooks. All
//        consumers import from @smartout/types to avoid drift between layers.
//
// Spec ref: docs/superpowers/specs/2026-05-16-timeline-templates-design.md §items_json shape
// ADR ref:  ADR-0334 (Timeline Templates)

import { z } from "zod";

// ── Scope type ────────────────────────────────────────────────────────────────

export const ScopeType = z.enum(["team", "department", "location", "shift"]);

export type ScopeTypeT = z.infer<typeof ScopeType>;

// ── Item kind enum ────────────────────────────────────────────────────────────

export const TimelineTemplateItemKind = z.enum([
  "schedule_shift",
  "session_hook",
  "session_task",
  "session_note",
  "deviation",
  "free_form",
]);

export type TimelineTemplateItemKindT = z.infer<typeof TimelineTemplateItemKind>;

// ── Item base (shared fields on every item) ───────────────────────────────────

const ItemBase = z.object({
  kind: TimelineTemplateItemKind,
  // 24-hour HH:MM format — e.g. "08:00", "23:59"
  time_hhmm: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  // null means "no fixed duration" (open-ended or point-in-time)
  duration_min: z.number().int().positive().nullable(),
});

// ── Per-kind payload schemas ──────────────────────────────────────────────────

/**
 * Payload for a template shift slot. Maps to schedule_shift on apply.
 * position_id / team_id / location_id / zone are all optional — the template
 * author may leave these as null if they vary per apply invocation.
 */
export const SchedShiftPayload = z.object({
  role: z.string().min(1).max(40),
  position_id: z.string().uuid().nullable(),
  team_id: z.string().uuid().nullable(),
  location_id: z.string().uuid().nullable(),
  zone: z.string().max(40).nullable(),
  notes: z.string().max(280).nullable(),
});

export type SchedShiftPayloadT = z.infer<typeof SchedShiftPayload>;

/**
 * Payload for a session hook slot. Maps to session_hook on apply.
 * Canvas inserts session_hook; cron session_hook_executor materialises
 * session_task at fire time (per spec cron-canvas boundary).
 */
export const HookPayload = z.object({
  hook_type: z.enum(["pre_open", "open", "scheduled", "pre_close", "close"]),
  trigger_offset_min: z.number().int(),
  linked_procedure_id: z.string().uuid().nullable(),
  linked_routine_id: z.string().uuid().nullable(),
});

export type HookPayloadT = z.infer<typeof HookPayload>;

/**
 * Payload for a standalone task slot. Maps to session_task on apply with
 * session_hook_id=NULL to distinguish from cron-materialised tasks (spec
 * supervisor finding — cron idempotency key ignores canvas session_task rows).
 */
export const TaskPayload = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(500).nullable(),
  is_compliance_required: z.boolean().default(false),
});

export type TaskPayloadT = z.infer<typeof TaskPayload>;

/**
 * Payload for a session note slot. Maps to session_note on apply.
 */
export const NotePayload = z.object({
  content: z.string().min(1).max(500),
});

export type NotePayloadT = z.infer<typeof NotePayload>;

/**
 * Payload for a deviation slot. Maps to deviation on apply.
 * category is a free-text string (no enum) — matches deviation table schema.
 */
export const DeviationPayload = z.object({
  title: z.string().min(1).max(120),
  category: z.string().max(40),
  description: z.string().max(500).nullable(),
});

export type DeviationPayloadT = z.infer<typeof DeviationPayload>;

/**
 * Payload for a free-form chip. At apply time the user picks per-chip:
 * materialise as session_task, session_note, or skip.
 * No DB row is written at save time — free-form is an authoring placeholder.
 */
export const FreeFormPayload = z.object({
  label: z.string().min(1).max(80),
});

export type FreeFormPayloadT = z.infer<typeof FreeFormPayload>;

// ── Discriminated union — single item in items_json array ────────────────────

/**
 * A single item within a timeline template.
 * Discriminated on `kind`; each branch extends ItemBase with a typed payload.
 *
 * The discriminated union gives TypeScript and Zod exhaustive narrowing:
 *   if (item.kind === "schedule_shift") { item.payload.role ... }
 */
export const TimelineTemplateItem = z.discriminatedUnion("kind", [
  ItemBase.extend({ kind: z.literal("schedule_shift"), payload: SchedShiftPayload }),
  ItemBase.extend({ kind: z.literal("session_hook"), payload: HookPayload }),
  ItemBase.extend({ kind: z.literal("session_task"), payload: TaskPayload }),
  ItemBase.extend({ kind: z.literal("session_note"), payload: NotePayload }),
  ItemBase.extend({ kind: z.literal("deviation"), payload: DeviationPayload }),
  ItemBase.extend({ kind: z.literal("free_form"), payload: FreeFormPayload }),
]);

export type TimelineTemplateItemT = z.infer<typeof TimelineTemplateItem>;

// ── Array wrapper ─────────────────────────────────────────────────────────────

/**
 * The full items_json value stored in the JSONB column.
 * min(1): a template must have at least one item.
 * max(200): spec cap to prevent transaction timeout on apply (200 items × per-kind INSERT).
 */
export const TimelineTemplateItems = z.array(TimelineTemplateItem).min(1).max(200);

export type TimelineTemplateItemsT = z.infer<typeof TimelineTemplateItems>;

// ── DB row shape ──────────────────────────────────────────────────────────────

/**
 * TypeScript type for a row returned from the timeline_template table.
 * Mirrors the SQL schema verbatim. T2 capability tools and T3 BFF GET handler
 * use this to type Supabase query results.
 *
 * items_json is typed as unknown here and narrowed via TimelineTemplateItems.parse()
 * at the consumer level — Supabase returns JSONB as `unknown`.
 */
export type TimelineTemplateRow = {
  id: string;
  workspace_id: string;
  name: string;
  scope_type: ScopeTypeT;
  scope_id: string;
  items_json: unknown;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
};

// ── BFF body validation schemas ───────────────────────────────────────────────

/**
 * Zod schema for POST /api/timeline-template (save) request body.
 * workspace_id and created_by are NOT accepted from body — derived server-side
 * per ADR-0151. T3 BFF validates this schema then passes to capability tool.
 */
export const TimelineTemplateSaveSchema = z.object({
  name: z.string().min(1).max(80),
  scope_type: ScopeType,
  scope_id: z.string().uuid(),
  items_json: TimelineTemplateItems,
  notes: z.string().max(500).optional().nullable(),
});

export type TimelineTemplateSaveBodyT = z.infer<typeof TimelineTemplateSaveSchema>;

/**
 * Allowed materialization choices for free_form items at apply time.
 */
export const FreeFormMaterialization = z.enum(["task", "note", "skip"]);

export type FreeFormMaterializationT = z.infer<typeof FreeFormMaterialization>;

/**
 * Zod schema for POST /api/timeline-template/apply request body.
 * freeform_mapping keys are item array indices (as string, JSON object key constraint).
 * template_id is the UUID of the timeline_template row to apply.
 * target_date must be a valid ISO date string; T3 BFF validates >= today (Oslo TZ).
 */
export const TimelineTemplateApplySchema = z.object({
  template_id: z.string().uuid(),
  target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  freeform_mapping: z.record(z.string(), FreeFormMaterialization).default({}),
});

export type TimelineTemplateApplyBodyT = z.infer<typeof TimelineTemplateApplySchema>;
