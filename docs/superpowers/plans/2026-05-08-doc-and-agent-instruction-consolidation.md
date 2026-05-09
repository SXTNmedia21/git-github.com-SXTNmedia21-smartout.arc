---
title: "Doc + Agent-Instruction + Skills Consolidation — single-source-of-truth"
status: ready
created: 2026-05-08
updated: 2026-05-08
module: governance
campaign: doc-consolidation
adr: [ADR-0282, ADR-0276, ADR-0284, ADR-0220, ADR-0238]
sortie: feat/doc-consolidation
gates:
  - B1 merged (apps/web/src/app/api/wizard/start/route.ts hardened)
  - vad-bench PASS verified (services/voice-agent/scripts/vad-bench)
  - Phase E E6 deletion sweep merged (Ultravox files removed)
council_review: 2026-05-08
council_verdict: APPROVE WITH CHANGES (4/4 reviewers)
tags: [docs, agents, skills, ultravox-deprecation, ssot, governance]
---

# Doc + Agent-Instruction + Skills Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring all documentation surfaces, agent instructions, and skills into a single coherent state where every reader (human or agent) gets the same answer to "what does X do, what does Y prescribe, what status is Z." Eliminate split-brain (`STAGE-ENGINE.md` × 2, `BOTSSON-SYSTEM-MAP.md` × 2), stale references (MODULE_BOTSSON 47 days drift, ADR-0282 §Open Items), missing handoffs (Phase A3/A6/D1), missing journeys (6 surfaces unauthored), undocumented runtimes (3 voice paths), and Ultravox glossary creep (174 docs files / 734 lines).

**Architecture:** Seven sequential phases gated on prerequisite work. Phases 1-3 land before Ultravox deletion (E6). Phases 4-5 land concurrent with or after E6. Phases 6-7 are preventive infrastructure. Each phase has independent acceptance criteria + scope guard.

**Tech Stack:** Pure markdown work. No code. Verified via `grep`, `git log --all`, and explicit acceptance commands.

---

## Council Verdict (2026-05-08)

APPROVE WITH CHANGES. 4/4 reviewers responded (steward chair, supervisor, agent-coordinator, harness-builder). Hard rules adopted:

1. `docs/audits/2026-05-08-botsson-harness-audit.md` = BEVAR ubetinget (canonical before-state evidence)
2. Ultravox U3-rewrites krever `§2.X LiveKit session lifecycle` (not just strip)
3. U3 må snapshote line-refs FØR E6 (Coordinator code-tracer evidence)
4. Active-content threshold = 0 Ultravox-refs in `docs/architecture/`, `docs/modules/`, `docs/decisions/`. `docs/archive/`, `docs/research/`, `docs/plans/completed/` unbounded.
5. `docs/INDEX.md` får eget sortie (autoritativ navigasjon)
6. Heartbeat-job må ha full spec eller droppes

Risk flags: R-1 (STAGE-ENGINE.md path), R-2 (B2 implement gate), R-3 (3 system prompts = code bug, separate ADR), R-4 (16→17 capability verification), R-5 (ADR ID-squatting — patched in Phase E Task 9), R-6 (tools-mission.ts orphan = E6 scope).

---

## Files

### Created

- `docs/architecture/ULTRAVOX-DEPRECATION-INVENTORY.md` (Phase 1 T1.1)
- `docs/audits/2026-05-08-pre-ultravox-deletion-snapshot.md` (Phase 4 T4.1)
- `docs/runbooks/RUNBOOK-voice-plane-rollback.md` (Phase 5 T5.4)
- `docs/HANDOFF-phase-a3-memory-writer.md` (Phase 2 T2.1)
- `docs/HANDOFF-phase-a6-pg-notify-bus.md` (Phase 2 T2.2)
- `docs/HANDOFF-phase-d1-session-recorder.md` (Phase 2 T2.3)
- `docs/HANDOFF-domain-chat-ownership.md` (Phase 2 T2.4)
- `docs/journeys/JOURNEY-botsson-arena-form-view.md` (Phase 2 T2.5)
- `docs/journeys/JOURNEY-botsson-arena-video-view.md` (Phase 2 T2.5)
- `docs/journeys/JOURNEY-recorder-platform-admin-replay.md` (Phase 2 T2.5)
- `docs/journeys/JOURNEY-komm-tools-bridge.md` (Phase 2 T2.5)
- `docs/journeys/JOURNEY-domain-chat-ownership.md` (Phase 2 T2.5)
- `docs/journeys/JOURNEY-mr-botsson-dashboard-orb-voice.md` (Phase 2 T2.5)
- `docs/learnings/0225-deprecation-plan-must-verify-adr-existence.md` (Phase 7 T7.1 — council L-NEW-A)
- `docs/learnings/0226-doc-footprint-files-vs-lines.md` (Phase 7 T7.1 — L-NEW-B)
- `docs/learnings/0227-doc-deprecation-three-time-slices.md` (Phase 7 T7.1 — L-NEW-C)
- `docs/learnings/0228-chair-self-reversal-protocol-promotion.md` (Phase 7 T7.1 — L-NEW-D)
- `docs/council/COUNCIL-LOG.md` 2026-05-08 entry (Phase 7 T7.2)

### Modified

