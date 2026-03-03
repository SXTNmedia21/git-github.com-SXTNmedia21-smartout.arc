---
title: Learning Log
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
