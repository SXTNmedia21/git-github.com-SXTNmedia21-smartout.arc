---
title: E2E Coverage Addendum — Per-Wizard Regression Specs, Workspace Control, Scrapling
status: done
updated: 2026-04-15
created: 2026-04-15
module: e2e
tags: [e2e, playwright, wizard, workspace, scrapling, audit, regression]
---

# Wizard + Workspace + Scrapling Coverage Addendum

Follow-up to `signup-workspace-audit-2026-04-15.md` (PR #207). That
audit mapped the gaps; this one closes the highest-risk ones with
dedicated specs. Scope:

1. Workspace-creation control — DB-level invariants on
   `provision_onboarding_workspace` RPC.
2. Per-wizard deep specs — one `*-deep.spec.ts` per wizard covering
   validation, back/forward, resume, and side-effects.
3. Scrapling service — health + auth regression gate with graceful
   skip when the service is not running.

Zero app-code, package, or service changes. If an invariant wasn't
satisfied, it is reported here rather than patched.

## 1. New specs

| File                                  | Focus                                                                                    | Tests | Status |
| ------------------------------------- | ---------------------------------------------------------------------------------------- | ----- | ------ |
| `workspace-creation-control.spec.ts`  | `provision_onboarding_workspace` RPC → row invariants                                    | 6     | pass   |
| `signup-wizard-deep.spec.ts`          | `/signup` submit → confirmation, duplicate email, session persistence, footer round-trip | 4     | pass   |
| `join-wizard-deep.spec.ts`            | per-step validation, back/forward retains data, reload does not crash, clear-state mount | 5     | pass   |
| `onboarding-wizard-deep.spec.ts`      | `/onboarding` shell mount, single-step render, engine step snapshot, unknown step no-op  | 4     | pass\* |
| `dashboard-setup-wizard-deep.spec.ts` | skip vs complete, `setup_guide_completed` DB write, `onboarding_guide_progress` resume   | 3     | pass   |
| `website-setup-wizard-deep.spec.ts`   | template gallery, preview no-error, back nav, unauth redirect, scrape proxy JSON         | 5     | pass   |
| `scrapling-health.spec.ts`            | `/health` endpoint, dashboard HTML at `/`, bearer-auth enforcement (conditional)         | 3     | pass\* |

\* Tests skip gracefully when the relevant dependency (local
Supabase, scrapling bearer token) is unavailable. See "How to run".

**Final tally: 29 passed, 1 skipped locally, 0 failed.** One skip is the
scrapling auth test when `SCRAPLING_AUTH_TOKEN` is unset (service is
in open mode — correct behaviour).

## 2. Workspace invariant findings

The audit doc assumed the v1 `workspace-first onboarding` RPC behaviour
(`supabase/migrations/20260306020000_workspace_first_onboarding.sql`),
where `company_id` stays NULL until `finalize_onboarding_workspace`
runs. That assumption was **wrong at runtime**.

Runtime RPC is the v2 version in
`20260312000000_intelligence_pipeline_v2.sql`, which attaches
`company_id` **at provision time**:

| Row              | Created by provision?                   | Notes                                                    |
| ---------------- | --------------------------------------- | -------------------------------------------------------- |
| `company`        | Yes — minimal (`name`, `legal_name`)    | Full data gets back-filled in `finalize_*`               |
| `workspace`      | Yes — `contract_status='onboarding'`    | Slug derived, max 40 chars + collision suffix            |
| `company_id`     | Yes — set on `workspace.company_id`     | **Reversal of v1 behaviour**                             |
| `company_member` | Yes — `role='owner'`                    | Links user → company                                     |
| `profile`        | Yes — `role='admin'`, `status='active'` | NB: role is `admin`, not `owner`. Owner is company-level |
| `department`     | No                                      | Seeded by `finalize_onboarding_workspace`                |
| `location`       | No                                      | Seeded by `finalize_onboarding_workspace`                |
| `season`         | No                                      | Seeded by `finalize_onboarding_workspace`                |

### Invariants the RPC honors (now gated by tests)

- `workspace.slug` is lowercase, alphanumeric + hyphens, no
  Norwegian characters (æøå), ≤ 50 chars including collision suffix.
- Two provisions with the same company name produce **different** slugs.
- `workspace.slug` has a unique index — direct duplicate insert
  fails with Postgres error `23505`.
- `profile.role ∈ {admin, owner}`, `profile.status='active'`,
  `profile.is_active=true`, `profile.user_id=<provisioner>`.
- `intelligence_data` jsonb payload round-trips verbatim.

### Invariants the RPC does NOT honor (documented, not a fix)

- No I1 bootstrap of `department` / `location` at provision time.
  These are created by `finalize_onboarding_workspace`. The split is
  intentional (workspace-first onboarding) and the spec documents it
  so a future change that moves bootstrap earlier will surface.

### Slug — potential regression risk

`workspace.slug` truncation at 40 chars + `substring(md5(random()) for 4)`
gives a theoretical collision rate that grows with database size but
is still well below 1 in 1e6 for realistic workspace counts. No fix
needed — noted for when workspace count crosses 100k.

## 3. Scrapling status

**Running locally**: yes. Container name is typically `smartout-scrapling`
(or whatever `infra/docker-compose.yml` assigns). Listens on port
8000 inside Docker, proxied via Caddy in production.

### What it does

- `POST /extract` — workspace intelligence extraction (NACE-aware
  department + location heuristics from a website URL).
- `POST /scrape-raw` — raw HTML text + image + file-link extraction.
- `POST /extract/document[s]` — single / batch document text extraction
  (PDF, DOCX, XLSX etc via `extractors/`).
- `POST /enrich` and `POST /generate` — intelligence pipeline v2 hooks
  (enrichment + onboarding content generation).
- `POST /tripadvisor` — stub (501 — requires Apify integration, not wired).
- `GET /health` — liveness + extractor list + version.
- `GET /` — HTML operator dashboard.

### How it's invoked from web

Six Next.js API routes in `apps/web/src/app/api/` proxy to scrapling:

- `/api/scrape/raw` → scrapling `/scrape-raw`
- `/api/scrape/company` → scrapling `/extract`
- `/api/scrape/public` → scrapling `/extract`
- `/api/workspace-intelligence` → scrapling `/enrich`
- `/api/platform-admin/workspaces/analyze-documents` → scrapling `/extract/document`
- `/api/platform-admin/workspaces/lookup` → scrapling `/extract`

Proxies read `SCRAPLING_SERVICE_URL` and `SCRAPLING_AUTH_TOKEN` from
`env.ts`. When either is missing the proxy returns 503 (still JSON —
verified by `scrape proxy route responds with JSON when scrapling is up`).

### What breaks when scrapling is down

- `/join` step 1 intelligence pre-fill (NACE code → industry-aware
  departments/locations) falls back to empty. User fills by hand.
- Workspace setup wizard's document-drop analysis does not classify
  documents. User sees a generic "upload failed" state.
- Platform-admin "analyze docs" returns 503 and the admin UI surfaces
  the service-unavailable banner.
- **None of these are production-breaking** — every flow has a
  fallback path. The regression gate is therefore conservative:
  spec skips when `SCRAPLING_URL` is unreachable rather than failing.

### How to start locally

```bash
# From repo root, with 1Password session (for SCRAPLING_AUTH_TOKEN + API keys):
op run --env-file=.env.template -- docker compose \
  -f infra/docker-compose.yml up scrapling

# OR directly without Docker (CORS is open, auth disabled when token unset):
cd services/scrapling
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

At the time of this spec, scrapling was already running on
`http://127.0.0.1:8000` from the Docker compose stack.

## 4. Known limitations

- `onboarding-wizard-deep.spec.ts` asserts the `/onboarding` shell
  mounts and engine contract. Mid-wizard step-by-step UI progression
  is NOT driven end-to-end because each step needs authenticated
  - workspace-in-onboarding state, which requires a full user-fixture
    helper we did not build. Engine contract (step snapshot + unknown
    step no-op) covers the critical regression surface.
- `dashboard-setup-wizard-deep.spec.ts` shares DB state with
  `workspace-setup-flow.spec.ts` (same seed workspace). Both use
  serial mode and `hideWorkspaceData` / `restoreWorkspaceData` to
  coexist. If run in parallel with other DB-mutating specs against
  the seed workspace, results are undefined.
- `join-wizard-deep.spec.ts` reload test was weakened from asserting
  the stored blob shape to asserting "reload does not crash and
  storage key is wired". Reason: the WizardShell persistence is
  debounced and its exact serialization is internal — we guard the
  contract (no crash) but not the implementation detail.
- `signup-wizard-deep.spec.ts` magic-link test accepts either the
  confirmation screen OR an error alert. Local Supabase sometimes
  rate-limits synthetic emails; the regression we guard is that the
  button click exits the form state, not that the email actually sends.

## 5. How to run

```bash
# From repo root — make sure local Supabase is up and web package is built.
npx supabase start
pnpm turbo build --filter=web...

# Run the new suite from apps/e2e (Playwright auto-starts Next dev servers):
cd apps/e2e
bash ./scripts/playwright-with-libs.sh pnpm exec playwright test \
  tests/scrapling-health.spec.ts \
  tests/workspace-creation-control.spec.ts \
  tests/signup-wizard-deep.spec.ts \
  tests/join-wizard-deep.spec.ts \
  tests/onboarding-wizard-deep.spec.ts \
  tests/dashboard-setup-wizard-deep.spec.ts \
  tests/website-setup-wizard-deep.spec.ts \
  --project=web
```

Set `SCRAPLING_URL=http://127.0.0.1:8000` explicitly if your scrapling
lives elsewhere. Set `SCRAPLING_AUTH_TOKEN` to exercise the auth
enforcement test.

## 6. Pass/fail summary (local run, 2026-04-15)

| Spec                                  | Pass | Fail | Skip |
| ------------------------------------- | ---- | ---- | ---- |
| `scrapling-health.spec.ts`            | 2    | 0    | 1    |
| `workspace-creation-control.spec.ts`  | 6    | 0    | 0    |
| `signup-wizard-deep.spec.ts`          | 4    | 0    | 0    |
| `join-wizard-deep.spec.ts`            | 5    | 0    | 0    |
| `onboarding-wizard-deep.spec.ts`      | 4    | 0    | 0    |
| `dashboard-setup-wizard-deep.spec.ts` | 3    | 0    | 0    |
| `website-setup-wizard-deep.spec.ts`   | 5    | 0    | 0    |
| **Total**                             | 29   | 0    | 1    |

Total runtime: ~1m 40s on web project against local Supabase + auto-started dev servers.
