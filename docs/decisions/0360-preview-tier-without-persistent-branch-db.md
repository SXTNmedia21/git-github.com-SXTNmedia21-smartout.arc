---
title: "Preview tier without persistent Branch DB — Supabase smoke routes via CI on-demand"
id: ADR-0360
status: accepted
layer: decision
created: 2026-05-17
updated: 2026-05-17
supersedes: []
amends: [ADR-0071]
related: [ADR-0265]
---

# ADR-0360: Preview tier without persistent Branch DB

## Context and Problem Statement

ADR-0071 (2026-04-20) declared the preview tier uses a persistent Supabase Branch DB as a staging environment for migrations + Edge Functions + RLS before main. The skill body (`deploying`), the smoke-probe script (`infra/scripts/smoke-probe.sh:67`), the 1Password vault item `Supabase Preview Branch`, and `infra/scripts/sync-env-to-vercel.sh` all assume this Branch DB exists.

HOP A 2026-05-17 surfaced (L-0299, L-0300) that:

- The Branch DB ref hardcoded in smoke-probe (`rrjfrisxvrrhyzzitlxd`) returns DNS NXDOMAIN.
- The historical alternate (`cibmhhgsrdmpnmcikalu`) also returns NXDOMAIN.
- The 1Password vault item still points to the dead ref.
- L-first-prod-release-2026-05-13 had already noted both refs were gone — for ≥4 days nothing happened operationally because nothing actually depended on the preview Branch DB.

Result: the ADR-0071 narrative is fiction. HOP A cannot complete to lkg-tag (smoke RED). The pipeline contract is broken at the gate-5/gate-6 boundary.

Two ways to resolve:
- **Option A:** Re-provision the preview Branch DB. Re-establish parity. Maintain it.
- **Option B (this ADR):** Recognize 4 days of zero-impact absence as revealed preference. Drop preview Branch DB. Route Edge Function + RLS smoke through CI workflow_dispatch (on-demand throwaway Branch DB) or post-merge.

## Decision Drivers

- **Revealed preference signal:** preview Branch DB infra has been absent for ≥4 days; no operator, no CI job, no test, no automation noticed. If it were load-bearing, something would have broken.
- **Cost vs use:** persistent Branch DB is a recurring line item. Cost-justified only if used.
- **Drift surface area:** maintaining preview Branch DB = maintaining vault item, smoke-probe fallback, sync-env-to-vercel entries, migration replay flow. Four drift surfaces for a tier that nothing uses.
- **Edge Function / RLS pre-main testing IS valuable** — but doesn't need to be always-on. CI `workflow_dispatch` against a throwaway Branch DB is cheaper, opt-in, and explicit.
- **HOP A must be runnable end-to-end.** A pipeline whose gate-5 cannot pass is broken by construction. Either fix the gate or fix the requirement.

## Considered Options

1. **Option A:** Provision new persistent preview Branch DB. Update vault + smoke ref + sync-env-to-vercel. Recurring cost; maintains ADR-0071 as written.
2. **Option B (this ADR):** Drop preview Branch DB. Amend ADR-0071. Smoke for preview = Vercel-only. Edge Function + RLS pre-main testing routes through CI workflow_dispatch.
3. **Option C (deferred):** Ephemeral per-PR Branch DBs via Supabase preview integration. More work; not required to unblock HOP A; revisit if Option B's CI-dispatch path proves insufficient.

## Decision Outcome

**Chosen: Option B.**

- Matches reality. No drift between docs / infra / ADR.
- Zero recurring cost.
- HOP A unblocked: smoke-probe SKIPs Supabase preview surfaces intentionally with explicit reason ("no preview Branch DB per ADR-0360"); wrapper proceeds to lkg-tag if all non-skipped surfaces green.
- Edge Function + RLS testing not lost — they route through:
  - **CI workflow_dispatch** (opt-in, on-demand, throwaway Branch DB)
  - **Local Supabase** during dev (pgTAP, RLS check)
  - **Post-merge prod smoke** (catches Edge Function regressions before next promote)

## Rules & Consequences

### Rules

