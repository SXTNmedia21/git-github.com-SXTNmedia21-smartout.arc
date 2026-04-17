---
title: "Tier 2 — Content extraction from Wrightegaarden workspace, re-created as v3-native governance"
status: draft
updated: 2026-04-17
created: 2026-04-17
module: strike-mcp
tags: [tier2, bubble, content-extraction, v3-native, governance]
supersedes: "2026-04-17 council verdict on Bubble→v3 governance mapping (table-by-table approach)"
---

# Tier 2 — Content Extraction Approach

> **Reframe note (2026-04-17):** A multi-agent council ran a verdict on
> Tier 2 as a table-by-table mapping problem. Pontus halted with one
> sentence: *"Vi behøver jo ikke hente informasjonen table by table. Vi
> må bare hente kunnskapen fra Workspacen og implementere den i version 3."*
> This spec replaces the council verdict.

---

## Goal

Migrate Wrightegaarden's training + handbook + quiz content from Bubble
into v3 by extracting the underlying knowledge (what the workspace wanted
to teach), not by translating the Bubble data model. v3 governance gets
v3-native rows shaped by v3 conventions, not by Bubble compromises.

## Non-goals

- 1:1 entity mapping from Bubble to v3.
- Cross-workspace shared content migration (Bubble's "Global" flag,
  `add to workspace[]` array). If Wrightegaarden uses a globally-shared
  handbook, we duplicate the content into Wrightegaarden's workspace at
  extraction time.
- Multilingual storage. Wrightegaarden operates in Norwegian. Use Norwegian.
- AI-provenance preservation. v3 doesn't model `AI created?` flags as
  first-class metadata. Drop.
- `🗞️posts🚫`, `📚 content 🚫`, badge entities, log aggregations.
- Quiz content for Tier 2 phase one — quizzes depend on cross-workspace
  question references; deferred until extraction surface stable.

## Inputs

| Input | Source | Status |
|---|---|---|
| 26 Wrightegaarden handbook records (with titles, descriptions, status) | Bubble live API + `mappings/handbooks.json` (Tier 1 discovery) | available |
| 935 Wrightegaarden activity records (titles, bodies, hierarchy, multilingual fields) | Bubble live API + `mappings/activities.json` | available (Tier 2 discovery) |
| 90 handbook.challenge records (challenge title + body) | `mappings/handbook_challenges.json` | available |
| 21 handbook.stage records (stage labels) | `mappings/handbook_stages.json` | available |
| 30 🎖️handbook.log completion records | `mappings/handbook_logs.json` | available |
| v3 governance schema (policy, protocol, procedure, procedure_step, knowledge_test, confirmation, control_list, runbook) | `~/dev/smartout.ai-wt-2/supabase/migrations/00003_governance_tables.sql` | known |

## Outputs

For each Wrightegaarden handbook, produce v3-native rows:

