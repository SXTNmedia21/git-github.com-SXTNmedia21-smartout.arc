---
title: SXTN Plugin Extraction — Full Spec
status: draft
updated: 2026-05-28
created: 2026-05-28
module: plugin
tags: [plugin, sxtn, sdsm, orchestrator, council, extraction, multi-project]
---

# SXTN Plugin — Full Extraction Spec

> **Purpose:** Extract the SDSM Orchestrator into a portable, multi-project Claude Code plugin named `sxtn`. Plugin ships agent + commands + skills + templates + schemas + bin-scripts as a closed, self-improving system. Per-project adapter via `.sxtn/config.yaml`. First consumer: Smartout (post-HMS-Wizard S9 closure).
>
> **Companion specs:**
> - `docs/superpowers/specs/2026-05-28-smartout-development-state-machine-design.md` — SDSM state machine (state/gate/tier/import-mode definitions). This SPEC references SDSM spec; does not duplicate it.
> - `.claude/agents/sdsm-orchestrator.md` v2 — current orchestrator agent body. This SPEC defines the cleaned, plugin-ready version.

---

## 0. Meta

| Field | Value |
|-------|-------|
| Spec version | 1.0 (draft) |
| Distribution | Standalone GitHub repo: `SXTNmedia21/sxtn-plugin` |
| Distribution method | Claude Code marketplace + `/plugin install` |
| Versioning | SemVer; plugin contract pinned per-project in `.sxtn/config.yaml` |
| First consumer | Smartout (post-HMS-Wizard S9 closure) |
| Second consumer (validation) | TBD — likely second-brain-v2 vault OR another SXTN project |
| Locked stack | TypeScript + Supabase + Vercel (hardcoded; no stack questionnaire) |
| Rollout phases | 4 (F1 core → F2 council → F3 self-improve → F4 polish) |

---

## 1. Identity

### What `sxtn` IS

- A **portable plugin** that turns any TS/Supabase/Vercel project into an SDSM-conformant codebase.
- A **closed lifecycle system**: 6 slash commands wrap a full feature/campaign lifecycle from S0 IDLE to S9 CLOSED.
- A **council-driven gate enforcer**: G3/G4/G6 auto-validated by ADR-grade council; G8 Pontus-stop only.
- A **self-improving system**: lessons captured per sortie → 3-occurrence threshold → plugin-PR draft → version bump.
- A **single-orchestrator architecture**: one agent (`sxtn-orchestrator`) dispatches all subagents per phase.

### What `sxtn` IS NOT

- Not a code generator. Subagents (project-shipped) write feature code; plugin orchestrates.
- Not a multi-stack tool. TS+Supabase+Vercel locked. Other stacks = fork plugin.
- Not a CI/CD system. Plugin reads CI green-state; does not drive deploys (deploy-conductor agent does that).
- Not a replacement for `run-council` Skill — plugin *contains* run-council; council is plugin's authority surface, not a separate system.

---

## 2. Goals & Non-Goals

### Goals

1. **Multi-project portability** — install once via marketplace, configure per-project via `.sxtn/config.yaml`.
2. **Closed lifecycle** — 6 commands cover full lifecycle; no manual orchestration outside the plugin surface.
3. **Self-improvement** — lessons promote to plugin via PR; plugin learns across sorties + projects.
4. **Council-as-authority** — gate decisions made by council (DEFINITIVE), not Pontus. Pontus = G8 visual + T4 cross-campaign + hard-block only.
5. **Brownfield onboarding** — `init-council` questionnaire + codebase scan → working `.sxtn/config.yaml` in ≤15 min.
6. **Zero ambiguity for extraction sortie** — this spec is the bill-of-materials.

### Non-Goals

- Multi-stack support (Python, Go, Rust). Locked stack reduces surface; fork for others.
- Replacing existing project-shipped skills (`smartout-*`, `payroll-engine-developer` etc.). Plugin reads them via config.
- Replacing CLAUDE.md project-level rules. Plugin reads, never overrides.
- Replacing Linear/claude-mem/activity-log. Plugin emits to all three; does not own them.

