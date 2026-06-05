---
title: Design Handoff — Rules of Engagement Dossier
status: draft
created: 2026-06-02
updated: 2026-06-02
module: design-handoff
tags: [rules-of-engagement, design-handoff, dossier, nordic-split, refactor, step-1]
---

# Design Handoff — Rules of Engagement Dossier

> **Purpose.** Land the Claude Design handoff (`smartout-re-designe`, ~1010 web + 297 mobile
> component entries, Nordic Split, Norwegian UI) onto the EXISTING SmartOut repo — reuse-first,
> page by page, without breaking the live app.
>
> **Why this dossier.** Last time the dominant cost was **coordination + method ambiguity**, not code.
> This document separates what is already **LOCKED** (settled — do not re-litigate) from the **OPEN
> FORKS** (where the source documents disagree or are silent). The fork list is the decision surface
> for Step 2; the locked list is context, not debate.
>
> **Scope.** Rules only. The route/page/schema **inventory is a SEPARATE step-3 coverage seed**
> (`docs/superpowers/seeds/2026-06-02-route-page-inventory-seed.md`), not folded in here.
> No code, no canon writes this turn.

---

## 0. Provenance (what was actually read)

| Scout | Sources read |
|---|---|
| **adr-scout** | `docs/decisions/` — ADR-0007/0008/0009/0021/0023/0113/0115/0132/0133/0134/0135/0136/0173/0213/0238/0240/0260/0265/0268/0328/0338/0357/0358/0362/0366/0376/0377/0392/0415/0422 |
| **protocol-scout** | `CLAUDE.md` (project + global), `docs/protocols/` (DOCUMENTATION, KNOWLEDGE, SECURITY, AUTH_SECURITY, ENV_PROTOCOL, DEPLOYMENT), ADR-0019/0366/0415 |
| **method-scout** | `sxtn-refactor-driver.md`, `sxtn-design-ingest.md`, f10-design-intake spec, `wt-2/.sxtn/{config.yaml,init-metadata.yaml,council.yaml}`, all 41 `.sxtn/lessons/*.md` |
| **design-scout** | `smartout-re-designe/project/` tree, web `component-index.yaml` (1010), mobile `component-index.yaml` (297), `Design System.html`, `SMARTOUT-DESIGN-SPEC.md`, production `tokens.css` / routes spot-check |

---

## 1. LOCKED Rules (settled — context, not debate)

Compressed. Each line is a hard constraint with source tag. Full text in scout reports.

### 1.1 Design system / tokens
- `[ADR-0009/0366/0361]` Colors only via `@smartout/design-tokens`, Tailwind theme tokens (`bg-background`), or `var(--token)`. **No hex, no inline `oklch()` in app code.** Only exempt file: `apps/web/src/app/globals.css`. ESLint `nordic-split/no-oklch-literal` = error, pre-push + CI.
- `[Nordic Split]` Warm hue 40–60. Never cold grey/blue, never pure white/black. Instrument Serif (`font-heading`) / Geist Sans / Geist Mono. Lucide only, **no emoji**.
- `[Nordic Split]` Spring presets: standard 35/22/2.2 · snappy 45/24/2.0 · gentle 30/20/2.5. Use `motion.*` tokens, not inline magic numbers.
- `[ADR-0023]` Scrollbar via design token, no ad-hoc webkit overrides.
- `[ADR-0338]` Any design-system change requires the **4-step visual gate**: token resolved-value audit → motion-timing audit → side-by-side perceptual match → gesture-conflict check. PR must carry the 4-item checklist.

### 1.2 Shell / composition (load-bearing)
- `[ADR-0021]` Dashboard = **Server layout + Client DashboardShell**. Middleware injects `x-workspace-slug`; server layout reads it, provides `WorkspaceProvider`. Auth routes live on portal only.
- `[ADR-0362]` `DashboardShell` wraps `<BotssonHost>{children}<EmmaOverlay/></BotssonHost>`. `BotssonHost` SSR-safe; `EmmaOverlay` = `dynamic({ssr:false})`. **Hierarchy is load-bearing — any shell refactor must preserve it.** No nested `BotssonProvider`.
- `[ADR-0115]` RSC route pattern: `page.tsx` = Server Component, EXACTLY one `<Suspense>` + one `<PageClient>`, **ambience-free** (no orbs/glass/noise/Framer at route level — those live only inside `DashboardShell`). `loading.tsx` uses `<NordicSkeleton>` (from `packages/ui/`). First chunk carries the `h1`.
- `[ADR-0007/0008]` Fixed top bar + fixed sidebar + flex-1 main with **internal** scroll. Full-window scroll forbidden.
- `[ADR-0113]` `useDashboard()` facade **deprecated** → targeted hooks. `ThemeContext` mounts highest; theme flips `documentElement.dataset.theme` synchronously.

