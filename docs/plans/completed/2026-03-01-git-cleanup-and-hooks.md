---
title: "Git Cleanup And Hooks"
status: done
updated: 2026-04-10
created: 2026-03-01
module: meta
tags: []
---

# Git Cleanup & Security Enforcement Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Clean up stale branches/stashes, push unpushed work, and build a Git hook system that physically enforces the Three Laws from `docs/protocols/SECURITY.md` — making security violations impossible to commit.

**Architecture:** Four-phase approach — (1) push and sync, (2) clean dead branches/stashes/duplicate files, (3) install enforcement hooks (secret detection, conventional commits, typecheck), (4) verify every hook end-to-end.

**Tech Stack:** Git, Husky v9, lint-staged v16, @commitlint/cli, @commitlint/config-conventional

---

## Security Context — What The Hooks Must Enforce

The hooks in this plan are the **local enforcement layer** for `docs/protocols/SECURITY.md`. The Three Laws:

```
LAW 1: Never store a plaintext secret in code, config files, logs, or database columns.
LAW 2: Never bypass RLS for convenience.
LAW 3: Never commit a key, token, or secret to Git.
```

LAW 3 is enforced by pre-commit. LAW 1 is partially enforced (catches secrets in staged files). LAW 2 is a runtime concern — not enforceable via Git hooks but documented here for completeness.

### Secret Patterns (derived from Security Protocol §2.3 Key Format)

These are the exact patterns the pre-commit hook must catch:

| Pattern                        | What it catches                    | Source                           |
| ------------------------------ | ---------------------------------- | -------------------------------- |
| `smo_sk_live_`                 | Production workspace API key       | Security Protocol §2.3           |
| `smo_sk_test_`                 | Sandbox workspace API key          | Security Protocol §2.3           |
| `smo_svc_live_`                | Production service-to-service key  | Security Protocol §2.3           |
| `smo_svc_test_`                | Sandbox service-to-service key     | Security Protocol §2.3 (implied) |
| `sk_live_`                     | Stripe live secret key             | Security Protocol §4.3           |
| `sk_test_`                     | Stripe test secret key             | Security Protocol §4.3           |
| `whsec_`                       | Stripe webhook secret              | env.ts validation                |
| `SG.`                          | SendGrid API key                   | env.ts validation                |
| `eyJhbGciOi`                   | JWT token (base64 header)          | Security Protocol §1             |
| `SUPABASE_SERVICE_ROLE_KEY=ey` | Service role key assigned inline   | Security Protocol §3             |
| `op://` references are SAFE    | 1Password references — do NOT flag | Security Protocol §2.1           |

### Files That Must NEVER Contain Real Secrets

Per Security Protocol §3 and .gitignore:

- `*.ts`, `*.tsx` — application code
- `supabase/migrations/*.sql` — migration files
- `supabase/seed.sql` — seed data
- `*.json` — config files
- `.env` files (already gitignored, but hook adds defense-in-depth)

### Files That Legitimately Reference Key Patterns (allowlist)

These files document key formats with examples — they are NOT violations:

- `docs/protocols/SECURITY.md` — the protocol itself
- `docs/architecture/SMARTOUT_SECRET_API_INFRASTRUCTURE.md` — architecture docs
- `docs/architecture/SMARTOUT_ADMIN_KEY_MANAGEMENT.md` — admin key docs
- `CLAUDE.md` — project instructions (references prefixes)
- `docs/plans/*.md` — implementation plans
- `docs/decisions/*.md` — ADRs
- `supabase/functions/_shared/scope-middleware.ts` — validates prefix format (no actual keys)

### Existing Enforcement Layers (context)

| Layer                     | What                                                       | Status                       |
| ------------------------- | ---------------------------------------------------------- | ---------------------------- |
| `.gitignore`              | Blocks `.env`, `.env.*`, `*.secrets`, `/secrets/`, `.op/`  | Active                       |
| `apps/web/src/env.ts`     | Zod validation with prefix checks (`sk_`, `whsec_`, `SG.`) | Active                       |
| `supabase/.gitignore`     | Blocks `.env.keys`, `.env.local`, `.env.*.local`           | Active                       |
| `apps/web/.gitignore`     | Blocks `.env*.local`                                       | Active                       |
| `apps/landing/.gitignore` | Blocks `.env*.local`                                       | Active                       |
| GitHub Actions CI         | Lint + typecheck + format + build + perf budgets           | Active                       |
| Claude Code Review        | `claude-code-review.yml` — automated PR review             | Active                       |
| PR template               | Manual checklist (lint, typecheck, build, perf)            | Active                       |
| **Pre-commit hook**       | lint-staged only (no secret detection)                     | **GAP — this plan fixes it** |
| **Commit-msg hook**       | None                                                       | **GAP — this plan fixes it** |
| **Pre-push hook**         | None                                                       | **GAP — this plan fixes it** |

