---
title: Decision Log
status: done
updated: 2026-03-25
created: 2026-03-24
module: communications
tags: [decisions]
---

# Decision Log — notification-system

| #   | Date       | Decision                                                                                                 | Status   |
| --- | ---------- | -------------------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-24 | Outbox pattern: all notification sources INSERT into notification_outbox, single consumer EF processes   | Accepted |
| 2   | 2026-03-24 | Dollar-quote tags ($cmd$/$sql$) for pg_cron registration in migrations                                   | Accepted |
| 3   | 2026-03-24 | Mobile notification hooks duplicated locally instead of shared package                                   | Accepted |
| 4   | 2026-03-24 | Email delivery is console.log stub in MVP — SendGrid integration deferred                                | Accepted |
| 5   | 2026-03-24 | Event config registry in TypeScript (not DB table) — zero-code extension for new event types             | Accepted |
| 6   | 2026-03-24 | CRITICAL priority (2) bypasses quiet hours and triggers immediate dispatch via DB trigger                | Accepted |
| 7   | 2026-03-24 | Smart grouping uses 3-minute window on group_key — updates existing notification instead of creating new | Accepted |
| 8   | 2026-03-24 | notification_preference keyed by user_id (not profile_id) — preferences apply across all workspaces      | Accepted |
