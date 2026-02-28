# Vercel Deploy — Handoff

> Session: 2026-02-28 | Plan: ADR-0020 Vercel Fresh Deploy

---

## What Was Done

### Builds Working

Both Vercel projects build successfully from the monorepo.

| Project            | Root Dir       | Build Command                                      | Status         |
| ------------------ | -------------- | -------------------------------------------------- | -------------- |
| `smartout-web`     | `apps/web`     | `cd ../.. && npx turbo run build --filter=web`     | 43 pages built |
| `smartout-landing` | `apps/landing` | `cd ../.. && npx turbo run build --filter=landing` | 24 pages built |

Install command for both: `cd ../.. && pnpm install`
Ignored Build Step for both: `npx turbo-ignore --fallback=HEAD^1`

### Infrastructure

- Production Supabase (`yljaglomadbhyqpcigff`) — all 17 migrations pushed
- Env vars set in Vercel from 1Password vault
- `.vercelignore` fixed (patterns anchored with `/` to prevent matching `apps/landing/src/app/docs/`)
- `pnpm` updated to 9.15.9, lockfile regenerated

### Code Changes (Committed)

- `ff0306c` — fix: bump pnpm to 9.15.9 and remove webpack diagnostics
- `8edcf89` — fix: keep apps/e2e in Vercel builds to fix pnpm workspace resolution
- `2e63a9a` — fix: anchor .vercelignore patterns to root with leading /
- `85cfd0d` — fix: regenerate pnpm-lock.yaml with pnpm 9.15.9

### Code Changes (NOT YET Committed)

- `apps/web/src/lib/security.ts` — removed `x-forwarded-host` from SUSPICIOUS_HEADERS
- `docs/learnings/0008-vercel-x-forwarded-host-400.md` — learning record
- `docs/learnings/0000-learning-log.md` — updated index

---

## What's Blocking Production

### 400 Bad Request (web) — FIX READY, NEEDS COMMIT + PUSH

**Root cause found and fixed.** `detectSuspiciousRequest()` in `apps/web/src/lib/security.ts` flagged `x-forwarded-host` as suspicious. Vercel's edge network **always** sets this header. Every production request returned 400.

**Fix:** Removed `x-forwarded-host` from `SUSPICIOUS_HEADERS`. File edited, not yet committed.

**Action needed:**

1. Commit the security fix + learning record
2. Push to trigger Vercel rebuild
3. Verify web app loads at production URL

### Landing 400 — Likely NOT the Same Issue

Landing has **no middleware**. If it's still returning 400 after web is fixed, check:

- Is the Vercel project pointing to the right Root Directory (`apps/landing`)?
- Are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set?
- Try hitting the landing URL directly after push — it may have been showing a cached error

---

## What's Left (from Original Plan)

| Task                                    | Status             | Notes                                                                         |
| --------------------------------------- | ------------------ | ----------------------------------------------------------------------------- |
| Task 1: Create smartout-web project     | Done               |                                                                               |
| Task 2: Create smartout-landing project | Done               |                                                                               |
| Task 3: Configure domains               | **Not started**    | Need to add `app.smartout.ai`, `smartout.ai`, `www.smartout.ai` + DNS records |
| Task 4: Ignored Build Step              | Done               | `npx turbo-ignore --fallback=HEAD^1`                                          |
| Task 5: Verify builds                   | **Partially done** | Builds pass, runtime 400 needs fix pushed                                     |
| Task 6: Clean up webpack diagnostics    | Done               | Committed in `ff0306c`                                                        |

### Other Pending Work

- **104 uncommitted files** from previous sessions (docs pages, schedule components, dashboard changes) — need to be organized and committed
- **Turbo env var warnings** — add env vars to `turbo.json` `globalEnv` for proper cache hashing
- **Sentry warnings** — instrumentation file and global error handler not configured
- **Update ADR-0020** — plan said Root Directory = `.`, reality is Root Directory = app dir
- **Local `.vercel/project.json` cleanup** — `apps/landing/.vercel/project.json` points to "web" (wrong, but gitignored so only affects CLI deploys)

---

## Immediate Next Steps

1. **Commit + push** the `x-forwarded-host` fix
2. **Verify** both sites load after Vercel redeploy
3. **Configure domains** (Task 3 from plan)
4. **Batch commit** the 104 uncommitted files