1. **`smoke-probe.sh preview`** SKIPs Supabase REST + Edge Functions surfaces when `SUPABASE_PREVIEW_REF` is empty/unset. SKIP is yellow + reason-tagged + does NOT count toward FAILED. Override: export `SUPABASE_PREVIEW_REF=<ref>` if a Branch DB has been provisioned.
2. **`smoke-probe.sh production`** behavior unchanged. Production ref is load-bearing; `SUPABASE_PROD_REF` (or `SUPABASE_REF`) empty in production env = explicit FAIL with "unexpected" message. Default `yljaglomadbhyqpcigff` at smoke-probe.sh:80 means production effectively cannot hit the empty-ref branch unless an operator explicitly nullifies the default — code path is defensive guard, not a reachable path under current defaults.
3. **HOP A `promote-preview.sh` wrapper** Stage 2 accepts smoke green when smoke-probe exits 0, regardless of how many surfaces SKIPped. SKIP ≠ FAIL.
4. **Vercel preview env vars** (Supabase URL, anon key, service role key) point to local-dev placeholder or are removed from preview shared. Preview Vercel deploys do not need live Supabase backing — they're code-rendering smoke, not data smoke.
5. **1Password vault item `Supabase Preview Branch`** archived OR marked with note: "Per ADR-0360, preview tier has no persistent Branch DB. Restore if Option C ephemeral integration adopted."
6. **CI workflow `pgtap.yml` + RLS coverage** continue to run on PR (current behavior unchanged). Edge Function regressions slip to post-merge unless explicit workflow_dispatch run; document this trade-off in `deploying` skill body.
7. **Restoration path:** If preview Branch DB must return (Option A regret), the work is: (a) unarchive 1Password vault item `Supabase Preview Branch` (if archived per Rule 5), (b) provision in Supabase Cloud, (c) `export SUPABASE_PREVIEW_REF=<new-ref>` OR update default at smoke-probe.sh:74 (`SUPABASE_REF="${SUPABASE_PREVIEW_REF:-}"` → `:-<new-ref>`), (d) update vault item URL + project ref + anon key + service role key, (e) uncomment the 8 preview Supabase manifest entries in sync-env-to-vercel.sh (smartout-web: 4 lines around 188–197; smartout-landing: 4 lines around 222–228), (f) re-run `./infra/scripts/sync-env-to-vercel.sh` (nuke-and-replace will re-add the 8 entries automatically), (g) revert ADR-0071 amendment marker + ADR-0360 amendment notes in `docs/protocols/ENV_PROTOCOL.md` + `docs/protocols/DEPLOYMENT.md`, (h) ADR-0360 amendment marking SUPERSEDED-BY-X with the new ADR ID.

### Good, because

- HOP A becomes runnable end-to-end without operator workaround.
- Empirical reality (4 days zero-impact absence) honored over aspirational ADR text.
- Reduces drift surface count from 4 to 0 in preview tier.
- Restoration path is reversible — can re-enable Option A by setting one env var.
- Skill body, scripts, ADRs all align on the same story.

### Bad, because

- Edge Function regression slips to post-merge unless operator opts into workflow_dispatch.
- ADR-0071's "preview = staging" narrative is meaningfully changed — preview now = "Vercel-only staging with Supabase routed elsewhere."
- Future contributors may assume preview Branch DB exists (per old habit) and waste time looking. Mitigation: skill body + ADR amendment + CLAUDE.md preview tier table all updated in one sortie.
- Trade-off explicit: pre-main Edge Function smoke is opt-in, not always-on. Risk acceptable per 4-day-revealed-preference data.

### Agent Impact

- **Claude (when running HOP A):** must invoke with `set -o pipefail` per L-0299; expect 2 SKIPs on preview Supabase surfaces; smoke green = exit 0 with SKIPs present.
- **Pontus + future operators:** no more "smoke RED on preview" false alarms; if Edge Function changes need pre-main verification, run CI workflow_dispatch manually.
- **CI workflows:** unchanged for now. Adjacent sortie should add `workflow_dispatch` entry to pgtap/EF workflows so manual pre-main smoke is one click.
- **`deploying` skill:** updated in same sortie — preview tier table reflects Vercel-only; HOP A Operational Traps L-0300 row marked RESOLVED.

### Amends ADR-0071

The following sections of ADR-0071 are SUPERSEDED by this ADR:
- Any reference to "persistent Branch DB `cibmhhgsrdmpnmcikalu`" or `rrjfrisxvrrhyzzitlxd` for preview tier.
- Any claim that preview tier provides pre-main Supabase Cloud parity testing.

ADR-0071 should be edited to add a header note: "AMENDED 2026-05-17 by ADR-0360 — preview tier no longer has a persistent Supabase Branch DB. See ADR-0360 for current architecture."

### Open / deferred

- ADR for ephemeral per-PR Branch DB integration (Option C) — not needed unless Option B-routing proves insufficient.
- Adjacent sortie: add `workflow_dispatch` to `pgtap.yml` + Edge Function workflows so on-demand pre-main smoke is one CLI command.
- Cost audit: confirm no Supabase plan downgrade is possible after dropping the preview Branch DB (likely no impact since the Branch DB was already gone, but verify line items).

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md` if appropriate.
