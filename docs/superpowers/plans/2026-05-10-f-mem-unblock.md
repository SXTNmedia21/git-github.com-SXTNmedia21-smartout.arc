---
title: "F-MEM-UNBLOCK — Memory Authority Seed (G1 Closure)"
status: ready
created: 2026-05-10
updated: 2026-05-10
module: MODULE_BOTSSON
campaign: botsson-arena
tags: [memory, authority, sortie, g1, phase-a3-item-5]
adr: [ADR-0078, ADR-0099, ADR-0204]
sortie: feat/f-mem-unblock
gates: []
unblocks: mr-botsson-memory-feel
po_decisions:
  policy: opt-in-dev-only  # Dev workspaces only. Production workspaces opt in via separate sortie + UI flow.
  level: suggest           # Per memory/index.ts spec — save_memory is suggest-tier
  min_role: employee       # Lowest role; authenticated users may trigger memory writes
---

# F-MEM-UNBLOCK — Memory Authority Seed (G1 Closure)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seed `engine_authority_config` for the `memory` capability on dev workspaces so `save_memory` tool becomes visible in the agent toolset, closing G1 (memory writer ungated, `engine_memory` 0 rows globally despite Phase A3 marked 🟢).

**Architecture:** Migration-only fix. Phase A3 already shipped tool code + writer infrastructure + capability registration. The runtime gap is one missing seed migration. Per `memory/index.ts` spec, `save_memory` is `suggest`-tier; tier-unlock logic at `tool-selector.ts:50-54` requires authority `level >= suggest` to expose the tool. We seed `level='suggest'`, `min_role='employee'` for the 3 dev workspaces (`hq-workspace`, `may2026-demo`, `system`). Production workspaces (`strom-mat-bar`, `bardshaug-vegkro`, `yogurt-heaven`) stay default `read_only` (tool hidden) — they opt in via separate sortie with UI flow per ADR-0078 PII opt-in spec.

**Tech Stack:** Supabase migration (PostgreSQL 17), Vitest for capability-tool integration test, manual smoke test via web Botsson chat.

**Out of scope (deferred to follow-up sorties):**
- Phase A3 Item 3: auto-summary at session-end via `buildSessionSummary` (function does not exist in stage-engine; build is separate sortie)
- Phase A3 Item 4: TTL via pg_cron (separate sortie)
- Production workspace fanout (requires opt-in UI flow + ADR-0078 amendment if changing default policy)
- Adding `emit("memory.saved", ...)` telemetry events (separate L-0176 sweep sortie — gate_action already writes `activity_trail`)

---

## Files

- Create: `supabase/migrations/20260528000000_seed_memory_authority_dev_workspaces.sql`
- Modify: `packages/supabase/src/database.types.ts` (regenerated, do not edit manually)
- Create: `packages/ai/src/capabilities/memory/__tests__/save-memory-tool-visibility.test.ts`
- Create: `docs/HANDOFF-f-mem-unblock.md` (at sortie close)

---

## Self-Review Notes

**Schema verified 2026-05-10 against live DB:**
- `engine_authority_config` columns: `id` (UUID PK, default gen_random_uuid), `workspace_id` (UUID NOT NULL, FK → `workspace.workspace_id`), `capability` (TEXT NOT NULL), `level` (TEXT NOT NULL default `'read_only'`, CHECK in `autonomous|confirm|suggest|read_only|disabled`), `min_role` (TEXT NOT NULL default `'employee'`, CHECK in `employee|manager|admin|owner|system`), `requires_four_eyes` (boolean default false), `observer_escalation_hours` (integer default 72), `created_at`, `updated_at`, `updated_by` (FK).
- UNIQUE constraint `(workspace_id, capability)` — `ON CONFLICT DO NOTHING` is the safe upsert path.
- `workspace` FK column is `workspace_id` (not `id`).
- RLS: `service_manage_authority` policy allows service_role full access — migration runs as service_role so policy passes.

