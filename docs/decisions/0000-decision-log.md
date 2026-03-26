---
title: Decision Log
status: in_progress
updated: 2026-03-27
created: 2026-03-26
module: dashboard
tags: [decisions]
---

# Decision Log — admin-daily-loop

| #   | Date       | Decision                                                                                                                      | Status   |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-26 | No i18n for Phase 1 dashboard components — existing dashboard uses hardcoded Norwegian, keep consistent                       | accepted |
| 2   | 2026-03-26 | DepartmentBreakdown uses own query instead of modifying useOperationsData — avoids breaking existing aggregated data contract | accepted |
| 3   | 2026-03-26 | DailyStatusBar Phase 1 only shows reconciliation live data — schedule publish + stress level require Phase 3 wiring           | accepted |
