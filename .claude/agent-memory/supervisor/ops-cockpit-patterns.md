## Operations Cockpit Patterns

### Live vs demo status (web)

- `apps/web/src/components/dashboard/ActivityView.tsx` heatmap is demo-only (`generateHeatmapData`), with i18n warning key `activityDemoWarning`.
- `apps/web/src/app/dashboard/_hooks/use-activity-feed.ts` is real and reads `activity_trail` with realtime invalidation.

### Broadcast behavior mismatch

- `apps/web/src/app/dashboard/schedule/_components/day-control/BroadcastFooter.tsx` and `daily-briefing.tsx` show push/SMS UI, but push is stubbed (`toast.warning`) and SMS can be event-driven.
- Production send path exists at `apps/web/src/app/api/schedule/send-message/route.ts` with real Twilio batch send and audience resolution (`all|leaders|specific`).

### Task model boundaries

- Keep `schedule_day_task` (ad-hoc day tasks) separate from `session_task` (hook/session lifecycle tasks). Do not merge semantics.
- Day Control currently has both generic day task flows and integrated session task flows (`SessionTasksTab`), so reviews must enforce scope to avoid model drift.

### Governance review hotspot

- `apps/web/src/app/api/schedule/send-message/route.ts` is a mutation endpoint with membership check but no explicit role gate beyond workspace membership.
- Confirm C4/governance requirements explicitly when approving targeted-broadcast features.
