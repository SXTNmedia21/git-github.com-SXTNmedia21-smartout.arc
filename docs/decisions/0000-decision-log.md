---
title: Decision Log
status: done
updated: 2026-03-06
created: 2026-03-03
module: season-planning
tags: [decisions]
---

# Decision Log — operation

| #   | Date       | Decision                                                                                              | Status   |
| --- | ---------- | ----------------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-05 | Profile detail reuses EntityDetailLayout from organization/ — single shared component for consistency | accepted |
| 2   | 2026-03-05 | Invited users keep slide-out card instead of navigating to detail page (no profile_id)                | accepted |
| 3   | 2026-03-05 | Team card click navigates to full detail page, replacing previous sheet/drawer pattern                | accepted |

status: done
updated: 2026-03-06
created: 2026-03-02
module: comms
tags: [decisions]

---

# Decision Log — communications-finish

| #   | Date       | Decision                                                                                       | Status   |
| --- | ---------- | ---------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-02 | Keep SendGrid over Resend — already integrated, dynamic templates                              | accepted |
| 2   | 2026-03-02 | Tiptap v3 for rich text — already installed, used in contracts                                 | accepted |
| 3   | 2026-03-02 | OpenRouter via Vault for AI correction (grammar + tone)                                        | accepted |
| 4   | 2026-03-02 | Fixed email structure, not drag-and-drop builder (YAGNI)                                       | accepted |
| 5   | 2026-03-04 | ECDSA P-256 SHA-256 for SendGrid webhook signature verification                                | accepted |
| 6   | 2026-03-04 | Store locale on recipient row for future multilingual expansion                                | accepted |
| #   | Date       | Decision                                                                                       | Status   |
| --- | ---------- | ---------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-06 | Reuse settings/useOperatingHours hook for season hour derivation instead of creating duplicate | Accepted |
| 2   | 2026-03-06 | Create season_budget table separate from existing workspace_budget (strategic vs operational)  | Accepted |
| 3   | 2026-03-06 | Use UTC-only date arithmetic in calculation engine to prevent timezone bugs                    | Accepted |
| 4   | 2026-03-06 | Follow established (supabase.from as Function) cast pattern for new table hooks                | Accepted |

status: in_progress
updated: 2026-03-04
created: 2026-03-03
module: operations
tags: [decisions]

---

# Decision Log — daily-standup

| #        | Date       | Decision                                                 | Status   |
| -------- | ---------- | -------------------------------------------------------- | -------- |
| ADR-0043 | 2026-03-04 | DailyCloseEngine — State Machine + Reconciliation System | accepted |

---

title: Decision Log
status: done
updated: 2026-03-10
created: 2026-03-10
module: ai
tags: [decisions]

---

# Decision Log — agent-profile-system

| #   | Date       | Decision                                                                                       | Status   |
| --- | ---------- | ---------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-10 | Posture adjustments as deltas not absolutes — base personality + context deltas = composable   | Accepted |
| 2   | 2026-03-10 | Logarithmic familiarity growth (log10) — 50 conversations ≈ 1.0, natural diminishing returns   | Accepted |
| 3   | 2026-03-10 | Composite: 0.3 familiarity + 0.4 trust + 0.3 sentiment — trust hardest to earn, weighs most    | Accepted |
| 4   | 2026-03-10 | Keep legacy buildBotssonPrompt alongside new — backwards compat for unmigrated callers         | Accepted |
| 5   | 2026-03-10 | Auto-create agent_profile at workspace activation — zero-config, every workspace gets defaults | Accepted |
| 6   | 2026-03-10 | Parallel 5-way fetch in context collector — latency over sequential simplicity                 | Accepted |