**Memory tool verified:**
- `packages/ai/src/capabilities/memory/index.ts` — `defaultAuthority: "read_only"`, `suggestTools: [saveMemoryTool]`, `readOnlyTools: []`. `tools: writeTools`. `allowedChannels: ["chat"]`.
- `tool-selector.ts:50-54` — `tierUnlocked(read_only, suggest) = false` → tool hidden when authority is read_only.
- `memory/tools.ts:162` — `actionType: "save"`. Capability slug = `"memory"`.
- `memory/gate.ts` — uses `callGateAction` wrapper. Channel guard chat-only.

**Migration tip verified:** `ls supabase/migrations/ | tail -1` = `20260527000000_activity_trail_platform_actor.sql`. New migration timestamp `20260528000000` is strictly greater (per L-0042).

**No prior memory authority seed history** — `grep -rn "'memory'" supabase/migrations/ | grep engine_authority` returned empty. Confirms G1 root cause: never seeded.

**Workspaces selected for opt-in seed:**
- `b0000000-0000-0000-0000-000000000000` (hq-workspace) — dev/admin workspace
- `b1000000-0000-0000-0000-000000000001` (may2026-demo) — dev demo workspace
- `00000000-0000-0000-0000-0000000000a1` (system) — platform workspace

Production workspaces (`strom-mat-bar`, `bardshaug-vegkro`, `yogurt-heaven`, `villa-mat`, `bardshaug-grill`, `fjelds-mat`, `yogurt-heaven-seed`) NOT seeded — they stay default `read_only`. Pontus opts them in via separate sortie when product UX is ready.

**Council ADR-amendment NOT triggered** — opt-in default per memory/index.ts spec is preserved. No ADR-0078 amendment needed for this sortie.

---

## Task 0: Reserve migration timestamp + draft migration body

**Files:**
- Create: `supabase/migrations/20260528000000_seed_memory_authority_dev_workspaces.sql`

- [ ] **Step 1: Verify migration tip is unchanged**

Run:
```bash
ls /home/sxtnl/dev/smartout.ai/supabase/migrations/ | grep -v rollback | tail -1
```

Expected: `20260527000000_activity_trail_platform_actor.sql`

If a newer migration appeared, increment timestamp to one HHMM slot greater than the new tip (per L-0042).

- [ ] **Step 2: Verify target workspace_ids exist**

Run:
```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -d postgres -c "SELECT workspace_id, slug FROM workspace WHERE slug IN ('hq-workspace', 'may2026-demo', 'system');"
```

Expected: 3 rows returned. If any slug missing, halt — workspace bootstrap state has changed since plan was written; re-pick targets.

---

## Task 1: Write migration

**Files:**
- Create: `supabase/migrations/20260528000000_seed_memory_authority_dev_workspaces.sql`

- [ ] **Step 1: Write migration**

Create `/home/sxtnl/dev/smartout.ai/supabase/migrations/20260528000000_seed_memory_authority_dev_workspaces.sql` with content:

```sql
-- ============================================================================
-- F-MEM-UNBLOCK: Seed memory capability authority for dev workspaces
--
-- Closes G1 (memory writer ungated). Phase A3 Item 5 — Phase A3 plan committed
-- this seed but the migration was never written. Result: engine_authority_config
-- has no row for `memory` capability on any workspace; default `read_only` hides
-- save_memory tool (suggest-tier) from agent toolset.
--
-- Policy: opt-in-dev-only.
--   - 3 dev workspaces seeded with level='suggest', min_role='employee'.
--   - Production workspaces (strom-mat-bar, bardshaug-vegkro, yogurt-heaven,
--     villa-mat, bardshaug-grill, fjelds-mat, yogurt-heaven-seed) NOT seeded
--     here — they stay default read_only, opt in via separate UI flow per
--     ADR-0078 PII opt-in spec.
--
-- ON CONFLICT DO NOTHING — safe replay; (workspace_id, capability) is UNIQUE.
--
-- Refs: ADR-0078 (channel guard chat-only), ADR-0099 (gate_action),
--       ADR-0204 (gatedMutation orchestrator), memory/index.ts spec line 32.
-- ============================================================================

INSERT INTO engine_authority_config
  (workspace_id, capability, level, min_role, requires_four_eyes)
VALUES
  ('b0000000-0000-0000-0000-000000000000'::uuid, 'memory', 'suggest', 'employee', false),  -- hq-workspace
  ('b1000000-0000-0000-0000-000000000001'::uuid, 'memory', 'suggest', 'employee', false),  -- may2026-demo
  ('00000000-0000-0000-0000-0000000000a1'::uuid, 'memory', 'suggest', 'employee', false)   -- system
ON CONFLICT (workspace_id, capability) DO NOTHING;

-- Verification (manual run after migration):
--   SELECT workspace_id, capability, level, min_role
--     FROM engine_authority_config
--     WHERE capability = 'memory'
--     ORDER BY workspace_id;
-- Expected: 3 rows.
```