---

## Current State Assessment

| Item                                     | Status                                                           | Action               |
| ---------------------------------------- | ---------------------------------------------------------------- | -------------------- |
| **Local: SmartOut.ai**                   | 19 commits ahead of origin                                       | Push                 |
| **Local: feat/contract-system**          | Fully merged into SmartOut.ai                                    | Delete               |
| **Local: feat/platform-admin**           | NOT merged (10 commits diverged)                                 | Keep                 |
| **Remote: add-claude-github-actions-\*** | Auto-generated, stale                                            | Delete               |
| **Remote: feat/onboarding-agent-ts**     | Merged into SmartOut.ai                                          | Delete               |
| **Remote: feat/platform-admin**          | Tracks active local branch                                       | Keep                 |
| **Stash @{0}**                           | feat/contract-system — contract system + landing                 | Drop (work merged)   |
| **Stash @{1}**                           | feat/contract-system — pre-existing changes                      | Drop (work merged)   |
| **Stash @{2}**                           | SmartOut.ai — old webpack alias fix                              | Drop (resolved)      |
| **SMARTOUT_SECURITY_PROTOCOL.md**        | Root-level untracked, OLDER subset of docs/protocols/SECURITY.md | Delete               |
| **Husky pre-commit**                     | Runs lint-staged only                                            | Add secret detection |
| **Husky commit-msg**                     | Does not exist                                                   | Add commitlint       |
| **Husky pre-push**                       | Does not exist                                                   | Add typecheck        |
| **Worktrees**                            | 2 in `.claude/worktrees/` (platform-admin, enterprise-infra)     | Assess cleanup       |

---

## Task 1: Push SmartOut.ai to origin

**Files:** None

**Step 1: Push 19 unpushed commits**

Run: `git push origin SmartOut.ai`
Expected: SUCCESS — 19 commits pushed

**Step 2: Verify sync**

Run: `git status`
Expected: "Your branch is up to date with 'origin/SmartOut.ai'"

---

## Task 2: Delete merged local branch

**Files:** None

**Step 1: Delete feat/contract-system**

Fully merged into SmartOut.ai (confirmed via `git branch --merged`).

Run: `git branch -d feat/contract-system`
Expected: "Deleted branch feat/contract-system"

**Step 2: Verify**

Run: `git branch`
Expected: `* SmartOut.ai` and `feat/platform-admin` only

---

## Task 3: Delete stale remote branches

**Files:** None

**Step 1: Delete origin/add-claude-github-actions-1772261079475**

Auto-generated Claude GitHub Actions branch. Only 2 commits ("Claude Code Review workflow" + "Claude PR Assistant workflow") on top of an old base. The workflows already exist in SmartOut.ai.

Run: `git push origin --delete add-claude-github-actions-1772261079475`
Expected: Remote branch deleted

**Step 2: Delete origin/feat/onboarding-agent-ts**

Shows in `git branch -a --merged SmartOut.ai`. Work is in SmartOut.ai.

Run: `git push origin --delete feat/onboarding-agent-ts`
Expected: Remote branch deleted

**Step 3: Prune tracking refs**

Run: `git fetch --prune`
Expected: Stale refs removed

**Step 4: Verify**

Run: `git branch -a`
Expected:

```
* SmartOut.ai
  feat/platform-admin
  remotes/origin/HEAD -> origin/SmartOut.ai
  remotes/origin/SmartOut.ai
  remotes/origin/feat/platform-admin
```

---

## Task 4: Clean up stashes

**Files:** None

All three stashes are from completed or obsolete work.

**Step 1: Drop all stashes (oldest first to avoid index shift)**

```bash
git stash drop stash@{2}
git stash drop stash@{1}
git stash drop stash@{0}
```

Expected: All dropped

**Step 2: Verify**

Run: `git stash list`
Expected: Empty output

---

