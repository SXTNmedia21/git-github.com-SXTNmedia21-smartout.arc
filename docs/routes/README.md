---
title: Route Docs Index
status: in_progress
updated: 2026-04-29
created: 2026-04-29
module: routes
tags: [routes, docs, dashboard]
---

# Route Docs

Per-page documentation for every dashboard route. One MD per route. Code stays canonical — these docs explain **intent, layout, and wiring** so an agent or new dev can land cold and orient in 60 seconds.

## Conventions

- Filename: kebab-case mirroring URL — `/dashboard/calendar` → `dashboard-calendar.md`.
- Frontmatter required (`title`, `status`, `route`, `updated`, `created`, `module`, `tags`).
- Sections: Purpose · Layout · Tabs / Sub-routes · State · Sheets / Drawers · External Wiring · Related Files · Known Debt.
- Update `updated:` every time you touch the page or this doc.

## Pages

| Route | Doc | Status |
|-------|-----|--------|
| `/dashboard/calendar` | [dashboard-calendar.md](./dashboard-calendar.md) | in_progress |

Add new routes alphabetically.
