---
title: Learning Log
status: in_progress
updated: 2026-03-14
created: 2026-03-03
module: ai
tags: [learnings]
---

# Learning Log — guardian

| #   | Date       | Learning                                                                                | Impact                                                              |
| --- | ---------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | 2026-03-14 | Browser WebSocket API cannot send custom headers — use query param for JWT auth         | All WS endpoints must use `?token=` pattern                         |
| 2   | 2026-03-14 | Emit guardian events at the action source, not at every call site — prevents duplicates | Check if called function already emits before adding new emit calls |
