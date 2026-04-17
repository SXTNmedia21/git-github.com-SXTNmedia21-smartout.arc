---
title: "Witness-with-Camera Evidence Model for Control_List and Protocol Completion"
id: ADR_0131
status: proposed
layer: decision
created: 2026-04-17
updated: 2026-04-17
---

# ADR-0131: Witness-with-Camera Evidence Model

## Context and Problem Statement

ADR-0128 establishes mobile as the in-venue execution surface that web cannot replicate. One mobile-native superpower is the camera — physical-world evidence at the moment of action. Today, governance protocol completion (control_list_item, knowledge_test, confirmation) records "completed: true/false" with no evidence artifact. Compliance audits and C1 calibration loops have to trust the user's tap.

A bartender completing a HACCP temperature check on mobile should be able to attach a photo of the thermometer reading. A trainee completing a uniform check should be able to attach a photo of themselves in uniform. A manager witnessing a deviation should be able to capture the scene.

## Decision Drivers

- Camera is mobile-native; web cannot do this as well
- C1 calibration trust improves when completion has photographic provenance
- Norwegian compliance regimes (HACCP, Mattilsynet) increasingly accept photo evidence
- Storage cost and PII risk must be managed (faces of staff, customers in background)
- Photo evidence must be tied to the completion event for audit chains

## Considered Options

1. **No evidence — keep boolean completion.** Rejected: misses the mobile-native opportunity; weakens audit trust.
2. **Evidence as separate `evidence_artifact` table.** Rejected: over-normalizes; orphan-risk if completion deletes.
3. **Evidence as nullable column on completion entities + Supabase Storage.** Chosen.

## Decision Outcome

**Chosen: Option 3 — evidence is a typed reference on the completion row, stored in Supabase Storage with workspace-scoped RLS.**

## Rules & Consequences

### R1. Completion entities gain optional evidence reference
- `control_list_item_completion`, `knowledge_test_attempt`, `confirmation_record`, `deviation` gain `evidence_storage_path text NULL` and `evidence_kind text NULL` (`'photo' | 'video' | 'audio_note'`).
- Null = no evidence (backward compatible).
- Non-null = path in Supabase Storage `workspace-evidence` bucket, namespaced `<workspace_id>/<entity>/<id>.<ext>`.

### R2. Storage bucket RLS
- Bucket `workspace-evidence` policy: read/write only by members of the matching workspace.
- Photos are NOT publicly accessible — signed URLs only, 5-minute TTL.
- Service role can read for compliance exports (rare, audited).

### R3. PII guidance baked into capture UI
- Camera UI shows a "blur faces in background" toggle (default on for venues with customers visible).
- Capture screen shows "this photo will be stored for compliance — only your workspace managers can see it" (Norwegian localized).
- No upload to AI for analysis without explicit user consent (separate ADR if/when AI processing is added).

### R4. Evidence is optional, never required by default
- Protocol authoring (web) decides per-step whether evidence is required.
- If required, the mobile completion UI blocks completion until evidence is attached.
- Default = optional (minimum friction).

### R5. Telemetry includes evidence reference
- Completion `emit()` events include `has_evidence: boolean` and `evidence_kind` if present.
- Activity trail can be queried for "completions with evidence" for compliance reporting.
- No raw photo data in telemetry payload (PII).

### Agent Impact
- **Build agents:** mobile completion components accept `evidence_required: boolean` prop; render capture UI accordingly.
- **Steward:** new completion entities follow the `evidence_storage_path + evidence_kind` pattern.
- **Coordinator:** capabilities that read completions (training capability, governance capability) surface `has_evidence` as a derived field.

## Consequences

- **Good:** strengthens C1 calibration trust; enables compliance evidence chains; meets Norwegian regulatory expectations
- **Bad:** Storage costs scale with photo volume; PII risk requires careful UX (face blur, signed URLs)
- **Migration cost:** ~1 week DB migration + storage policy + mobile capture UI; ~3 days for first protocol step using it

---

> Registered in `docs/decisions/0000-decision-log.md`. Cross-references ADR-0128 (mobile execution surface). Depends on Supabase Storage being correctly RLS-policied (verify before implementation).