- [ ] **Step 2: Apply migration locally**

Run:
```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < /home/sxtnl/dev/smartout.ai/supabase/migrations/20260528000000_seed_memory_authority_dev_workspaces.sql
```

Expected: `INSERT 0 3` (3 rows inserted, no conflicts).

- [ ] **Step 3: Verify rows exist**

Run:
```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -d postgres -c "SELECT workspace_id, capability, level, min_role, requires_four_eyes FROM engine_authority_config WHERE capability = 'memory' ORDER BY workspace_id;"
```

Expected: 3 rows, all with `level=suggest`, `min_role=employee`, `requires_four_eyes=false`.

- [ ] **Step 4: Regenerate types**

Run:
```bash
cd /home/sxtnl/dev/smartout.ai && npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

**WARNING:** do NOT wrap with `op run` — 1Password substitutes substring matches like `admin` in column names with `<concealed>`, corrupting types (per memory `learning_op_run_supabase_gen_types_corrupts.md`). Local Supabase needs no secrets.

Expected: file updated, no diff in `engine_authority_config` shape (we did not add columns).

---

## Task 2: Failing test — `memory` capability invisible by default, visible when authority seeded

**Files:**
- Create: `packages/ai/src/capabilities/memory/__tests__/save-memory-tool-visibility.test.ts`

- [ ] **Step 1: Inspect tool-selector signature**

Read `packages/ai/src/router/tool-selector.ts` to confirm the public function name (`selectTools` or similar) and its signature for `(capability, authorityConfig, defaultLevel)` — adapt mock pattern below to match.

- [ ] **Step 2: Write failing test**

Create `/home/sxtnl/dev/smartout.ai/packages/ai/src/capabilities/memory/__tests__/save-memory-tool-visibility.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { memoryCapability } from "../index.js";
import { selectToolsForCapability } from "../../../router/tool-selector.js";

describe("memory capability — save_memory tool visibility (G1 closure)", () => {
  it("hides save_memory when authority level is read_only (default)", () => {
    const authorityConfig = {}; // no row → tool-selector falls through to defaultLevel
    const tools = selectToolsForCapability(memoryCapability, authorityConfig, "read_only");
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).not.toContain("save_memory");
  });

  it("exposes save_memory when authority level is suggest", () => {
    const authorityConfig = { memory: "suggest" as const };
    const tools = selectToolsForCapability(memoryCapability, authorityConfig, "read_only");
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain("save_memory");
  });

  it("exposes save_memory when authority level is confirm or autonomous", () => {
    for (const level of ["confirm", "autonomous"] as const) {
      const authorityConfig = { memory: level };
      const tools = selectToolsForCapability(memoryCapability, authorityConfig, "read_only");
      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain("save_memory");
    }
  });

  it("hides save_memory when authority level is disabled", () => {
    const authorityConfig = { memory: "disabled" as const };
    const tools = selectToolsForCapability(memoryCapability, authorityConfig, "read_only");
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).not.toContain("save_memory");
  });
});
```

- [ ] **Step 3: Run test to verify behavior**

Run:
```bash
cd /home/sxtnl/dev/smartout.ai && pnpm --filter @smartout/ai vitest run packages/ai/src/capabilities/memory/__tests__/save-memory-tool-visibility.test.ts
```

Expected: 4 PASS. (These tests assert the tier-unlock invariant that already exists in code — they pass without a code change. Their purpose is **regression net** for future tool-selector changes that might silently re-hide save_memory.)

If test 1 (hides on read_only) FAILS, the tier-unlock logic is broken — halt sortie and diagnose `tool-selector.ts:50-54`.

- [ ] **Step 4: Commit test + migration together**

Run:
```bash
cd /home/sxtnl/dev/smartout.ai
git add supabase/migrations/20260528000000_seed_memory_authority_dev_workspaces.sql \
        packages/supabase/src/database.types.ts \
        packages/ai/src/capabilities/memory/__tests__/save-memory-tool-visibility.test.ts
