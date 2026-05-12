---
title: "Stage-engine Dockerfile payroll-export — HANDOFF"
status: done
updated: 2026-05-12
created: 2026-05-12
module: services
tags: [docker, stage-engine, infra]
---

# Stage-engine Dockerfile payroll-export — HANDOFF

## What was built

Dockerfile fix for stage-engine to include @smartout/payroll-export in build chain. Unblocks live E2E verification for G3-ops + G4-guardian gate fixes.

| File | Change |
|------|--------|
| `services/stage-engine/Dockerfile` | Add payroll-export package.json + source COPY + install filter + build step in builder stage; mirror in prod stage |

## Decisions

### D1: `--filter @smartout/payroll-export...` (with ellipsis)
Including transitive deps. payroll-export needs @types/node from devDeps for tsc; the ellipsis suffix ensures pnpm install brings them. Without it: `error TS2688: Cannot find type definition file for 'node'`.

### D2: Build payroll-export BETWEEN journey-ir and ai
`@smartout/ai` imports payroll-export at type level. Must be built before ai. journey-ir already in correct slot before ai. Insert immediately after journey-ir.

### D3: Did NOT add payroll-calculate
`@smartout/ai` does NOT import payroll-calculate (only payroll-export). Adding it would expand container surface and risk other tsconfig conflicts (payroll-calculate uses eslint types that conflict in node:22-alpine context).

### D4: Did NOT touch tsconfig of payroll-export
payroll-export's tsconfig has `types: ["node"]` which is the correct production posture. Removing would break the package's own typecheck. The fix is to ensure @types/node is installed in container, not change the tsconfig.

## Live verification (partial)

- ✅ `docker compose build stage-engine` completes clean
- ✅ Container starts with `/health` 200
- ✅ Stage-engine version + timestamp respond
- ⚠️ E2E auth flow blocked on separate test-infra issue (login submit button timeout on stale `.next-e2e-web` cache vs recent schema changes from billing/payroll migrations). Not in scope for this sortie. Requires `.next-e2e-web` cache wipe + web rebuild before next live E2E run.

## Known follow-up

Web `.next-e2e-web` cache has stale compilation against schema before recent payroll/billing migrations. Symptom: `/login` initially 500'd with `Cannot resolve @smartout/telemetry` until workspace dists rebuilt. After rebuild, page renders 200 but auth submit click times out. Likely Supabase client auth flow needs schema-cache reload on web side too. Separate test-infra cleanup sortie required.

G3-ops + G4-guardian fixes are typechecked + spec-compiled green. Production correctness validated via tsc. Live runtime verification deferred to next-session test-infra sortie.

## Next steps

1. Merge to development.
2. Separate sortie: clean `.next-e2e-web` cache + restart web with fresh workspace dists + rerun G3 + G4 E2E.
3. Heartbeat job candidate: auto-rebuild stage-engine container after every dev-merge that touches packages/ai dependencies.

## References

- HANDOFF-g3-ops-triage-gate.md (cited blocker)
- HANDOFF-g4-guardian-ack-gate.md (cited blocker)
- Dev-merge `5dc099d02` (payroll campaign — root cause)
