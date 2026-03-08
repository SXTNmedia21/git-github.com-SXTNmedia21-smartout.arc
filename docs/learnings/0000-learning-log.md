---
title: Learning Log
status: in_progress
updated: 2026-03-08
created: 2026-03-08
module: cross-cutting
tags: [learnings]
---

# Learning Log — journey-package-skills

| #   | Date       | Learning                                                                                    | Impact                                                                 |
| --- | ---------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | 2026-03-06 | Engine-architect dry runs catch ~12 gaps per mission on first pass                          | Skills must include verification steps, not just generation            |
| 2   | 2026-03-06 | Guardian integration is already wired — mission authors only need journey_step_id on stages | Simplifies mission authoring; no manual event wiring needed            |
| 3   | 2026-03-06 | Triage gate prevents over-engineering: pure UI journeys don't need AI missions              | Saves effort; stub Mission.md with not-applicable status is sufficient |
| 4   | 2026-03-06 | SQL seed templates drift from skill templates — must align after each skill update          | Added N2 fix process; always diff skill vs template after changes      |

---

# Learning Log — unified-context-search

| #   | Date       | Learning                                                                                                   | Impact                                                                          |
| --- | ---------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | 2026-03-06 | Pre-existing type errors (service_config, leader_pulse) block pre-push hooks on all branches               | Must fix in feature branch or they block every push; svcTable() pattern works   |
| 2   | 2026-03-06 | sed replacements on multi-line `.from()` chains break when property access spans lines                     | Use Edit tool or helper function approach instead of sed for TS refactors       |
| 3   | 2026-03-06 | 4-wave parallel agent execution works cleanly when agents touch non-overlapping files                      | Can safely run 3 agents per wave on same worktree                               |
| 4   | 2026-03-06 | supabase.rpc() calls to new RPCs fail typecheck before types regen — cast via `(supabase.rpc as Function)` | Same pattern as .from() casts; grep for TODO to find all when migration applied |

---

# Learning Log — season-creation-wizard

| #   | Date | Learning | Impact |
| --- | ---- | -------- | ------ |

module: governance
tags: [learnings]

---

# Learning Log — governance-admin-ui

updated: 2026-03-06
created: 2026-03-06
module: meta
status: done
updated: 2026-03-08
created: 2026-03-06
module: infra
tags: [learnings]

---

# Learning Log

| #   | Date       | Learning                                                                                                     | Impact     |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------ | ---------- |
| 1   | 2026-03-08 | Long-lived missions (weeks/months) need nullable session expiry — default 1h expiry kills season sessions    | operations |
| 2   | 2026-03-08 | Calendar Guardian must query authoritative DB tables, not session collected_data (user-editable, incomplete) | operations |
| 3   | 2026-03-08 | `as unknown as` cast needed for SEASON_TOOLS array — SmartoutTool generic doesn't align with Vercel AI SDK   | ai         |
| 4   | 2026-03-08 | useWorkspaceOptional prevents crash when SeasonCard renders outside workspace context (e.g. loading states)  | dashboard  |
| 5   | 2026-03-08 | Phase-specific colors in dashboard cards are data-visualization, not theming — exempt from CSS variable rule | dashboard  |

updated: 2026-03-06
created: 2026-03-06
module: document
tags: [learnings]

---

# Learning Log — document-mode

| #   | Date | Learning | Impact |
| --- | ---- | -------- | ------ |

# Learning Log — infra-hardening

| #   | Date       | Learning                                                                                                                                                                          | Impact   |
| --- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-07 | Caddy global server write timeout caps ALL downstream responses, even if reverse_proxy transport has higher timeouts. Never set global write timeout when streaming routes exist. | Critical |
| 2   | 2026-03-07 | HSTS preload is a one-way commitment to the browser preload list. Cannot be undone. Only safe when ALL subdomains are HTTPS forever.                                              | High     |
| 3   | 2026-03-07 | Removing port exposure from base compose breaks health-check scripts on the host. Fix: bind to 127.0.0.1 in prod overlay.                                                         | High     |
| 4   | 2026-03-07 | Docker Compose `${VAR:?msg}` refuses to start if var unset. Split fail-fast (base) and fallback (override) across files.                                                          | Medium   |
| 5   | 2026-03-07 | Scrapling is consumed by Edge Functions on the host, not Docker services. Needs host-accessible ports, not just Docker network DNS.                                               | Medium   |

# Learning Log — zero-to-production

| #   | Date       | Learning                                                                                                       | Impact   |
| --- | ---------- | -------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-08 | useWorkspaceSetup counts ALL policies (no is_active filter) — can't hide policies by deactivating them         | Testing  |
| 2   | 2026-03-08 | detectIndustryType expects `brregData.naceCode` structure, NOT `nace_codes` array — undocumented format        | Critical |
| 3   | 2026-03-08 | Supabase REST API silently fails on FK cascade deletes — use docker exec psql for reliable E2E cleanup         | Testing  |
| 4   | 2026-03-08 | useLayoutEffect re-setting state on every render defeats dismiss/skip patterns — need separate dismissed state | Bug fix  |
| 5   | 2026-03-08 | Playwright route mocks must be set up BEFORE form interaction, not after filling the form                      | Testing  |
| 6   | 2026-03-08 | Wizard auto-advance (STEP_TO_MODULE) means tests that create data can cause subsequent tests to skip steps     | Testing  |
