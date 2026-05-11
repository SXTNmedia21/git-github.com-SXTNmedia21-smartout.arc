---
title: Schedule Admin View — User Journeys
feature: schedule-admin-view
status: verified
updated: 2026-05-11
created: 2026-05-11
module: schedule
tags: [schedule, admin, botsson, tool, role-gate]
---

# Journey: Admin Date Schedule Query

**Precondition:** User is authenticated with role admin, manager, or owner. Session is a Botsson chat or voice session with `userContext.role` resolved server-side.

1. Admin types "vis vaktplan for lørdag 16 mai" (or voice equivalent) → Intent classifier sees role=admin + date reference → routes to `schedule` capability
2. Stage Engine builds toolset for `schedule`, authority level `read_only` → `get_workspace_schedule` included
3. LLM calls `get_workspace_schedule` with `{ date: "2026-05-16" }`
4. Tool checks `ctx.userContext.role` — admin allowed → queries `schedule_shift` with `workspace_id` + `shift_date` filters
5. Returns enriched JSON array: shift rows with `profile.display_name`, `department.name`, `location.name`, `local.weekday`
6. LLM translates to Norwegian: "Lørdag 16 mai er det følgende vakter: ..."
7. Telemetry: `agent.schedule.workspace_queried` → posthog + logger + activity_trail

**Postcondition:** Admin sees full workspace staffing for the requested date. No hallucination: LLM has structured facts, not English prose to embellish.

**Error paths:**
- Empty date → `{ empty: true, date, scope: "workspace" }` → LLM: "Ingen vakter funnet for den datoen."
- DB error → `{ error: "db_query_failed", detail }` → LLM: "Fikk ikke hentet vaktplanen, prøv igjen."

---

# Journey: Employee Date Schedule Query

**Precondition:** User is authenticated with role employee. Session is Botsson chat or voice.

1. Employee asks "jobber jeg lørdag?" or "hva er vakten min fredag 16?" → Intent classifier sees role=employee + personal date query → routes to `schedule`
2. Stage Engine builds toolset → `get_date_schedule_for_me` included
3. LLM calls `get_date_schedule_for_me` with `{ date: "2026-05-16" }`
4. Tool filters `employee_id = ctx.profileId AND workspace_id = ctx.workspaceId AND shift_date = date` — no other employee data accessible
5. Returns own shifts as JSON array with `local.weekday`, `start_time`, `end_time`, `role`, `status`
6. LLM translates: "Ja, du jobber lørdag 16 mai fra 09:00 til 17:00 som Servitør i Sal."
7. Telemetry: `agent.schedule.date_queried_self` → posthog + logger

**Postcondition:** Employee sees their own shifts for the requested date. No other employee data exposed.

**Error paths:**
- No shifts that day → `{ empty: true, date, scope: "personal" }` → LLM: "Du har ingen vakter registrert på den datoen."

---

# Journey: Admin Tries Employee Tool (Cross-boundary)

**Precondition:** Admin is in voice session (channel=voice).

1. Admin asks "vis vaktplan for lørdag" via voice
2. `get_workspace_schedule` is called
3. Tool checks `ctx.channel === "voice"` → returns `{ error: "channel_forbidden", reason: "pii_in_voice" }`
4. LLM: "Av sikkerhetshensyn kan ikke vaktplanoversikt vises via stemme. Bruk chat."

**Postcondition:** No PII (employee names) exposed via voice. Admin redirected to chat surface.

---

# Journey: Employee Tries Admin Tool

**Precondition:** Employee is in chat session.

1. Employee asks "vis vaktplanen for hele restauranten lørdag"
2. LLM attempts `get_workspace_schedule`
3. Tool checks role — `employee` is not in `[admin, manager, owner]` → returns `{ error: "forbidden", reason: "role_insufficient" }` before ANY DB query
4. LLM: "Du har ikke tilgang til hele vaktplanen. Vil du se dine egne vakter?"

**Postcondition:** Employee role blocked at tool level. No DB query made. No data leak.