---

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    PROJECT (e.g. smartout.ai)                    │
│                                                                  │
│  .sxtn/                                                          │
│    ├── config.yaml          ← per-project adapter                │
│    ├── council.yaml         ← written by init-council            │
│    └── campaigns/<name>/STATE.md                                 │
│                                                                  │
│  docs/                                                           │
│    ├── DASHBOARD.md         ← managed by sxtn-dashboard          │
│    ├── domains/<d>/<f>/     ← STATE.md per feature, ADR-0392     │
│    └── decisions/           ← managed by sxtn-adr                │
│                                                                  │
│  supabase/migrations/       ← managed by sxtn-migration          │
│                                                                  │
│  .claude/skills/            ← project-shipped, referenced by     │
│    └── smartout-*           ← dispatch_table in config.yaml      │
│                                                                  │
└────────────────────────┬─────────────────────────────────────────┘
                         │ reads config, loads skills
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│           ~/.claude/plugins/sxtn/ (user-scope, multi-project)   │
│                                                                  │
│  agents/sxtn-orchestrator.md   ← single brain                   │
│                                                                  │
│  commands/                                                       │
│    sxtn-start-campaign, sxtn-start-feature, sxtn-close-feature, │
│    sxtn-close-campaign, sxtn-end-session, sxtn-status           │
│                                                                  │
│  skills/                                                         │
│    council/  (init, run, retro)                                  │
│    governance/ (adr, migration)                                  │
│    plumbing/ (state, import, gate, tier, dispatch, evidence,    │
│               dashboard)                                         │
│    self-improve/ (lesson-capture, promote-lesson, audit)         │
│                                                                  │
│  templates/ schemas/ examples/ docs/ bin/                        │
└──────────────────────────────────────────────────────────────────┘
```

**Read flow:** Pontus runs `/sxtn-start-feature x` → plugin command reads `.sxtn/config.yaml` → invokes `sxtn-orchestrator` agent → agent loads `sxtn-state`, `sxtn-import`, project-specified skills → dispatches subagents per `dispatch_table` → writes STATE.md atomic.

**Write flow:** All plugin writes go through `sxtn-state` (STATE.md), `sxtn-dashboard` (DASHBOARD.md), `sxtn-adr` (ADRs + decision-log), `sxtn-migration` (migration files). Direct writes to project paths from agent body = forbidden.

---

## 3.1 Autonomy Contract

The plugin is designed for autonomous agent execution. All commands and skills MUST obey:

1. Every command is idempotent and safe to re-run.
2. Every command declares: required inputs, optional inputs, preconditions, reads, allowed writes, forbidden writes, success criteria, failure modes, retry policy, escalation policy.
3. Every skill returns a structured `ExecutionResult` (§ 3.3) — never freeform prose.
4. Orchestrator may not directly edit project files except by invoking plugin skills.
5. Orchestrator may not modify application source code. Code changes delegated through `sxtn-dispatch` → project subagents only.
6. All state transitions backed by evidence, schema validation, or explicit gate verdict. No transitions on inference alone.
7. Human interruption only at: G8 product accept; T4 cross-campaign sync; failed gate after retry + council cap; destructive/irreversible operation.
8. Ambiguity + default defined → use default. No Pontus ping.
9. Ambiguity + no default → write `OPEN-QUESTIONS.md` entry + escalate.
10. Every command leaves repo in resumable state.

---

## 3.2 Write Policy

Hard allow/deny lists. Enforced by every plugin skill at call site.

```yaml
write_policy:
  default: deny

  plugin_orchestrator_may_write:
    - .sxtn/**
    - docs/DASHBOARD.md
    - docs/domains/**/STATE.md
    - docs/domains/**/SPEC.md
    - docs/domains/**/INVENTORY-REPORT.md
    - docs/domains/**/QUESTIONNAIRE.md
    - docs/domains/**/DESIGN-MAPPING.md
    - docs/domains/**/DESIGN-DEVIATIONS.md
    - docs/domains/**/plans/**
    - docs/domains/**/reports/**
    - docs/domains/**/screenshots/**
    - docs/domains/**/events/**
    - docs/domains/**/journeys/**
    - docs/domains/**/OPEN-QUESTIONS.md         # feature-scoped
    - .sxtn/campaigns/**/OPEN-QUESTIONS.md      # campaign-scoped
    - docs/decisions/**                         # only via sxtn-adr (see decision_write_rule below)
    - supabase/migrations/**                    # only via sxtn-migration, new files only (see sql_write_rule below)

  scope_restricted_writes:
    sql_write_rule:
      default: forbidden
      allowed_only_via:
        - skill: sxtn-migration
          operation: create
          path: supabase/migrations/**
      forbidden_even_via_sxtn_migration:
        - supabase/seed.sql
        - existing committed migration files (unless operation = lint-only / read-only)
      rationale: |
        Orchestrator must not "fix" or mutate existing migrations. Once a migration
        is committed and applied (or pushed), it is immutable. New files only.

    decision_write_rule:
      default: forbidden
      allowed_only_via:
        - skill: sxtn-adr
          path: docs/decisions/**
      rationale: |
        Orchestrator cannot directly edit ADRs or decision-log. All decision writes
        go through sxtn-adr so slot allocation, frontmatter validation, and
        decision-log registration stay consistent.

    open_questions_scope:
      feature: docs/domains/<d>/<f>/OPEN-QUESTIONS.md
      campaign: .sxtn/campaigns/<name>/OPEN-QUESTIONS.md
      root: forbidden unless project-wide ambiguity requires explicit Pontus authorization
      rationale: |
        Root-level OPEN-QUESTIONS.md becomes a dumping ground across parallel sorties.
        Scope questions to feature or campaign so they close out with the work that
        owns them.

  plugin_orchestrator_must_not_write:
    - apps/**
    - packages/**
    - services/**
    - components/**
    - lib/**
    - supabase/functions/**
    - supabase/seed.sql
    - package.json
    - pnpm-lock.yaml
    - turbo.json
    - tsconfig*.json
    - .env*
    - CLAUDE.md
    - any source file matching: *.ts, *.tsx, *.sql (except via sxtn-migration), *.json (except .sxtn/*)

  delegated_writes:
    description: |
      Only project subagents (dispatched via sxtn-dispatch) may write feature code.
      Orchestrator may only invoke dispatch; never bypass dispatch and edit code directly.
    enforcement: pre-write hook checks call site is sxtn-dispatch result, not orchestrator body

  destructive_actions:
    default: deny
    explicit_allow_list:
      - git mv (proposed only — never executed without explicit confirmation)
      - rm of *.lock files older than 24h (within .sxtn/locks/ only)
    forbidden_always:
      - rm -rf
      - git reset --hard
      - git push --force
      - DROP TABLE
      - migration timestamp re-numbering
```

Any write outside `plugin_orchestrator_may_write` MUST abort with `F_WRITE_FORBIDDEN` (§ 21).

---

## 3.3 Execution Result Format

Every command and skill returns this shape:

```typescript
type ExecutionResult = {
  status: "success" | "failed" | "blocked" | "needs_escalation" | "preview";
  command_or_skill: string;
  invocation_id: string;                    // UUID for trace correlation
  summary: string;                          // one-line human-readable

  inputs: Record<string, unknown>;
  files_read: string[];
  files_written: string[];                  // empty for dry-run; populated post-write
  files_blocked: { path: string; reason: string }[];

  validation_results: {
    schema: { name: string; result: "pass" | "fail"; errors?: string[] }[];
    gate?: { gate: string; result: "PASS" | "FAIL" | "AWAITING" };
  };

  state_before: { state?: string; gate_history?: unknown };
  state_after: { state?: string; gate_history?: unknown };

  next_recommended_action: string;          // what orchestrator should do next
  next_recommended_skill?: string;          // skill name if dispatch implied

  evidence: {
    council_report?: string;                // path on disk (must exist — see § 25)
    screenshots?: string[];                 // paths on disk
    test_results?: string;                  // path or stdout reference
    activity_log_entry?: string;            // log line reference
    git_commits?: string[];                 // SHAs (must verify via git log)
  };

  errors: { code: string; message: string; recoverable: boolean }[];
  retry_count: number;
  duration_ms: number;
};
```

Orchestrator reads `next_recommended_action` to decide next dispatch. If `status: "needs_escalation"` → Pontus stop with `errors[]` + `evidence`. Per § 25, every non-null evidence field MUST correspond to on-disk artefakt.

---

## 4. Folder Structure

### Plugin (user-scope)

```
~/.claude/plugins/sxtn/
│
├── .claude-plugin/
│   └── plugin.json                          # manifest
│
├── agents/
│   └── sxtn-orchestrator.md                 # single brain
│
├── commands/
│   ├── sxtn-start-campaign.md
│   ├── sxtn-start-feature.md
│   ├── sxtn-close-feature.md
│   ├── sxtn-close-campaign.md
│   ├── sxtn-end-session.md
│   └── sxtn-status.md
│
├── skills/
│   ├── council/
│   │   ├── init-council/SKILL.md
│   │   ├── run-council/SKILL.md
│   │   └── retro-council/SKILL.md
│   │
│   ├── governance/
│   │   ├── sxtn-adr/SKILL.md
│   │   └── sxtn-migration/SKILL.md
│   │
│   ├── plumbing/
│   │   ├── sxtn-state/SKILL.md
│   │   ├── sxtn-import/SKILL.md
│   │   ├── sxtn-gate/SKILL.md
│   │   ├── sxtn-tier/SKILL.md
│   │   ├── sxtn-dispatch/SKILL.md
│   │   ├── sxtn-evidence/SKILL.md
│   │   └── sxtn-dashboard/SKILL.md
│   │
│   └── self-improve/
│       ├── sxtn-lesson-capture/SKILL.md
│       ├── sxtn-promote-lesson/SKILL.md
│       └── sxtn-audit/SKILL.md
│
├── templates/
│   ├── STATE.md.tmpl
│   ├── SPEC.md.tmpl
│   ├── PLAN.md.tmpl
│   ├── QUESTIONNAIRE.md.tmpl
│   ├── COUNCIL-report.md.tmpl
│   ├── ADR.md.tmpl
│   ├── MIGRATION.sql.tmpl
│   └── DASHBOARD.md.tmpl
│
├── schemas/
│   ├── state.schema.json
│   ├── council.schema.json
│   ├── config.schema.json
│   ├── adr.schema.json
│   └── dashboard.schema.json
│
├── examples/
│   ├── smartout-pilot.md                    # HMS Wizard reference
│   └── smartout-traps.md                    # ADR-0392/0366/0361/0133 examples
│
├── docs/
│   ├── SPEC.md                              # plugin canonical spec
│   ├── CHANGELOG.md                         # self-improvement audit trail
│   └── README.md
│
└── bin/
    ├── sxtn-init.sh                         # first-install wizard
    ├── sxtn-promote-lesson.sh               # PR draft helper
    ├── sxtn-audit.sh                        # coherence check
    └── sxtn-migration-lint.sh               # pre-push gate
```

### Per-project adapter (project-scope)

```
<project-root>/
│
├── .sxtn/
│   ├── config.yaml                          # adapter (committed)
│   ├── council.yaml                         # written by init-council (committed)
│   └── campaigns/
│       └── <campaign-name>/STATE.md         # campaign-level state
│
├── docs/
│   ├── DASHBOARD.md                         # single source of git state (ADR-0075)
│   ├── domains/<d>/<f>/                     # feature spine (ADR-0392)
│   │   ├── STATE.md                         # sortie-level state
│   │   ├── SPEC.md
│   │   ├── INVENTORY-REPORT.md
│   │   ├── DESIGN-MAPPING.md
│   │   ├── DESIGN-DEVIATIONS.md
│   │   ├── plans/PLAN-*.md
│   │   ├── reports/COUNCIL-*.md
│   │   ├── reports/LESSONS-*.md
│   │   ├── screenshots/
│   │   ├── events/
│   │   └── journeys/
│   └── decisions/
│       ├── 0000-decision-log.md
│       └── XXXX-*.md
│
└── .claude/skills/                          # project-shipped skill kit
    └── <project>-*/                         # referenced from config.yaml