### 1.3 Mobile boundary
- `[ADR-0133]` "Web composes, mobile executes." Authoring UIs web-only (schedule editor, wizard, contract/governance authoring, settings, year-wheel, cost/billing). Mobile = D6 + C4 only.
- `[ADR-0132]` Mobile thin client → all AI/capability via web BFF (`/api/emma/chat`). Never imports `@smartout/ai`.
- `[ADR-0134]` Mobile mutation MUST resolve non-empty `workspace_id` + `actor_id` (via `getProfileContext()`) **before** `emit()`. Empty-string fallback hard-banned.
- `[ADR-0135]` Mobile voice = LiveKit. `[ADR-0268]` Mobile = **5 tabs** (Kalender · Vakter · FAB · Chat · Min Tid / Mer).

### 1.4 Capability / data boundary
- `[ADR-0173/0240]` Journey logic only via the frozen-4 capabilities; no cross-namespace writes — delegate to the owning capability. `[ADR-0238]` Any page with an embedded domain chat MUST declare `<DomainChatOwnership>` (Orb → passive).
- `[ADR-0415]` Write surface = Capability Tool by default; Server Action only for user-only/single-form/no-agent/no-`engine_event`. Server Action must `await emit()` in its body.

### 1.5 Telemetry
- `[CLAUDE.md]` Every mutation emits via `emit()`; four destinations (PostHog/Logger/`activity_trail`/`engine_event`). No second event system.
- `[ADR-0357/0377]` Registry entry (`packages/telemetry/src/registry.ts`) and matching `emit()` call-site land in the **same PR** (coverage gate + pre-commit). `[ADR-0376]` Page-polish 8-phase: `site-map.json` entry + page header + view-event emit are **never skippable** (thin-shell delegating pages exempt with documented rationale).
- `[lesson: telemetry-as-verification-spine]` Mutation emits **awaited** in `onSuccess`; nav/view/click may fire-and-forget. Gate proves the row landed (DB-assert, not UI-200).