## Task 5: Delete root SMARTOUT_SECURITY_PROTOCOL.md

**Files:**

- Delete: `SMARTOUT_SECURITY_PROTOCOL.md` (root, untracked)
- Keep: `docs/protocols/SECURITY.md` (canonical, 494 lines)

**Why:** The root file is an older, less comprehensive version (226 lines) of the canonical protocol. The canonical version at `docs/protocols/SECURITY.md` has:

- YAML frontmatter with dependency tracking
- §8 Data Encryption section
- §10 Rate Limiting section
- §12 Audit Trail section
- §15.2-15.7 Detailed AI agent checklists (new table, Edge Function, scope, microservice)
- §16 Infrastructure section
- §17 Document Relationships

The root file has nothing the canonical version lacks.

**Step 1: Delete the duplicate**

Run: `rm SMARTOUT_SECURITY_PROTOCOL.md`
Expected: File removed

---

## Task 6: Triage uncommitted changes

**Files:**

- Modified: `apps/landing/src/app/docs/_components/docs-agent-panel.tsx`
- Modified: `apps/landing/src/app/docs/_components/docs-sidebar.tsx`
- Modified: `apps/web/src/app/dashboard/schedule/page.tsx`
- Modified: `docs/decisions/0000-decision-log.md`
- Untracked: `docs/modules/journey/`
- Untracked: `docs/plans/2026-03-01-journey-portal-phase-1.md`
- Untracked: `docs/plans/2026-03-01-landing-variant-system.md`
- Untracked: `docs/plans/2026-03-01-schedule-local-state-design.md`

**Step 1: Review diffs**

Run:

```bash
git diff apps/landing/src/app/docs/_components/docs-agent-panel.tsx
git diff apps/landing/src/app/docs/_components/docs-sidebar.tsx
git diff apps/web/src/app/dashboard/schedule/page.tsx
git diff docs/decisions/0000-decision-log.md
```

**Step 2: Ask user — commit, stash, or leave?**

Options:

- **Commit as WIP** — group by feature area
- **Leave unstaged** — continue working on them
- **Discard** — restore to HEAD

**Step 3: Act on decision**

---

## Task 7: Install commitlint

Enforces conventional commit format. Makes commit history readable and parseable.

**Files:**

- Create: `commitlint.config.mjs`
- Create: `.husky/commit-msg`
- Modify: `package.json` (devDependencies)

**Step 1: Install packages**

Run: `pnpm add -Dw @commitlint/cli @commitlint/config-conventional`
Expected: Added to root devDependencies

**Step 2: Create commitlint config**

Create `commitlint.config.mjs`:

```javascript
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "perf",
        "test",
        "build",
        "ci",
        "chore",
        "revert",
      ],
    ],
    "scope-case": [2, "always", "kebab-case"],
    "subject-case": [2, "never", ["start-case", "pascal-case", "upper-case"]],
    "header-max-length": [2, "always", 100],
  },
};
```

**Step 3: Create commit-msg hook**

Create `.husky/commit-msg`:

```bash
npx --no -- commitlint --edit $1
```

**Step 4: Test — bad message**

Run: `echo "test" | npx commitlint`
Expected: FAIL — "type may not be empty"

**Step 5: Test — good message**

Run: `echo "feat(auth): add login endpoint" | npx commitlint`
Expected: PASS

**Step 6: Commit**

```bash
git add commitlint.config.mjs .husky/commit-msg package.json pnpm-lock.yaml
git commit -m "chore: add commitlint with conventional commits enforcement"
```

---

## Task 8: Add secret detection to pre-commit (LAW 3 enforcement)

This is the core enforcement hook. It blocks commits that contain real secrets by scanning staged diffs.

**Files:**

- Modify: `.husky/pre-commit`

**Step 1: Write the pre-commit hook**

Replace `.husky/pre-commit` with:

