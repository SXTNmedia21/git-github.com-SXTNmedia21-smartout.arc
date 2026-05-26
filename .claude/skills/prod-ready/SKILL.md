---
name: prod-ready
description: Use when asking "what's left to ship", "production readiness", "completion status", "what's next", "hva mangler", "hvor langt har vi kommet", "ferdighetsgrad", "klar for prod", "neste sortie", "neste skritt", driving Smartout v3 toward production, picking the next sortie that moves the needle, weekly cadence check on overall progress, or pre-campaign-merge spot-check on a domain's readiness. Holds per-domain completion % state across every folder in docs/domains/.
---

# prod-ready

## Overview

The active drive layer for shipping Smartout v3 to production. Holds machine-readable state of every domain's completion %, computes the next bottleneck across the fleet, and tells you (and the agent fleet) exactly what to ship next.

**Core loop:** `scan → score → rank gaps → propose next action → re-scan after work lands`.

**Not a passive dashboard.** This skill *drives*: it answers "what is the single next sortie that moves us closest to production" and tracks whether that sortie actually moved the needle on the next scan.

**Two-layer relationship with `domain-steward`:**

| Concern | Owner | Output |
|---|---|---|
| Per-domain qualitative truth (8-file spine, mirror field, build-state prose) | **domain-steward** | `docs/domains/<name>/_DASHBOARD.md` rows |
| Cross-domain quantitative scoring + fleet ranking + next-action queue | **prod-ready** | `docs/prod-ready/state.json` + rendered dashboard |

`prod-ready` **reads** the domain dashboard as one input signal (axis 14). It **never** writes to `docs/domains/` — that is domain-steward's territory. When prod-ready detects spine drift, it **queues** a `domain-steward update <name>` sortie; it never edits the spine itself.

## When to Use

Triggers:
- `/prod-ready` (default quick view), `/prod-ready scan` (full rescore), `/prod-ready domain <name>`, `/prod-ready gaps`, `/prod-ready next`, `/prod-ready diff`
- "what's left to ship", "production readiness", "completion status", "what's next"
- Norwegian: "hva mangler", "hvor langt har vi kommet", "ferdighetsgrad", "klar for prod", "neste sortie", "neste skritt", "hva skal jeg gjøre i dag"
- Heartbeat weekly job → re-scan all domains, alert on regression
- Before any `campaign/* → development` merge → re-score touched domain to confirm gain
- After any `/close-feature` merge → trigger `/prod-ready domain <inferred>` to confirm needle moved

