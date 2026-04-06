# Mission: Verify CLAUDE.md Against Codebase

> You are an auditor. Your job is to verify that CLAUDE.md is accurate, complete, and reflects the current state of the codebase. Every claim in CLAUDE.md must be backed by code. Every significant pattern in code must be reflected in CLAUDE.md.

## Rules

- Do NOT make changes to any code files
- Do NOT make changes to CLAUDE.md directly
- Output a structured AUDIT REPORT (see format at bottom)
- Be thorough — check every section, not just the ones that look suspicious
- If something is partially correct, mark it as `⚠️ DRIFT` with explanation

---

## Phase 1: Structural Verification

Check that the monorepo structure in CLAUDE.md matches reality.

```bash
# Compare documented structure against actual
ls -la apps/
ls -la packages/
ls -la services/
ls -la infra/
ls -la supabase/
ls -la docs/
```

For each entry in the "Monorepo Structure" section:

- Does the directory exist?
- Are there directories in the repo NOT listed in CLAUDE.md?
- Are the port numbers correct? Check `package.json` scripts and any config files.
- Is the description accurate?

---

## Phase 2: Tech Stack Verification

Check every technology claim:

```bash
# Framework versions
cat package.json | grep -E "next|react|typescript"
cat apps/web/package.json | grep -E "next|react"

# Tailwind version — CLAUDE.md says v4 CSS config, no config file
ls apps/web/tailwind.config* 2>/dev/null
cat apps/web/src/app/globals.css | head -30

# shadcn/ui style
cat apps/web/components.json

# Supabase
cat supabase/config.toml | head -20

# pnpm version
cat package.json | grep "packageManager"

# Check all integrations mentioned: Stripe, DocuSign/DocuSeal, SendGrid, Twilio, Sentry, Upstash, Ultravox, Remotion
grep -r "stripe" packages/ apps/ --include="package.json" -l
grep -r "docusign\|docuseal" packages/ apps/ --include="package.json" -l
grep -r "sendgrid" packages/ apps/ --include="package.json" -l
grep -r "twilio" packages/ apps/ --include="package.json" -l
grep -r "sentry" packages/ apps/ --include="package.json" -l
grep -r "upstash" packages/ apps/ --include="package.json" -l
grep -r "ultravox" packages/ apps/ --include="package.json" -l
grep -r "remotion" packages/ apps/ --include="package.json" -l
```

---

## Phase 3: Database Verification

This is critical. CLAUDE.md has many specific claims about tables, enums, and patterns.

```bash
# Generate current types to compare
# Check existing types file
wc -l packages/supabase/src/database.types.ts

# Verify every table claim:
grep -c "user_identity" packages/supabase/src/database.types.ts
grep "public.user:" packages/supabase/src/database.types.ts  # Should NOT exist

# Check enum count (CLAUDE.md says 60+)
grep "Enum:" packages/supabase/src/database.types.ts | wc -l

# Verify specific enums mentioned
grep "contract_status" packages/supabase/src/database.types.ts
grep "budget_status" packages/supabase/src/database.types.ts
grep "shift_status" packages/supabase/src/database.types.ts
grep "api_key_version_status" packages/supabase/src/database.types.ts
grep "api_key_type" packages/supabase/src/database.types.ts

# Check trigger claims
grep -r "handle_new_user" supabase/migrations/ | tail -5
grep -r "set_updated_at\|moddatetime" supabase/migrations/ | tail -10

# Verify table existence for all mentioned tables
for table in user_identity company company_member workspace profile department location team \
  season season_budget day_factor hour_factor schedule_shift engine_process engine_state \
  engine_state_step engine_memory engine_authority_config engine_sessions session_hook \
  session_task session_note department_session platform_api_key platform_api_key_usage \
  platform_external_secret workspace_doc_chunk knowledge_test_attempt confirmation_signature \
  procedure_step_completion protocol_assignment; do
  echo "--- $table ---"
  grep "$table" packages/supabase/src/database.types.ts | head -1
done

# Check is_godmode claim
grep "is_godmode\|is_super_admin" packages/supabase/src/database.types.ts
```

---

## Phase 4: Code Conventions Verification

Check that documented conventions match actual code patterns:

```bash
# TypeScript strict
cat apps/web/tsconfig.json | grep strict
cat packages/typescript-config/*.json | grep strict

# File naming patterns — spot check
ls apps/web/src/components/ | head -20  # Should be PascalCase
ls apps/web/src/hooks/ | head -10       # Should be useName
ls apps/web/src/lib/ | head -10         # Should be camelCase

# Check "use client" pattern — should be deep, not at page level
grep -r "\"use client\"" apps/web/src/app/ --include="*.tsx" -l | head -10

# Telemetry emit pattern
grep -r "emit(" apps/web/src/ --include="*.ts" --include="*.tsx" -l | wc -l
grep -r "@smartout/telemetry" apps/web/src/ --include="*.ts" --include="*.tsx" -l | wc -l

# Commitlint
cat commitlint.config* 2>/dev/null || cat .commitlintrc* 2>/dev/null
cat .husky/commit-msg 2>/dev/null

# Zod + t3 env validation
cat apps/web/src/env.ts | head -20

# 1Password references
cat .env.template | grep "op://" | head -5
```

---

## Phase 5: Security Verification

