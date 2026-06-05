---
title: Handoff — SmartOut oversikt-v2 verify + people-v2 track session
status: done
updated: 2026-06-04
created: 2026-06-04
module: master-refactor
tags: [handoff, page-polish, oversikt-v2, people-v2, telemetry, campaign]
---

# Handoff — SmartOut side (2026-06-04)

> Session scope: verify the `oversikt-v2` page-polish run on disk, and unblock + track the
> at-risk `people-v2` design port. Campaign: `master-refactor` (Nordic Split design handoff
> onto the live SmartOut app, reuse-first, page by page).

---

## 1. What we did

### A. Verified the `oversikt-v2` page-polish run (not trusted — checked on disk)

Pontus asked to "run" `.claude/page-polish/dashboard-oversikt-v2.run.yml`. That file is a **record**,
not an executable. So the real job = honour campaign rule 7 ("evidence on disk, never a worker's
word") and re-verify every claim the record makes, plus run the gates that *can* run in this
environment (WSL2, no Chromium, no running app).

Loaded skills: `smartout-page-polish`, `smartout-nordic-split`.

**Verified GREEN on disk:**

| Claim | Verified | Result |
|-------|----------|--------|
| 5 polish files exist + already committed | present, not in uncommitted set | ✅ |
| 11 `emit()` calls in `OversiktCockpit.tsx` | 11 `void emit({` (line-11 is a comment, filename strings excluded) | ✅ |
| 11 distinct `oversikt.*` events | 11 | ✅ |
| Registry entries (src + dist) | both `packages/telemetry/src/registry.ts` and `dist/registry.d.ts` carry all 11 | ✅ |
| Nudge fix `profile_id → workspace_id` | component + src interface + dist interface all `workspace_id` | ✅ |
| Design audit (zinc/gray/slate, hex) | 0 palette, 0 hex in `_components/` | ✅ |
| Telemetry typecheck | `pnpm --filter @smartout/telemetry typecheck` → EXIT:0 | ✅ |
| site-map `oversikt-v2` entry | present at `apps/web/.botsson/site-map.json:2221`, 0 new errors | ✅ |

**Verdict: `oversikt-v2` is L2-green (telemetry *wired*). NOT L3 (telemetry *proven*).**
The run record's L2 claims are honest — they hold on disk.

### B. Unblocked + tracked the `people-v2` design port

A commit attempt in the **wt-2** worktree (`refactor/smartout`) was blocked by the pre-commit
page-polish gate (people-v2 has no `run.yml`). Diagnosed it was a **cross-worktree** event (not
ours), confirmed **no data loss**, then committed the port as tracked-WIP per Pontus's choice
(path 2: `SKIP_PAGE_POLISH=1` + documented reason).

- Commit: **`fe995c52b`** on `refactor/smartout` — `feat(people): track people-v2 design port (polish deferred)`
- 5 files, **5757 insertions** (page.tsx 34, AnsatteDirectory.tsx 881, ansatte.css 4610, to-design-shape.ts 189, + .sxtn/heartbeat)
- Removes the single-point-of-loss risk on ~5700 lines of previously-untracked work (CLAUDE.md rule 10).

---

## 2. What is completed

- `oversikt-v2` reaches **L2** (Wired & Operable): every event registered + emitted, design clean,
  page knowledge present, site-map entry present, telemetry typecheck green.
- `people-v2` port is now **tracked** (was at-risk/untracked). No longer loss-exposed.
- wt-2 working tree clean after commit.

---

## 3. What is NOT done (gaps / take forward)

| Item | Why blocked | Next step |
|------|-------------|-----------|
| `oversikt-v2` **L3 proof** | needs running app + auth to fire events and assert rows in `activity_trail` (DB-assert, not UI-200) | In a browser+DB session: fire each of the 11 events, `select … from activity_trail`, confirm non-empty `workspace_id`+`actor_id`. This is what gates **G8 close** per CLAUDE.md rule 4. |
| `oversikt-v2` **Lighthouse (Phase 1–4)** | no Chromium in WSL2 | Browser session: capture LCP/CLS/TTI into the run.yml `speed_test`/`retest` fields |
| `oversikt-v2` **Phase 7 harness tools** | consumer pipe (HarnessAdapter) does not exist | blocked on **ADR-0327** — do not add `useRegisterTools` until it ships |
| `people-v2` **keep/discard decision** | product call (PO/Pontus), not engineering | Decide. If KEEP → full polish run → L3. If DISCARD → revert `fe995c52b`. |
| `people-v2` **full polish run** | premature until decided-keep + browser/DB session | After keep decision: run 8-phase workflow, write `dashboard-people-v2.run.yml` |
| **web full typecheck** | OOM risk (only ~5.2Gi free; OOM-endemic on WSL2) | run.yml already records EXIT:0 from polish session; re-run with `TURBO_CONCURRENCY=1` when RAM ≥6.5Gi if re-proof wanted |

### Smaller cleanups surfaced

- **site-map.json has 6 pre-existing validation failures** (NOT oversikt-v2):
  - `/dashboard/chat` — missing `polished_at`; `owns_chat_surface=true` needs `domain_chat_endpoint`
  - `/dashboard/komm/varsler` purpose 173 chars (>140)
  - `/dashboard/settings` purpose 229 chars
  - `/dashboard/organization` purpose 255 chars
  - `/dashboard/payroll/tariff` purpose 211 chars
  → `pnpm --filter web site-map:validate` will keep exiting 1 until these are tightened.
- **Scope drift:** validator shows tool scope `"oversikt"` registered at
  `src/components/day/_tools/oversikt-tools-bridge.tsx` (old day-control tab), while the
  `oversikt-v2` site-map entry has `tools: []`. Different surfaces — not blocking — but dedupe later.

---

## 4. What we learned (SmartOut-specific)

1. **L2-green ≠ done.** A `verified: true` run.yml proves emit is *wired* (registered + called), not
   that a row *lands*. `oversikt-v2` is the live example: clean L2, zero L3. The campaign's
   definition-of-done (rule 4) is the `activity_trail` row — only L3 satisfies it. Phantom-green is
   the trap: rosy "defined %" next to an all-FAIL landing check.
2. **The dist artifact is a real type source.** `packages/telemetry` resolves from `dist/` for
   typecheck. Registry interface changes must patch **both** `src/registry.ts` *and*
   `dist/registry.d.ts` or typecheck fails against the stale interface. (The nudge fix did both —
   confirmed.) Candidate hardening: a telemetry `build` step in pre-push.
3. **Run records are honest here, but must still be disk-verified.** Every oversikt-v2 claim held —
   good signal — but the verification itself caught a tooling bug (next doc) the record didn't flag.

---

## 5. What we discussed

- Whether to "run" a record file → reframed as verify-on-disk + run the runnable gates.
- The L2/L3 boundary and why `oversikt-v2` cannot close (G8) without a browser+DB session.
- `people-v2`: keep/discard is a product decision; tracking-WIP now ≠ deciding keep. Chose to
  track to kill loss-risk, defer the decision and the polish.

---

## 6. Pointers

| For | Path |
|-----|------|
| oversikt-v2 polish record | `.claude/page-polish/dashboard-oversikt-v2.run.yml` |
| oversikt-v2 component | `apps/web/src/app/dashboard/oversikt-v2/_components/OversiktCockpit.tsx` |
| people-v2 port (now tracked) | `apps/web/src/app/dashboard/people-v2/` (wt-2, `refactor/smartout`) |
| Telemetry registry (done-oracle) | `packages/telemetry/src/registry.ts` (+ `dist/registry.d.ts`) |
| Telemetry control.json | `docs/campaign/telemetry-map/oversikt/control.json` |
| Reference port (golden) | `apps/web/src/app/dashboard/min-dag-v2/` |
| Campaign contract | `CLAUDE.md` (this worktree) |
