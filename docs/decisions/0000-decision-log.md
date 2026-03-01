---
title: Decision Log
status: in_progress
updated: 2026-03-01
created: 2026-03-01
module: landing
tags: [decisions]
---

# Decision Log — landing-analytics

| #   | Date       | Decision                                                                    | Status   |
| --- | ---------- | --------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-01 | Cookie consent: strictly necessary (no banner) for smo_vid analytics cookie | Accepted |
| 2   | 2026-03-01 | All tracking data in Supabase only (no PostHog for landing)                 | Accepted |
| 3   | 2026-03-01 | Full click tracking (all clicks with element info, not just CTAs)           | Accepted |
| 4   | 2026-03-01 | Session aggregation: incremental updates on each event (not batch)          | Accepted |
| 5   | 2026-03-01 | Visitor ID as cookie value = PK in landing_visitor (no separate lookup)     | Accepted |
| 6   | 2026-03-01 | navigator.sendBeacon for session_end (survives page unload)                 | Accepted |
| 7   | 2026-03-01 | Visitor identification: auto at signup + manual admin tagging               | Accepted |