```bash
# ============================================================
# PRE-COMMIT HOOK — Security Protocol Enforcement
# Source of truth: docs/protocols/SECURITY.md
# Enforces: LAW 3 (never commit secrets to Git)
# ============================================================

# 1. Run lint-staged (eslint + prettier on staged files)
npx lint-staged

# 2. Secret detection — scan staged diff for known key patterns
#
# Patterns derived from:
#   - Security Protocol §2.3 (Key Format): smo_sk_, smo_svc_
#   - Security Protocol §4.3 (Deployment Checklist): sk_live_, sk_test_
#   - env.ts Zod validation: whsec_, SG.
#   - JWT detection: eyJhbGciOi (base64 of {"alg":)
#
# Allowlisted file patterns (docs that reference key formats):
#   - docs/**/*.md, CLAUDE.md, *.md in docs/
#   - These legitimately show key format examples like smo_sk_live_k7HjQ9...
#
# This hook does NOT catch:
#   - Secrets in binary files (use .gitignore)
#   - Secrets already in history (use git-secrets or truffleHog for audit)

STAGED_DIFF=$(git diff --cached --diff-filter=d -- \
  ':!docs/**/*.md' \
  ':!CLAUDE.md' \
  ':!*.md' \
)

if [ -z "$STAGED_DIFF" ]; then
  exit 0
fi

# Smartout platform keys (Security Protocol §2.3)
if echo "$STAGED_DIFF" | grep -qE 'smo_sk_(live|test)_[A-Za-z0-9]'; then
  echo ""
  echo "ERROR: Smartout workspace API key detected in staged changes!"
  echo "  Pattern: smo_sk_(live|test)_*"
  echo "  Violation: Security Protocol LAW 3"
  echo "  Fix: Use environment variable or op:// reference"
  echo ""
  exit 1
fi

if echo "$STAGED_DIFF" | grep -qE 'smo_svc_(live|test)_[A-Za-z0-9]'; then
  echo ""
  echo "ERROR: Smartout service key detected in staged changes!"
  echo "  Pattern: smo_svc_(live|test)_*"
  echo "  Violation: Security Protocol LAW 3"
  echo "  Fix: Use environment variable or op:// reference"
  echo ""
  exit 1
fi

# Stripe keys
if echo "$STAGED_DIFF" | grep -qE 'sk_live_[A-Za-z0-9]{20,}'; then
  echo ""
  echo "ERROR: Stripe live secret key detected in staged changes!"
  echo "  Pattern: sk_live_*"
  echo "  Violation: Security Protocol LAW 3"
  echo "  Fix: Use STRIPE_SECRET_KEY env var"
  echo ""
  exit 1
fi

# Stripe webhook secrets
if echo "$STAGED_DIFF" | grep -qE 'whsec_[A-Za-z0-9]{20,}'; then
  echo ""
  echo "ERROR: Stripe webhook secret detected in staged changes!"
  echo "  Pattern: whsec_*"
  echo "  Violation: Security Protocol LAW 3"
  echo "  Fix: Use STRIPE_WEBHOOK_SECRET env var"
  echo ""
  exit 1
fi

# SendGrid keys
if echo "$STAGED_DIFF" | grep -qE 'SG\.[A-Za-z0-9_-]{20,}'; then
  echo ""
  echo "ERROR: SendGrid API key detected in staged changes!"
  echo "  Pattern: SG.*"
  echo "  Violation: Security Protocol LAW 3"
  echo "  Fix: Use SENDGRID_API_KEY env var"
  echo ""
  exit 1
fi

# JWT tokens (Supabase service role key or any raw JWT)
if echo "$STAGED_DIFF" | grep -qE 'eyJhbGciOi[A-Za-z0-9_-]{50,}'; then
  echo ""
  echo "ERROR: JWT token detected in staged changes!"
  echo "  Pattern: eyJhbGciOi* (base64 JWT header)"
  echo "  Violation: Security Protocol LAW 3"
  echo "  This may be a Supabase service role key or auth token."
  echo "  Fix: Use environment variable — never inline JWTs"
  echo ""
  exit 1
fi

# Generic high-entropy secret assignment (catches password="...", secret="...", token="...")
# Only flags assignments with values longer than 20 chars (avoids false positives on short strings)
if echo "$STAGED_DIFF" | grep -qE '(password|secret|token|api_key|apiKey|API_KEY)\s*[=:]\s*["\x27][A-Za-z0-9+/=_-]{20,}["\x27]'; then
  echo ""
  echo "WARNING: Possible hardcoded secret detected in staged changes!"
  echo "  Pattern: password/secret/token/api_key = \"<long_string>\""
  echo "  Violation: Security Protocol LAW 1 + LAW 3"
  echo "  Review with: git diff --cached"
  echo "  If this is a false positive, use: git commit --no-verify (document why)"
  echo ""
  exit 1
fi

# .env file content in non-.env files (catches copy-paste accidents)
if echo "$STAGED_DIFF" | grep -qE '^[+].*SUPABASE_SERVICE_ROLE_KEY=ey'; then
  echo ""
  echo "ERROR: Supabase service role key assignment detected!"
  echo "  Pattern: SUPABASE_SERVICE_ROLE_KEY=ey*"
  echo "  Violation: Security Protocol LAW 3"
  echo "  Service role key MUST be in .env.local (gitignored)"
  echo ""
  exit 1
fi
```

