---
title: "Journey — Enforced Deployment Pipeline"
status: done
created: 2026-05-03
updated: 2026-05-03
module: cross-cutting
tags: [journey, deployment, enforcement, drift, smoke]
---

# Journey: Enforced Deployment Pipeline (ADR-0265)

Three flows. Each flow has one purpose. Together they make every deploy
attempt either green-and-shipped, or red-and-blocked-with-a-clear-reason —
no in-between.

---

## Journey: Admin — Promote development → preview (HOP A)

**Precondition:** Feature branches merged to `development`. Local repo on
`development`, clean tree. `VERCEL_TOKEN` available via 1Password.

1. Admin runs `op run --env-file=.env.template -- ./infra/scripts/promote-preview.sh`
   → System runs Stage 1 (4 foundational gates: sync, GH Actions green,
   Vercel READY, FF possible) → Admin sees per-gate status
2. System (if Stage 1 green) FF-pushes `preview` → husky pre-push re-runs
   lint + typecheck + ancestry → push completes
3. System runs Stage 2: `smoke-probe.sh preview` against Vercel web,
   Vercel landing, Supabase REST, Edge Functions → Admin sees green/red
   per surface
4. System (if smoke green) tags `lkg-preview-<sha>` and pushes the tag →
   activity-log records `promote-preview: lkg-preview-<sha> smoke green`
5. System prints next step: `gh pr create --base main --head preview --template preview-to-main.md`

**Postcondition:** `preview` branch at the new SHA, smoke green confirmed,
LKG tag pushed, activity-log updated. Admin has a rollback target.

**Error paths:**
- Stage 1 Gate 2 red (CI not green) → fix the failing workflow on
  development, push, retry
- Stage 1 Gate 3 red (Vercel not READY) → wait for Vercel deploy or fix
  Vercel build, retry
- Stage 1 Gate 4 red (preview diverged) → manual recovery via
  `git reset --hard origin/development` + force-push (no ruleset on
  recovery branch); see memory `reference_squash_merge_recovery.md`
- Stage 2 smoke red → preview deploy is broken at the new SHA. Investigate
  via Sentry + Vercel logs. No tag is created. Fix forward on development,
  retry promote.

---

## Journey: Admin — Release preview → main (HOP B)

**Precondition:** HOP A succeeded. `lkg-preview-<sha>` exists. Operator has
validated the preview deploy URL behaviorally.

1. Admin runs `gh pr create --base main --head preview --template preview-to-main.md`
   → System opens PR with the enforcement checklist pre-filled
2. Admin fills the checklist: paste preview URL, paste LKG tag, confirm
   smoke result, confirm migration state, acknowledge Edge Function diff
3. System runs the 14 required CI checks → Admin sees pass/fail per check
4. Admin (only if all 14 green and checklist complete) merges via
   rebase-merge or squash-merge from GitHub UI
5. System auto-deploys Vercel production, auto-applies Supabase migrations,
   runs the `Edge Functions` CI job which deploys changed functions to
   prod → Admin sees deploys complete in respective dashboards
6. System runs `Migration State` CI gate on the main push → Admin sees
   green if prod schema matches code, red if drift (= MIGRATIONS_FAILED
   on prod)
7. Admin runs `op run -- ./infra/scripts/smoke-probe.sh production` →
   Admin sees per-surface smoke
8. Admin (only if needed) SSH to droplet and runs `infra/scripts/deploy.sh`
   for any service-layer changes

**Postcondition:** Production updated, Edge Functions deployed, migrations
applied, smoke green. Activity-log records the release.

**Error paths:**
- 14 checks not green → branch protection blocks merge, admin fixes red
  check or aborts release
- Checklist box unchecked → admin completes box or aborts (no enforcement
  beyond template; review discipline)
- Post-merge `Migration State` red → main is in MIGRATIONS_FAILED. Admin
  fixes via Supabase dashboard, opens hotfix PR with the corrected
  migration. Memory `reference_supabase_mcp_rules.md` documents recovery.
- Post-merge smoke red → roll back via the per-surface buttons in the PR
  template:
  - Vercel: `vercel rollback <url> --token "$VERCEL_TOKEN"`
  - Droplet: `ssh root@164.92.176.42 "cd /root/dev/smartout.ai && git checkout <LKG-SHA> && ./infra/scripts/deploy.sh"`

---

## Journey: System — Drift response (continuous review)

**Precondition:** Heartbeat job `drift-check` is enabled.

1. Heartbeat (every 24h) runs `infra/scripts/drift-check.sh` → System
   produces 4 results: vercel-manifest-baseline, env-ts-vs-known-keys,
   edge-fn-secrets, droplet-env-vs-manifest
2. System (if any check FAIL) sends Telegram alert via
   `~/.claude/scripts/heartbeat-notify.sh` → Admin receives
   `drift-check: N drift(s) — first: <name>`
3. System (always) appends to activity-log:
   `drift-check: green` or `drift-check: N drift(s)`
4. Admin (on alert) opens `infra/scripts/drift-check.sh` output → reads
   the failed check name and detail line
5. Admin chooses fix path:
   - manifest count drop → restore deleted manifest entries; sync
   - env.ts key not in manifest/template → add to one of the two; sync
   - Edge Function secret missing → `supabase secrets set <KEY>`
   - droplet env-var missing → `./infra/scripts/sync-env-to-droplet.sh --remote`
6. Admin re-runs `./infra/scripts/drift-check.sh` until all green → System
   logs `drift-check: green` resolved

**Postcondition:** Drift resolved within next heartbeat window OR Linear
ticket auto-opened with `deploy-drift` label if alert ignored 7+ days.

**Error paths:**
- Drift-check itself errors (exit 2) → SKIP recorded, admin checks why
  (missing tool, no auth, network)
- SSH unreachable for droplet check → `--skip-droplet` flag, schedule
  recheck when droplet reachable
- Supabase secrets unreadable from CI context → check runs locally only
  via heartbeat; not part of CI gate
