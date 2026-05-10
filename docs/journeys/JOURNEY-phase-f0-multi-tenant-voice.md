---
title: "Journey — Multi-Tenant Voice Workspace Correctness"
feature: phase-f0-perimeter
status: verified
verified_at: 2026-05-10
e2e_test: services/stage-engine/src/__tests__/chat.workspace-derivation.test.ts
updated: 2026-05-10
created: 2026-05-10
module: MODULE_BOTSSON
tags: [voice, multi-tenant, workspace-derivation, audit-fix, F-SE-01]
---

# Journey — Multi-Tenant Voice Workspace Correctness

Closes audit finding F-SE-01. Phase E shipped voice with `BOTSSON_SERVICE_JWT` adapter token; `chat.ts` derived `effectiveWorkspaceId` from that JWT (= service-account workspace) instead of the calling user's workspace. Local single-workspace dev hid the bug. Production = cross-tenant data leak.

## Journey 1: User in workspace W1 starts voice session

**Precondition:** User Anna logged in to workspace W1 (Strøm Mat & Bar). Voice-agent container running on LiveKit Cloud.

1. Anna trykker mic-knapp på Botsson orb → System minter LiveKit token via `/api/botsson/voice/token` med `room = botsson-orb:<anna-profile-id>`, `workspace_id = W1` server-derived → Anna ser orb pulse listening
2. Anna sier "vis dagens vakter" → LiveKit voice-agent picker opp → posts `/agent/chat` med body `workspace_context.workspace_id = W1` + `BOTSSON_SERVICE_JWT` Bearer
3. Stage-engine `chat.ts` resolver `effectiveWorkspaceId = W1` (fra body.workspace_context, NOT fra service-account JWT) → kaller schedule capability med correct workspace
4. Schedule capability returnerer Anna's W1 vakter → voice-agent svarer "Du har 3 vakter i dag" → Anna ser orb pulse speaking
5. Telemetri events emitted med `workspace_id = W1` (ikke service-account workspace) → activity_trail row tilskrives W1

**Postcondition:** Anna's voice queries kjørt mot W1 data only. gate_action evaluations gjort med W1 authority config. activity_trail rows tilskrevet W1.

**Error paths:**
- body.workspace_context.workspace_id null/missing → fail-closed, voice-agent får 400 `MISSING_WORKSPACE_CONTEXT_FOR_SERVICE_ACCOUNT` → orb viser "kunne ikke koble til"
- body.workspace_context.workspace_id matcher ikke noen workspace Anna har profile i → fail-closed, 400 (BFF session-context route enforcer membership-check ved token-mint)
- BOTSSON_SERVICE_JWT invalid/expired → fail-closed, voice-agent får 401

## Journey 2: User in workspace W2 starts voice session simultaneously

**Precondition:** Bjarne logged in to workspace W2 (Bårdshaug Vegkro), simultaneous med Anna's session.

1. Bjarne trykker mic → System minter LiveKit token `room = botsson-orb:<bjarne-profile-id>`, `workspace_id = W2`
2. Bjarne sier "hvor mange ansatte er innom i dag?" → voice-agent posts `/agent/chat` med `workspace_context.workspace_id = W2`
3. Stage-engine resolver `effectiveWorkspaceId = W2` (Bjarne's workspace, ikke Anna's, ikke service-account)
4. Schedule capability returnerer W2 staffing → voice-agent svarer Bjarne med W2 numbers
5. Telemetri events emitted med `workspace_id = W2`

**Postcondition:** Anna's session og Bjarne's session er fullstendig isolert. Ingen cross-tenant data leak. activity_trail rows tilskrives correct workspace per session.

**Error paths:**
- Voice-agent reuses adapter context fra Anna's session i Bjarne's call → fail-closed, body.workspace_context server-derived per request via `setSessionContext` payload
