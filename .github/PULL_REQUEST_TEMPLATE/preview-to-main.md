# Release: preview → main

> **One-purpose template.** Use only for `preview → main` PRs (ADR-0262).
> Open via:
> `gh pr create --base main --head preview --template preview-to-main.md`

## Operator checklist

- [ ] **Preview URL validated.** I opened the preview deployment and verified
      the changes work end-to-end.
      Preview URL: `<paste here>`

- [ ] **Smoke probe green.** I ran or confirmed:
      `op run --env-file=.env.template -- ./infra/scripts/smoke-probe.sh preview`
      Result attached or `lkg-preview-<sha>` tag exists.

- [ ] **Last-known-good rollback target identified.**
      LKG SHA: `<paste 8-char SHA>`
      Tag: `lkg-preview-<sha>` (created by promote-preview after green smoke)

- [ ] **Migration state matches prod.** No `MIGRATIONS_FAILED` on production.
      Verified via Supabase dashboard OR previous main-push CI ran the
      `Migration State` gate green.

- [ ] **Edge Functions diff acknowledged.** Either no `supabase/functions/**`
      changes in this release, OR `Edge Functions` CI job dry-run passed
      and I am ready to verify post-merge real deploy.

- [ ] **Drift check green.** Latest `drift-check.sh` run is GREEN
      (heartbeat job `drift-check` last status, or run manually now).

## Surface impact

- [ ] Vercel: web prod auto-deploy
- [ ] Vercel: landing prod auto-deploy
- [ ] Supabase: migrations auto-apply on main push
- [ ] Supabase: Edge Functions deploy via CI on main push
- [ ] Droplet: I will run `infra/scripts/deploy.sh` after merge OR none of
      `services/`, `infra/docker-compose*.yml`, `packages/` services
      consume changed

## Rollback plan (one-click per surface)

If post-merge smoke goes red:

```bash
# Vercel — promote previous READY deploy
vercel rollback <previous-deploy-url> --token "$VERCEL_TOKEN"

# Droplet — rebuild from previous image tag
ssh root@164.92.176.42 "cd /root/dev/smartout.ai && \
  git checkout <LKG-SHA> && ./infra/scripts/deploy.sh"

# Migrations — manual reverse via Supabase MCP/dashboard
# Edge Functions — supabase functions deploy from <LKG-SHA>
```

## Required CI checks (14 total — all must be green)

- Format Check, Lint, Type Check
- Vitest (packages), Build Health, Build, API Docs Go-Live Guard
- 4× Docker Build
- **Enforce branch flow** (added 2026-05-03 per ADR-0262)
- **pgTAP Suites** (added 2026-05-03 per ADR-0262)
- **authority-seed-parity** (added 2026-05-03 per ADR-0262)

`Edge Functions` and `Migration State` are **non-blocking** for this PR
(they run on main push). They protect the next release, not this one.
