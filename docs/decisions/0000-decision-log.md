---
title: Decision Log
status: in_progress
updated: 2026-04-06
created: 2026-04-06
module: onboarding
tags: [decisions]
---

# Decision Log — invitation-rls-fix

| #   | Date       | Decision                                                                                                                                                                                                                     | Status   |
| --- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-04-06 | Replace USING(true) anon SELECT on invitation with SECURITY DEFINER RPC `get_invitation_by_token()`. Token (UUID, 122-bit) acts as authorization. Non-pending returns status only (no PII).                                  | accepted |
| 2   | 2026-04-06 | Set profile status to `active` directly on invite acceptance. Trainee mode deferred to engine_process — profile status on insert is not the right mechanism.                                                                 | accepted |
| 3   | 2026-04-06 | engine_event uses dot-separated event types (`invitation.accepted`) matching engine_trigger convention. activity_trail uses space-separated (`invitation accepted`) matching telemetry registry. Dual naming is intentional. | accepted |
