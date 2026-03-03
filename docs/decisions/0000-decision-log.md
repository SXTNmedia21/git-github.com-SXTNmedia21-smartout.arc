---
title: Decision Log
status: in_progress
updated: 2026-03-14
created: 2026-03-03
module: onboarding
tags: [decisions]
---

# Decision Log — intelligence-pipeline-v2

| #   | Date       | Decision                                                                                                                                                                    | Status   |
| --- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-14 | Early workspace creation: provision minimal workspace during intelligence pipeline (before onboarding completes) so intelligence data has a permanent DB home               | Accepted |
| 2   | 2026-03-14 | Use `contract_status = 'onboarding'` text value on workspace to mark provisional workspaces (workspace.contract_status is a plain text field, not the contract_status enum) | Accepted |
| 3   | 2026-03-14 | Two-RPC approach: `provision_onboarding_workspace` (minimal) + `finalize_onboarding_workspace` (full promotion) — clear separation of lifecycle stages                      | Accepted |
| 4   | 2026-03-14 | Google Places as separate Edge Function (`google-places-intelligence`) with graceful degradation — returns empty result if no API key configured                            | Accepted |
| 5   | 2026-03-14 | SECURITY DEFINER on both RPCs — required because they bypass RLS, called only via service role from Edge Functions                                                          | Accepted |
| 6   | 2026-03-14 | 4-phase parallel pipeline: (A) scrape+Brreg, (B) provision workspace, (C) Places+web search, (D) store — maximizes parallelism while respecting data dependencies           | Accepted |
| 7   | 2026-03-14 | Support both URL and org number as pipeline entry points — org number gives direct Brreg lookup without scraping                                                            | Accepted |
| 8   | 2026-03-14 | Promote Google Places data to dedicated workspace columns (lat, lng, rating, place_id, etc.) instead of only storing in JSONB — enables indexing and direct queries         | Accepted |

module: ai
tags: [decisions]

---

# Decision Log — guardian

| #   | Date       | Decision                                                                                  | Status   |
| --- | ---------- | ----------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-14 | Guardian operates through agent mode (capability + tools), not mission stages             | Accepted |
| 2   | 2026-03-14 | Tool authority split: reads at read_only, acknowledge at suggest                          | Accepted |
| 3   | 2026-03-14 | Acknowledge note persisted in data JSONB (no new column)                                  | Accepted |
| 4   | 2026-03-14 | Guardian posture: slightly more formal and assertive (+0.1 each)                          | Accepted |
| 5   | 2026-03-14 | Direct WebSocket from stage engine (not Supabase Realtime) for Guardian events (ADR-0049) | Accepted |
| 6   | 2026-03-14 | Whisper = one-shot system message stored in collected_data.\_whispers[]                   | Accepted |
| 7   | 2026-03-14 | Actor colors hardcoded in EventFeed (exception to CSS variable rule)                      | Accepted |
