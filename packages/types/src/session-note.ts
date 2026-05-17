// =============================================================================
// session-note.ts
// Zod schemas for session_note targeted-fanout feature (ADR-0331, ADR-0333).
//
// WHY: session_note gained audience JSONB + notify_at TIMESTAMPTZ in
//   Track A migration. These schemas validate the audience shape at the
//   Server Action boundary (ADR-0151) and provide a pure resolver function
//   that is imported by BOTH create-targeted-note-action.ts AND
//   supabase/functions/note-fanout-scheduler/audience-resolver.ts.
//   Single source of truth — no parallel implementations.
// =============================================================================

import { z } from "zod";

// ─── Audience shape ───────────────────────────────────────────────────────────
//
// JSONB stored in session_note.audience. Each array member is a UUID that the
// fanout scheduler resolves to concrete profile_ids at notify_at time.
// At least one array must be non-empty when the audience is submitted.

export const noteAudienceSchema = z
  .object({
    dept_ids: z.array(z.string().uuid()).optional(),
    team_ids: z.array(z.string().uuid()).optional(),
    shift_ids: z.array(z.string().uuid()).optional(),
    profile_ids: z.array(z.string().uuid()).optional(),
  })
  .refine((a) => Object.values(a).some((v) => v !== undefined && v.length > 0), {
    message: "Audience must contain at least one target",
  });

export type NoteAudience = z.infer<typeof noteAudienceSchema>;

// ─── Create targeted note input ────────────────────────────────────────────────

export const createTargetedNoteInputSchema = z.object({
  workspace_id: z.string().uuid(),
  session_id: z.string().uuid(),
  body: z.string().min(1).max(2000),
  audience: noteAudienceSchema,
  // ISO 8601 datetime string — must be > now, validated on the server side.
  notify_at: z.string().datetime({ offset: true }),
  note_type: z.literal("targeted"),
});

export type CreateTargetedNoteInput = z.infer<typeof createTargetedNoteInputSchema>;

// ─── Pure dept-id extractor ────────────────────────────────────────────────────
//
// Extracts the explicit department UUIDs from an audience object WITHOUT
// resolving team/shift/profile memberships (that requires DB access).
// Used by create-targeted-note-action to classify cross-dept at the gate site.
//
// Cross-dept check logic (per ADR-0333):
//   1. Extract audience.dept_ids as-is — these are explicit dept targets.
//   2. team_ids / shift_ids / profile_ids require DB joins to resolve their
//      dept_id — that enrichment is done inside resolveAudienceDeptIds().
//
// This pure function is used at the SERVER ACTION level for the fast-path check
// "does the audience mention any dept not in caller's set?". The full resolver
// (with DB joins) is in supabase/functions/note-fanout-scheduler/audience-resolver.ts.

export function extractAudienceExplicitDeptIds(audience: NoteAudience): string[] {
  return audience.dept_ids ?? [];
}