```

---

## 5. Skill Catalogue

16 skills. Each shipped as `<name>/SKILL.md` per Anthropic plugin convention.

### 5.1 Council triad

#### `init-council`
**Trigger:** First plugin install in project / `sxtn-start-campaign` if no `council.yaml` exists.
**Inputs:** Project root, locked stack assumption (TS/Supabase/Vercel).
**Behavior:**
1. Brownfield scan: detect existing `docs/decisions/`, ADR count, migration count, surface count.
2. Questionnaire (4 Q):
   - Regulated domain? (gdpr / hipaa / pci / nlawyer / none)
   - Team size? (solo / 2-5 / 6+)
   - Cascade-style scheduling? (yes → adds cascade-developer member)
   - Mobile surface? (yes → adds mobile-ux member)
3. Always-on base (8 members, locked):
   - `security-guard`, `framework-guard`, `code-reviewer`, `safety-guard`
   - `migration-guard`, `deploy-guard`, `schema-guard`, `adr-guard`
4. Conditional add-ons based on questionnaire + scan.
5. Writes `.sxtn/council.yaml` with member roster + dispatch rules.

**Output:** `.sxtn/council.yaml` (validated against `council.schema.json`).

#### `run-council`
**Trigger:** `sxtn-gate` invokes at G3/G4/G6/import/deviation triggers.
**Inputs:** Topic, context files, current STATE.md.
**Behavior:** Dispatches council members per `council.yaml` roster + topic class. Collects verdicts (APPROVE / REJECT / APPROVE-WITH-CHANGES). Writes report to `docs/domains/<d>/<f>/reports/COUNCIL-<topic>-<ts>.md`.
**Output:** Council report markdown + verdict to orchestrator.

#### `retro-council`
**Trigger:** `sxtn-close-feature` (S8→S9) + `sxtn-close-campaign`.
**Inputs:** STATE.md, LESSONS files, sortie reports.
**Behavior:** Council reviews completed sortie/campaign. Proposes member adjustments (add/remove/upgrade-model). If pattern recurs 3+ times: triggers `sxtn-promote-lesson`. Writes adjustment proposals to `.sxtn/council.yaml` via PR (not direct write).
**Output:** PR against `.sxtn/council.yaml` + closure report.

### 5.2 Governance pair

#### `sxtn-adr`
**Trigger:** Schema-lock / cross-domain / capability surface / pattern-class decisions during sortie.
**Functions:**
- `adr.draft <slot> <title>` — picks next slot, writes from `ADR.md.tmpl`.
- `adr.register` — appends to `docs/decisions/0000-decision-log.md`, validates frontmatter via `adr.schema.json`.
- `adr.gate` — council trigger router (when ADR-grade decision detected).
- `adr.lint` — pre-push gate: every accepted ADR registered.

**Slot collision handling:** If concurrent sorties race for slot, outsider-renumber per Smartout L-0147 pattern (last writer takes next free slot).

#### `sxtn-migration`
**Trigger:** Any new SQL migration during sortie.
**Functions:**
- `mig.new <description>` — generates `YYYYMMDDHHMMSS_<desc>.sql` with timestamp > current repo tip (Smartout L-0042 trap avoidance).
- `mig.lint` — pre-push gate:
  - Timestamp ordering (no migration < latest applied)
  - Dual-auth RLS on workspace-scoped tables (JWT + API key per Smartout convention)
  - `workspace_id` column present where applicable
  - Post-migration typegen committed (Smartout L-0083 sibling)
- `mig.gate` — council trigger if: schema-lock, new table, cross-workspace policy change.
- `mig.typegen` — post-migration `pnpm supabase gen types --local` + commit.

**Stack assumption:** Supabase locked. PostgreSQL 17. RLS-everywhere convention.

### 5.3 Plumbing skills

#### `sxtn-state`
**Purpose:** Single writer/reader for `STATE.md` per feature.
**Schema validate:** `state.schema.json` (frontmatter fields, gate-history shape).
**Atomicity:** Read-modify-write cycle wrapped; never partial writes.
**Migrations:** Plugin-version aware (e.g., v1→v2 field renames handled via alias map).

#### `sxtn-import`
**Purpose:** Brownfield discovery when STATE.md missing.
**Search order (configurable):**
1. `docs/domains/<d>/<f>/`
2. `docs/domains/<d>/` (legacy flat)
3. `docs/superpowers/specs/*<f>*-design.md`
4. `docs/plans/PLAN-*<f>*.md`
5. Campaign worktrees: `<worktree_root>/<campaign_prefix><name>/`

**Classify:** Artefakter → inferred state (S1/S2/S4/S5). Council validation if T3/T4 OR >2 DEVIATIONs OR cross-domain.
**Migration proposal:** Lists `git mv` commands; never executes without approval.

#### `sxtn-gate`
**Purpose:** Routes gate validation per gate-table (see § 10).
**Auto vs council vs Pontus:** Per gate-table decision matrix.
**Council loop cap:** Max 2 council consults per gate; then escalate (closes orchestrator H4 finding).

#### `sxtn-tier`
**Purpose:** Tier classification T1-T4 from INVENTORY.
**Rules:** Per SDSM spec § 5. Tier-promotion blocked until 5 successful T1 sorties (SDSM hard rule).
**Output:** Tier stamp written to STATE.md.

#### `sxtn-dispatch`
**Purpose:** Selects subagent per phase per `.sxtn/config.yaml dispatch_table`.
**Decision rules:**
- Phase A — Build:
  - Capabilities/AI work → project-shipped `*-harness-builder` (e.g., `botsson-harness-builder` for Smartout)
  - UI polish → project-shipped `frontend-designer` (or generic)
  - Default → `general-purpose`
- Phase B — Verify: `phase-verifier` (project-shipped or `general-purpose` fallback)
- Phase C — Journey: `journey-inference` or fallback
- Phase D — Playwright: Bash, not subagent
- Failure escalation: `system-steward` (opus)

**Model enforcement:** Always pass `model:` explicitly per CLAUDE.md orchestrator dispatch protocol. No silent Opus inheritance.

#### `sxtn-evidence`
**Purpose:** Phase B + G8 evidence capture.
**Functions:**
- Screenshot capture to `docs/domains/<d>/<f>/screenshots/`
- Telemetry-emit grep (verify `emit()` call-sites match event registry)
- API call verification (grep handler + response shape)
- Output bundle for G8 product-accept ping

#### `sxtn-dashboard`
**Purpose:** Single writer for `docs/DASHBOARD.md` per project (ADR-0075).
**Triggers:**
- `sxtn-start-feature` → adds sortie row + pending journeys
- `sxtn-close-feature` → removes sortie row, frees slot
- `sxtn-start-campaign` → adds campaign row (long-lived)
- `sxtn-status` → reads + renders (no write)
- `sxtn-audit` heartbeat → verifies rows match `git worktree list`; surfaces drift

**Schema:** `dashboard.schema.json` enforces pure git-state shape (no history, no narrative).

### 5.4 Self-improvement triad

#### `sxtn-lesson-capture`
**Trigger:** `sxtn-close-feature` at S9.
**Behavior:** Scans STATE.md for anomalies:
- Subagent retries > 1
- Council REJECT verdicts
- Self-fix loop usage
- Pontus pings (rare = anomaly signal)
- Gate FAIL → PASS transitions

Drafts `docs/domains/<d>/<f>/reports/LESSONS-<sortie>.md` from template.

#### `sxtn-promote-lesson`
**Trigger:** When pattern recurs 3+ times across sorties/projects (per CLAUDE.md skill-promotion rule).
**Behavior:**
1. Reads all LESSONS files matching pattern.
2. Drafts CHANGELOG entry for plugin repo.
3. Drafts agent-body delta + spec amendment.
4. Opens PR against `SXTNmedia21/sxtn-plugin` via `gh pr create`.
5. Logs to project activity-log.

**Pontus role:** PR review + merge gate. Never auto-merge.

#### `sxtn-audit`
**Trigger:** Heartbeat (cooldown ≥7d) + `sxtn-close-campaign`.
**Checks:**
- Council members still relevant? (compare to recent council reports)
- Dispatch table still maps? (verify project subagents exist)
- Skills still loaded? (verify `.sxtn/config.yaml` skills_required[] resolves)
- DASHBOARD.md matches `git worktree list`?
- ADR coherence: every code path with feature flag has matching ADR?
- Migration coherence: every migration applied has typegen committed?

**Output:** `docs/audits/<date>-sxtn-audit.md`. Drift → Pontus alert via heartbeat-notify.sh.

---

### 5.5 Universal Skill Contract

Every SKILL.md MUST declare frontmatter conformant to:

```yaml
---
skill_name: <kebab-case>
plugin: sxtn
plugin_version_min: "1.0"
purpose: <one-line>

inputs:
  required:
    - name: <input_name>
      type: string | number | boolean | object | array
      description: <one-line>
  optional:
    - name: <input_name>
      type: <type>
      default: <value-or-derivation-rule>

preconditions:
  - <human-readable assertion>
  - file_exists: <path>
  - schema_valid: <schema_name>

reads:
  - <path or path-pattern>

writes:
  allowed:
    - <path or path-pattern>
  forbidden:
    - <path or path-pattern>           # inherits § 3.2 if omitted

validates:
  - <schema_name>

returns:
  shape: ExecutionResult                # § 3.3

idempotency:
  key_fields: [<input names that define operation identity>]
  on_duplicate: skip | reconcile | error

retry_policy:
  max_attempts: <N>
  retry_on: [F_TRANSIENT_*, F_LOCK_*]
  never_retry_on: [F_SCHEMA_INVALID, F_WRITE_FORBIDDEN]

escalation:
  on_failure: [council | pontus | block]
  council_topic: <topic_class>          # if council
---
```

Body of SKILL.md follows: full behavior description + invocation examples.

### 5.6 Skill Result Schema

All skill results conform to `ExecutionResult` (§ 3.3). Schema-validated by orchestrator at every dispatch return. Invalid result = automatic `F_SKILL_CONTRACT_VIOLATION` (§ 21).

---

## 6. Command Catalogue

6 slash commands. Each wraps existing CLAUDE.md command + adds plugin behavior.

| Command | Wraps existing | Plugin adds |
|---------|----------------|-------------|
| `/sxtn-start-campaign <name>` | `/start-campaign` | Init `.sxtn/campaigns/<name>/STATE.md`; spawn `init-council` if no `council.yaml`; register sub-sortie slots |
| `/sxtn-start-feature <name>` | `/start-feature` | Init `docs/domains/<d>/<f>/STATE.md`; run `sxtn-import` (brownfield); classify tier; S0→S1 |
| `/sxtn-close-feature` | `/close-feature` | `retro-council` → LESSONS capture → close-feature.sh gates → if 3-occurrence pattern: `sxtn-promote-lesson` PR |
| `/sxtn-close-campaign <name>` | (no existing) | Cross-sortie LESSONS synthesis; member-graduation review; archive STATE → `docs/domains/<d>/_CLOSED.md`. Worktree stays per ADR-0213 ancestry rule. |
| `/sxtn-end-session` | `/end-session` | Writes STATE "Open Pontus pings" + activity-log + claude-mem digest + heartbeat queue check |
| `/sxtn-status` | `/status` | `sxtn-dashboard` reader + STATE summary across active features |

---

## 6.1 Command Execution Contracts

Each command obeys § 3.1 Autonomy Contract and returns `ExecutionResult` (§ 3.3).

### `/sxtn-start-campaign <name>`

```yaml
required_inputs: [campaign_name]
optional_inputs:
  - base_branch (default: development)
  - dry_run (default: false)
preconditions:
  - .sxtn/config.yaml exists + schema-valid
  - campaign branch does not already exist
  - worktree slot available at <worktree_root>/<campaign_prefix><name>
reads:
  - .sxtn/config.yaml
  - .sxtn/council.yaml (if exists)
  - git worktree list
allowed_writes:
  - <worktree path> (new git worktree)
  - .sxtn/campaigns/<name>/STATE.md
  - .sxtn/campaigns/<name>/.lock
  - .sxtn/council.yaml (only if init-council fires)
  - docs/DASHBOARD.md (campaign row)
  - activity_log
forbidden_writes: per § 3.2
success_criteria:
  - campaign worktree created
  - campaign STATE.md exists + state=ACTIVE
  - DASHBOARD campaign row present
  - if no council.yaml: init-council completed
failure_modes:
  - F_CONFIG_MISSING -> run sxtn-init, abort
  - F_WORKTREE_EXISTS -> resume (read STATE, update DASHBOARD)
  - F_BRANCH_EXISTS -> abort with proposal (delete branch or pick different name)
idempotency:
  - if campaign STATE.md exists: read + reconcile, never overwrite
dry_run: prints planned worktree + branch + STATE writes without committing
escalation: pontus on F_BRANCH_EXISTS
```

### `/sxtn-start-feature <name>`

```yaml
required_inputs: [feature_name]
optional_inputs:
  - domain
  - design_url
  - tier_override
  - test_mode (continuous | end; default continuous)
  - dry_run (default false)
preconditions:
  - .sxtn/config.yaml exists + valid
  - .sxtn/council.yaml exists (else init-council fires first)
  - cwd is project root or campaign worktree
reads:
  - .sxtn/config.yaml
  - .sxtn/council.yaml
  - docs/DASHBOARD.md
  - existing docs/domains/**/<feature>/**
  - existing docs/superpowers/specs/*<feature>*-design.md
  - existing docs/plans/PLAN-*<feature>*.md
allowed_writes:
  - docs/domains/<domain>/<feature>/STATE.md
  - docs/DASHBOARD.md (sortie row)
  - .sxtn/locks/<feature>.lock
  - activity_log
forbidden_writes: per § 3.2
success_criteria:
  - STATE.md exists + validates + state=S1
  - gate_history includes G1
  - DASHBOARD sortie row present
  - lockfile acquired
  - if brownfield: sxtn-import classification recorded
failure_modes:
  - F_STATE_EXISTS -> enter resume mode (read STATE, do not overwrite)
  - F_LOCK_HELD -> abort with current owner + age (if >24h: propose break)
  - F_AMBIGUOUS_DOMAIN -> infer from feature name; fallback "general"
  - F_DESIGN_URL_404 -> escalate pontus
idempotency: safe to re-run; STATE.md not overwritten
dry_run: prints planned writes + STATE.md preview without committing
escalation: pontus on F_DESIGN_URL_404; council on tier-boundary
```

### `/sxtn-close-feature`

```yaml
required_inputs: []          # resolves feature from cwd / STATE.md
optional_inputs:
  - force (default false; requires Pontus confirmation)
  - dry_run (default false)
preconditions:
  - STATE.md state >= S7
  - all required artefakter present per § 20 manifest for S9
  - lockfile owned by this orchestrator
reads:
  - STATE.md, SPEC.md, plans/, reports/, screenshots/, journeys/
  - close-feature.sh gate definitions
allowed_writes:
  - docs/domains/<d>/<f>/reports/LESSONS-<sortie>.md
  - docs/DASHBOARD.md (remove sortie row)
  - STATE.md (state=S9, closed_at)
  - activity_log
  - claude-mem digest invocation
  - .sxtn/locks/<feature>.lock (delete)
forbidden_writes: per § 3.2
success_criteria:
  - retro-council completed
  - LESSONS-<sortie>.md written
  - close-feature.sh exits 0
  - STATE state=S9
  - DASHBOARD row removed
  - lockfile released
  - if 3-occurrence pattern detected: sxtn-promote-lesson PR opened
  - § 22 Definition of Done all checkboxes ticked
failure_modes:
  - F_ARTIFACT_MISSING -> block, surface manifest gap
  - F_CLOSE_GATE_FAIL -> block, surface block reason; never bypass via --no-verify
  - F_LOCK_NOT_OWNED -> abort (concurrent close attempt)
  - F_COUNCIL_REJECT -> apply changes if concrete, escalate if abstract
idempotency: safe to re-run; LESSONS not overwritten; DASHBOARD row removal idempotent
dry_run: prints all planned writes + close-feature.sh dry pass
escalation: pontus on F_CLOSE_GATE_FAIL; council on F_ARTIFACT_MISSING
```

### `/sxtn-close-campaign <name>`

```yaml
required_inputs: [campaign_name]
optional_inputs:
  - dry_run (default false)
preconditions:
  - campaign STATE.md exists
  - all sorties in campaign closed (state=S9)
  - no active feature locks under campaign
reads:
  - .sxtn/campaigns/<name>/STATE.md
  - all docs/domains/**/STATE.md for campaign features
  - LESSONS files across campaign