```bash
# RLS enabled — check recent migrations
grep -r "ENABLE ROW LEVEL SECURITY" supabase/migrations/ | wc -l
grep -r "DISABLE ROW LEVEL SECURITY" supabase/migrations/  # Should be 0 or very few

# API key prefixes in code
grep -r "smo_sk_live_\|smo_sk_test_\|smo_svc_live_" apps/ packages/ services/ supabase/ \
  --include="*.ts" --include="*.tsx" -l

# Auth middleware
ls supabase/functions/_shared/auth-middleware.ts 2>/dev/null
cat supabase/functions/_shared/auth-middleware.ts | head -20

# verify_jwt config
cat supabase/functions/config.toml

# Vault wrapper functions
grep -r "get_secret\|upsert_secret\|delete_vault_secret\|delete_secret" supabase/migrations/ | tail -10

# No .env.local anywhere
find . -name ".env.local" -not -path "*/node_modules/*" 2>/dev/null
```

---

## Phase 6: Edge Functions & API Gateway

```bash
# Count Edge Functions (CLAUDE.md says 29)
ls supabase/functions/ | grep -v "_shared\|node_modules" | wc -l
ls supabase/functions/ | grep -v "_shared\|node_modules"

# workspace-api handlers
ls supabase/functions/workspace-api/handlers/ 2>/dev/null

# Scope list — verify handlers exist for each active scope
for scope in profiles schedules operations reports guardian events suppliers waste equipment training contracts; do
  echo "--- $scope ---"
  ls supabase/functions/workspace-api/handlers/$scope* 2>/dev/null || echo "NOT FOUND"
done
```

---

## Phase 7: Docs Verification

```bash
# INDEX.md exists and is populated
cat docs/INDEX.md | head -30

# All referenced docs exist
for doc in docs/STATE.md docs/reference/DATABASE.md docs/reference/ROUTES.md \
  docs/reference/PACKAGES.md docs/reference/ENV_VARS.md docs/protocols/SECURITY.md \
  docs/protocols/DOCUMENTATION.md docs/protocols/KNOWLEDGE.md docs/protocols/ENV_PROTOCOL.md; do
  echo "--- $doc ---"
  [ -f "$doc" ] && echo "EXISTS" || echo "MISSING"
done

# ADR count (CLAUDE.md says 42)
ls docs/decisions/ | grep -c "\.md$"

# Module docs count (CLAUDE.md says 17 modules: 1-15, 17-18)
ls docs/modules/MODULE_*.md 2>/dev/null | wc -l
```

---

## Phase 8: Services Verification

```bash
# Each service mentioned in monorepo structure
for svc in contract-service interview-mcp scrapling shift-mcp stage-engine; do
  echo "--- $svc ---"
  [ -d "services/$svc" ] && echo "EXISTS" || echo "MISSING"
  [ -f "services/$svc/package.json" ] && cat "services/$svc/package.json" | grep -E "name|port" | head -2
done

# Docker Compose (ADR-0039)
ls infra/docker-compose* 2>/dev/null
ls infra/Caddyfile* 2>/dev/null
```

---

## Phase 9: Onboarding Wizard Verification

```bash
# CLAUDE.md says: 15 step components + 4 drawers + useOnboardingWizard hook
ls apps/web/src/app/**/onboarding/ -la 2>/dev/null
find apps/web/src -path "*onboarding*" -name "*.tsx" | wc -l
find apps/web/src -path "*onboarding*" -name "*drawer*" -o -name "*Drawer*" | wc -l
grep -r "useOnboardingWizard" apps/web/src/ --include="*.ts" --include="*.tsx" -l
```

---

## Output Format: AUDIT REPORT

Structure your findings as follows:

```markdown
# CLAUDE.md Audit Report

**Date:** [today]
**CLAUDE.md version:** 9.3.0
**Auditor:** Claude Code

## Summary

- ✅ Verified: X sections
- ⚠️ Drift: X items (documented ≠ code)
- ❌ Wrong: X items (documented claims are false)
- 🕳️ Missing: X items (in code but not documented)

## Section-by-Section

### Monorepo Structure

| Claim                 | Status       | Evidence         |
| --------------------- | ------------ | ---------------- |
| apps/web on port 3050 | ✅ / ⚠️ / ❌ | [what you found] |
| ...                   | ...          | ...              |

### Tech Stack

| Claim      | Status       | Evidence             |
| ---------- | ------------ | -------------------- |
| Next.js 16 | ✅ / ⚠️ / ❌ | package.json shows X |
| ...        | ...          | ...                  |

### Database

| Claim     | Status       | Evidence      |
| --------- | ------------ | ------------- |
| 60+ enums | ✅ / ⚠️ / ❌ | Found X enums |
| ...       | ...          | ...           |

[continue for all sections]

## Recommended Changes to CLAUDE.md

1. [specific change with exact old → new text]
2. ...

## Recommended Changes to Code (if conventions not followed)

1. [specific file + what's wrong]
2. ...
```

---

## Important

- This is a READ-ONLY audit. Do not fix anything.
- If a section has 10+ claims, check ALL of them, not just a sample.
- Pay extra attention to numbers (port numbers, counts, versions) — these drift first.
- Check the changelog dates — if recent changes claim specific additions, verify those additions exist.
- If you find code patterns that should be in CLAUDE.md but aren't, flag them as 🕳️ Missing.