git commit -m "feat(memory): seed authority for dev workspaces — close G1

Phase A3 plan Item 5 was committed but never written. engine_authority_config
had no row for memory capability on any workspace; default read_only hid
save_memory (suggest-tier) from agent toolset. Result: engine_memory 0 rows
globally despite Phase A3 marked green.

Seed: 3 dev workspaces (hq-workspace, may2026-demo, system) → level=suggest,
min_role=employee, requires_four_eyes=false. Production workspaces stay
default read_only, opt in via separate UI flow per ADR-0078 PII opt-in spec.

Tests assert the tier-unlock invariant as a regression net for future
tool-selector changes.

Closes G1 (BOTSSON-KNOWN-LIMITATIONS.md). Phase A3 Items 3 (auto-summary at
session-end) + 4 (TTL via pg_cron) remain open — separate sortie.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Manual smoke test — chat persists memory

**Files:** none (manual verification)

- [ ] **Step 1: Verify dev environment running**

Run:
```bash
docker ps --filter "name=supabase_db" --format "{{.Names}} {{.Status}}"
```

Expected: container present, healthy. If not, run `pnpm dev:start` (or `op run --env-file=.env.template -- ./infra/scripts/dev-startup.sh`) per CLAUDE.md.

- [ ] **Step 2: Confirm `engine_memory` empty before test**

Run:
```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -d postgres -c "SELECT count(*) FROM engine_memory;"
```

Expected: `count = 0` (G1 baseline state).

- [ ] **Step 3: Open Botsson chat in browser**

Navigate to a dev workspace dashboard (e.g. `http://hq-workspace.localhost:3060/dashboard`). Open Botsson chat surface (Arena → Chat view).

- [ ] **Step 4: Send memory-trigger message**

Type:
```
Husk at jeg liker kaffe svart på morgenen.
```

Send via chat (NOT voice — `memory` capability is `allowedChannels: ["chat"]`).

Expected response: agent confirms it will remember (Norwegian, paraphrased). Tool call to `save_memory` should appear in Arena LogView (commit `cafd6c30c` lifted voice activity feed; chat tool calls render in `agent.debugLog` in same view).

- [ ] **Step 5: Verify `engine_memory` row appeared**

Run:
```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -d postgres -c "SELECT workspace_id, profile_id, scope, memory_type, content, created_at FROM engine_memory ORDER BY created_at DESC LIMIT 5;"
```

Expected: at least 1 row with `content` mentioning "kaffe" / "svart" or similar normalized form. `workspace_id` matches the dev workspace used. `scope` is one of the spec's allowed values (`personal`, `conversation`, etc).

- [ ] **Step 6: Verify gate_action audit row exists**

Run:
```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -d postgres -c "SELECT capability, action_type, allowed, decided_at FROM gate_evaluation WHERE capability = 'memory' ORDER BY decided_at DESC LIMIT 5;"
```

Expected: at least 1 row with `capability='memory'`, `action_type='save'`, `allowed=true`. Confirms ADR-0099 gate evaluation chain wrote audit row.

- [ ] **Step 7: Re-open session, verify memory surfaces in prompt**

Refresh browser (new session). Type:
```
Hva husker du om meg?
```

Expected: agent surfaces the coffee preference (paraphrased, Norwegian). Confirms collector-side reader path works end-to-end through the prompt builder's `<user_memories>` block.

- [ ] **Step 8: If any step fails, halt and diagnose**

If save_memory does not fire: check `engine_authority_config` row exists for the test workspace, check `tool-selector.ts` log for tier-unlock decision, check Botsson chat surface uses `chat` channel (not voice).

If row does not appear: check `gate_evaluation` for `allowed=false` rows; if present, root cause is gate logic not authority. If absent, check `memory-writer.ts` error log.

---

