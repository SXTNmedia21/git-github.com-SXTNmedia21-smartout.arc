---
title: Learning Log
status: in_progress
updated: 2026-03-05
created: 2026-03-03
module: org-structure
tags: [learnings]
---

# Learning Log — entity-detail-pages

| #   | Date       | Learning                                                                                                                          | Impact                               |
| --- | ---------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 1   | 2026-03-05 | `LOCATION_TYPE_CONFIG` lacks `border` property — had to add optional `border` or adjust type when using for badges in detail view | low — quick fix                      |
| 2   | 2026-03-05 | EntityDetailLayout works for both organization entities AND people — breadcrumbs + tabs pattern is universal for detail pages     | high — reuse for future detail pages |
status: done
updated: 2026-03-06
created: 2026-03-02
module: comms
tags: [learnings]
---

# Learning Log — communications-finish

| #   | Date       | Learning                                                                                                   | Impact                                   |
| --- | ---------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 1   | 2026-03-04 | SendGrid signed event webhooks use ECDSA P-256 (not HMAC) — need Web Crypto API                            | Edge Function implementation pattern     |
| 2   | 2026-03-04 | SendGrid `dynamicTemplateData` is per-message, not per-batch — must loop                                   | Changed batch sending approach           |
| 3   | 2026-03-04 | Tiptap `onUpdate` fires on every keystroke — debounce for AI correction                                    | UX smoothness for AI feature             |
| 4   | 2026-03-04 | Supabase `increment_communication_counter()` function needed for atomic counter updates in webhook handler | Data consistency for engagement tracking |