allowed_writes:
  - .sxtn/campaigns/<name>/STATE.md (state=RETIRED, closed_at)
  - docs/domains/<d>/_CLOSED.md (campaign archive)
  - docs/DASHBOARD.md (mark campaign retired, keep row)
  - activity_log
  - claude-mem digest invocation
forbidden_writes:
  - DO NOT delete campaign worktree (ADR-0213 ancestry rule)
  - DO NOT delete campaign branch
  - per § 3.2
success_criteria:
  - cross-sortie LESSONS synthesis written
  - retro-council member-graduation review complete
  - campaign STATE.md state=RETIRED
  - _CLOSED.md archive exists
failure_modes:
  - F_OPEN_FEATURES -> block, list non-S9 sorties
  - F_COUNCIL_REJECT -> apply or escalate
idempotency: safe to re-run; archive not overwritten
dry_run: prints archive writes; no STATE mutation
escalation: pontus on irrecoverable F_OPEN_FEATURES
```

### `/sxtn-end-session`

```yaml
required_inputs: []
optional_inputs:
  - message
  - dry_run (default false)
preconditions:
  - within active session
reads:
  - all active STATE.md across project
  - DASHBOARD.md
  - heartbeat queue
allowed_writes:
  - STATE.md "Open Pontus pings" sections (across active features)
  - activity_log session-end entry
  - claude-mem session_digest invocation
  - heartbeat state file
forbidden_writes: per § 3.2
success_criteria:
  - all active STATE.md pings updated
  - activity_log session-end appended
  - claude-mem digest triggered
  - heartbeat queue checked
failure_modes:
  - F_CLAUDE_MEM_UNREACHABLE -> degraded mode, log warning, continue
idempotency: safe to re-run within same session
dry_run: shows planned pings + digest invocation
escalation: none (session-end is terminal)
```

### `/sxtn-status`

```yaml
required_inputs: []
optional_inputs:
  - --verbose
  - --campaign <name>
  - --feature <name>
preconditions: none
reads:
  - docs/DASHBOARD.md
  - all active STATE.md
  - git worktree list
  - heartbeat state
allowed_writes: NONE (read-only)
forbidden_writes: ALL writes forbidden
success_criteria:
  - report rendered with: active campaigns, active sorties, pending journeys, gate awaiting, free slots, heartbeat due
  - DASHBOARD vs worktree-list reconciliation reported
failure_modes:
  - F_DASHBOARD_DRIFT -> report drift, do not auto-repair (suggest sxtn-audit)
idempotency: trivially idempotent (read-only)
dry_run: no-op (already read-only)
escalation: none
```

---

## 7. Template & Schema Catalogue

### Templates (8)

| Template | Purpose | Source |
|----------|---------|--------|
| `STATE.md.tmpl` | Per-feature state | Extract HMS `docs/domains/hms/wizard/STATE.md` |
| `SPEC.md.tmpl` | Feature spec | Extract HMS `SPEC.md` |
| `PLAN.md.tmpl` | Per-plan blueprint | Extract HMS `PLAN-sortie-1a.md` |
| `QUESTIONNAIRE.md.tmpl` | S3 questionnaire | Extract HMS `QUESTIONNAIRE.md` |
| `COUNCIL-report.md.tmpl` | Council verdict report | Extract HMS `COUNCIL-import-*.md` |
| `ADR.md.tmpl` | ADR draft | Derive from `docs/templates/decision.md` |
| `MIGRATION.sql.tmpl` | New migration with RLS + workspace_id stub | New |
| `DASHBOARD.md.tmpl` | Project DASHBOARD | Derive from `docs/DASHBOARD.md` |

### Schemas (5)

| Schema | Validates |
|--------|-----------|
| `state.schema.json` | STATE.md frontmatter + gate-history shape |
| `council.schema.json` | `.sxtn/council.yaml` member roster + dispatch rules |
| `config.schema.json` | `.sxtn/config.yaml` per-project adapter |
| `adr.schema.json` | ADR.md frontmatter (status, slot, dependencies) |
| `dashboard.schema.json` | DASHBOARD.md pure-git-state shape |

---

## 8. Per-Project Adapter

### `.sxtn/config.yaml`

```yaml
plugin_version: "1.0"                # pin plugin version per project

project:
  name: smartout
  worktree_root: ~/dev
  campaign_prefix: "smartout.ai-"
  domain_root: docs/domains
  feature_layout: "<domain>/<feature>"
  branch_convention: campaign-direct  # or: feat-per-plan

stack:                                # locked, validated against plugin assumption
  language: typescript
  database: supabase
  deploy: vercel

paths:
  decisions: docs/decisions
  migrations: supabase/migrations
  log_script: ~/.claude/scripts/log-activity.sh
  dashboard: docs/DASHBOARD.md

dispatch_table:
  s2_brainstorm: <project_agent_name>          # e.g. general-purpose
  s3_spec_writer: <project_agent_name>
  s4_spec_writer: <project_agent_name>
  s5_plan_generator: <project_agent_name>
  s6_phase_a:
    capabilities: <project.capability_builder_agent>   # e.g. botsson-harness-builder
    ui: <project.ui_designer_agent>                    # e.g. frontend-designer
    default: <project_agent_name>
  s6_pre_b_reviewer: <project_agent_name>
  s6_phase_b_verifier: <project_agent_name>
  s6_phase_c_journey: <project_agent_name>
  failure_escalation: <project.escalation_agent>       # e.g. system-steward

skills_required:                                       # project-shipped skills plugin loads
  - <project_skill_name>
  - <project_skill_name>
  # see examples/<project>/config.yaml for concrete adapter

council_skill: run-council                             # always plugin-shipped
```

**Concrete project examples live under `examples/<project>/config.yaml`.** Plugin core uses placeholders only; project-specific agent and skill names are isolated to `examples/`. See § 14 Migration for Smartout adapter as reference implementation.

### `.sxtn/council.yaml`

Written by `init-council`. Shape:

```yaml
plugin_version: "1.0"
council_version: 1