## Task 4: Update tracking docs

**Files:**
- Modify: `docs/architecture/BOTSSON-KNOWN-LIMITATIONS.md` — flip G1 to Closed
- Modify: `docs/architecture/BOTSSON-SYSTEM-MAP.md` — flip memory capability + engine_memory rows
- Modify: `.claude/agents/botsson-harness-builder.md` — flip G1 from Open → Closed
- Modify: `docs/plans/CAMPAIGN-botsson-arena.md` — note Phase A3 Item 5 closed; Items 3+4 still open

- [ ] **Step 1: Update KNOWN-LIMITATIONS**

In `docs/architecture/BOTSSON-KNOWN-LIMITATIONS.md`:

1. Move the G1 entry from `## Open limitations` to `## Closed (historical)` table.
2. Add closed-row entry:

```markdown
| ~G1 | Memory authority not seeded → save_memory hidden | 2026-05-10 | commit `<insert SHA from Task 2 Step 4>`, migration `20260528000000_seed_memory_authority_dev_workspaces.sql` |
```

- [ ] **Step 2: Update BOTSSON-SYSTEM-MAP**

In `docs/architecture/BOTSSON-SYSTEM-MAP.md`:

L4 capabilities table — change `memory` row:
```markdown
| **memory** | `memory/` | 🟢 | **Phase A3 Item 5 closed 2026-05-10 (G1).** Authority seeded for 3 dev workspaces (hq-workspace, may2026-demo, system) via migration `20260528000000`. Production workspaces stay default `read_only` (opt-in pending). save_memory tool visible in dev. Items 3+4 (auto-summary, TTL) still open. |
```

L5 persistence table — change `engine_memory` row:
```markdown
| `engine_memory` | 🟢 | Tabell + reader 🟢; writer code 🟢; **runtime exposure dev-only 🟢 (G1 closed 2026-05-10)**. 3 dev workspaces seeded; production workspaces default `read_only`. Embedding-kolonne forblir NULL (retrieval ranker på importance, ikke similarity). |
```

- [ ] **Step 3: Update harness-builder.md**

In `.claude/agents/botsson-harness-builder.md`:

1. Move G1 entry from `### Open` table to `### Closed (historical)` table:
```markdown
| ~G1 | `memory` capability authority not seeded | 2026-05-10 | F-MEM-UNBLOCK migration `20260528000000` |
```

2. Update `## How to Wire Memory` section header note: "G1 closed 2026-05-10 for dev workspaces. Production workspaces opt-in pending. Items 3+4 (auto-summary, TTL) still open."

- [ ] **Step 4: Update campaign plan**

In `docs/plans/CAMPAIGN-botsson-arena.md`, find the Phase A3 row, update merknad:

```markdown
- [x] **A3** — Wire `engine_memory` writer (producer path) — landed 2026-04-22 (Items 1+2+5 — Item 5 backfilled 2026-05-10 via F-MEM-UNBLOCK closing G1)
      → Items 3 (auto-summary at session-end) + 4 (TTL via pg_cron) remain open — separate sortie.
```

- [ ] **Step 5: Commit doc patches**

Run:
```bash
cd /home/sxtnl/dev/smartout.ai
git add docs/architecture/BOTSSON-KNOWN-LIMITATIONS.md \
        docs/architecture/BOTSSON-SYSTEM-MAP.md \
        .claude/agents/botsson-harness-builder.md \
        docs/plans/CAMPAIGN-botsson-arena.md
git commit -m "docs(memory): flip G1 closed across tracking surfaces

F-MEM-UNBLOCK landed migration 20260528000000 + smoke verified end-to-end.
Update KNOWN-LIMITATIONS (Open → Closed), BOTSSON-SYSTEM-MAP (memory cap +
engine_memory rows green), harness-builder.md (G1 → Closed historical),
CAMPAIGN-botsson-arena.md (A3 Item 5 backfilled, Items 3+4 still open).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Write HANDOFF + close-feature gate

**Files:**
- Create: `docs/HANDOFF-f-mem-unblock.md`

- [ ] **Step 1: Write HANDOFF**

Create `/home/sxtnl/dev/smartout.ai/docs/HANDOFF-f-mem-unblock.md`:

```markdown
---
title: "Handoff — F-MEM-UNBLOCK"
status: done
created: 2026-05-10
updated: 2026-05-10
campaign: botsson-arena
sortie: feat/f-mem-unblock
tags: [memory, authority, g1, phase-a3-item-5, handoff]
---

