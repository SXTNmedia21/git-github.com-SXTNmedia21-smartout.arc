---
name: stage-engine compose keys
description: How to run stage-engine container with correct local Supabase JWT keys when op:// refs are unresolvable
type: reference
---

## Problem

`infra/.env.template` uses `op://smartout_ai/Supabase/service_role_key` references. Without `op run`, these expand to literal `op://...` strings (~41 chars). The stage-engine Supabase admin client then gets an invalid JWT causing `Expected 3 parts in JWT; got 1` on every row fetch.

**Symptom:** `[mission-pool] row fetch error — skipping` with JWT error. Mission never reaches 'complete'.

## Solution

Write actual local dev JWT keys to `infra/.env.local` (gitignored per `infra/.gitignore`). These are the well-known Supabase local demo JWTs (iss: supabase-demo, not production secrets).

```bash
SUPABASE_ANON_KEY=$(grep "^SUPABASE_ANON_KEY=" apps/e2e/.env.local | cut -d= -f2-)
SUPABASE_SERVICE_ROLE_KEY=$(grep "^SUPABASE_SERVICE_ROLE_KEY=" apps/e2e/.env.local | cut -d= -f2-)

cat > infra/.env.local << EOF
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
EOF
```

Then start with both env files:
```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.override.yml \
  --env-file .env.template \
  --env-file infra/.env.local \
  up --no-deps -d stage-engine
```

## Workers directory issue

When `mission-pool-slot.ts` is added to `src/workers/`, the Docker build cache may serve a final stage COPY layer that predates the workers/ dir. Symptom: no `[mission-pool] slot 1 listening` log at startup.

**Fix:** Force full rebuild with `--no-cache`:
```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.override.yml \
  --env-file .env.template \
  build --no-cache stage-engine
```

Then start with both env files as above.

## Verification

```bash
docker exec infra-stage-engine-1 sh -c 'echo "SRK_LEN=${#SUPABASE_SERVICE_ROLE_KEY}"'
# Must be 164, not 41
docker logs infra-stage-engine-1 | grep mission-pool
# Must show: [mission-pool] slot 1 listening on mission_dispatch
```
