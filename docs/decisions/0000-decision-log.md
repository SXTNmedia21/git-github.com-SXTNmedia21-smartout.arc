---
title: Decision Log
status: in_progress
updated: 2026-04-10
created: 2026-03-06
module: meta
tags: [decisions]
---

# Decision Log

| #   | Date       | Decision                                                                                                | Status | Module     |
| --- | ---------- | ------------------------------------------------------------------------------------------------------- | ------ | ---------- |
| 1   | 2026-04-08 | Bypass finalize-workspace Edge Function — call `finalize_onboarding_workspace` RPC directly from client | active | onboarding |
| 2   | 2026-04-08 | RPC creates company on-the-fly if workspace was provisioned without one (NULL company_id)               | active | onboarding |
| 3   | 2026-04-09 | Season stage transitions use calendar-based Guardian (not manual user triggers)                         | active | operations |
| 4   | 2026-04-09 | Calendar Guardian queries season table directly for dates (not session collected_data)                  | active | operations |
| 5   | 2026-04-09 | SeasonCard uses hardcoded phase colors for data-visualization semantics                                 | active | operations |
| 6   | 2026-04-09 | useActiveSeason infers "running" stage when no engine session exists for active season                  | active | operations |
| 7   | 2026-04-09 | Season tools use SeasonToolContext with workspace_id + supabase client                                  | active | operations |