# Handoff — F-MEM-UNBLOCK

## Summary

Closed G1 (memory authority not seeded → `save_memory` hidden). Phase A3 Plan
Item 5 was committed but never landed. `engine_authority_config` had no row for
`memory` capability on any workspace; default `read_only` hid the suggest-tier
`save_memory` tool. Result: `engine_memory` 0 rows globally despite Phase A3
marked 🟢 since 2026-04-22.

## What was built

| Item | Status | Commit |
|---|---|---|
| Migration `20260528000000_seed_memory_authority_dev_workspaces.sql` | ✅ | `<sha>` |
| 4 vitest cases — tool-visibility tier-unlock invariant | ✅ | `<sha>` |
| Manual smoke test — chat → engine_memory row → cross-session recall | ✅ | n/a |
| Tracking docs flipped (KNOWN-LIMITATIONS, SYSTEM-MAP, harness-builder, campaign) | ✅ | `<sha>` |

## Decisions

| Decision | Rationale |
|---|---|
| Opt-in dev-only (3 workspaces) | Per memory/index.ts spec "workspaces opt in". Production fanout requires UI opt-in flow + ADR-0078 amendment if changing default — out of scope. |
| level=suggest | save_memory is suggest-tier per capability spec. confirm/autonomous would auto-fire without LLM gate. |
| min_role=employee | Lowest CHECK value; any authenticated profile may trigger memory writes within their workspace. |
| requires_four_eyes=false | Memory writes are personal-scope, no four-eyes needed for dev. |
| Phase A3 Items 3+4 deferred | `buildSessionSummary` does not exist in code; pg_cron TTL is separate infra concern. Both belong in follow-up sortie. |

## Learnings

- **Phase-X-marked-🟢 ≠ Phase-X-actually-running.** Phase A3 was marked 🟢
  on 2026-04-22 because capability code + writer infrastructure shipped.
  Authority seed (Item 5) was committed in the plan but never written. Reader
  side (collector) made the system feel alive at session-start, masking the
  writer gap. Production traffic produced 0 `engine_memory` rows for ~18 days.
- **L-0176 sub-pattern: runtime exposure ≠ compile-time presence.** Same drift
  class as docstring-vs-body — capability registered but tool hidden. Detection
  requires DB-state check + tool-selector trace, not just code-level audit.
- **Migration sandbox safety.** Production workspaces stayed default
  `read_only` because we used 3-row INSERT, not a SELECT-fanout. This is the
  pattern for any "opt-in" capability seed where workspace owners must
  explicitly grant.

## Known issues / debt

- **Phase A3 Items 3 + 4 still open.** Auto-summary at session-end (`buildSessionSummary`
  not yet built) + TTL via pg_cron. Separate sortie F-MEM-LIFECYCLE.
- **Production workspaces have no path to opt in via UI yet.** Pontus opens
  separate sortie when ready. Until then, Botsson cannot remember on prod
  workspaces — same UX as before this sortie for any workspace not in the
  3 dev seeds.
- **Memory tool emits no telemetry event.** `gate_action` writes
  `gate_evaluation` + `activity_trail` but no `emit("memory.saved", ...)`
  call exists in `memory/tools.ts`. Audit-trail integrity preserved via
  `gate_evaluation`; PostHog signal absent. Separate L-0176 sweep sortie.

## Next steps

1. Pontus pushes the 2 commits (`<migration-sha>` + `<docs-sha>`) to
   `origin/development`.
2. Run `/audit smoke` to confirm G1 closed in baseline.
3. Sortie F-DB01-FIX (G2 promotion-blocker) — next priority.
4. Sortie F-MEM-LIFECYCLE — auto-summary + TTL — when prioritized.
```

- [ ] **Step 2: Commit handoff**

Run:
```bash
cd /home/sxtnl/dev/smartout.ai
git add docs/HANDOFF-f-mem-unblock.md
git commit -m "docs(handoff): F-MEM-UNBLOCK closure

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 3: Verify ready for /close-feature**

