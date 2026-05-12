---
title: "Journey — stage-engine-dockerfile-payroll-export"
feature: stage-engine-dockerfile-payroll-export
branch: feat/stage-engine-dockerfile-payroll-export
created: 2026-05-12
updated: 2026-05-12
module: services
status: verified
tags: [docker, stage-engine, infra]
---

# Journey — stage-engine-dockerfile-payroll-export

## Why

Dev-merge `5dc099d02` (payroll campaign) added `@smartout/payroll-export` as runtime dep of `@smartout/ai`. Stage-engine Dockerfile didn't include the new package in COPY or build chain — `docker compose build stage-engine` failed with `Cannot find module '@smartout/payroll-export'`. Blocked live E2E verification for G3-ops + G4-guardian fixes.

## Journey 1 — Add payroll-export to Dockerfile

**Precondition:** `services/stage-engine/Dockerfile` builds chain telemetry/types/journey-ir/ai/stage-engine. payroll-export missing.

1. Add `COPY packages/payroll-export/package.json ./packages/payroll-export/` to builder stage's manifest-copy block
2. Update install line to `--filter @smartout/stage-engine... --filter @smartout/payroll-export...` so payroll-export's devDeps (@types/node) install for tsc build
3. Add `COPY packages/payroll-export/ ./packages/payroll-export/` to builder stage's source-copy block (before ai source)
4. Insert `pnpm --filter @smartout/payroll-export build` between journey-ir and ai in build order
5. Mirror prod stage: copy package.json + dist for payroll-export

**Postcondition:** `docker compose build stage-engine` completes clean. Container starts with `/health` 200.

## Live verification

Container rebuilt successfully:
```
Image infra-stage-engine Built
Container infra-stage-engine-1 Started
{"status":"ok","service":"stage-engine","version":"0.1.0"}
```

Subsequent E2E run on G3-ops + G4-guardian specs ran into a separate test-infrastructure auth flow blocker (login submit button click timeout) unrelated to this fix. That's a stale `.next-e2e-web` cache issue against recent schema changes — outside Dockerfile scope.

## Error paths

- payroll-export build fails inside container → falls back to "Cannot find module" at `@smartout/ai` build. Mitigated by including `--filter @smartout/payroll-export...` so devDeps install.
- Container starts but missing dist → falls back to runtime require failure on first stage-engine request. Mitigated by `COPY --from=builder /app/packages/payroll-export/dist ./packages/payroll-export/dist` in prod stage.