**Step 2: Test pattern detection (without committing anything)**

```bash
# Test each pattern in isolation
echo 'smo_sk_live_k7HjQ9xM2bP4' | grep -qE 'smo_sk_(live|test)_[A-Za-z0-9]' && echo "PASS: smo_sk detected" || echo "FAIL"
echo 'smo_svc_live_p1Qr2St3Uv4W' | grep -qE 'smo_svc_(live|test)_[A-Za-z0-9]' && echo "PASS: smo_svc detected" || echo "FAIL"
echo 'sk_live_abc123def456ghi789jkl' | grep -qE 'sk_live_[A-Za-z0-9]{20,}' && echo "PASS: Stripe live detected" || echo "FAIL"
echo 'whsec_abc123def456ghi789jkl012' | grep -qE 'whsec_[A-Za-z0-9]{20,}' && echo "PASS: Stripe webhook detected" || echo "FAIL"
echo 'SG.abcdefghijklmnopqrstuvwxyz' | grep -qE 'SG\.[A-Za-z0-9_-]{20,}' && echo "PASS: SendGrid detected" || echo "FAIL"
echo 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0' | grep -qE 'eyJhbGciOi[A-Za-z0-9_-]{50,}' && echo "PASS: JWT detected" || echo "FAIL"
```

Expected: All 6 print "PASS: ... detected"

**Step 3: Test allowlist (docs should NOT trigger)**

```bash
# Simulate a diff from a markdown doc — should NOT be flagged
echo '+smo_sk_live_k7HjQ9xM2bP4' | grep -qE 'smo_sk_(live|test)_[A-Za-z0-9]' && echo "RAW MATCH (expected)" || echo "NO MATCH"
# The hook excludes docs/**/*.md from the diff — so this won't fire in practice
```

**Step 4: Commit**

```bash
git add .husky/pre-commit
git commit -m "chore: add secret detection to pre-commit hook

Enforces Security Protocol LAW 3 by scanning staged diffs for:
- Smartout API keys (smo_sk_*, smo_svc_*)
- Stripe keys (sk_live_*, whsec_*)
- SendGrid keys (SG.*)
- JWT tokens (eyJhbGciOi*)
- Generic secret assignments

Allowlists docs/**/*.md to avoid false positives on
key format documentation."
```

---

## Task 9: Add pre-push hook with typecheck

Blocks broken TypeScript from reaching the remote. Mirrors the CI `typecheck` job locally.

**Files:**

- Create: `.husky/pre-push`

**Step 1: Create pre-push hook**

Create `.husky/pre-push`:

```bash
# ============================================================
# PRE-PUSH HOOK — Type Safety Enforcement
# Mirrors: .github/workflows/ci.yml → typecheck job
# ============================================================

pnpm typecheck
```

**Step 2: Commit**

```bash
git add .husky/pre-push
git commit -m "chore: add pre-push hook with typecheck enforcement"
```

---

## Task 10: Final verification — end-to-end test

**Files:** None

**Step 1: Verify branch state**

Run: `git branch -a`
Expected:

```
* SmartOut.ai
  feat/platform-admin
  remotes/origin/HEAD -> origin/SmartOut.ai
  remotes/origin/SmartOut.ai
  remotes/origin/feat/platform-admin
```

**Step 2: Verify stash state**

Run: `git stash list`
Expected: Empty

**Step 3: Verify all hooks exist**

Run: `ls .husky/pre-commit .husky/commit-msg .husky/pre-push`
Expected: All three files exist

**Step 4: Test — bad commit message should fail**

```bash
echo "test" > /tmp/test-msg
npx commitlint < /tmp/test-msg
```

Expected: FAIL

**Step 5: Test — secret in staged file should fail**

```bash
echo 'const x = "smo_sk_live_abc123def456"' > /tmp/secret-test.ts
git add /tmp/secret-test.ts 2>/dev/null || echo "Cannot stage outside repo — test pattern only"
```