- **One `protocol` row** representing the handbook (name = handbook title,
  description = handbook description, status = `draft` until reviewed).
  No matching `policy` row required — v3 1:1 constraint
  (`UNIQUE (policy_id)` on protocol) means we either need a real policy or
  we leave the handbook as a protocol-only knowledge unit. Tier 2 generates
  a single bookkeeping policy per workspace ("Wrightegaarden onboarding
  knowledge base") and binds all handbook protocols to it.
- **`procedure` rows** for each substantive activity branch in the
  handbook tree. Activity hierarchy depth > 1 collapses into ordered
  `procedure_step` rows with body text from the activity content.
- **`procedure_step` rows** for leaf activities (the actual reading content
  the employee consumes). Body text comes from the Norwegian locale of the
  activity's multilingual fields.
- **`confirmation` rows** for each `handbook.challenge` record (one per
  challenge). `confirmation.name` from challenge title; `confirmation_text`
  from challenge body; `requires_signature = false` by default (Pontus
  decides per-handbook if any need signature).
- **(deferred)** `knowledge_test` rows from quiz-type activities — Phase 2.

## Method

### Step 1: Content read

For each of the 26 handbooks:

1. Fetch the handbook record + all activity records linked to it (via
   parent FK on activities).
2. For each activity, extract:
   - Norwegian title (from `🏳️‍🌈 List of title` array, locale `no_no`)
   - Norwegian body (from `🏳️‍🌈 description` array + linked `📚 Content`
     entity body if populated)
   - Position in tree (root activity, child of which parent)
   - Type signal (`_dataType`, `_activityType`) — used as a hint for v3
     entity choice, not as a strict discriminator
3. Walk handbook.challenge records linked to the handbook; extract title +
   body in Norwegian.
4. Build an in-memory tree per handbook.

### Step 2: v3 shape

For each handbook tree:

1. Emit one `protocol` row.
2. Walk the tree:
   - Root + first-level activities → one `procedure` row each (using
     activity title as procedure name).
   - Activities below first level → `procedure_step` rows under their
     nearest ancestor procedure, ordered by Bubble's `txt.order` field.
   - Activity body text becomes `procedure_step.description` (NOT NULL in
     schema) and `procedure_step.training_content` (rich text).
3. Emit `confirmation` rows for each handbook challenge.
4. Generate stable v3 UUIDs via uuidv5 from Bubble `_id` + namespace, so
   re-runs are idempotent.

### Step 3: SQL emission

- One SQL file per handbook: `tier2_<handbook-slug>.sql`
- Per-statement `source = 'bubble_migration'` literal in a metadata column
  (add migration-tagging column if not already present per Tier 1 pattern).
- All inserts wrapped in a transaction with SAVEPOINT per handbook for
  partial rollback (per ADR-0006 amendment from Tier 1 council).

### Step 4: Apply (DRY-RUN inherits Tier 1 gate)

Strike-mcp emits SQL; production apply remains blocked on the same gates
as Tier 1 (strike-auth-bridge buildout, ADR-0099 implementation). Apply
order:
1. Emit policy bookkeeping row per workspace.
2. Emit protocol rows per handbook.
3. Emit procedure + procedure_step rows.
4. Emit confirmation rows.
5. (Profiles already exist from Tier 1 — `auto_assign_protocols` trigger
   from `20260428100000_auto_assign_protocols.sql` will fire on profile
   inserts and produce protocol_assignment rows. For pre-existing profiles
   from Tier 1, run `auto_assign_protocols_to_workspace(workspace_id)`
   manually if it exists, else accept that historical assignments are
   not backfilled.)

## What this approach drops vs the council verdict

| Council artifact | Status under this spec |
|---|---|
| ADR-0100 (Tier 1 handbook→runbook remap) | **Still required** — Tier 1 attestation hole is real. Standalone fix. |
| ADR-0101 (migration emit grandfather) | **Optional** — same problem; deferrable to Tier 2 apply phase. |
| ADR-0102 (nested protocols → procedure_step) | **Killed** — not an architectural decision; just how this spec writes the extractor. |
| ADR-0103 (content entity → procedure_step body) | **Killed** — same reason. |
| ADR-0104 (AI provenance columns) | **Killed** — no preservation, no decision. |
| ADR-0105 (K1a template layer) | **Killed** — out of scope (no cross-workspace migration). |
| ADR-0106 (activity discriminator truth table) | **Killed** — we don't classify 935 rows; we read each activity and choose its v3 home. |
| 7th-entity content discovery pass | **Folded in** — extractor reads `📚 Content` body inline if present. |
| Per-question product decisions for Pontus | **Resolved** — Pontus decided: "no table-by-table; extract knowledge." |

## What survives

- Tier 1 runbook attestation hole (Supervisor's finding). Fix needs to land
  before Tier 2 apply because handbooks were marked as `runbook` targets
  in Tier 1 mapping, not protocol targets — the Tier 1 mapping needs
  re-attestation to point at protocol.
- Strike-mcp zero-emit() observation. Documented debt; not blocking Tier 2
  emit (DRY-RUN only).
- `knowledge_test.workspace_id` writer bug (Agent-Coord finding). Standalone
  v3 fix unrelated to Tier 2 since this spec doesn't write knowledge_test
  rows in Phase 1.
- `auto_assign_protocols` trigger order constraint. Folded into Apply step.
- `confirmation.name` NOT NULL requirement. Folded into Step 2.

## Open questions for Pontus (much smaller list)

1. **Bookkeeping policy per workspace** — OK to generate one synthetic
   policy ("Wrightegaarden onboarding knowledge base") to satisfy the
   protocol→policy 1:1 constraint? Alternative: ask Pontus to author the
   policy text manually before Tier 2 apply.
2. **Confirmation signature default** — All handbook challenges as
   `requires_signature = false`? Or are some legally signed acknowledgments
   that need `true`? Per-handbook flagging from Pontus.
3. **Quiz Phase 2 timing** — When should we tackle quiz extraction
   (knowledge_test JSONB)? Deferred or planned?

## Acceptance criteria

- [ ] Extractor reads all 26 handbooks + linked activities + challenges
- [ ] Each handbook produces one `tier2_<slug>.sql` file with v3-native rows
- [ ] All `procedure_step.description` populated (NOT NULL satisfied)
- [ ] All `confirmation.name` populated (NOT NULL satisfied)
- [ ] All inserts tagged with `source = 'bubble_migration'`
- [ ] DRY-RUN apply against a clean v3 staging DB succeeds
- [ ] Spot-check: 3 handbooks render in v3 dashboard handbook UI (if UI
      exists; otherwise spot-check via SELECT)
- [ ] Tier 1 runbook attestation hole resolved before Tier 2 SQL applies

## Cross-references

- Reframe trigger: Pontus 2026-04-17 message
- Council verdict (superseded): `~/dev/smartout.ai-wt-2/docs/council/COUNCIL-LOG.md` 2026-04-17 entry
- Learning: `~/dev/smartout.ai-wt-2/docs/learnings/0034-migration-as-knowledge-extraction.md`
- Tier 1 attestation hole: Supervisor's finding in council 2026-04-17 (handbooks → runbook mapping)
- Discovery output: `services/strike-mcp/mappings/{activities,handbook_challenges,handbook_stages,handbook_logs}.json`