base_members:                          # always-on, locked
  - security-guard
  - framework-guard
  - code-reviewer
  - safety-guard
  - migration-guard
  - deploy-guard
  - schema-guard
  - adr-guard

conditional_members:
  - name: cascade-developer
    enabled: true                      # questionnaire Q3
    triggers: [schedule, d6, cascade]
  - name: mobile-ux
    enabled: true                      # questionnaire Q4
    triggers: [mobile, react-native]
  - name: payroll-engine-expert
    enabled: true                      # brownfield scan detected
    triggers: [payroll, tariff, settlement]

dispatch_rules:
  topic_to_members:
    schema-lock: [schema-guard, adr-guard, code-reviewer]
    cross-domain: [adr-guard, code-reviewer, safety-guard]
    capability-surface: [code-reviewer, security-guard, adr-guard]
    deviation: [code-reviewer, frontend-designer, safety-guard]
    g6-3-strike: [system-steward, code-reviewer, all-base]
    import: [code-reviewer, all-base, conditional-by-domain]

retro_rules:
  upgrade_member_model_threshold: 3    # 3 council REJECTs by member → upgrade haiku→sonnet→opus
  graduate_member_threshold: 5         # 5 sorties with 0 contributions → remove from council
  promote_lesson_threshold: 3          # 3 LESSONS files with same pattern → plugin-PR
```

---

## 9. State Machine Reference

**Authoritative source:** `docs/superpowers/specs/2026-05-28-smartout-development-state-machine-design.md`.

Plugin implements states S0-S9, gates G1-G8, tiers T1-T4, IMPORT MODE exactly per that spec. **Do not duplicate logic here.** Plugin extracts the orchestrator's *behavior* per state from current `.claude/agents/sdsm-orchestrator.md` v2 — corrected for the H1 drift identified in 2026-05-28 review:

| State | Pontus stop? | Council? | Auto? |
|-------|--------------|----------|-------|
| S0 → S1 (G1) | No | No | Yes (curl design-link) |
| S1 → S2 (G2) | No | No | Yes (INVENTORY non-empty + tier set) |
| S2 → S3 (G3) | **No** (was yes pre-v2) | If open arch Q | Yes if Q have defaults |
| S3 → S4 (G4) | **No** (was yes pre-v2) | If 2+ open arch Q | Yes if SPEC unambiguous |
| S4 → S5 (G5) | **No** (was yes pre-v2) | If plan-order ambiguous | Yes (default `continuous`) |
| S5 → S6 (G6) | No | After 3-strike self-fix fail | Yes (verify.sh output) |
| S6 → S7 (G7) | No | After per-failure escalation | Yes (Playwright exit code) |
| S7 → S8 (G8) | **YES** — sole Pontus-stop | No (Pontus only) | No (interactive prompt) |
| S8 → S9 | No | No | Yes (`close-feature.sh` exit) |

---

## 10. Gate Handling

Per orchestrator agent body v2 § "Gate handling — auto vs Pontus" with H1 corrections applied:

```
ALL gates auto-validate per § 9 table.
G3/G4/G5: auto if unambiguous, council if ambiguous, NEVER Pontus-stop.
G8: ALWAYS Pontus-stop. Capture 7 screenshots + side-by-side mockup ref. Stop.
T4 cross-campaign sync: Pontus-stop.
3-strike self-fix + 1 council consult both failed: Pontus-stop (escalation).
```

**Council loop cap (closes orchestrator H4):** Max 2 council consults per gate. Then escalate Pontus regardless of council verdict.

---

## 11. Locked Stack Assumptions

Plugin assumes:

| Layer | Tool | Rationale |
|-------|------|-----------|
| Language | TypeScript strict | Pontus directive: "TS everywhere — no exceptions" |
| Database | Supabase (PostgreSQL 17) | RLS-everywhere, dual-auth (JWT + API key), migration timestamp ordering, typegen |
| Deploy | Vercel + Supabase Cloud | Branch DB for preview, EF for backend, Vercel Web/Edge |
| Test | Playwright (E2E) + Vitest (unit) | Standard SXTN stack |
| Build | pnpm + Turborepo | Monorepo assumption |

**Forking:** Other-stack projects fork plugin. Plugin core does not abstract these.

---

## 12. Self-Improvement Loop

```
Sortie close (S9)
  ↓
sxtn-lesson-capture writes LESSONS-<sortie>.md
  ↓
retro-council reviews (sortie + cross-sortie patterns)
  ↓
3-occurrence pattern detected?
  ├─ NO → log to claude-mem + activity-log, done
  └─ YES → sxtn-promote-lesson
            ↓
       drafts CHANGELOG entry + agent-body delta + spec amendment
            ↓
       gh pr create against SXTNmedia21/sxtn-plugin
            ↓
       Pontus reviews PR
            ↓
       Merge → /plugin update sxtn → version bump
            ↓
       All consuming projects pull on next `sxtn-status`