- `docs/architecture/modules/MODULE_BOTSSON.md` (Phase 2 T2.6 + Phase 5 T5.1) — 47-day staleness, add §14-§19, refresh against code
- `docs/INDEX.md` (Phase 3 T3.1) — separate sortie per council Hard Rule 5
- `docs/architecture/STAGE-ENGINE.md` vs `docs/engines/artificial-intelligence/stage-engien/STAGE-ENGINE.md` (Phase 1 T1.2) — split-brain resolution
- `docs/architecture/BOTSSON-SYSTEM-MAP.md` vs `docs/engines/artificial-intelligence/BOTSSON-SYSTEM-MAP.md` (Phase 1 T1.3) — split-brain resolution
- `docs/decisions/0107-*.md` (Phase E Task 9 — already in plan) — `amended_by: [ADR_0276]`
- `docs/decisions/0282-*.md` (Phase E Task 9c) — already patched
- `docs/decisions/0276-*.md` (Phase E Task 9 Step 2) — already patched
- `docs/decisions/0284-*.md` (Phase E Task 9b) — already patched
- `docs/decisions/0000-decision-log.md` (Phase 3 T3.2) — verify all 28+ recent ADRs registered
- `docs/STATE-SUMMARY.md` (Phase 5 T5.2) — strip Ultravox active references
- `docs/plans/CAMPAIGN-botsson-arena.md` (Phase 5 T5.3) — Phase E completion
- `docs/plans/ROADMAP-ai-harness.md` (Phase 5 T5.3) — Ultravox marked removed
- `~/dev/smartout.ai/.claude/agents/botsson-harness-builder.md` (Phase 6 T6.1) — refresh against current state
- `~/dev/smartout.ai/.claude/agents/system-agent-coordinator.md` (Phase 6 T6.2) — refresh
- `.claude/skills/smartout-agent-dev/SKILL.md` (Phase 6 T6.3) — refresh capability list 16→17
- `.claude/skills/smartout-edge-function-guide/SKILL.md` (Phase 6 T6.4) — refresh function list, livekit-token wizard-mode reference
- `.claude/skills/smartout-database-guide/SKILL.md` (Phase 6 T6.5) — refresh `engine_sessions` schema notes if Phase E adds `process_id`
- `~/.claude/CLAUDE.md` (Phase 6 T6.6) — verify still accurate (memory + skills sections)
- `CLAUDE.md` (root) (Phase 6 T6.7) — refresh "163 ADRs as of 2026-04-20" → "295+ as of 2026-05-08", capability count, ADR list freshness
- `~/.claude/scripts/heartbeat-notify.sh` (Phase 7 T7.3) — register doc-drift heartbeat job

### Heartbeat job registered

- `~/dev/second-brain-v2/HEARTBEAT.md` (Phase 7 T7.3) — add `doc-drift-check [cooldown: 7d]`

---

## Self-Review Notes

Three documentation surfaces were silently treated as one in earlier work: `apps/web/src/app/api/`, `~/.claude/agents/`, `~/.claude/skills/`. They are independent — agent files are loaded at agent-spawn, skills at session-start, docs only when explicitly read. A single source of truth per concern means: ADRs are canonical for decisions; module docs are canonical for architecture; agent files describe how each agent behaves; skills describe re-usable procedures. Refreshing one without the others creates drift.

The Ultravox deletion is on a critical path (Phase E E6 sortie). Doc work that strips Ultravox references must wait until E6 lands, else docs assert deletion that hasn't shipped. Banners + inventory can land in advance — they declare deprecation, don't enact it.

The 4 learnings (L-0225 through L-0228) capture the meta-lessons from this session: fact-check before claiming "to-write" (existing files repeatedly missed), files-vs-lines distinction in footprint counts, three-time-slice doc deprecation protocol, chair self-reversal as expected behavior (not exception).

`MODULE_BOTSSON.md` has been 47 days stale (last update 2026-03-22). Multiple landed phases (A3 memory writer, A6 pg_notify guardian, D1 session recorder) are not reflected. Three voice runtimes (Ultravox web, LiveKit Orb web, LiveKit mobile) are not documented. Three system prompts (mission registry / voice-agent hardcoded / onboarding mission) diverge — only the audit `docs/audits/2026-05-08-botsson-harness-audit.md` documents this.

Skill files at `.claude/skills/` and `~/.claude/skills/` reference older state. `smartout-agent-dev` skill describes 14 capabilities; current is 16 (or 17 post-onboarding). Doesn't break agents, but produces stale guidance.

---

## PHASE 1 — Inventory + Canonical-Source Resolution (4h, parallel-safe)

**Pre-requisites:** None. Read-only doc work.

### Track 1.1 — Ultravox glossary inventory

**File:** `docs/architecture/ULTRAVOX-DEPRECATION-INVENTORY.md`

- [ ] **Step 1: Run inventory grep**

```bash
grep -rln "ultravox\|Ultravox\|UltravoxSession\|UltravoxSessionStatus\|ultravox-client" docs/ \
  --exclude-dir=archive --exclude-dir=research \
  | sort > /tmp/ultravox-doc-files.txt

grep -rn "ultravox\|Ultravox" docs/ \
  --exclude-dir=archive --exclude-dir=research \
  | wc -l > /tmp/ultravox-doc-line-count.txt
```

- [ ] **Step 2: Classify each file into 5 buckets**

Per council Hard Rule 1 (gjenbruk `cascade-legacy-usage-inventory.md` schema), classify into:

| Bucket | Action | Examples |
|---|---|---|
| **A — prose-glossary** | Strip + history-section after E6 | MODULE_BOTSSON, HARNESS-ARCHITECTURE, STAGE-ENGINE prose |
| **B — capability-amendments (16→17 with onboarding)** | Update tables to reflect post-E6 capability set | INDEX.md, system-map L4 row |
| **C — Ultravox-adjacent dead-code references** | Already-deleted files, just remove doc-refs | service-contracts.ts mentions in docs |
| **D — code-comments quoted in docs** | Replace with LiveKit equivalents | Plan/runbook code blocks |
| **E — single-line cutover-anchors** | Banner-only treatment | One-liner mentions in audit summaries |

