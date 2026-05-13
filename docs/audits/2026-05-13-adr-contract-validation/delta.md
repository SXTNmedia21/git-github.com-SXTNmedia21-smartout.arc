---
title: "Audit Delta 2026-05-13 vs 2026-05-10"
status: complete
created: 2026-05-13
updated: 2026-05-13
module: audit
tags: [audit, delta, adr]
---

# Delta vs 2026-05-10 baseline

| Metric | Count |
|---|---|
| new_critical | 3 |
| new_high | ~22 |
| regressed | 4 |
| closed | 7 |
| unchanged_open | ~18 |

## New CRITICAL (3)

| ID | File:Line | ADR | Why CRITICAL |
|---|---|---|---|
| F-DB-09 | `department_session.sql:65-73` + `session_infrastructure.sql:40-48` + `deviation_shift_approval.sql:92-95` | 0299 | Three D6 sister tables retain `FOR ALL USING(...)` no-WITH-CHECK shape. Forgeable workspace_id on INSERT/UPDATE. `deviation` has no role gate. |
| F-OB-10-01 | `apps/web/src/app/onboarding/{WizardContext.tsx,hooks/*,sections/*,components/*}` | 0041 | ~17 legacy scroll-wizard files left as importable dead code. Would throw on render. 3 perform ADR-0123-violating EF calls if revived. |
| F-CL-11 | `packages/ai/src/capabilities/legal/index.ts:57` | 0163 | `allowedChannels: ["chat","voice","system"]` on §14-6 / AML capability. L2 defence-in-depth removed. |

## Regressed (4)

| Item | Baseline | Now |
|---|---|---|
| ADR-0204 SS-5 backlog | 7 hooks | 13 hooks + 2 brand-new sites (EventDetailPanel + OversiktTab) |
| F-PD-03 palette bypass | Drift | Trending worse |
| L-0083 mobile baseline | 3 sites | Never remediated, 2 new sites added |
| F-JR-02 UltravoxVoice type | Open | Still present despite Phase E completion claim |

## Closed (7)

| ID | What closed |
|---|---|
| F-AC-02 | Landing wizard voice → deleted endpoint (resolved) |
| F-SE-01 | Voice cross-tenant workspace derivation (sealed via Priority-2 BFF-validated workspace_context) |
| F-EF-01 | analyze-setup-documents — SMA-350/ADR-0151 added real bearer+workspace+path auth |
| F-JR-01 | 5 voice journey statuses (now verified/deferred) |
| F-ME-02 | Voice journey spec references (point to existing specs + Phase F sortie 4 ref) |
| F-CT-01 | billing-query L-0176 docstring/body drift (cleared) |
| F-OB-04 | Partial — BFF route exists but consumer wiring still pending |

## Unchanged Open (~18)

ADR-0204 voice-tool 3 writes (now confirmed 2 sites). F-EF-02a wizard-definition.ts ADR-0179 violation. F-CL-09 personal/tools.ts gate+direct-write. F-WH-03 sendgrid counter idempotency. F-WH-04 call_log UNIQUE missing. F-MO-01/02/03 L-0083. F-ME-01 zero mission E2E. F-ME-07 mr-botsson orb no E2E. ADR-0152 effectively superseded but still `proposed`. ADRs 0220/0260/0274/0278 accepted with zero code surface. P-001 permaskipped.

## Warnings

- **`regressed: 4` > 0 in HIGH-equivalent** — if invoked from CI, exit non-zero.
- **Critical count 0 → 3** in 3 days is the wrong trendline. All 3 are sister-surface gaps to issues we believed closed (F-DB-09 ⇄ ADR-0299 Sortie A; F-OB-10-01 ⇄ Phase E onboarding migration; F-CL-11 ⇄ ADR-0078 L3 inversion).