```

**Governance:** Pontus = sole merge authority. Auto-merge forbidden. Plugin version pinning per project = blast radius zero on bad merge.

---

## 13. Multi-Project Model

### Validation criteria for "multi-project proven"

- **Project A (Smartout):** F1-F4 shipped. ≥3 sorties green S9. Plugin version 1.x stable.
- **Project B (TBD):** Plugin installed via marketplace. `init-council` completes. ≥1 sortie green S9.

### Candidate Project B

- `second-brain-v2` (vault — different domain, validates non-Smartout context)
- Other SXTN project (lower complexity, validates new domain)

Decision deferred to post-F4. First validation = does plugin work standalone on Smartout.

### Configuration drift prevention

- `config.yaml` schema-validated on every command invocation
- Plugin emits warning if `plugin_version` in config doesn't match installed plugin version
- `sxtn-audit` heartbeat catches dispatch_table drift (subagent missing, skill renamed)

---

## 14. Migration from Current Orchestrator

### HMS pilot compatibility

HMS Wizard STATE.md uses `sdsm_*` frontmatter fields (`sdsm_autonomous_activated_at`, `sdsm_tightened_autonomy_at`). Plugin reads both `sdsm_*` and `sxtn_*` for one minor release (alias map in `sxtn-state` skill). Deprecation warning emitted. Hard cutover at plugin v2.0.

### Cutover sequence

1. HMS Wizard closes S9 (live as of 2026-05-28: plan-3 dispatching, ~3 plans remaining).
2. Extraction sortie `sxtn-plugin-extraction` runs (per implementation plan).
3. Plugin v0.1 installed user-scope. `.sxtn/config.yaml` written for Smartout.
4. Existing `.claude/agents/sdsm-orchestrator.md` deleted from project; replaced by plugin agent.
5. Next sortie (post-HMS) uses plugin lifecycle commands exclusively.
6. Old `/start-feature` etc. commands aliased to `/sxtn-start-feature` for transition; removed at v2.0.

### Files removed from project on cutover

- `.claude/agents/sdsm-orchestrator.md` → moved to plugin
- `.claude/skills/run-council/` → moved to plugin (project loads from plugin)
- `~/.claude/commands/{start-feature,close-feature,start-campaign,end-session}.md` → aliased to plugin commands

### Files retained in project

- `.claude/skills/smartout-*` (project-specific kit, plugin reads via config)
- `docs/superpowers/specs/2026-05-28-smartout-development-state-machine-design.md` (SDSM spec, copied to plugin docs/SPEC.md as canonical reference)
- All HMS pilot artefakter (`docs/domains/hms/wizard/`)

---

## 15. Rollout Plan

### F1 — Core (3 work-days)

**Ships:** agent + 6 commands + plugin.json + 7 plumbing skills (state, import, gate, tier, dispatch, evidence, dashboard).

**Acceptance:** Plugin installs, orchestrator runs, can drive a S0→S9 sortie end-to-end on Smartout. STATE.md/DASHBOARD.md writes work. No council yet (auto-only gates).

### F2 — Council + governance (4 work-days)

**Ships:** 3 council skills (init/run/retro) + 2 governance skills (adr/migration) + council.schema.json + ADR.md.tmpl + MIGRATION.sql.tmpl + sxtn-migration-lint.sh.

**Acceptance:** `init-council` completes for Smartout. Council triggers fire at G6/import/deviation. ADR drafting + decision-log register work. Migration lint pre-push gate active.

### F3 — Self-improvement (3 work-days)

**Ships:** 3 self-improve skills (lesson-capture, promote-lesson, audit) + sxtn-promote-lesson.sh + sxtn-audit.sh.

**Acceptance:** First LESSONS file written on next sortie close. Audit heartbeat scheduled. Plugin-PR draft mechanism tested with dry-run.

### F4 — Polish (2 work-days)

**Ships:** All 8 templates + 5 schemas (full validation) + examples/ + docs/ + README.

**Acceptance:** Plugin self-validates on install. Examples readable. Schemas catch malformed YAML. Marketplace metadata complete.

### Post-F4 — Multi-project validation

Install on Project B. Run `init-council`. Drive first sortie. If green: plugin v1.0 published to marketplace.

---

## 16. Risks & Open Questions

### Risks

| Risk | Mitigation |
|------|-----------|
| Premature lock-in freezes pilot-bug shape | Wait until HMS S9 CLOSED before extraction start |
| 16-skill surface explosion | Hard rule: skills only added via ADR-grade plugin RFC, not "I had an idea" |
| Smartout-isms leak into plugin core | Strict review: any `apps/`/`packages/`/`supabase/`/`smartout-*` ref in plugin = block |
| Plugin update breaks live sortie | Pin plugin_version per project; orchestrator reads pinned spec, not latest |
| Self-improvement loop unsupervised | Plugin updates via PR only; Pontus = merge gate |
| `sxtn-audit` heartbeat spam | Default cooldown ≥7d |
| Council base members add cost floor | Council short-circuit allowed: skip if gate auto-passes |
| Subagent commit-collision (Smartout L-2026-05-20 pattern) | sxtn-dispatch enforces per-agent worktree isolation when fan-out >2 |

### Open Questions

1. **Plugin repo location:** Confirm `SXTNmedia21/sxtn-plugin` as canonical (vs `smartout/sxtn-plugin` or `sxtn-org/plugin`).
2. **Marketplace publish:** Anthropic Claude Code marketplace acceptance criteria for self-improving plugins — research before F4.
3. **Plugin version pinning enforcement:** Hard-fail vs warn when project pins below installed plugin version?
4. **Council member registry:** Plugin-shipped registry of generic members (security/framework/etc.) vs project-resolved per dispatch table? **Current SPEC assumes plugin-shipped base + project-shipped conditional.**
5. **Cross-project lesson promotion:** Lessons from Project A promote to Project B automatically (via plugin update) or only on Pontus-initiated propagation? **Current SPEC: via plugin update, opt-in via plugin_version bump.**

---

## 17. Acceptance Criteria

Plugin extraction sortie is COMPLETE (S9-ready) when:

### Functional

- [ ] `/plugin install sxtn` works user-scope AND exposes all 6 commands + 16 skills
- [ ] `.sxtn/config.yaml` schema-validates for Smartout
- [ ] `.sxtn/council.yaml` written by `init-council` for Smartout in one bounded init flow
- [ ] `/sxtn-start-campaign` creates campaign STATE + acquires lock
- [ ] `/sxtn-start-feature` creates feature STATE + DASHBOARD row + acquires lock
- [ ] Every command supports `--dry-run` per § 24
- [ ] Orchestrator drives one full S0→S9 sortie on Smartout per § 22 Definition of Done
- [ ] G8 Pontus-stop fires with screenshot bundle + evidence per § 25
- [ ] `/sxtn-close-feature` runs retro-council + close-feature.sh + LESSONS capture + lock release
- [ ] DASHBOARD.md matches `git worktree list` post-close
- [ ] sxtn-migration lint blocks bad timestamp PR
- [ ] sxtn-adr drafts + registers ADR on Smartout
- [ ] First LESSONS file written + 1-occurrence logged
- [ ] No `F_WRITE_FORBIDDEN` events for plugin orchestrator in activity log
- [ ] No `F_SUBAGENT_FABRICATION` events unresolved
- [ ] All `ExecutionResult.evidence` fields verified per § 25

### Quality

- [ ] Zero `apps/`/`packages/`/`supabase/`/`smartout-*` strings in plugin source (grep gate)
- [ ] All 5 schemas validate against templates
- [ ] All 16 SKILL.md files have YAML frontmatter
- [ ] Plugin `docs/SPEC.md` canonical content hash matches extraction spec hash recorded in `CHANGELOG.md` (or content matches verbatim under canonical-spec section if plugin docs require additional install/usage prose)
- [ ] `docs/SPEC.sha256` exists alongside `docs/SPEC.md` and matches
- [ ] CHANGELOG.md initialized with v0.1 entry referencing spec hash

### Validation

- [ ] HMS pilot completes S9 BEFORE extraction starts (gate)
- [ ] Extraction sortie runs in dedicated worktree (`~/dev/smartout.ai-sxtn-plugin-extraction`)
- [ ] Extraction sortie itself uses old orchestrator (dogfood-paradox avoided)
- [ ] Plugin v0.1 tagged `v0.1.0` in `SXTNmedia21/sxtn-plugin`
- [ ] First post-extraction Smartout sortie uses plugin commands (proof of cutover)

---

## 18. References

### Internal

- `docs/superpowers/specs/2026-05-28-smartout-development-state-machine-design.md` — SDSM spec (state machine, gates, tiers, IMPORT MODE)
- `.claude/agents/sdsm-orchestrator.md` v2 — current orchestrator agent body
- `docs/domains/hms/wizard/STATE.md` — first SDSM pilot, live as of 2026-05-28
- `docs/decisions/0075-knowledge-system-consolidation.md` — DASHBOARD.md = pure git state, ADR-0075
- `docs/decisions/0213-campaign-prs-use-merge-commit-not-squash.md` — campaign branch protocol
- `docs/decisions/0392-domain-spine.md` — `docs/domains/<d>/<f>/` spine structure
- `CLAUDE.md` (project) — code conventions, hard rules, mandatory protocols
- `~/.claude/CLAUDE.md` (global) — git workflow, worktree workflow, orchestrator dispatch protocol

### External

- Claude Code Plugin Marketplace conventions (Anthropic docs)
- `~/.claude/plugins/cache/claude-plugins-official/superpowers/5.1.0/` — superpowers plugin reference for skill/template/schema layout

### Sibling Smartout Lessons

- L-0042 — migration timestamp ordering
- L-0083 — typegen behind-DB drops columns
- L-0147 — single-axis council insufficient; outsider-renumber pattern
- L-0176 — docstring drift from body
- L-0177 — silent fallback on row-not-found
- L-0299 — pipe-mask in HOP A scripts
- L-2026-05-17 — builder-agent fabrication
- L-2026-05-20 — sub-agent commit-collision
- WSL2 OOM endemic — close-feature.sh free -h gate candidate

---

---

## 19. Idempotency & Resume Rules

Every plugin command and skill MUST be safe to re-run. Resume is the default, not the exception.

### Rules

1. **Read before write.** Every write operation begins with a read to check existing state.
2. **Never overwrite unprompted.** If target artefakt exists, reconcile or skip; never silently replace.
3. **Partial execution = resumable.** Every operation that could fail mid-way writes a checkpoint to STATE.md `subagent_log` BEFORE the failure point.
4. **No destructive defaults.** Commands never delete artefakter unless explicitly in `destructive_actions.explicit_allow_list` (§ 3.2).
5. **State hash check.** Operations that modify STATE.md compute `input_state_hash` before write. Mismatch on resume = `F_STALE_INPUT` (§ 21), retry with fresh read.
6. **Lockfile-protected concurrency.** See § 23.

### Per-artefakt resume behavior

| Artefakt | If exists at command start | Action |
|----------|----------------------------|--------|
| STATE.md | yes | Read + reconcile; never overwrite frontmatter blindly |
| DASHBOARD row | yes | Update in place; never duplicate |
| SPEC.md | yes | Refuse to regenerate; require explicit `--force` |
| PLAN-*.md | yes per slot | Skip existing slots; generate only missing |
| Council report | yes for timestamp | Append-only; new report = new timestamp |
| ADR slot | yes | Outsider-renumber to next free slot (L-0147 pattern) |
| Migration timestamp | clash with applied | Re-timestamp to repo-tip + 1 second (L-0042) |
| LESSONS-*.md | yes | Refuse to overwrite; append `-v2` suffix if reopened |
| Lockfile | yes + same owner | OK, continue |
| Lockfile | yes + different owner < 24h | Abort, surface owner + age |
| Lockfile | yes + different owner > 24h | Propose break, require explicit confirm |
| Worktree | yes | Resume in place; never recreate |

### Failure mid-command

When a command fails mid-execution:

1. Write `last_checkpoint` to STATE.md with timestamp + step name + error code.
2. Set state to current S<N> (no advance).
3. Release lockfile only if failure is non-resumable.
4. Return `ExecutionResult.status = "failed"` with checkpoint reference.
5. Next invocation reads `last_checkpoint`, resumes from that step.

---

## 20. State Artifact Manifest

For every state S0-S9, the plugin defines required + optional artefakter. State transitions are invalid if required artefakter missing.

```yaml
S0:                                         # IDLE
  required: []
  optional: []

S1:                                         # STARTED
  required:
    - docs/domains/<d>/<f>/STATE.md
    - docs/DASHBOARD.md sortie row
    - .sxtn/locks/<f>.lock
  optional:
    - design_link in STATE frontmatter

S2:                                         # DISCOVERING
  required:
    - INVENTORY-REPORT.md
    - tier classification in STATE
  optional:
    - DESIGN-MAPPING.md
    - DESIGN-DEVIATIONS.md

S3:                                         # QUESTIONNAIRE-PENDING
  required:
    - QUESTIONNAIRE.md
  optional:
    - reports/COUNCIL-inventory-*.md         # if uncertainty