Output: table in `ULTRAVOX-DEPRECATION-INVENTORY.md` with columns: `file_path | bucket | line_count | current_status | target_status | cutover_phase`.

- [ ] **Step 3: Apply BEVAR-rules to inventory**

Per council Hard Rule 1 (`docs/audits/2026-05-08-botsson-harness-audit.md`) and standing precedent:

PRESERVE (mark `target_status: keep_unchanged`):
- All ADRs (incl. ADR-0135 original Ultravox decision) — audit trail
- All learnings referencing Ultravox — preserve as historic lesson
- All audits in `docs/audits/` — frozen evidence
- `docs/audits/2026-05-08-botsson-harness-audit.md` — canonical pre-deletion state
- `docs/decisions/0282-*.md` — the cutover ADR itself

- [ ] **Step 4: Commit**

```bash
git add docs/architecture/ULTRAVOX-DEPRECATION-INVENTORY.md
git commit -m "docs(governance): Ultravox deprecation inventory — pre-E6 classification

Per ADR-0282 + council 2026-05-08. Classifies all 174 doc-files / 734 lines
into 5 buckets (prose-glossary / capability-amendments / dead-code /
code-comments / cutover-anchors) plus PRESERVE rules for ADRs / learnings
/ audits. Reuses cascade-legacy-usage-inventory.md schema (ADR-0128/0144
deprecation-lifecycle precedent).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Track 1.2 — STAGE-ENGINE.md split-brain (R-1)

**Files:**
- Modify: `docs/architecture/STAGE-ENGINE.md` (canonical)
- Delete: `docs/engines/artificial-intelligence/stage-engien/STAGE-ENGINE.md` (typo `stage-engien`, archive or delete)

- [ ] **Step 1: Diff content**

```bash
ls docs/architecture/STAGE-ENGINE.md docs/engines/artificial-intelligence/stage-engien/STAGE-ENGINE.md
diff docs/architecture/STAGE-ENGINE.md docs/engines/artificial-intelligence/stage-engien/STAGE-ENGINE.md
```

- [ ] **Step 2: Pick canonical**

Canonical: `docs/architecture/STAGE-ENGINE.md` (matches `docs/architecture/BOTSSON-SYSTEM-MAP.md` placement convention).

If the typo'd file has unique content, merge into canonical first. If it's a stale duplicate, archive:

```bash
mkdir -p docs/archive/2026-05-08-doc-consolidation
git mv docs/engines/artificial-intelligence/stage-engien/STAGE-ENGINE.md \
       docs/archive/2026-05-08-doc-consolidation/STAGE-ENGINE-stage-engien-typo-duplicate.md
rmdir docs/engines/artificial-intelligence/stage-engien 2>/dev/null
```

- [ ] **Step 3: Commit**

```bash
git commit -m "docs(architecture): resolve STAGE-ENGINE.md split-brain (R-1 council finding)

Two STAGE-ENGINE.md files existed: docs/architecture/ (canonical, matches
BOTSSON-SYSTEM-MAP.md placement) and docs/engines/artificial-intelligence/
stage-engien/ (typo 'stage-engien'). Canonical kept. Typo'd duplicate
archived to docs/archive/2026-05-08-doc-consolidation/.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Track 1.3 — BOTSSON-SYSTEM-MAP.md split-brain

Same pattern as Track 1.2 for `docs/architecture/BOTSSON-SYSTEM-MAP.md` vs `docs/engines/artificial-intelligence/BOTSSON-SYSTEM-MAP.md`. Pick `docs/architecture/` as canonical, archive the other.

### Acceptance — Phase 1

- [ ] `find docs/ -name "STAGE-ENGINE.md" | wc -l` = 1
- [ ] `find docs/ -name "BOTSSON-SYSTEM-MAP.md" | wc -l` = 1
- [ ] `docs/architecture/ULTRAVOX-DEPRECATION-INVENTORY.md` exists with all 174 files classified
- [ ] No commit touches files outside `docs/architecture/`, `docs/engines/`, `docs/archive/`

---

## PHASE 2 — Backfill HANDOFFs + Journeys + MODULE_BOTSSON Refresh (5h)

**Pre-requisites:** Phase 1 merged.

### Track 2.1-2.4 — Phase HANDOFFs

For each of A3/A6/D1/DomainChatOwnership, gjenbruk audit + commit-log + ADR-references for source material:

| Handoff | Source | Estimat |
|---|---|---|
| `HANDOFF-phase-a3-memory-writer.md` | A3 system-map seksjon + `git log --grep="memory writer"` + ADR-0099 | 30 min |
| `HANDOFF-phase-a6-pg-notify-bus.md` | A6 system-map + ADR-0186 + commit log | 30 min |
| `HANDOFF-phase-d1-session-recorder.md` | Audit § 1.2 + ADR-0184/0185 + 6 BFF endpoints + recorder hooks | 60 min |
| `HANDOFF-domain-chat-ownership.md` | ADR-0238 + grep `<DomainChatOwnership>` (verify implemented) | 30 min |

Each handoff has frontmatter: `title, status: done, type: handoff, created, updated, module, tags, decisions: [], learnings: []`.

### Track 2.5 — Six missing journeys

Per Pontus' analysis. Each follows journey-protocol skill format:

```markdown
## Journey: [Role] [Action]
**Precondition:** ...
1. User does X → System does Y → User sees Z
**Postcondition:** ...
**Error paths:** ...
```