Per CLAUDE.md feature-closure gates:
- [ ] Decision log entries: NONE — sortie operates within existing ADRs (0078, 0099, 0204).
- [ ] User journeys: N/A — internal infrastructure sortie, no user-flow change.
- [ ] Typecheck: `pnpm turbo typecheck` passes.
- [ ] Handoff: written above.
- [ ] E2E: vitest test added; manual smoke verified.

If on a sub-sortie under `campaign/botsson-arena`, run `/close-feature` (script merges to campaign + syncs development into campaign).

If on a sortie under `development` from main repo, run `/close-feature` (script merges to development).

---

## Acceptance Criteria

- [ ] Migration `20260528000000_seed_memory_authority_dev_workspaces.sql` exists, applies cleanly, inserts 3 rows.
- [ ] `SELECT capability, count(*) FROM engine_authority_config WHERE capability = 'memory'` returns count=3.
- [ ] All 4 vitest cases in `save-memory-tool-visibility.test.ts` PASS.
- [ ] `pnpm --filter @smartout/ai typecheck` — 0 errors.
- [ ] Manual smoke: chat "Husk at jeg liker kaffe svart" → `engine_memory` row appears within 5 seconds.
- [ ] Manual smoke: cross-session "Hva husker du om meg?" → agent surfaces coffee preference.
- [ ] `gate_evaluation` row exists with `capability='memory'`, `action_type='save'`, `allowed=true`.
- [ ] G1 entry moved from Open to Closed in BOTSSON-KNOWN-LIMITATIONS.md.
- [ ] memory capability row in BOTSSON-SYSTEM-MAP.md flipped 🟡 → 🟢 with G1 closure annotation.
- [ ] G1 row moved Open → Closed in `.claude/agents/botsson-harness-builder.md`.
- [ ] Phase A3 row in `docs/plans/CAMPAIGN-botsson-arena.md` annotated with Item 5 backfill.
- [ ] HANDOFF written, no decision-log update needed (no new ADR).
- [ ] **Scope guard:** No commit touches files outside: `supabase/migrations/`, `packages/supabase/src/database.types.ts`, `packages/ai/src/capabilities/memory/__tests__/`, the 4 doc files, `docs/HANDOFF-f-mem-unblock.md`.

## Estimated Time

- Task 0: 5 min (verify tip + workspaces)
- Task 1: 15 min (write + apply + regen types)
- Task 2: 25 min (test design + run + commit)
- Task 3: 30 min (manual smoke including dev-env start if not running)
- Task 4: 15 min (4 doc patches)
- Task 5: 10 min (handoff write + commit)

**Total: 100 min for an experienced engineer.** 2-3h with review buffer + dev-env startup if cold.

## Rollback

Pure additive migration. Rollback via:

```sql
DELETE FROM engine_authority_config
WHERE capability = 'memory'
  AND workspace_id IN (
    'b0000000-0000-0000-0000-000000000000'::uuid,
    'b1000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-0000000000a1'::uuid
  );
```

Forgery surface returns to pre-fix state (save_memory hidden again, `engine_memory` writes stop). No cascading data loss — existing rows preserved.

If a `engine_memory` row was written during smoke test that should be removed:
```sql
DELETE FROM engine_memory
WHERE workspace_id IN (
  'b0000000-0000-0000-0000-000000000000'::uuid,
  'b1000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-0000000000a1'::uuid
)
AND created_at > '2026-05-10 00:00:00';
```

## Dispatch options

- **Option A (recommended):** sub-sortie under `campaign/botsson-arena`. From `/home/sxtnl/dev/smartout.ai-botsson-arena` worktree run `/start-feature f-mem-unblock`. Sortie merges to campaign at close; development sync is automatic per `/close-feature`.
- **Option B:** sortie under `development` from main repo. From `/home/sxtnl/dev/smartout.ai` run `/start-feature f-mem-unblock`. Sortie merges to development at close.

Recommend Option A — keeps memory closure attached to harness lineage so future Botsson sorties find the closure trail in `campaign/botsson-arena` history.