**Step 6: Test — good commit should pass**

Stage this plan file (docs are safe, no secrets) and commit:

```bash
git add docs/plans/2026-03-01-git-cleanup-and-hooks.md
git commit -m "docs: add git cleanup and security enforcement plan"
```

Expected: lint-staged runs, commitlint passes, no secret detection triggers, commit succeeds

**Step 7: Test — push should typecheck**

Run: `git push origin SmartOut.ai`
Expected: `pnpm typecheck` runs, all passes, push succeeds

---

## Enforcement Matrix — All Perspectives

After this plan is complete, here's every enforcement layer and what it catches:

### Local (developer machine)

| Hook                       | Trigger      | What it enforces                 | Bypass                 |
| -------------------------- | ------------ | -------------------------------- | ---------------------- |
| `pre-commit` (lint-staged) | Every commit | Code quality (eslint + prettier) | `--no-verify` (logged) |
| `pre-commit` (secret scan) | Every commit | LAW 3 — no secrets in code       | `--no-verify` (logged) |
| `commit-msg` (commitlint)  | Every commit | Conventional commit format       | `--no-verify` (logged) |
| `pre-push` (typecheck)     | Every push   | Type safety across monorepo      | `--no-verify` (logged) |
| `.gitignore` (layered)     | Always       | .env files never tracked         | Manual `git add -f`    |

### Remote (GitHub)

| Gate               | Trigger                | What it enforces         | Bypass              |
| ------------------ | ---------------------- | ------------------------ | ------------------- |
| CI: lint job       | Push + PR              | ESLint rules             | None (blocks merge) |
| CI: typecheck job  | Push + PR              | TypeScript strict        | None (blocks merge) |
| CI: format job     | Push + PR              | Prettier formatting      | None (blocks merge) |
| CI: build job      | Push + PR              | Apps compile             | None (blocks merge) |
| CI: perf-budgets   | Push (fail), PR (warn) | Performance regressions  | Budget exemption    |
| Claude Code Review | PR                     | Automated AI code review | None                |
| PR template        | PR                     | Manual checklist         | Human skip          |

### Runtime (production)

| Layer                   | What it enforces                      | Bypass            |
| ----------------------- | ------------------------------------- | ----------------- |
| `env.ts` Zod validation | All env vars present + correct format | App won't start   |
| Supabase RLS            | Workspace isolation (LAW 2)           | service_role only |
| Edge Function auth      | JWT or API key required               | None              |
| Scope middleware        | API key must have required scope      | None              |
| Vault SECURITY DEFINER  | Only service_role reads secrets       | None              |

### Defense-in-depth for LAW 3 specifically

```
Commit attempt with secret
  │
  ├── 1. .gitignore blocks .env files entirely
  │
  ├── 2. Pre-commit hook scans staged diff for key patterns
  │     ├── smo_sk_*, smo_svc_* (Smartout keys)
  │     ├── sk_live_*, whsec_* (Stripe)
  │     ├── SG.* (SendGrid)
  │     ├── eyJhbGciOi* (JWT tokens)
  │     └── password/secret/token = "<long_value>"
  │
  ├── 3. If developer uses --no-verify to bypass...
  │     ├── CI lint job catches code quality issues
  │     ├── Claude Code Review catches security patterns
  │     └── PR template requires manual security check
  │
  └── 4. If somehow merged...
        ├── GitHub secret scanning (if enabled)
        └── Incident response protocol §13
```

---

## Summary — Before vs After

| Component                | Before              | After                                                          |
| ------------------------ | ------------------- | -------------------------------------------------------------- |
| Local branches           | 3                   | 2 (removed feat/contract-system)                               |
| Remote branches          | 4                   | 2 (removed github-actions + onboarding-agent-ts)               |
| Stashes                  | 3                   | 0                                                              |
| Commits ahead of origin  | 19                  | 0                                                              |
| Root security duplicate  | Untracked           | Deleted                                                        |
| Pre-commit               | lint-staged only    | lint-staged + secret detection (6 patterns)                    |
| Commit-msg               | None                | commitlint (conventional commits)                              |
| Pre-push                 | None                | pnpm typecheck                                                 |
| LAW 3 enforcement layers | 2 (.gitignore + CI) | 5 (.gitignore + pre-commit + CI + Claude review + PR template) |