### 1.6 The copy / port law (method core)
- `[lesson: faithful-design-port-copy-not-rewrite]` Design JSX/markup/classNames/CSS are **done** — copy 1:1. Only allowed edits = plumbing (IIFE→`"use client"`+export, React imports, inline helpers). **Zero markup nodes added/removed.** ~2× source line-count = a rewrite → reject.
- Data via **ONE thin adapter** `toDesignShape(realRows)`; design JSX renders unchanged; backend gaps defaulted in that one adapter, never scattered.
- Fidelity is disk-checkable: selector-set match · className count ≈ design · JSX line count ≈ source. Reference: `dashboard/people-v2/` (1607L, 4 files).
- `[lesson: no-ghost-data]` Never ship synthetic/fabricated/`Math.random()` data as real. Wire to real source from v1; render honest empty/loading state when none exists.
- `[lesson: frozen-design-source-is-repo-internal]` Port only from repo-internal `smartout-re-designe/project/apps/web/` (93 pages, superset). Downloads copy is STALE. Add `smartout-re-designe/` to `.prettierignore` + eslint ignores (it's Babel-IIFE, not ES modules). Strip `*:Zone.Identifier` cruft.

### 1.7 Reuse / additive / ordering
- `[sxtn-refactor-driver]` Reuse everything that works, rewire to new design, **never regenerate or destroy**. Migrations additive-only via `sxtn-migration`; destructive DDL human-gated (`F_MIGRATION_DESTRUCTIVE`). One shell, registered pages — never a parallel app. Never break role-gated access.
- `[lesson: redesign-wiring-pipeline]` Ordering: (1) **Foundation** (serial, once) — port design tokens once + harness gate config. (2) **Golden-path** (serial, one backend-ready domain) — prove the motion. (3) **Fan-out** (parallel) — remaining backend-ready domains. (4) **Gap track** (parallel) — backend-gap domains close backend FIRST (longest pole).
- `[lesson: domain-nomination-achievable-friction]` Port in friction order, lightest first (`oversikt` 19 → … → `vaktplan` 153 LAST), driven by telemetry (`next-domain.sh`), not hand-picked.
- `[sxtn-refactor-driver]` **Per page: STATE PLAN FIRST** (page · design source · existing tables/routes from reuse-map · classification keep/re-skin/rewire/new/remove · gate it feeds). No plan, no edit. Then architect → builder → verifier → mark done. Per-domain **G8 = human accept**.
- `[lesson: do-the-thing-not-machinery]` Smallest real product result first. One running page > ten planning docs.

### 1.8 Control-point / observability / roles
- `[lesson: mechanical-control-point-artifact]` Each unit emits machine-readable `control.json` (counts + booleans + derived `gate:PASS|FAIL` + `blockers[]`). Gate reads disk; readiness is mechanical, never judgment. Append-only `activity/feed.jsonl`. Text log primary, HTML dashboard secondary.
- `[lesson: coverage-map-drifts-from-source]` Measure against source-of-truth (`registry.ts`), never a derived map. Re-derive before dispatching off a metric. >100% = formula bug.
- `[lesson: redesign-wiring-lanes / watchdog-flags-human-decides]` **Four non-crossing lanes** — Orchestrator (trains + dispatches, doesn't build/grade) · Foreman (finds/feeds/verifies, runs gate, stages under Pontus) · UiBuilder (ports ONE domain, doesn't self-grade/pick/redesign/write-DB) · Pontus (commits, push, DB approval, priority). Watchdog flags → proposes → **waits for human**. Confident ≠ authorized (C4).
- `[lesson: live-db-connection-before-db-claims]` Reading migrations ≠ being on the DB. Confirm a LIVE connection (prefer local Supabase) before any DB-framed claim; count with `count(*)` + `to_regclass()`, never planner estimate.
- `[lesson: concurrent-instances-wipe-shared-sxtn]` ONE instance owns a worktree `.sxtn/`; others read-only. `[lesson: stale-branch]` Canonical branch = `refactor/smartout`. Re-derive any gating number from one authoritative command immediately before use.
- `[lesson: commit-early-untracked-is-vulnerable]` Commit non-trivial work to the refactor branch promptly. Never `--no-verify`.

### 1.9 Git / docs / closure
- `[global CLAUDE.md / ADR-0213]` `campaign/master-refactor` is long-lived — never `/close-feature`. Sub-sorties `feat/*` → campaign via **merge-commit** (never squash/rebase, never force-push). Conventional commits, commitlint+husky, header ≤100. Never commit to preview/main. 14 required CI checks to main.
- `[DOCUMENTATION.md]` Every `docs/` file needs frontmatter + `INDEX.md` registration. Never edit `database.types.ts` manually. `[ADR-0392 — proposed]` Domain docs at `docs/domains/<name>/`, 8-file spine, `mirror:` + `last_verified` frontmatter, `domain-lint` gate.
- `[global CLAUDE.md]` Closure gates (block merge): decision-log current · `JOURNEY-<feature>.md` (admin/manager/employee, happy+error) · `pnpm turbo typecheck` = 0. Then HANDOFF doc.

---

## 2. OPEN FORKS (the decision surface for Step 2)

Each fork = a place sources **disagree or are silent**. Tagged by blocking level:
**B0** blocks the Foundation sortie (must decide before any token/gate setup) ·
**B1** blocks the first domain build · **B2** per-domain / deferrable but must be flagged now.

### B0 — must decide before Foundation sortie

**F1 · Decompose vs direct-port — how do we even start?** `[method #2,#3,#8]`
The F10 spec mandates a `sxtn-design-decompose` pre-phase (per-domain `DESIGN-MODEL.md` + completeness gate `F_DOMAIN_INCOMPLETE`). The lessons show the live campaign **bypassed** it — ported `oversikt` + `people-v2` directly from raw `.jsx` and shipped working output. `config.yaml domains: []` is empty; `sxtn-design-ingest` has not populated `feature-index.yaml` / `docs/domains/`.
- *Sides:* (a) run the decompose/ingest pipeline as the spec requires → blocks at completeness gate until domains scaffolded; (b) accept the proven direct-port motion → bypass that gate entirely.
- *Decides:* PO + Pontus. **This sets the entire operating model — pick first.**

**F2 · Loop / role ownership — who drives the autonomous loop?** `[method #1,#4]`
`sxtn-harness-builder.md` and `sxtn-foreman.md` both landed untracked and both appear to claim the between-gate drive. Also unresolved: does the Foreman running the verifier count as "self-grade" (the no-self-grade rule was scoped to UiBuilder)?
- *Risk:* two agents arming the same Stop-loop = double-dispatch + `.sxtn/` state collisions.
- *Decides:* PO + Pontus, after reading `sxtn-foreman.md`.

**F3 · Token-name reconciliation — remap vs define-literal.** `[design #1,#8,#9 vs copy-law]`
Design uses short token names (`--bg`, `--orange`, `--sh-glow`, `--card:#fff`); production uses shadcn names (`--background`, `--brand-orange`, `--ring`, warm `--card`). **Two locked rules collide:** the copy-law says *"define the design's vars with their literal values, don't remap to other tokens"*, while ADR-0366 says *"no hex/oklch literals outside globals.css; consume via design-tokens only."* Plus `--sh-*` shadow tokens + `--border-strong` have no production equivalent.
- *Sides:* (a) author a canonical mapping table design→production tokens (one-time, in tokens.ts); (b) define design tokens verbatim in globals.css per copy-law. (a) honors ADR-0366 + reuse; (b) honors copy-fidelity but risks token sprawl.
- *Decides:* architect proposal → PO. **Blocks Foundation (token port is step 1).**

**F4 · Font contract — Cabinet Grotesk or Instrument Serif?** `[adr #3, cross-flag #2]`
ADR-0260 (Cabinet Grotesk as `font-heading`) is **proposed, not landed**. ADR-0115 still guards Instrument Serif as active. Design ships Instrument Serif.
- *Sides:* (a) handoff assumes Instrument Serif (matches design + active contract) → safe; (b) wait for / sequence the Cabinet Grotesk cutover sortie first.
- *Decides:* PO. **Day-1 — determines heading styles on every page.**

**F5 · Telemetry registry reconciliation — is `events.ts` dead yet?** `[method #6, adr telemetry]`
Register-first gate must enforce against ONE registry. `registry.ts` = runtime-authoritative; `events.ts` = divergent. F0.1 added 121 events to `registry.ts` (committed) but it's unclear whether `events.ts` divergence was ever resolved.
- *Decides:* verify on disk first (this is half a fact-check, half a fork). If still divergent → reconcile before enabling the gate.

### B1 — blocks the first domain build

**F6 · Pre-existing color debt — fix-as-you-go or leave?** `[protocol #5, adr #4, method cross #2]`
ADR-0366 deferred **171 Bucket-B hex + 15 Bucket-C ambiguous** hits to follow-up sortier B1/B2/B3, plus **4 intentionally theme-invariant** contract-print hits (must NOT be tokenized without a new ADR). The handoff touches the same files (esp. `components/day/`). Also: 589 legacy direct-`supabase`-write offenders (rule = error for new/ported, warn for legacy).
- *Sides:* (a) refactor fixes inline as it touches → unscoped work + collision with B1/B2/B3; (b) refactor leaves them → debt persists but scopes stay clean.
- *Decides:* PO. Must also **sequence** handoff vs the hex-sweep sortier. Recommended default: **leave + annotate** (don't reclassify theme-invariant print surfaces).

**F7 · Route-naming lock — Norwegian or English paths?** `[design cross #3]`
Design routes are Norwegian (`vaktplan`, `ansatte`, `lonn`, `oversikt`); production routes are English (`schedule`, `people`, `payroll`). No ADR governs this.
- *Decides:* PO — campaign-level lock before mapping. Recommended: keep English route paths (existing), Norwegian only in UI strings/i18n.

**F8 · Visual-verification gate in the per-page loop?** `[adr cross #1]`
ADR-0338's 4-step visual gate exists precisely for this regression class. Unclear whether `sxtn-refactor-driver`'s verifier already includes it.
- *Decides:* fold ADR-0338 steps into the verifier gate (recommended) — cheap, high-value.

**F9 · Frontmatter field-set conflict.** `[protocol #1]`
global CLAUDE.md mandates `title/status/updated/created/module/tags`; `DOCUMENTATION.md` mandates `title/id/status/layer/created/updated`. A doc satisfies one, violates the other.
- *Decides:* PO — pick the canonical set before the first doc. Cheap but blocks clean docs.

### B2 — per-domain / deferrable, flag now

**F10 · New modules with no production anchor — scope or defer?** `[design #2,#3,#6]`
- `menykunnskap` (AI menu-knowledge: photo→extraction→dish cards→quiz) = **new tables + new Edge Function** — first-class in design, only `my-training/` exists in prod.
- `min-dag` (employee home) — no production route (candidates: `operations/`, new `my-day/`, dashboard root).
- `min-laering` vs `my-training`, `lonn-config`, multi-level `ansatte-ct-*` contract sub-routes.
- *Decides:* PO — in-scope vs deferred per module. The backend-bearing ones (`menykunnskap`) belong to the **gap track** (close backend first) per F10-ordering.

**F11 · Backend-gap domains — front-load per method.** `[method cross #6, wiring lesson]`
`oppgaver` form backend has **no `control_list_attempt` table** → honest stub + "ikke lagret ennå" toast until a dedicated backend sortie. Seed-coverage is a hard e2e pre-gate (zero-seed domains e2e-blocked). New additive `CREATE TABLE` gate trigger is undefined (clear for DROP/RENAME, silent for additive).
- *Decides:* PO — confirm CREATE-TABLE = additive-auto vs human-gated; schedule Phase-0 seed-expansion for thin domains before their sorties.

**F12 · `/dashboard/schedule` RSC exclusion — exit ADR needed if `vaktplan` in scope.** `[adr #7]`
ADR-0115 excludes schedule from the RSC pattern "until a separate ADR." That ADR doesn't exist. `vaktplan` is the heaviest domain (153 elements, ported LAST).
- *Decides:* if `vaktplan` in scope → write the exclusion-override ADR before its sortie.

**F13 · Closure granularity — JOURNEY per page or per milestone?** `[protocol #3]`
Closure gates are written for single-feature sorties; silent on a many-page campaign.
- *Decides:* PO — per-milestone (recommended) needs an explicit milestone definition; per-page makes every sub-sortie carry a JOURNEY doc.

**F14 · ADR-0392 / domain-lint status — proposed, CI wiring unknown.** `[adr #5]` ·
**F15 · `performance-governance.md` referenced but missing.** `[protocol #4]` ·
**F16 · Error-message i18n — Norwegian-hardcode OK or key required?** `[adr #6]` (ADR-0422/0328 say "message in Norwegian"; CLAUDE.md says "no hardcoded Norwegian — use keys" — they don't resolve each other) ·
**F17 · Layout supersession — does the design handoff amend ADR-0007/0008, or is it authoritative?** `[adr #1]` ·
**F18 · `useDashboard()` migration obligation — must touched files migrate off the facade, or out of scope?** `[adr #2]` ·
**F19 · ADR-0429 referenced in `Design System.html` — exists in prod? (ADR-0430 does).** `[design #9, cross #1]`
- *Decides:* PO, mostly cheap clarifications; F17/F18 affect refactor scope per touched file.

---

## 3. Fact-checks to run before Step 2 (not forks — verify on disk)

These are stated-but-unconfirmed; resolve by reading, not deciding:
- `events.ts` divergence state (F5).
- `smartout-re-designe/` present in `.prettierignore` + eslint ignores in this worktree.
- `NordicSkeleton` exported from `packages/ui/`.
- Location of `completion-rate.sh`/`reconcile.sh`/`next-domain.sh` (`.sxtn-staging/telemetry-map/`?).
- `.claude/agents/sxtn-ui-builder.md` exists + `config.yaml s6_phase_a.ui` assignment live.
- `refactor/smartout` tip hash (re-derive from reflog — two misreads occurred last campaign).
- ADR-0429 existence in `docs/decisions/`.
- Which ported pages declare `<DomainChatOwnership>` (oversikt-v2 / people-v2 / min-dag-v2).

---

## 4. Excluded from this dossier (by design)
- Route/page/schema **inventory** → separate step-3 seed (`docs/superpowers/seeds/2026-06-02-route-page-inventory-seed.md`).
- Fork **decisions** → Step 2 (PO + Pontus).
- Implementation **plan** → after the ruleset locks (Step 3+).