Six journeys:
1. `JOURNEY-botsson-arena-form-view.md`
2. `JOURNEY-botsson-arena-video-view.md`
3. `JOURNEY-recorder-platform-admin-replay.md` — godmode flag → whisper → force-stop → break-glass-PII
4. `JOURNEY-komm-tools-bridge.md` — Mr. Botsson via komm-flate (5 read + 3 action tools)
5. `JOURNEY-domain-chat-ownership.md` — ADR-0238 wizard side, Orb suppress
6. `JOURNEY-mr-botsson-dashboard-orb-voice.md` — LiveKit Orb voice call end-to-end

### Track 2.6 — MODULE_BOTSSON.md refresh (47-day staleness fix)

**File:** `docs/architecture/modules/MODULE_BOTSSON.md`

Changes:
- Bump `updated:` to 2026-05-08
- Add `verified_against_code: 2026-05-08`
- Add `last_council_correction: 2026-05-08`
- Existing §1-§13: refresh capability counts (16, post-PR-#342 17)
- ADD §14 Voice Runtimes — 3 paths (Ultravox web, LiveKit Orb web, LiveKit mobile). Tag Ultravox path as "DEPRECATED per ADR-0282 (proposed) — removal in flight."
- ADD §15 System Prompt Sources — 3 divergent sources documented. Cross-ref to R-3 ADR-0295 (to-write).
- ADD §16 Authority Gate — ADR-0099 + ADR-0287 + gate_action obligatory on mutation tools
- ADD §17 Recorder Layer — Phase D1, hooks per L3 module (prompt-builder, agent-router, authority, guardian, memory, tool exec)
- ADD §18 Capabilities Table — 16 (or 17) entries with capability name, owner, layer, allowedChannels, status
- ADD §19 Surface Ownership (ADR-0238 DomainChatOwnership) — wizard pages with embedded chat declare ownership

Acceptance: `grep -c "verified_against_code: 2026-05-08" docs/architecture/modules/MODULE_BOTSSON.md` = 1.

### Acceptance — Phase 2

- [ ] 4 new HANDOFFs in `docs/HANDOFF-*.md`
- [ ] 6 new journeys in `docs/journeys/JOURNEY-*.md`
- [ ] MODULE_BOTSSON.md ≥ 19 sections + verified_against_code stamp
- [ ] All scope-guarded — no commit touches outside `docs/`

---

## PHASE 3 — INDEX + Decision-log + ADR Format Normalize (2h)

**Pre-requisites:** Phase 2 merged (so all new HANDOFFs / journeys can be indexed).

### Track 3.1 — INDEX.md backfill (separate sortie per council Hard Rule 5)

Add to `docs/INDEX.md`:
- ADR-0220, ADR-0238, ADR-0276, ADR-0282, ADR-0284, ADR-0287, ADR-0288, ADR-0289 in decisions table
- Audit `2026-05-08-botsson-harness-audit.md` in audits section
- 5 botsson-plans listed
- 4 super-powers plans (B1, B2, vad-bench, this consolidation plan)

### Track 3.2 — Decision-log verify

```bash
for n in 0276 0277 0278 0280 0281 0282 0283 0284 0285 0286 0287 0288 0289 0290 0291 0292 0293 0294; do
  grep -q "ADR-${n}" docs/decisions/0000-decision-log.md && echo "$n OK" || echo "$n MISSING"
done
```

For each MISSING, add row in chronological table.

### Track 3.3 — ADR id-format normalize

Standardize on `ADR-NNNN` (dash, not underscore). Frontmatter-only edit. **Council 2026-05-08 R2 hard rule: anchored sed pattern only — naive replace would corrupt body text.**

```bash
# CORRECT — anchored to lines starting with "id:"
sed -i -E '/^id:[[:space:]]*ADR_/s/ADR_([0-9])/ADR-\1/' docs/decisions/*.md

# Verification
grep -rE "^id: ADR_[0-9]" docs/decisions/*.md | wc -l   # expect 0
grep -c "ADR_0" docs/decisions/*.md | grep -v ":0$"     # body refs untouched
```

### Acceptance — Phase 3

- [ ] All 8 referenced ADRs (0220, 0238, 0276, 0282, 0284, 0287, 0288, 0289) in INDEX.md decisions table
- [ ] All 18 recent ADRs in decision-log
- [ ] `grep -E "^id: ADR_[0-9]" docs/decisions/*.md | wc -l` = 0 (only dash format)
- [ ] **Scope guard:** No commit touches files outside `docs/INDEX.md`, `docs/decisions/0000-decision-log.md`, frontmatter-only edits in `docs/decisions/[0-9]*.md`. Body text untouched.

---

## PHASE 4 — Ultravox Pre-Deletion Banners + Snapshot (3h)

**Pre-requisites:** Phase 1 merged (inventory exists). MUST land BEFORE Phase E E6.

### Track 4.1 — Snapshot before E6 (Council Hard Rule 3)

**File:** `docs/audits/2026-05-08-pre-ultravox-deletion-snapshot.md`

Run from a clean checkout pre-E6:

```bash
grep -rn "ultravox\|UltravoxSession\|UltravoxSessionStatus" \
  apps/ packages/ services/ \
  --include='*.ts' --include='*.tsx' --include='*.json' \
  > /tmp/ultravox-code-refs-pre-e6.txt

grep -rn "ultravox\|Ultravox" docs/ \
  --exclude-dir=archive --exclude-dir=research \
  > /tmp/ultravox-doc-refs-pre-e6.txt
```

Commit both as a snapshot file with frontmatter `frozen: true`.

### Track 4.2 — Banner-pass (E12/U2)

Add blockquote banner (per council — NOT `⚠️` emoji) to active "current" docs:

```markdown
> **Ultravox deprecation in flight.** This document references Ultravox surfaces
> that are being removed per ADR-0282 (proposed) and ADR-0276 (proposed). Active
> rewrites land at Phase E E6 cutover. Until then, Ultravox sections are
> historical-in-spirit but live-in-code.
```

Files to banner:
- `docs/architecture/modules/MODULE_BOTSSON.md`
- `docs/architecture/HARNESS-ARCHITECTURE.md` (if exists)
- `docs/architecture/STAGE-ENGINE.md` (canonical post-Phase 1)
- `docs/STATE-SUMMARY.md`

### Track 4.3 — INDEX.md status-column tag

Mark Ultravox-related entries with `(deprecating)` in status column.

### Acceptance — Phase 4

- [ ] 4 docs banner-tagged
- [ ] Snapshot file committed at `docs/audits/2026-05-08-pre-ultravox-deletion-snapshot.md` with frontmatter `frozen: true`
- [ ] INDEX status-column entries tagged
- [ ] **Scope guard:** No commit touches files outside `docs/audits/`, `docs/architecture/`, `docs/STATE-SUMMARY.md`, `docs/INDEX.md`. Code paths untouched.

---

## PHASE 5 — Ultravox Strip + Rewrite (Concurrent with Phase E E6) (4h)

**Pre-requisites:** Phase E E6 merged (Ultravox files deleted), B2 merged (mobile context-pipe live), vad-bench PASS.

### Track 5.1 — MODULE_BOTSSON §2.3 + §6 LiveKit rewrite

Strip Ultravox-specific content from §2.3 (provider) + §6 (client-tool registration). REWRITE with `§2.X LiveKit Session Lifecycle` per council Hard Rule 2:
- LiveKit Room creation
- Token mint flow (per `livekit-token` Edge Function post-wizard-mode extension)
- Tool surface = capability layer projection (server-side `buildAllBotssonTools`)
- Krisp NC client-side, voice-agent NC-off invariant (ADR-0282 R5)

Preserve one "Historical (pre-E6)" subsection pointing to ADR-0282 + audit + snapshot.

### Track 5.2 — STATE-SUMMARY + plans cleanup

- `docs/STATE-SUMMARY.md` — strip Ultravox active references, keep timeline event "ADR-0282 cutover E6 landed YYYY-MM-DD"
- `docs/plans/CAMPAIGN-botsson-arena.md` — Phase E completion sync log row
- `docs/plans/ROADMAP-ai-harness.md` — mark Ultravox paths as "removed E6"
- `docs/plans/PLAN-voice-plane-consolidation.md` → move to `docs/plans/completed/`
- `docs/superpowers/specs/2026-05-04-voice-plane-consolidation.md` → move to `docs/superpowers/specs/archive/`

### Track 5.3 — Banner removal

Remove blockquote deprecation banner from Phase 4 docs (rewrite is complete).

### Track 5.4 — Rollback runbook (NEW per council E15)

**File:** `docs/runbooks/RUNBOOK-voice-plane-rollback.md`

Sections:
- E6 revert procedure (git revert of deletion sweep)
- LiveKit → Ultravox emergency fallback (re-add `ultravox-client` dep, restore deleted files via git)
- 3-prompt divergence handling during partial revert
- VAD bench re-run after revert
- Communication template (ADR-0265 deploy-conductor sign-off)

### Acceptance — Phase 5

- [ ] `grep -c "Ultravox" docs/architecture/modules/MODULE_BOTSSON.md` < 5 (only history-section + ADR-link)
- [ ] `grep -rl "Ultravox" docs/architecture/ docs/decisions/ | grep -v archive | wc -l` ≤ 5 (audit-trail-bevarte)
- [ ] `docs/runbooks/RUNBOOK-voice-plane-rollback.md` exists
- [ ] Plans promoted to `completed/` and `archive/`
- [ ] **Scope guard:** No commit touches files outside `docs/architecture/`, `docs/STATE-SUMMARY.md`, `docs/plans/`, `docs/superpowers/specs/`, `docs/runbooks/`. Code paths untouched.

---

## PHASE 6 — Agent Files + Skills + CLAUDE.md Refresh (3h)

**Pre-requisites:** Phase 5 merged (architecture is ground truth).

### Track 6.1-6.2 — Agent files refresh

`~/dev/smartout.ai/.claude/agents/` files:
- `botsson-harness-builder.md` — refresh L1-L5 status references, capability count, 🔴/🟡/🟢 list
- `system-agent-coordinator.md` — refresh Stage Engine contracts, AuthContext shape, capability surface

For each: read current state, diff against MODULE_BOTSSON.md (post-Phase 5 refresh), update.

### Phase 6 split — in-repo track + out-of-band track

> **Council 2026-05-08 R2 fix:** Phase 6 originally bundled in-repo files (`.claude/skills/`, root `CLAUDE.md`, `.claude/agents/`) with out-of-repo files (`~/.claude/skills/`, `~/.claude/CLAUDE.md`). Sortie + close-feature.sh cannot capture out-of-repo files. Split below.

### Track 6A — IN-REPO files (sortie-merge captures)

#### Track 6A.1 — `smartout-agent-dev` skill (path NOTE: GLOBAL — see Track 6B)

Per Council 2026-05-08 R2 verification: `smartout-agent-dev/SKILL.md` exists ONLY at `~/.claude/skills/` (global). No project-local copy. **Moved to Track 6B (out-of-band).**

#### Track 6A.2 — `smartout-edge-function-guide` skill

`.claude/skills/smartout-edge-function-guide/SKILL.md` (verified project-local):
- Refresh function list — add wizard-mode notes for `livekit-token` (post-Phase E)
- Reference ADR-0282 wizard-token decision
- Update example list

#### Track 6A.3 — `smartout-database-guide` skill

`.claude/skills/smartout-database-guide/SKILL.md` (verified project-local):
- Refresh `engine_sessions` schema notes (per Phase E KRIT-1 resolution — if `process_id` column added via migration, document it; else document `mission_id`-based discriminator)
- Add `engine_world` shared state references (ADR-0281 + 0290 accepted)
- Refresh enum count + RLS pattern examples

#### Track 6A.4 — Agent files (in-repo)

- `~/dev/smartout.ai/.claude/agents/botsson-harness-builder.md` — refresh L1-L5 status, capability count (REAL count via `grep -c "Capability,$" packages/ai/src/capabilities/registry.ts`), 🔴/🟡/🟢 list per current BOTSSON-SYSTEM-MAP
- `~/dev/smartout.ai/.claude/agents/system-agent-coordinator.md` — refresh Stage Engine contracts, AuthContext shape, capability surface
- For each: read current state, diff against MODULE_BOTSSON.md (post-Phase 5 refresh), update.
- **Note:** 🔴/🟡/🟢 status badges live in BOTSSON-SYSTEM-MAP.md, NOT in agent files directly. Agent files reference system-map; refresh = update reference.

#### Track 6A.5 — Root `CLAUDE.md` refresh

`/home/sxtnl/dev/smartout.ai/CLAUDE.md`:
- "163 ADRs as of 2026-04-20" → "295+ ADRs as of 2026-05-08" (verify count: `ls docs/decisions/[0-9]*.md | grep -oE '[0-9]{4}' | sort -n | tail -1`)
- Capability count refresh — DO NOT hardcode. Use grep verification at write-time:
  ```bash
  grep -c "Capability,$" packages/ai/src/capabilities/registry.ts
  ```
  Expected output ≥29 as of 2026-05-08. Council 2026-05-08 R2 found plan-author hardcoded "16/17" while real count is 29.
- ADR list freshness
- Refresh "What NOT To Do" section if any new pattern emerged

### Track 6B — OUT-OF-BAND files (NOT captured by sortie merge)

> Council 2026-05-08 R2 hard rule: out-of-repo files cannot be merged via sortie close-feature.sh. Manual update + activity-log entry.

#### Track 6B.1 — `~/.claude/skills/smartout-agent-dev/SKILL.md` (global)

Same content updates as Track 6A.2/6A.3 in shape, but:
- Global skill at `~/.claude/skills/smartout-agent-dev/SKILL.md`
- Capability count: REAL count via grep, not hardcoded number (council 2026-05-08 R2 — was 16/17 in plan, real is 29)
- Tool-routing examples refreshed against current intent-classifier
- ADR-0287 reference (gate_action mandatory)

Manual update procedure:
```bash
# 1. Read current state
cat ~/.claude/skills/smartout-agent-dev/SKILL.md

# 2. Edit with new capability count + ADR refs
# (Editor of choice; not captured by sortie)

# 3. Log to activity-log
~/.claude/scripts/log-activity.sh user pontus \
  "Updated ~/.claude/skills/smartout-agent-dev/SKILL.md — capability count refresh + ADR-0287"
```

#### Track 6B.2 — `~/.claude/CLAUDE.md` (global)

Read `~/.claude/CLAUDE.md`. Verify accurate against current state:
- Memory section — paths still valid
- Skills section — list matches actual skills present
- Worktree pattern — current
- Activity log — paths valid

If drift found, fix manually + log to activity-log.

### Acceptance — Phase 6

- [ ] In-repo: 2 agent files updated with `verified_against_code: 2026-05-08` in frontmatter (if frontmatter exists)
- [ ] In-repo: 2 project-local skill files updated (smartout-edge-function-guide, smartout-database-guide)
- [ ] In-repo: root CLAUDE.md refreshed with REAL capability count (grep-verified, NOT hardcoded)
- [ ] Out-of-band: 2 global files updated manually (smartout-agent-dev/SKILL.md + ~/.claude/CLAUDE.md), each with activity-log entry
- [ ] Spot-check: spawn `botsson-harness-builder` agent with prompt "list 🔴 components" — verifies output against post-Phase-5 system-map state
- [ ] Scope guard: no commit touches files outside `.claude/skills/{smartout-edge-function-guide,smartout-database-guide}/`, `.claude/agents/{botsson-harness-builder,system-agent-coordinator}.md`, root `CLAUDE.md` (in-repo). Out-of-band changes captured in activity-log only.

---

## PHASE 7 — Knowledge Capture + Heartbeat (2h)

**Pre-requisites:** Phase 6 merged. Final sortie phase.

### Track 7.1 — Council learnings (4 new files)

Reserve numbers `0225-0228` (highest used = 0224 across all branches per Phase 1 INTAKE).

**`docs/learnings/0225-deprecation-plan-must-verify-adr-existence.md`:**
> Pattern: deprecation plans claiming "ADR X to-write" without first running
> `git log --all` to verify whether the ADR already exists. Has occurred 3+
> times: ADR-0276 + ADR-0284 (2026-05-08 council found existing), and prior
> session ADR-0282 §Open Items.
>
> **Rule:** Before any plan claims "to write" an ADR, run
> `ls docs/decisions/<num>-*.md` and `git log --all --name-only | grep <num>`.
> If file exists in any branch, plan must say "edit existing" not "create".
>
> **Why:** L-0042 retimestamp protocol triggers renumbering when slot is
> occupied — orphans previously-written ADR.
>
> **How to apply:** Phase 2.5 fact-check skill must include "verify ADR slots
> via git log --all" as required step.

**`docs/learnings/0226-doc-footprint-files-vs-lines.md`:**
> Plan footprint counts must distinguish files vs lines.
> 174 files referencing X is different from 734 lines referencing X. Council
> 2026-05-08 caught Ultravox count at 174 files while plan stated 304 — both
> valid measures, but plan must declare which.
>
> **Rule:** Plan footprint counts must declare denominator (`files: N` or
> `lines: N`).

**`docs/learnings/0227-doc-deprecation-three-time-slices.md`:**
> Doc deprecation has 3 time slices, not binary "before vs after":
> 1. SNAPSHOT (before deletion) — freezes line-refs as historical evidence
> 2. BANNERS (concurrent with deletion) — declares deprecation, reversible
> 3. REWRITES (after deletion + parity gate passed) — replaces stripped content
>
> Binary "strip when E6 lands" loses the snapshot evidence and mid-cutover
> rollback context. Council 2026-05-08 promoted this from observed to
> protocol.

**`docs/learnings/0228-chair-self-reversal-protocol-promotion.md`:**
> Chair Self-Reversal Protocol now promoted from "observed" (3 precedents
> per skill) to "expected behavior" — 5th precedent landed 2026-05-08 in
> doc-consolidation council (Phase 3 R1 on STAGE-ENGINE.md path → Phase 5
> reversal after Coordinator code-trace evidence).
>
> **Rule:** When 2+ reviewers vote opposite to chair with code-trace
> evidence, chair MUST classify Phase 3 vote as REVERSED in Phase 5 §1
> (not REFINED, not HELD-with-conditions). Promote to first-class hard
> rule (already documented in `run-council` skill §1.5; this learning
> raises priority from 3rd-precedent advisory to 5th-precedent core
> protocol).

### Track 7.2 — Council session log

Append to `docs/council/COUNCIL-LOG.md` (create if missing per skill convention):

```markdown
## 2026-05-08 — Doc + Agent-Instruction + Skills Consolidation
**Type:** plan
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator, botsson-harness-builder + general-purpose (Phase 2.5 fact-check, 4 categories verified, 4 false claims caught)
**Prior verdict held?** Yes — ADR-0282 council 2026-05-04 verdict still applies; this council is doc-side companion.
**Key decision:** 7-phase consolidation gated on B1 merge + vad-bench PASS + Phase E E6 deletion. 5 sortie tracks (E11-E15) consolidated with doc-resync (Sortie 1-5) and skills/agent alignment (Phase 6). Heartbeat drift-check job registered.
**ADR created:** none (no architectural decisions; all adopted council hard rules already covered by ADR-0282 + ADR-0276 + ADR-0220).
**Learnings created:** L-0225, L-0226, L-0227, L-0228.
```

### Track 7.3 — Heartbeat drift-detection job

Per council Hard Rule 6, full spec required:

In `~/dev/second-brain-v2/HEARTBEAT.md`, add:

```markdown
- [ ] doc-drift-check [cooldown: 7d] — Detect doc drift against code reality
  - Command: `cd ~/dev/smartout.ai && bash infra/scripts/doc-drift-check.sh`
  - Threshold: > 0 stale-pointer findings → Telegram alert
  - Channel: telegram + file
  - Alert subject: "Smartout doc drift detected — N findings"
```

Create `infra/scripts/doc-drift-check.sh`:

```bash
#!/bin/bash
# Detects doc drift against code reality.
# Exit 0 if no drift, 1 if drift detected.
#
# Council 2026-05-08 R2 fix: replaced ((var++)) with var=$((var + 1)) — set -e
# treats post-increment-returning-0 as failure. Also added || echo 0 guards on
# git log subshells to handle untracked files gracefully.

set -uo pipefail
cd "$(dirname "$0")/../.."

drift_count=0

# Check 1: STAGE-ENGINE.md split-brain
if [ "$(find docs/ -name 'STAGE-ENGINE.md' | wc -l)" -gt 1 ]; then
  echo "DRIFT: STAGE-ENGINE.md split-brain"
  drift_count=$((drift_count + 1))
fi

# Check 2: BOTSSON-SYSTEM-MAP.md split-brain
if [ "$(find docs/ -name 'BOTSSON-SYSTEM-MAP.md' | wc -l)" -gt 1 ]; then
  echo "DRIFT: BOTSSON-SYSTEM-MAP.md split-brain"
  drift_count=$((drift_count + 1))
fi

# Check 3: MODULE_BOTSSON.md staleness
mb_ct=$(git log -1 --format=%ct docs/architecture/modules/MODULE_BOTSSON.md 2>/dev/null || echo 0)
if [ "$mb_ct" != "0" ]; then
  days=$(( ($(date +%s) - mb_ct) / 86400 ))
  if [ "$days" -gt 14 ]; then
    echo "DRIFT: MODULE_BOTSSON.md ${days}d stale (threshold 14d)"
    drift_count=$((drift_count + 1))
  fi
fi

# Check 4: ADR proposed > 14 days without plan-link
proposed_old=$(grep -l "^status: proposed" docs/decisions/*.md 2>/dev/null | while read f; do
  ct=$(git log -1 --format=%ct "$f" 2>/dev/null || echo 0)
  [ "$ct" = "0" ] && continue
  age=$(( ($(date +%s) - ct) / 86400 ))
  if [ "$age" -gt 14 ]; then echo "$f ($age d)"; fi
done)
if [ -n "$proposed_old" ]; then
  echo "DRIFT: ADRs proposed > 14d without acceptance: $proposed_old"
  drift_count=$((drift_count + 1))
fi

# Check 5: ADR/learning collision risk (info only)
max_adr=$(ls docs/decisions/[0-9]*.md 2>/dev/null | grep -oE '[0-9]{4}' | sort -n | tail -1 || echo "none")
max_learn=$(ls docs/learnings/[0-9]*.md 2>/dev/null | grep -oE '[0-9]{4}' | sort -n | tail -1 || echo "none")
echo "INFO: max ADR=$max_adr, max learning=$max_learn"

# Check 6: capability count drift in skill files (council 2026-05-08 R2 finding)
real_capability_count=$(grep -c "Capability,$" packages/ai/src/capabilities/registry.ts 2>/dev/null || echo "0")
if [ "$real_capability_count" -gt "0" ]; then
  echo "INFO: real capability count = $real_capability_count"
  # Check skill files for stale numbers
  for skill_file in .claude/skills/smartout-agent-dev/SKILL.md ~/.claude/skills/smartout-agent-dev/SKILL.md; do
    if [ -f "$skill_file" ]; then
      stale=$(grep -oE "Capability count [0-9]+" "$skill_file" 2>/dev/null | grep -oE "[0-9]+" || echo "")
      if [ -n "$stale" ] && [ "$stale" != "$real_capability_count" ]; then
        echo "DRIFT: $skill_file says capability count $stale, real is $real_capability_count"
        drift_count=$((drift_count + 1))
      fi
    fi
  done
fi

if [ "$drift_count" -gt 0 ]; then
  echo "Total drift: $drift_count"
  exit 1
fi
echo "No drift."
exit 0
```

**Council 2026-05-08 R2 acceptance addition:** verify script syntax pre-commit:
```bash
bash -n infra/scripts/doc-drift-check.sh
```

### Acceptance — Phase 7

- [ ] 4 learning files created (L-0225 through L-0228) PLUS L-0229 (capability-count drift, council R2 finding)
- [ ] Council session logged in `docs/council/COUNCIL-LOG.md` (R1 + R2 entries)
- [ ] Heartbeat job spec'd with full command + threshold + channel
- [ ] `infra/scripts/doc-drift-check.sh` exists, executable, exit 0 on clean state, `bash -n` syntax-check passes
- [ ] **Scope guard:** No commit touches files outside `docs/learnings/`, `docs/council/`, `docs/learnings/0000-learning-log.md`, `~/dev/second-brain-v2/HEARTBEAT.md` (out-of-band activity-log entry), `infra/scripts/doc-drift-check.sh`. Code paths untouched.

---

## Acceptance Criteria (overall)

- [ ] All 7 phases merged
- [ ] `find docs/ -name "STAGE-ENGINE.md" -o -name "BOTSSON-SYSTEM-MAP.md" | wc -l` = 2 (exactly 2 canonical files)
- [ ] `grep -c "verified_against_code: 2026-05-08" docs/architecture/modules/MODULE_BOTSSON.md` = 1
- [ ] `grep -c "Ultravox" docs/architecture/modules/MODULE_BOTSSON.md` < 5 (post-Phase-5 only)
- [ ] All 4 council learnings registered in `docs/learnings/0000-learning-log.md`
- [ ] Council session row in `docs/council/COUNCIL-LOG.md`
- [ ] `infra/scripts/doc-drift-check.sh` exits 0 on current state
- [ ] No commit touches code outside `docs/`, `infra/scripts/`, `~/.claude/skills/`, `~/.claude/CLAUDE.md`, `CLAUDE.md`, `.claude/agents/`, `.claude/skills/`, `~/dev/second-brain-v2/HEARTBEAT.md`

## Estimated Time

- Phase 1: 4h (parallel-safe — 2 sub-tracks)
- Phase 2: 5h
- Phase 3: 2h
- Phase 4: 3h (must land before Phase E E6)
- Phase 5: 4h (concurrent or after Phase E E6)
- Phase 6: 3h
- Phase 7: 2h

Total: 23h. With 2-3 parallel sortie spawns post-Phase-1: ~12-14h wall-clock.

## Rollback

Pure documentation work. Each phase's commits revertable. No code paths affected. No migrations to undo.

## Out of Scope

- R-3 system-prompt SSOT consolidation — separate ADR-0295 + 5th plan, not this work
- B1, B2, vad-bench, Phase E execution — separate plans
- Code refactoring of MODULE_BOTSSON-referenced functions — only doc-state changes
- New ADRs (none needed — council adopted hard rules cover existing ADRs)
- Pixel-parity audit (Sortie 5 from Pontus' analysis) — separate frontend-designer dispatch

## Cross-References

- ADR-0282 (Voice Plane Consolidation) — Phase 4-5 gated on E6
- ADR-0276 (ADR-0107 amendment) — patched in Phase E Task 9 already
- ADR-0284 (Phantom-Reuse Detection) — patched in Phase E Task 9b
- ADR-0220 (Botsson term-ban orchestrator) — preserved during Phase 5 rewrite
- ADR-0238 (DomainChatOwnership) — Phase 2 T2.4 backfill
- ADR-0128 + ADR-0144 (deprecation-lifecycle precedent) — schema reuse for Phase 1 inventory
- L-0083 (lying-in-docs precedent) — risk R-2 mitigation
- L-0042 (migration timestamp ordering) — applied to ADR ID reservations
- L-0150 (system-map 7d-gate) — extended to MODULE_BOTSSON in Phase 7 heartbeat
- `~/.claude/skills/run-council/SKILL.md` — verdict format + Phase 8/9 procedures