Do NOT use when:
- Single-feature in-flight progress → use `/status` (DASHBOARD.md = git state, not completion %)
- Per-domain doc reconciliation → use `domain-steward` directly
- Finding-pool generation → use `adr-contract-audit` (audit output is one of prod-ready's input signals, not a substitute)
- Asking "is this PR safe to merge" → use `local-ci-before-pr`

## Domain Discovery

Source of truth: `ls docs/domains/` (excludes `_DASHBOARD.md`, `_*.md`). Never hardcode the domain list — it grows.

Current snapshot (verify on first scan): agent-harness, announcements, billing, bootstrap, botsson, communication, contracts, core-structure, day-session, lovsen, notifications, onboarding-wizard, payroll, procedure-engine, reports, scheduling, scrapling, shift-clock, training, year-wheel — plus any added since.

A folder under `docs/domains/` with **no `_DASHBOARD.md` row** = "undeclared domain" → flag and queue `domain-steward update <name>` (or `pre` if brand new).

## Scoring Rubric (14 DoD axes)

Per domain, each axis scored **0** (missing) / **1** (partial) / **2** (done). Domain completion % = `(sum / 28) × 100`. **No half-credit improvisation** — if criterion-set for "2" is incomplete, score 1; if criterion-set for "1" is incomplete, score 0.

| # | Axis | Counts as 2 (done) when | Detection signal |
|---|---|---|---|
| 1 | Journey | `docs/journeys/JOURNEY-<domain>*.md` exists, all roles covered (admin + manager + employee where applicable), happy + error paths, precondition + postcondition | `ls docs/journeys/` + `grep` for role headings |
| 2 | Schema | All declared tables migrated, `database.types.ts` regenerated, RLS dual policies (JWT + API key) on every workspace-scoped table | migration list + types diff + `grep` policy `CREATE POLICY` |
| 3 | Capability | Frozen-4 tool in correct namespace (ADR-0173/0240), `gatedMutation` for writes (ADR-0204), intent-classifier enum + system-prompt prose registered (L-0112) | `ls packages/ai/src/capabilities/<domain>/` + intent-classifier grep |
| 4 | Telemetry | Every registry event has matching `emit()` call-site (count match), `workspace_id` + `actor_id` resolved server-side before emit (L-0177) | `packages/telemetry/src/registry.ts` diff vs `grep -r 'emit(' apps/ packages/` |
| 5 | Web UI | Page exists at `apps/web/src/app/dashboard/<route>/`, Server-default, Nordic Split tokens only (no OKLCH literals, no hardcoded zinc), i18n keys for nb + en, `font-heading`/Geist/Lucide compliance | route file presence + token regex scan |
| 6 | Mobile | If domain in scope per ADR-0133: surface exists at `apps/mobile/src/screens/<x>/`, shared logic in `packages/`, `getProfileContext()` resolves before emit. If web-only per ADR-0133: explicit `mobileScope: "web-only"` flag → axis auto-scores 2 | route file presence + ADR-0133 lookup |
| 7 | Edge Function | Workspace-scoped data routes through `workspace-api` gateway (ADR-0039); webhooks have `verify_jwt=false` + signature verification | `ls supabase/functions/` + `config.toml` scan |
| 8 | Unit tests | `pnpm turbo test --filter='@smartout/<domain-pkg>'` exit 0, no skipped tests in domain scope | test runner exit code + skip count |
| 9 | Live invoke | `scripts/live-invoke/<domain>.mjs` exists, runs against local Supabase, exits 0 — **mandatory for any DB-read capability** (L-0348, 3rd occurrence) | script presence + run exit code |
| 10 | E2E | `apps/web/e2e/<domain>/` has Playwright spec per journey (file count ≥ journey count) | file count comparison |
| 11 | Typecheck | `TURBO_CONCURRENCY=1 pnpm turbo typecheck --filter='@smartout/<domain-pkg>'` exit 0 | runner exit code |
| 12 | Page polish | 8-phase complete: speed-test baseline + bottleneck fix + re-test + UI/UX pass + telemetry view-emit + page-instructions + harness tool descriptions + site-map entry (`smartout-page-polish` skill criteria) | `site-map.json` entry + view-emit grep + tool desc grep |
| 13 | Audit clean | Latest `/audit` finds 0 CRITICAL + 0 HIGH scoped to this domain | parse `docs/audits/<latest>/00-SYNTHESIS.md` |
| 14 | Spine | `docs/domains/<domain>/_DASHBOARD.md` row says `mirror: verified` AND all 8 spine files present AND `last_verified` within 30 days | dashboard row parse + file count + date math |

**Special rules:**
- **Mobile N/A domains** (e.g. year-wheel, billing-admin, governance-authoring per ADR-0133): axis 6 auto-2 with `mobileScope: "web-only"` flag in state. Do not penalize.
- **Aspirational-only domains** (declared, no code yet): score 0 on all code-axes (2–13), score axis 1 + 14 against docs. Surfaces as "declared, unimplemented" in dashboard.
- **Multi-package domains** (e.g. scheduling has 5 capabilities + shift-mcp): axis 3 = AVG of per-tool scores; axis 8 + 11 = MIN across all packages (one red package = red).

## Modes

### `/prod-ready` (default — fast cached view, <5s)
- Read cached `docs/prod-ready/state.json`.
- Print: global %, top-5 lowest-completion domains, top-3 recommended next sorties from `fleetQueue`.
- Warn if `generatedAt` > 24h → suggest `scan`.

### `/prod-ready scan` (~5–10 min full rescore)
1. Discover domains: `ls docs/domains/` minus `_*`.
2. For each domain, dispatch **haiku** subagent to score axes 1–7, 10, 12–14 (file-grep ops, parallel-safe).
3. Run axes 8 + 11 (test + typecheck) **sequentially** with `TURBO_CONCURRENCY=1`. Pre-flight `free -h ≥ 6500Mi` check (L-WSL2-OOM, 5+ occurrences).
4. Run axis 9 (live invoke) only when `scripts/live-invoke/<domain>.mjs` exists.
5. Read axis 13 from `docs/audits/<latest>/00-SYNTHESIS.md`; if no audit younger than 14d → flag + score 0.
6. Compute per-domain %, rank by P0/P1/P2 (P0 = blocks > 1 other domain or appears on the critical path to prod).
7. Generate `fleetQueue`: ordered next-sortie list with owner-class (sonnet/haiku/opus) inferred from axis type.
8. Write `state.json`, regenerate `DASHBOARD.md` + per-domain detail files, append line to `history.jsonl`.
9. If global completion regressed > 2pp or any domain regressed > 5pp → emit Telegram alert via `~/.claude/scripts/heartbeat-notify.sh telegram "..."`.

### `/prod-ready domain <name>` (~30s)
Re-score one domain only. Update its entry in state.json + regenerate `<name>.md`. **Use after every `/close-feature` merge** that touched a domain — confirms the sortie moved the needle.

### `/prod-ready gaps [--axis <name>] [--blocking] [--domain <name>]`
List gaps across all domains. Default filters: `--blocking` (only gaps that block another domain or a P0 path). Sortable by axis. Use to plan a multi-sortie wave.

### `/prod-ready next [--count N]`
**The drive verb.** Returns N (default 1) sortie phrased per CLAUDE.md style rule:
> *"Skal jeg X? Rationale: highest impact-per-hour (Δglobal +0.8pp, 2h, sonnet); unblocks audit-schedule + payroll-recalc downstream."*

Ranking formula: `score = (Δglobal_pp / estimateHours) × (1 + 0.5 × blockedDownstreamCount)`. Higher score = recommend first. Never propose work whose dependency is also in queue.

### `/prod-ready diff [<commitA> <commitB>] | [--scans N]`
Show completion delta between two scans. `--scans 5` = current vs scan 5 entries back in history.jsonl. Catches regression on changes that "compiled" but actually broke a downstream axis (e.g. registry change without emit-site update).

## State Files

```
docs/prod-ready/
├── state.json          # Single source of machine-readable state (orchestrator-owned, single-writer)
├── DASHBOARD.md        # Human render with progress bars + top-5 gaps + fleet queue
├── <domain>.md         # Per-domain detail (one per domain) — axes table, gap list, last 3 scan diffs
├── history.jsonl       # One line per scan, for trend + regression detection
└── README.md           # Skill pointer + last scan timestamp
```

### `state.json` schema

```json
{
  "version": "1.0",
  "generatedAt": "2026-05-26T10:00:00Z",
  "generatedBy": "claude|heartbeat|manual",
  "globalCompletion": 67.2,
  "domainCount": 21,
  "weightedRank": [
    { "domain": "scheduling", "completion": 78.6, "gapCount": 3, "priority": "P0", "blocksDownstream": 2 }
  ],
  "domains": {
    "scheduling": {
      "completion": 78.6,
      "priority": "P0",
      "mobileScope": "full",
      "axes": {
        "journey": 2, "schema": 2, "capability": 2, "telemetry": 1,
        "web": 2, "mobile": 1, "edgeFunction": 2, "unit": 2,
        "liveInvoke": 0, "e2e": 1, "typecheck": 2, "pagePolish": 2,
        "audit": 1, "spine": 2
      },
      "gaps": [
        {
          "axis": "liveInvoke",
          "action": "Write scripts/live-invoke/scheduling.mjs covering list_week + propose_week + accept_proposal",
          "blocking": true,
          "blocksDownstream": ["audit"],
          "estimateHours": 2,
          "owner": "sonnet",
          "rationale": "L-0348 4th occurrence; mocks missed 4 column drifts in Phase 1 turnus"
        }
      ],
      "nextAction": "live-invoke-scheduling — 2h sonnet — Δglobal +0.4pp, unblocks audit",
      "lastScannedAt": "2026-05-26T10:00:00Z",
      "lastCommitTouched": "abc1234",
      "spineLastVerified": "2026-05-23"
    }
  },
  "fleetQueue": [
    {
      "rank": 1,
      "sortie": "live-invoke-scheduling",
      "domain": "scheduling",
      "owner": "sonnet",
      "estimateHours": 2,
      "deltaGlobalPp": 0.4,
      "blocksDownstream": ["audit-scheduling"],
      "rationale": "Highest impact-per-hour; unblocks audit-scheduling + reduces P0 count by 1"
    }
  ],
  "spineRefreshQueue": [
    { "domain": "procedure-engine", "reason": "code newer than spine by 14 commits", "delegateTo": "domain-steward update procedure-engine" }
  ],
  "alerts": []
}
```

## DASHBOARD.md Template

```markdown
# Smartout v3 — Production Readiness

**Global:** 67.2% ████████████░░░░░░  (last scan: 2026-05-26 10:00, +1.4pp vs last week)

## Top recommendation

> **Skal jeg ta `live-invoke-scheduling`?** 2h sonnet · Δglobal +0.4pp · unblocks audit-scheduling.
> Rationale: L-0348 4th occurrence; mocks missed 4 column drifts in Phase 1 turnus. Highest impact-per-hour in queue.

## Domains ranked by production priority

| Rank | Domain | % | Bar | Blocking gaps | Mobile | Next action |
|---|---|---|---|---|---|---|
| P0 | scheduling | 78.6% | ███████████░░ | 3 | full | live-invoke (2h) |
| P0 | payroll | 71.4% | ██████████░░░ | 5 | read-only | typecheck domain green (4h) |
| P1 | day-session | 64.3% | █████████░░░░ | 4 | full | Phase D mobile push (6h) |
| ... |

## Fleet queue (next 5 sorties)

1. live-invoke-scheduling [sonnet, 2h] Δ+0.4pp
2. payroll-typecheck-fix [sonnet, 4h] Δ+0.8pp, blocks 3
3. day-session-mobile-push [sonnet, 6h] Δ+0.6pp
4. notifications-prefs-matrix [sonnet, 3h] Δ+0.3pp
5. contracts-mobile-sign [sonnet, 5h] Δ+0.5pp

## Spine refresh queue (delegate to domain-steward)

- procedure-engine — code newer than spine by 14 commits
- notifications — code newer than spine by 8 commits

## Trend (last 5 scans)

| Date | Global | Δ | Top mover | Regression |
|---|---|---|---|---|
| 2026-05-26 | 67.2% | +1.4 | scheduling +7.1pp | — |
| 2026-05-19 | 65.8% | +0.6 | day-session +3.2pp | — |
| 2026-05-12 | 65.2% | +2.1 | procedure-engine +5.5pp | contracts −1.1pp |
```

## Cooperation Protocol with `domain-steward`

**One-way data flow:** prod-ready READS domain-steward output. Never writes to spine.

| Event | prod-ready action |
|---|---|
| Scan finds code commits in `packages/ai/src/capabilities/<x>/` newer than `docs/domains/<x>/_DASHBOARD.md` row's `last_verified` | Add to `spineRefreshQueue` → user must run `/domain-steward update <x>` before axis 14 can score > 1 |
| Scan finds folder under `docs/domains/` with no `_DASHBOARD.md` row | Add to alerts → user runs `/domain-steward update <x>` or `pre <x>` |
| Scan finds `mirror: aspirational` on a spine that contains verified-grade content | Alert — domain-steward owns the fix; prod-ready just flags |
| `/prod-ready next` would recommend a sortie in a domain with stale spine | Re-rank to put `domain-steward update <x>` first |

**`/close-feature` post-merge hook (recommended):**
```bash
# In ~/.claude/scripts/close-feature.sh, after merge success:
inferred_domain=$(detect_domain_from_diff)
if [ -n "$inferred_domain" ]; then
  echo "↻ Re-scoring domain: $inferred_domain"
  # Trigger /prod-ready domain $inferred_domain in next claude session
  echo "domain:$inferred_domain" >> docs/prod-ready/post-merge-queue.txt
fi
```

On next session, prod-ready scan picks up queue and re-scores affected domains automatically.

## Heartbeat Integration

Add to `~/dev/second-brain-v2/HEARTBEAT.md`:

```
- [ ] prod-ready-scan [cooldown: 7d] — Re-score all domains, alert on regression, post weekly to Telegram
```

Telegram alert format:
```
📊 prod-ready weekly
Global: 67.2% (+1.4pp vs 2026-05-19)
Top mover: scheduling +7.1pp
⚠ Regression: contracts -1.1pp (axis 9 broke after Phase 7d merge)
Next P0: live-invoke-scheduling (2h, sonnet)
Spine refresh queue: 2 domains
```

## Production-Ready Threshold

When global ≥ 95% AND zero P0 gaps AND all domains ≥ 85% AND zero CRITICAL audit findings:
1. Emit Telegram + activity-log entry: `🎯 PRODUCTION-READY THRESHOLD REACHED`.
2. Draft `preview → main` PR body with completion snapshot per ADR-0265 template.
3. Block further `/prod-ready next` recommendations until Pontus signs off on the threshold — the skill stops driving once the destination is reached.

## Driving the Project (the "active" part)

This skill is the orchestrator's nightstand clock. Use it like this:

| Cadence | Command | Purpose |
|---|---|---|
| Session start | `/prod-ready` | Where are we, what's first today |
| Mid-session, choosing next sortie | `/prod-ready next` | One recommendation, phrased as "Skal jeg X?" |
| After every `/close-feature` merge | `/prod-ready domain <inferred>` | Confirm needle moved as expected |
| Weekly (auto via heartbeat) | `/prod-ready scan` | Full rescore, regression alert |
| Before campaign → development merge | `/prod-ready domain <touched>` | Spot-check before pulling trigger |
| When stuck | `/prod-ready gaps --blocking` | Reveal hidden cross-domain blockers |

## Common Pitfalls

- **Scoring inflation (axis = 1 default trap).** Force 0 or 2 wherever possible. "Mostly done" = 0 until the last criterion is met. Axis 1 only when a criterion-set is genuinely half-met (e.g. 3 of 5 roles have journeys, but 2 missing).
- **Stale axis 14 self-scoring.** Spine score depends on domain-steward's verdict. If you score axis 14 by reading the spine yourself, you reproduce domain-steward logic — wrong. Delegate by reading the existing `_DASHBOARD.md` row.
- **Counting tests by file existence only.** A spec file exists ≠ the test passes. Run axes 8 + 11 (test + typecheck) in scan; axis 10 (E2E) is presence-only because running all E2E in scan is too slow — pair with a separate `/prod-ready e2e-run` later if needed.
- **Mobile-N/A miscounting.** When the domain is web-only per ADR-0133, axis 6 auto-2 with `mobileScope: "web-only"` flag. Do NOT score 0 — that drags % down for a non-defect.
- **fleetQueue staleness.** Queue is derived from state.json at scan time. After any merge, re-scan the affected domain before consuming the queue — otherwise you recommend already-done work.
- **state.json conflicts on parallel sub-sorties.** Treat state.json as single-writer (orchestrator). Never let two sub-sorties write simultaneously. Use `/prod-ready domain <x>` strictly post-merge.
- **OOM during scan (axes 8 + 11).** `TURBO_CONCURRENCY=1` + `free -h ≥ 6500Mi` pre-check. L-WSL2-OOM, 5+ occurrences. Kill sibling tsc/expo processes before scan.
- **Hardcoding the domain list.** Always `ls docs/domains/` at runtime — list grew from 19 to 21 between drafts; will grow more.
- **Treating prod-ready as report-only.** This skill is supposed to DRIVE. If `/prod-ready next` is never invoked, prod-ready degrades into a passive dashboard — defeats the purpose.

## Red Flags — STOP and re-verify

- Global completion jumps > 5pp in a single scan → suspect scoring bug, not real progress. Diff axes vs previous scan.
- Domain reports 100% but no Playwright spec ran in last 30 days → axis 10 is presence-only; manually run before claiming done.
- `/prod-ready next` recommends the same sortie twice across two scans → sortie failed silently OR scoring criterion ambiguous. Audit the axis definition.
- state.json mtime > 7d → cached results unreliable. Force `scan`.
- Spine refresh queue grows monotonically across scans → domain-steward not being run; stop and run it before next prod-ready recommendation.

## First Run Protocol

If `docs/prod-ready/state.json` does not exist:
1. Create `docs/prod-ready/` directory.
2. Run full `scan`.
3. Verify discovered domain list matches `docs/domains/_DASHBOARD.md` rows. Surface any mismatch (folder without row, or row without folder) as alert.
4. Write `state.json`, `DASHBOARD.md`, per-domain files, `history.jsonl` (first line).
5. Print Pontus one sentence: *"Initial scan: global X%. Top P0: <name> (Y%). Skal jeg ta sortie <Z>? Rationale: <one line>."*

## Skill Cooperation Map

| Other skill | How prod-ready interacts |
|---|---|
| `domain-steward` | Reads `_DASHBOARD.md` rows (axis 14). Queues `update <x>` when code-newer-than-spine detected. Never writes to `docs/domains/`. |
| `adr-contract-audit` | Consumes `docs/audits/<latest>/00-SYNTHESIS.md` for axis 13. Triggers full audit if last audit > 14d. |
| `smartout-page-polish` | Axis 12 criteria match this skill's 8-phase definition. Reference its checklist; don't duplicate. |
| `local-ci-before-pr` | Independent — runs on PR open. prod-ready doesn't gate PRs, prod-ready gates *campaign merges* and *prod release readiness*. |
| `deploying` | When Production-Ready Threshold hit, prod-ready surfaces the threshold but `deploying` skill executes the actual `preview → main` PR. No overlap. |
| `heartbeat` | Weekly `prod-ready-scan` job. Drift-check is for env/migration parity; prod-ready is for feature completion. Complementary. |
| `run-council` | When a sortie is deemed load-bearing by prod-ready (touches 2+ frozen-4 boundaries, or affects > 3 axes), prod-ready recommends `/run-council` BEFORE the sortie ships. |

## Rationalizations Table (continuous learning)

Captured from real loop iterations. Add a row every time an agent rationalizes around the rubric. Quote the rationalization verbatim; add the counter-rule.

| Iteration | Rationalization | Counter-rule |
|---|---|---|
| 2026-05-26 bootstrap | "Domain has 'X migrations + Y capabilities + UI live' in prose → axis 2/3/5 all = 2" | False. Prose summary ≠ axis criteria. Score axis 2 = 2 only if `database.types.ts` regenerated AND RLS dual policies exist. Default to 1 (partial) when uncertain in lite scan; mark `scanMode: "lite-bootstrap"` so reader knows to discount. |
| 2026-05-26 bootstrap | "I read fn_list_my_tasks migration to derive task source-table columns → I can write a live-invoke script that asserts those columns" | False. Migration files describe what was created at one point in time; subsequent migrations rename, drop, restructure. ALWAYS grep `packages/supabase/src/database.types.ts` for current Row shape BEFORE writing select-lists in live-invoke. Migration-derived columns triggered 4 immediate failures on first run (`session_id` vs `department_session_id`; personal_task missing `description`+`assigned_to`+`completed_at`; emma_task `profile_id` not `assigned_to`; schedule_day_task `schedule_day_task_id`+`label`+`task_status`+`shift_date`). This is the L-0348 family in microcosm — the scaffold caught itself on first run, which is exactly how it is supposed to work. |
| 2026-05-26 bootstrap | "Axis 9 scores 0 for all 20 domains → the gap is in every domain → 20 separate sorties needed" | False. The systemic axis 9 gap has TWO classes: (A) scaffold absence (one-time fix: `scripts/live-invoke/` dir + `_lib.mjs` + `_template.mjs` + `_runner.mjs` + 1 ref impl) and (B) per-domain script absence (one sortie per domain after scaffold). Closing (A) unlocks all 20 axis 9 scoring paths but does NOT move any domain's axis 9 score from 0 → 2; that requires (B). prod-ready DASHBOARD must distinguish these two gap classes — recommending (B) before (A) is shipped is wasted work. |
| 2026-05-26 iter-2 | "Each live-invoke per-domain sortie estimated 0.5h" | Empirically wrong: actual time for sonnet-dispatched per-domain script was 0.04–0.07h (3 of 3 GREEN first run, parallel-dispatched). The original 0.5h estimate assumed sequential, human-paced work with multiple test iterations. After the scaffold is in place AND `database.types.ts` is fresh, per-domain scripts are nearly mechanical for sonnet — fleet queue must update `actualHours` per iteration so future estimates calibrate. Stale estimates lead to over-cautious dispatch (1 at a time instead of 3-5 in parallel). |
| 2026-05-26 iter-3 | "Sub-agent reports `operations/tools.ts:132 selects schedule_shift with bare 'id' column` — this is a real production bug" | FALSE. Verified by reading actual file: line 132 is inside `classifyEvent()` (no DB call); the actual DB call at line 71 selects `employee_id` only. Grep across `packages/ai/src/` for `.from("schedule_shift").select("...id...")` returned ZERO matches. The sub-agent hallucinated a finding while doing otherwise correct work (its OWN script GREEN-passed and the columns it used were real). **Rule: every sub-agent claim about production code must be re-verified by orchestrator with file:line read OR grep before being recorded as a finding.** Sub-agent's script-internal claims (its own pass/fail counts) are trustworthy because the script's exit code is independently observable; cross-file findings about UNRELATED code are NOT trustworthy because the sub-agent has no obligation to verify them. |
| 2026-05-26 iter-4 | "Domain prompt lists tables that should exist (e.g. `billing.invoice`, `billing.pricing_terms`) → write live-invoke against them" | DRIFT-RICH ASSUMPTION. Sub-agent followed L-0348 rule and grep'd database.types.ts FIRST, discovering 4 of the prompt's stated tables don't exist in stated location: `billing.invoice` is `public.invoice` (line 10876); `billing.pricing_terms` is `public.pricing_terms` (line 15103); `billing.dunning_state` doesn't exist at all (closest is `public.dunning_escalation_log` line 7691); `billing.settlement_artifact` uses `generated_at` instead of created_at/updated_at; `billing.accountant_company_grant` PK is `grant_id` not `id`. This is **the orchestrator's drift too** — the fleet queue and prompts both inherited the same aspirational schema assumption. The skill should warn: "any table reference in a prompt is a CLAIM, not a fact — sub-agent's first job is to verify table-existence + schema-location + PK-name in database.types.ts before writing select-lists." Verified by orchestrator via direct grep of types file at line numbers sub-agent provided. |
| 2026-05-26 iter-5 | "Live-invoke scripts only catch drift in DB-call paths" | UNDERESTIMATE. Iter-5 sub-agents (botsson + reports + communication) caught drift in code paths they didn't even smoke: communication/tools.ts:223 filters `channel.is_active=true` but real column is `is_archived` (channel Row line ~3xxx); reports/preview-report.ts:31 selects `department.location_id` but real department Row has no such column. These would have shipped silently OR PGRST-errored at runtime — the live-invoke smoke didn't directly exercise them, but the SCHEMA GREP done while WRITING the smoke surfaced the divergence because the sub-agent compared all references to the real types. **Emergent benefit: live-invoke authoring is a passive audit of every other capability tool that touches the same tables.** Skill should encourage sub-agents to flag any drift they notice while reading database.types.ts, even if outside their smoke scope. |
| 2026-05-26 iter-8 | "L-0287 phantom telemetry is per-domain — Lovsen has 6 of 9 phantom, the others probably similar" | UNDERESTIMATE BY 10X. Iter-8 haiku full sweep across `packages/telemetry/src/registry.ts` (858 events) found **252 phantom events — 29.3% systemic drift**. Top: contract 29, ops 14, channel 13, lovsen 8, payroll 7, auth 5. Lovsen is NOT the outlier — it's near-average. This is endemic. **Lesson: when a single domain shows a class of bug, the orchestrator's intuition should be "scan the full fleet for the same class" not "fix the visible domain". One scan-only haiku finds the systemic shape; per-domain remediation can then parallelize.** Persist scan output to docs/prod-ready/ for future reference (not /tmp). Estimated 40-60h aggregate for full L-0287 closure across 5 parallel sorties. |
| 2026-05-26 iter-9 | "252 phantom events all need emit() injection" | OVERESTIMATE. Iter-9 remediation revealed 4 distinct phantom classes the static grep didn't distinguish: **(A) TRUE PHANTOM** — TS code path exists, missing emit() — fix by injection (6 of 12 attempted closed). **(B) SQL-NATIVE** — emit happens via SQL trigger writing to `engine_event` table directly, never goes through `emit()` (2 of 7 payroll phantoms). Static grep misses these because TS never calls emit() — they're correctly wired in SQL. **(C) ASPIRATIONAL** — event registered but the producing code path doesn't exist yet (5 payroll, 3 lovsen). Either ship the feature OR remove from registry. **(D) CLIENT-SIDE / NO-SERVER-INTERCEPT** — event semantically belongs to a client action with no server hook (3 auth events: signed_in/out/signup_failed). Requires architecture work to add server intercept. **Plus CRUFT** — duplicate registry entries from legacy (auth `logged_in` vs `signed_in`). True injectable phantom rate is probably ~40-50% of the 252, not 100%. Update the phantom-report methodology: re-scan with awareness of (B)(C)(D) before sizing remediation work. **Skill update: don't treat scan output as flat "fix list" — first triage into A/B/C/D/cruft classes.** |

## Discovered Traps (record verbatim, fix once, share forever)

- **Lite-bootstrap RAM trap** (2026-05-26): WSL2 baseline RAM is 5.5Gi when claude-code session is active + sibling tsc/expo processes running. Skill threshold of 6500Mi for axes 8 + 11 is correct but means the *first* scan almost always runs in lite mode. Document `scanMode` in state.json so consumers know which axes are heuristic vs measured. Do NOT mark axes 8/11 as 0 when skipped — score 1 (unknown-but-presumed-functional) and surface in alerts.
- **Domain count is dynamic** (2026-05-26): Skill draft assumed 19 domains; spine grew to 20 (added `bootstrap`, `botsson` since spec). Always `ls docs/domains/ | grep -v '^_'` at scan time. Never hardcode in state.json `domainCount`.
- **Reference impl as living proof** (2026-05-26): The first reference live-invoke script caught 4 column drifts on its first run — but the drifts were in *the test's own assumptions about column names*, not in production code. This is still success: it proves the scaffold catches L-0348-class issues, AND it teaches future authors to grep `database.types.ts` before writing select-lists. Document the catch in the script's own header comments — it is the proof-of-life for the scaffold.
- **state.json mid-scan corruption risk**: Skill says "single-writer orchestrator". Confirmed: if I write `state.json` then re-run `/prod-ready domain X` in the same turn, the second invocation overwrites in-progress work. Mitigation: each scan must complete + write atomically before next can start. Future enhancement: write to `state.json.tmp` then `rename` for atomicity.
- **Parallel-sonnet fleet dispatch is the unlock** (2026-05-26 iter-2): 3 sonnet sub-sorties for `live-invoke-{scheduling,payroll,contracts}` ran in parallel with 0 conflicts (different files, shared scaffold). All 3 GREEN first run. Wall-clock ~4 minutes for 3 domains × 12-14 assertions each. The skill should DEFAULT to parallel-dispatch when the next 2-5 fleet items are file-independent + low-risk (live-invoke scripts, telemetry registry additions, page-polish view-emit injections). Sequential dispatch is for cross-cutting refactors only.
- **Auto-drift caught by parallel dispatch** (2026-05-26 iter-2): payroll sub-sortie caught a real docstring↔schema drift (`payroll_system_id` in tool docstring, `employee_number` in DB) before writing the script. This is L-0287 family (docs vs reality). prod-ready's fleet dispatch is becoming a passive drift-finder — every per-domain script written is a fresh scan for the L-0287/L-0348 class. Worth flagging this as an emergent benefit of axis 9 scaffold.

## Testing Debt (transparency)

This skill was shipped without the full RED-GREEN-REFACTOR baseline test required by `writing-skills` protocol. Rationale: action-mode build under owner directive; baseline scenarios would have delayed an actively-needed tool.

**Status 2026-05-26 (post-iteration-1):** First real loop iteration surfaced 4 rationalizations + 4 traps (captured above). Testing-debt partially repaid via real-world iteration rather than synthetic baseline scenarios. Continue capturing rationalizations on each loop iteration — three more iterations should fully close the debt.