S4:                                         # SPEC-DRAFT
  required:
    - SPEC.md (or reference to docs/superpowers/specs/*<f>*-design.md)
  optional:
    - reports/COUNCIL-spec-*.md              # if 2+ open arch Q

S5:                                         # PLANS-GENERATED
  required:
    - plans/PLAN-*.md (>= 1)
    - tier stamp per plan
  optional: []

S6:                                         # PLAN-RUNNING
  required (per plan):
    - feat-branch or campaign commit per plan
    - phase-verifier output captured
    - reports/COUNCIL-g6-*.md                # if 3-strike
  optional:
    - screenshots/<route>/*.png

S7:                                         # ALL-PLANS-DONE
  required:
    - all plans state=DONE
    - Playwright suite green (if test_mode=end)
  optional: []

S8:                                         # PRODUCT-ACCEPT
  required:
    - screenshots/g8/reference.png            # design source side-by-side reference
    - screenshots/g8/desktop-after.png
    - screenshots/g8/mobile-after.png
    - screenshots/g8/tablet-after.png
    - screenshots/g8/primary-flow-1.png
    - screenshots/g8/primary-flow-2.png
    - screenshots/g8/error-or-empty-state.png
    - DESIGN-DEVIATIONS.md resolution log     # every deviation resolved or accepted
    - DESIGN-MAPPING.md                       # every mapping implemented/deferred/deviation
    - evidence bundle (telemetry-emit + API-call verification)
  policy:
    g8_evidence:
      min_screenshots: 7
      required_viewports: [desktop, mobile, tablet]
      configurable_via: .sxtn/config.yaml g8_evidence_policy
  optional:
    - screenshots/g8/before.png               # pre-change reference if relevant

S9:                                         # CLOSED
  required:
    - reports/LESSONS-<sortie>.md
    - close-feature.sh exit 0 captured
    - DASHBOARD row removed
    - lockfile released
    - claude-mem digest triggered
    - all ADRs referenced registered in decision-log
  optional:
    - sxtn-promote-lesson PR (if 3-occurrence pattern)
```

**Validation:** `sxtn-state` verifies manifest at every state transition. Missing required artefakt = `F_ARTIFACT_MISSING` (§ 21), block transition.

---

## 21. Failure Taxonomy

Plugin uses fixed failure codes. Agents map exceptions to these codes — never to freeform strings.

| Code | Meaning | Recoverable | Default agent action |
|------|---------|-------------|----------------------|
| `F_CONFIG_MISSING` | `.sxtn/config.yaml` missing | yes | Run `sxtn-init`, then retry |
| `F_CONFIG_INVALID` | Config fails schema | yes (with patch) | Surface repair patch, block until fixed |
| `F_COUNCIL_MISSING` | `.sxtn/council.yaml` missing | yes | Run `init-council`, then retry |
| `F_STATE_MISSING` | Expected STATE.md missing | yes | Run `sxtn-import` |
| `F_STATE_INVALID` | STATE.md schema invalid | sometimes | Repair if safe (auto-migrate fields); else escalate |
| `F_STALE_INPUT` | `input_state_hash` mismatch on resume | yes | Recompute from fresh read, retry once |
| `F_GATE_FAILED` | Gate validation failed | yes | Retry self-fix once; then council (cap 2); then Pontus |
| `F_COUNCIL_REJECT` | Council rejects proposal | sometimes | Apply changes if concrete; else escalate |
| `F_WRITE_FORBIDDEN` | Attempted write outside § 3.2 | no | Abort immediately, log violation |
| `F_ARTIFACT_MISSING` | Required artefakt for state missing per § 20 | yes | Generate or block transition |
| `F_LOCK_HELD` | Another orchestrator owns lockfile | depends | Abort if <24h; propose break if >24h |
| `F_LOCK_NOT_OWNED` | Operation requires lock not owned | no | Abort |
| `F_TOOL_UNAVAILABLE` | Required CLI tool missing | yes | Surface install instructions, block |
| `F_DESIGN_URL_404` | design_link unreachable | yes (manual) | Escalate Pontus |
| `F_DASHBOARD_DRIFT` | DASHBOARD doesn't match worktree list | yes | Surface drift; never auto-repair (require sxtn-audit) |
| `F_CLOSE_GATE_FAIL` | `close-feature.sh` blocked | yes | Surface block reason; fix; retry; never bypass |
| `F_SUBAGENT_FABRICATION` | Subagent claims done but no commits exist (L-2026-05-17) | yes | Re-dispatch with verify-commits instruction |
| `F_TELEMETRY_MISSING` | Registry entry without `emit()` call-site (L-0083 sibling) | yes | Block G6; re-dispatch with wire-emit instruction |
| `F_SCHEMA_DRIFT` | Plugin schema version mismatch with project pin | depends | Warn + degrade if minor; block if major |
| `F_SKILL_CONTRACT_VIOLATION` | Skill returned non-`ExecutionResult` shape | no | Abort dispatch, mark skill broken |
| `F_PLAYWRIGHT_FLAKE` | E2E failed once | yes | Rerun once; 2 fails → quarantine + escalate |
| `F_WSL_OOM` | SIGTERM 143 during heavy task | yes | Suggest `free -h` + `TURBO_CONCURRENCY=1`, retry once |
| `F_OPEN_FEATURES` | Campaign close attempted with non-S9 sorties | yes | Block, list open sorties |
| `F_BRANCH_EXISTS` | Branch already exists on `sxtn-start-campaign` | yes | Abort with proposal |
| `F_AMBIGUOUS_DOMAIN` | Domain not inferable for new feature | yes | Use `general` fallback or escalate |
| `F_CLAUDE_MEM_UNREACHABLE` | claude-mem MCP unreachable | yes | Degrade gracefully, log warning |
| `F_DRY_RUN_UNSUPPORTED` | Underlying script lacks `--dry-run` capability | no | Abort dry-run; surface missing capability; never invoke real script |
| `F_USABILITY_FAIL` | Phase B usability check failed (§ 28) | yes | Block G6; surface failing check; re-dispatch build with concrete fix |
| `F_DESIGN_MAPPING_MISSING` | DESIGN-MAPPING.md absent when design package present (§ 27) | yes | Block G5→S6; dispatch design-mapping subagent |
| `F_DESIGN_DEVIATION_UNRESOLVED` | Mapping has unresolved deviation at G8 (§ 27) | yes | Block G8; require resolution or explicit defer-to-sortie |
| `F_SUBAGENT_PROMPT_INVALID` | Dispatch prompt missing required field (§ 26) | no | Abort dispatch; do not spawn |

**Recoverable** = retry policy may apply. **Non-recoverable** = always abort + escalate.

---

## 22. Definition of Done for Autonomous Sortie

A sortie is **NOT S9 CLOSED** unless ALL checkboxes tick:

- [ ] All required artefakter exist per § 20 manifest for S9
- [ ] All schemas validate (STATE, ADR, council, dashboard)
- [ ] All gate-history entries complete (no `AWAITING` in history)
- [ ] No unresolved entries in `OPEN-QUESTIONS.md` (root)
- [ ] No `F_WRITE_FORBIDDEN` events in activity log for this sortie
- [ ] No `F_SUBAGENT_FABRICATION` events unresolved
- [ ] DASHBOARD.md matches current worktree state
- [ ] All migrations created during sortie pass `sxtn-migration lint`
- [ ] All ADRs referenced in STATE registered in `docs/decisions/0000-decision-log.md`
- [ ] G8 evidence bundle exists if UI was touched (screenshots + design-deviation resolution)
- [ ] `reports/LESSONS-<sortie>.md` exists + populated
- [ ] `close-feature.sh` exits 0
- [ ] Lockfile released
- [ ] Activity log session-end appended
- [ ] claude-mem digest triggered
- [ ] All `ExecutionResult.evidence` fields verified per § 25

"Done" without all checkboxes = false-positive. Orchestrator MUST refuse to mark S9 unless every box ticks.

---

## 23. Locking & Concurrency

### Lockfile

Path: `.sxtn/locks/<feature>.lock` (feature) or `.sxtn/campaigns/<name>/.lock` (campaign).

Shape:

```yaml
feature: <feature-name>                # or campaign: <campaign-name>
domain: <domain>
owner_invocation_id: <UUID>
acquired_at: <ISO-8601>
last_heartbeat_at: <ISO-8601>
orchestrator_pid: <int>
state_at_acquire: <S0-S9>
```

### Acquisition

- `/sxtn-start-feature` acquires lock atomically (write-if-not-exists).
- Lock heartbeat every 10 min while orchestrator active.
- Stale lock = `last_heartbeat_at` > 30 min ago.

### Rules

1. Only one orchestrator may own a feature STATE.md at a time.
2. Sub-skills inherit the orchestrator's lock; no nested locking.
3. Lock release only at: `/sxtn-close-feature` success, explicit Pontus break, or stale-lock break.
4. Stale-lock break: surface to Pontus with current owner + age; require explicit y/N.
5. Concurrent `/sxtn-start-feature` for same feature = `F_LOCK_HELD`, abort second invocation.

### Campaign lock

Held by `/sxtn-start-campaign`, released by `/sxtn-close-campaign`. Sub-sortie locks nest under campaign lock informationally (no nested mutex semantics; campaign lock is advisory).

### Pre-write check

Every write operation:

1. Reads feature/campaign lock.
2. Verifies `owner_invocation_id` matches current orchestrator.
3. Mismatch = `F_LOCK_NOT_OWNED`, abort.

---

## 24. Dry-Run Mode

Every plugin command MUST support `--dry-run`.

### Semantics

- Read-only: zero writes, zero side-effects.
- Renders complete `ExecutionResult` with `files_written` listed but NOT actually written.
- Lockfile NOT acquired.
- Council NOT dispatched (preview-only proposal listed in result).
- Subagent NOT spawned (preview shows would-dispatch + model + prompt).
- Returns `status: "preview"` (ExecutionResult variant per § 3.3).

### Use cases

- Pre-flight before destructive operations
- CI gates verifying plugin coherence
- Pontus visibility before letting agent run
- Test harness for plugin development

### Required dry-run support per command

| Command | Dry-run behavior |
|---------|------------------|
| `/sxtn-start-campaign` | Shows worktree + branch + STATE writes; no creation |
| `/sxtn-start-feature` | Shows STATE + DASHBOARD + lockfile writes; no creation |
| `/sxtn-close-feature` | Shows LESSONS + close-feature.sh dry pass; no commit |
| `/sxtn-close-campaign` | Shows archive writes; no STATE mutation |
| `/sxtn-end-session` | Shows STATE pings + claude-mem digest; no triggers |
| `/sxtn-status` | No-op (already read-only) |

### Skill-level dry-run

Skills MUST accept `dry_run: true` in inputs. Same semantics: zero writes, return preview.

### Underlying script dry-run requirement

If an underlying script (e.g. `close-feature.sh`, `migration-lint.sh`, project-shipped lifecycle scripts) does not support `--dry-run`:

- Plugin MUST NOT invoke the real script during dry-run mode.
- Plugin MUST either: (a) simulate the script's checks read-only via plugin code, OR (b) return `F_DRY_RUN_UNSUPPORTED` with the missing dry-run capability surfaced.
- Plugin MUST NEVER fall through to running the real script "since it's probably idempotent" — fake-safe dry-run is forbidden.

Required dry-run support on underlying scripts (extraction sortie MUST ensure):

- `close-feature.sh` MUST support `--dry-run` (gate checks read-only)
- `migration-lint.sh` MUST support `--dry-run` (lint already read-only; flag for explicit confirmation)
- `sxtn-promote-lesson.sh` MUST support `--dry-run` (preview PR body without `gh pr create`)
- `infra/scripts/promote-preview.sh` is NEVER invoked by plugin (out of scope; deploy-conductor's surface)

Missing dry-run capability on any plugin-invoked script = `F_DRY_RUN_UNSUPPORTED` (§ 21), abort.

---

## 25. No-Fabrication Policy

The agent MUST NOT claim that artefakter exist unless they exist on disk at the path stated.

### Forbidden behaviors

- Claiming `tests pass` without `pnpm test` exit 0 captured
- Claiming `migration applied` without `supabase db push` or `db reset` output captured
- Claiming `council verdict APPROVE` without `reports/COUNCIL-*.md` written
- Claiming `screenshots captured` without files in `screenshots/`
- Claiming `PR opened` without `gh pr view <#>` confirmed
- Claiming `lesson promoted` without commit in plugin repo
- Claiming `commit landed` without `git log` confirming SHA

### Verification rule

For every claim made by a subagent in its return message:

1. Orchestrator extracts claim ("4 commits shipped", "tests green", "screenshots captured").
2. Orchestrator runs verification command (`git log`, `ls`, `pnpm test`, `gh pr view`).
3. Verification mismatch = `F_SUBAGENT_FABRICATION` (§ 21).
4. Re-dispatch subagent with `verify-before-claiming` instruction.
5. Second occurrence on same sortie = escalate Pontus.

### Pattern source

Smartout L-2026-05-17 — sonnet build-agent claimed 6 deliverables shipped, zero files written. Caught by `ls` + `grep`. Pattern reproducible across multiple sorties.

### Enforcement

- Every `ExecutionResult.evidence` field MUST link to on-disk artefakt or be `null`.
- `null` evidence with non-null claim in `summary` = `F_SKILL_CONTRACT_VIOLATION` (§ 21).
- `sxtn-audit` heartbeat re-verifies claimed evidence weekly; drift = Pontus alert.

---

---

## 26. Subagent Prompt Contract

Every prompt dispatched by `sxtn-dispatch` to a subagent MUST include these fields. Free-text prompts forbidden.

### Required fields

```yaml
mission:                            # one-line goal
  type: string
  example: "Implement chapter 1 wizard end-to-end per PLAN-sortie-1a.md Wave 2"

context_files:                      # files subagent must read before acting
  required:
    - docs/domains/<d>/<f>/STATE.md
    - docs/domains/<d>/<f>/SPEC.md
    - docs/domains/<d>/<f>/plans/PLAN-<N>.md
    - docs/domains/<d>/<f>/INVENTORY-REPORT.md
  optional:
    - DESIGN-MAPPING.md
    - DESIGN-DEVIATIONS.md

allowed_writes:                     # paths the subagent may write
  - <explicit list per plan scope>

forbidden_writes:                   # inherits § 3.2 + plan-specific guard
  - <explicit list, e.g. sibling-chapter paths during vertical-slice>

acceptance_criteria:                # falsifiable, machine-checkable
  - <list of testable assertions>

verification_commands:              # subagent MUST run these and capture output
  - pnpm typecheck
  - pnpm test --filter <scope>
  - git log --oneline <base>..<branch>
  - <plan-specific check>

evidence_paths:                     # subagent MUST write artefakter here
  - <screenshots / test results / migration files>

expected_git_diff:                  # rough shape — file count + scope hint
  files_touched_estimate: <N>
  scopes: [<plan-affected modules>]

return_contract:
  shape: ExecutionResult             # § 3.3
  must_include:
    - files_written (verified via ls)
    - git_commits (SHAs verifiable via git log)
    - validation_results (typecheck + tests with exit codes)
    - evidence paths

no_fabrication_reminder:            # literal inclusion in subagent prompt
  text: |
    Do NOT claim work is done unless every file in files_written exists on disk
    and every commit in git_commits resolves via git log. Verify before reporting.
    Per spec § 25 — fabrication = F_SUBAGENT_FABRICATION, re-dispatch + escalate.
```

### Enforcement

- `sxtn-dispatch` validates every prompt against this schema before spawning.
- Missing required field → `F_SUBAGENT_PROMPT_INVALID` (§ 21), abort dispatch, do not spawn.
- Subagent returning result without verifiable `files_written` / `git_commits` → `F_SUBAGENT_FABRICATION` (§ 21).

### Rationale

`sxtn-dispatch` may be perfect, but if the prompt to the subagent is loose, deliverables drift. Prompt contract is the firewall between orchestrator intent and subagent execution.

---

## 27. Design Package Enforcement

If a design package exists for a feature (Cloud Design link, Figma file, design folder under `docs/domains/<d>/<f>/design/`), the agent MUST enforce design completeness through DESIGN-MAPPING.md.

### DESIGN-MAPPING.md required shape

```yaml
design_source: <URL or path>
mapping_version: 1
features_mapped: <N>

mappings:
  - design_id: <component/screen ID from design>
    design_file: <path or design-link anchor>
    component_or_screen: <name>
    target_route: <e.g. /dashboard/hms/wizard>
    target_source_files:
      - <expected file path>
    implementation_status: not_started | in_progress | implemented | deferred | deviation
    screenshot_evidence: <path to S8 screenshot or null>
    deviation_reason: <only if status=deviation; links to DESIGN-DEVIATIONS.md entry>
    deferred_to_sortie: <only if status=deferred; sortie slug>
```

### Gate enforcement

| Gate | Block condition | Failure code |
|------|----------------|--------------|
| G5 → S6 | Design package exists AND `DESIGN-MAPPING.md` missing | `F_DESIGN_MAPPING_MISSING` |
| G5 → S6 | Any mapping has no `implementation_status` decision | `F_DESIGN_MAPPING_MISSING` |
| G8 | Any mapping has `not_started` or `in_progress` in current plan scope | `F_DESIGN_DEVIATION_UNRESOLVED` |
| G8 | Any mapping has `deviation` without DESIGN-DEVIATIONS.md entry | `F_DESIGN_DEVIATION_UNRESOLVED` |

**G8 PASSES only if** every mapping in current plan scope is `implemented` OR `deferred` (with `deferred_to_sortie` reference) OR `deviation` (with DESIGN-DEVIATIONS.md entry).

### Vertical-slice carve-out

For T3+ sorties using vertical-slice strategy (e.g. HMS Wizard chapter-1-first):

- DESIGN-MAPPING.md MAY mark sibling-chapter mappings as `deferred` with explicit `deferred_to_sortie` pointer.
- Phase B verifier MUST verify only mappings in current plan's scope.
- G8 product-accept evaluates only current-scope mappings.

### Rationale

Direct fix for the recurring "agent delivers design, but only uses some of it" pattern. DESIGN-MAPPING.md is the contract between design package and implementation — coverage is enforced at gate, not at review.

---

## 28. Usable Increment Rule

No plan may be marked DONE unless the changed surface is usable by a real user without developer intervention.

### Minimum usability checks (Phase B mandatory)

Every Phase B verifier MUST run + capture:

```yaml
usability_checks:
  primary_route:
    - loads without console error
    - first-paint < primary_route_load_ms_max (default 3000ms)
    - no 4xx / 5xx network errors on initial load

  primary_user_action:
    - completes end-to-end (click → result visible)
    - happy-path test passes

  states:
    - empty state rendered (no data)
    - loading state rendered (network slow)
    - error state rendered (network 500)

  copy:
    - no placeholder strings (TODO, lorem, "fill in", "asdf", "test")
    - no untranslated keys (raw t('foo.bar') literally rendered)
    - no developer-only strings

  controls:
    - no dead buttons (every visible button has handler)
    - no broken hrefs (every link resolves)
    - validation errors recoverable (user can fix + resubmit)

  viewports:
    - desktop (>=1280px) primary flow works
    - mobile (<=375px) primary flow does not break (collapse OK, broken layout NOT OK)
```

### Binding to Phase B / G6

- Phase B verifier MUST execute all `usability_checks` and write results to `reports/USABILITY-<plan>-<ts>.md`.
- G6 PASSES only if all usability checks green OR explicitly deferred with reason recorded.
- "Technically done, product-unusable" = `F_USABILITY_FAIL` (§ 21).

### Configurable via `.sxtn/config.yaml`

Projects may override thresholds:

```yaml
usability:
  primary_route_load_ms_max: 3000
  required_states: [empty, loading, error]
  required_viewports: [desktop, mobile]
  placeholder_strings_forbidden: ["TODO", "lorem", "asdf", "test"]
  console_error_tolerance: 0
```

### Rationale

Prevents "technically green, product-broken" S9. Code passing typecheck + tests is not the same as users being able to use the surface. Usability is part of done, not a follow-up.

---

**Status:** AUTONOMY-READY (per external reviewer 2026-05-28 second pass). 28 sections cover: autonomy contract, write policy, execution result, command + skill contracts, idempotency, resume, state manifest, failure taxonomy, locking, dry-run + script-support rule, no-fabrication, subagent prompt contract, design enforcement, usable increment. Spec is sufficient for autonomous agent execution of S0→S9 sortie without human improvisation.

---

**End of spec.**
