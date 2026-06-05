---
title: Consolidate-then-Bootstrap Plan — clean the ground, then arm the harness
status: draft
created: 2026-06-03
updated: 2026-06-03
module: design-handoff
tags: [bootstrap, consolidation, harness, runbook, planlegg, campaign]
---

# Consolidate-then-Bootstrap — clean ground first, then arm the harness

> **Decision:** clean-first ("rent"), not bootstrap-on-mess. Bootstrapping onto the current tree would
> bake in scatter + duplication + contamination. Consolidation is **infra-free** (no op, no web) — it
> uses the op-signin-blocked window productively; web resolves in parallel.
>
> **Two hard constraints, baked in:**
> 1. **IMPORT, not init.** Campaign is LIVE (golden-path `min-dag-v2` shipped + `.sxtn/` populated +
>    telemetry-map gates). `sxtn-init` greenfield would clobber → use `sxtn-import`/repo-refresh.
> 2. **Single `.sxtn` owner (rule 9).** All `.sxtn/` *writes* land on THIS worktree, one instance.
>    Other instances may plan; mutations happen here. Two writers = the contamination we're removing.

## Disk truth this plan stands on (2026-06-03, verified)

| Fact | Evidence |
|------|----------|
| Large uncommitted set (~40+ files), NOT "3 paths" | `.claude/agents/*`, all `page-polish/*.run.yml`, commands, hooks modified |
| Untracked complete ports at loss-risk | `oversikt-v2/` (4-file, L2, untracked) · `people-v2/` (untracked in `smartout.ai-wt-2`) |
| Uncommitted doc patches (this session) | `CLAUDE.md` + `ORIENTATION.md` reference-pointer fixes (min-dag-v2) |
| THREE scaffold roots (duplication) | `./templates/` + `./schemas/` (root) vs `.sxtn/runbook/{templates,schemas}` vs `.sxtn/schemas` |
| Canon location | `.sxtn/runbook/` already holds `feature_list.example.json` + `*.schema.json` → this is the hub |
| Campaign already populated | `min-dag-v2` tracked (4 files); `.sxtn/{PO-Briefing,bin,commands,inbox,runbook,schemas}` present |
| Open collision | LOG-LEGIBILITY-STANDARD ↔ `harness-event.schema` (reconcile, don't pick blind) |

---

## Phase 1 — LOCK + CONSOLIDATE (infra-free · this tree · one owner)

Goal: one canonical `.sxtn/runbook/` hub, nothing at loss-risk, working tree legible. **Every commit
routes through `commit-steward`; Pontus pushes. No `git add -A` blanket — triage.**

1. **Checkpoint (safety net).** `commit-steward` writes a WIP checkpoint of the current tree so nothing
   is lost before we start moving things. Tag tier WIP.
2. **Triage the ~40 modified files.** Classify each into: (a) canon-intentional (keep + commit by domain),
   (b) accidental drift (revert), (c) needs-review (hold for Pontus). Do NOT assume the agent/page-polish
   edits are all wanted — read, don't blanket-stage.
3. **Rescue untracked ports.** Commit `oversikt-v2/` at tier **WIP/L2** (honest — L3 needs activity_trail
   proof). Surface `people-v2/` (wt-2) for explicit keep/discard — do not touch another worktree unasked.
4. **Dedupe scaffold → `.sxtn/runbook/` canon.** Fold root `./templates/` + `./schemas/` into
   `.sxtn/runbook/{templates,schemas}`; resolve `.sxtn/schemas` vs `.sxtn/runbook/schemas` to one. Remove
   the duplicates only after confirming the canon copy is complete. `.sxtn/runbook/` = single runtime hub.
5. **Reconcile log-standard ↔ schema.** Resolve the `LOG-LEGIBILITY-STANDARD` ↔ `harness-event.schema`
   collision (which field set wins) — write the reconciliation, don't leave it open.
6. **Stale-doc sweep already done this session** (reference pointer → `min-dag-v2`; ORIENTATION phase note).
   Fold those patches into the consolidation commits.

**Phase 1 exit:** `git status` clean or every remaining item explained · `.sxtn/runbook/` is the sole
scaffold hub · no untracked port at loss-risk · log-standard/schema reconciled · all via commit-steward.

## Phase 2 — BOOTSTRAP CLEAN (on solid ground)

Goal: arm the harness against the consolidated hub — the relay's five pieces, import-mode.

| Relay piece | Action | Source |
|-------------|--------|--------|
| fundamental lists | feed `feature_list.json` + worklist (crystallize the prose wave-order from `DRIVE-TO-100.md` into the structured schema) | `.sxtn/runbook/schemas/{feature_list,worklist}.schema.json` |
| mount templates | mount set-models (IDEA/PROPOSAL/SPEC/STATE) + component-index | `.sxtn/runbook/templates/` |
| gates | confirm per-domain `control.json` + L3 done-oracle + steward wired | telemetry-map + schemas |
| controllers | arm orchestrator + heartbeat triggers (trigger-registry) | `work-mode-orchestrator` |
| kommentarer | legible logs/annotations | `LOG-LEGIBILITY-STANDARD` |

1. **`sxtn-import`** the live campaign (reconcile existing state into the runbook — NOT `sxtn-init`).
2. **Feed the feature-list** — the fundamental worklist (which domains, what wave order). Lightest-first
   backend-ready: `oversikt` → `lonn` → `oppgaver` → `hms`; gap/blocked: `ansatte`, `vaktplan` (ADR-0115 exit).
3. **Mount deduped templates** + component-index against the single hub.
4. **Wire gates + arm controllers** — control.json per domain, orchestrator + heartbeat triggers.
5. **Legible comments** — LOG-LEGIBILITY-STANDARD on every commit/annotation.

**Phase 2 exit:** harness armed against canon hub · feature-list drives the next fan-out wave · gates +
controllers live · first real build step = drive `oversikt-v2` to L3 (needs local Supabase = the op/web gate).

---

## What stays PO-held / blocked (not in this plan's gift)

- **ADR-0047** ruleset promotion · **F1** (ingest vs direct-port) · **ADR-0115 exit** (vaktplan RSC) — PO.
- **op-signin** (biometric, Pontus) → unblocks web → unblocks L3 proof + login-proof. Parallel to Phase 1.

## Sequence (one line)

`commit-steward checkpoint → triage+rescue+dedupe+reconcile (Phase 1) → sxtn-import + feed feature-list +
mount + wire + arm (Phase 2) → first wave: oversikt → L3 (when op/web up).`
