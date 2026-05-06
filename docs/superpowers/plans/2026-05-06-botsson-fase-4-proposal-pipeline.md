---
title: "Botsson Fase 4 — Proposal Pipeline + Schedule Integration"
status: approved
created: 2026-05-06
updated: 2026-05-06
module: MODULE_BOTSSON
tags: [botsson, voice-agent, schedule, proposal-pipeline, ghost-card]
---

# Botsson Fase 4 — Proposal Pipeline + Schedule Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire LiveKit voice-agent to existing ghost-card proposal pipeline so Botsson can propose schedule mutations that humans accept via UI. Fix the severed voice → stage-engine auth pipe. Remove auto-approve violation. Add reject audit.

**Architecture:** (1) Re-mint BOTSSON_SERVICE_JWT — voice-agent sends it as `Authorization: Bearer` header so stage-engine routes succeed and recorder rows flow. (2) Three `propose_*` tools in voice-agent publish data-channel events into existing `AgentProposalsContext.addProposal()`. (3) Auto-approve block removed — every mutation goes through ghost card. (4) Reject audited via existing `ChangeProposalRejected` telemetry event.

**Mantra:** Botsson foreslår. Mennesket aksepterer. Engine hvisker. Det uforpliktede dør stille.

**Debt anchors:**
- ADR-0289 (`docs/decisions/0289-voice-agent-tool-registry-tactical-duplication.md`) — tactical duplication waiver, R1.3 is binding closure
- SMA-295 — JWT rotation reminder (due: mint date + 25 days)
- SMA-296 — R1.3 tool-registry consolidation

**Tech Stack:** TypeScript, LiveKit Agents 1.3.0, OpenAI Realtime, Next.js App Router, React Context, Supabase, `@smartout/telemetry`.

---

## File Index

| File | Action |
|---|---|
| `services/voice-agent/src/adapter.ts` | Modify — add `Authorization` header + `workspace_context` body field |
| `services/voice-agent/src/tools-schedule.ts` | Create — three `propose_*` tools |
| `services/voice-agent/src/agent.ts` | Modify — spread scheduleTools + update instructions |
| `apps/web/src/app/Botsson/_components/BotssonOrbVoiceMount.tsx` | Modify — extend `BotssonActivityEvent` union |
| `apps/web/src/app/Botsson/_components/BotssonShell.tsx` | Modify — handle shift_proposal events in `handleVoiceActivity` |
| `apps/web/src/app/dashboard/schedule/_components/schedule-types.ts` | Modify — add `ProposalSource` type + `source` field |
| `apps/web/src/app/dashboard/schedule/_components/agent-proposals-context.tsx` | Modify — remove auto-approve block, make addProposal sync, add reject audit |
| `apps/web/src/app/dashboard/schedule/_components/schedule-voice-tools-bridge.tsx` | Modify — add window-event listener for shift proposals |

---

## Task 1 — Re-mint BOTSSON_SERVICE_JWT (both vaults)

**Spec ref:** §1 Authentication Fix. **Linear:** SMA-295.

> ⚠️ The existing JWT in the container expired 2026-04-26. Do NOT skip this task — every subsequent task depends on auth working.

- [ ] **Step 1.1: Generate new Supabase service JWT**

  In Supabase Studio (local) or via CLI, mint a JWT for the `admin@smartout.local` service account with `exp` ≥ 90 days from today:

  ```bash
  # From supabase local setup — note the JWT secret
  npx supabase status 2>/dev/null | grep "JWT secret"
  ```

  Use the JWT secret to mint via https://jwt.io or `jose` CLI. Payload:
  ```json
  {
    "iss": "http://127.0.0.1:54321/auth/v1",
    "sub": "e0000000-0000-0000-0000-000000000000",
    "aud": "authenticated",
    "role": "authenticated",
    "email": "admin@smartout.local",
    "exp": <now + 90 days in unix seconds>
  }
  ```

- [ ] **Step 1.2: Store in both vaults (same session — never one without the other)**

  ```bash
  # Dev vault
  op item edit "botsson-service-jwt" --vault smartout_ai value="<new-jwt>"
  # Prod vault
  op item edit "botsson-service-jwt" --vault smartout_ai_prod value="<new-jwt>"
  ```

  Verify `op://` references are correct (no raw value committed anywhere):
  ```bash
  grep "BOTSSON_SERVICE_JWT" .env.template
  # Expected: BOTSSON_SERVICE_JWT="op://smartout_ai/botsson-service-jwt/value"
  ```

- [ ] **Step 1.3: Set SMA-295 due date in Linear**

  Due = today's date + 25 days. Update via Linear UI or MCP.

---

## Task 2 — Wire Authorization header in `adapter.ts:ask()`

**Spec ref:** §1 adapter.ts fix. **File:** `services/voice-agent/src/adapter.ts`.

- [ ] **Step 2.1: Edit `ask()` function header**

  Replace the `headers` block and add `workspace_context` to the body in the existing fetch call (lines 65–77):

  ```typescript
  const res = await fetch(`${STAGE_ENGINE_URL}/agent/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // ADR-0289 + Fase 4: service JWT authenticates voice-agent to stage-engine.
      // Expires: see SMA-295. Rotate every 30 days (due: mint date + 25 days).
      Authorization: `Bearer ${process.env.BOTSSON_SERVICE_JWT ?? ""}`,
    },
    body: JSON.stringify({
      message: query,
      session_id: sessionId,
      channel: "voice",
      // workspace_context threads the correct workspace through chat.ts
      // effectiveWorkspaceId path (ADR-0151). profile_id removed from body
      // per ADR-0151 — server-derived from JWT.
      workspace_context: {
        workspace_id: ctx.workspace.workspace_id,
        name: ctx.workspace.workspace_name ?? "",
        niche: null,
        active_season_id: null,
        active_framework_id: null,
        planning_cycle_id: null,
      },
    }),
  });
  ```

  Note: remove the old `profile_id` and `workspace_id` body fields — they are not in `chatSchema` and will be ignored (but clean is better).

- [ ] **Step 2.2: Run voice-agent typecheck**

  ```bash
  cd services/voice-agent && npx tsc --noEmit 2>&1 | tail -10
  ```
  Expected: 0 errors.

- [ ] **Step 2.3: Commit**

  ```bash
  git add services/voice-agent/src/adapter.ts
  git commit -m "fix(voice-agent): add Authorization Bearer header + workspace_context to stage-engine ask()"
  ```

---

## Task 3 — Rebuild container and verify 200 + recorder row

**Spec ref:** §1 verification. §9 recorder fix.

- [ ] **Step 3.1: Rebuild voice-agent container**

  ```bash
  op run --env-file=.env.template -- docker compose -f infra/docker-compose.yml build --no-cache voice-agent
  op run --env-file=.env.template -- docker compose -f infra/docker-compose.yml up -d voice-agent
  ```

  Expected final log line: `"registered worker"` with a new worker ID.

- [ ] **Step 3.2: Verify 200 from inside container**

  ```bash
  docker exec infra-voice-agent-1 node -e "
  const jwt = process.env.BOTSSON_SERVICE_JWT;
  fetch('http://stage-engine:5010/agent/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + jwt,
    },
    body: JSON.stringify({
      message: 'ping',
      workspace_context: {
        workspace_id: 'b0000000-0000-0000-0000-000000000000',
        name: 'test', niche: null, active_season_id: null,
        active_framework_id: null, planning_cycle_id: null
      }
    })
  }).then(r => console.log('STATUS:', r.status)).catch(e => console.error('ERR:', e.message))
  " 2>&1
  ```
  Expected: `STATUS: 200` (or `STATUS: 403` with `PROFILE_NOT_FOUND` if workspace UUID doesn't exist — that is correct auth passing, wrong workspace).

- [ ] **Step 3.3: Verify recorder row flows after a real voice turn**

  Start a voice session via Orb mic. Speak any phrase. Then:
  ```bash
  # In psql local
  npx supabase db connect -- -c "SELECT count(*) FROM agent_session_recording WHERE created_at > now() - interval '5 minutes';"
  ```
  Expected: count > 0.

  If count = 0: check `docker logs --tail 30 infra-stage-engine-1` for errors.

---

## Task 4 — Add `ProposalSource` type to `schedule-types.ts`

**Spec ref:** §2 Proposal Pipeline Shape.

**File:** `apps/web/src/app/dashboard/schedule/_components/schedule-types.ts`

- [ ] **Step 4.1: Add `ProposalSource` union and `source` field to all three proposal types**

  Insert after line 175 (before the `ShiftProposalCreate` definition):

  ```typescript
  // ── Proposal source discriminator (ADR-0289 / Fase 4) ───────
  // "agent_response" is active in V0. "proactive" and "scheduled" are
  // reserved for future sorties — shape is forwards-compatible from day one.
  export type ProposalSource =
    | "agent_response"   // User asked Botsson, Botsson proposes
    | "proactive"        // Reserved: Botsson detects pattern unprompted
    | "scheduled";       // Reserved: cron/event-triggered suggestion
  ```

  Then add `source: ProposalSource` to `ShiftProposalCreate`, `ShiftProposalUpdate`, and `ShiftProposalDelete`. Existing callers that don't set `source` need `source?: ProposalSource` (optional with `?`) so no existing callsites break. Voice-agent tools will set it explicitly to `"agent_response"`.

  Final shapes:
  ```typescript
  export type ShiftProposalCreate = {
    id: string;
    type: "create";
    source?: ProposalSource;          // ← added
    employeeId: string;
    employeeName?: string;
    dateId: string;
    role: string;
    startTime: string;
    endTime: string;
    workHours: number;
    dayCategory: string;
    indicator: string;
    breaks: number;
    shiftTypeConfigId?: string;
  };

  export type ShiftProposalUpdate = {
    id: string;
    type: "update";
    source?: ProposalSource;          // ← added
    shiftId: string;
    employeeId: string;
    dateId: string;
    patch: Record<string, unknown>;
  };

  export type ShiftProposalDelete = {
    id: string;
    type: "delete";
    source?: ProposalSource;          // ← added
    shiftId: string;
    employeeId: string;
    dateId: string;
  };
  ```

- [ ] **Step 4.2: Run typecheck**

  ```bash
  pnpm --filter web typecheck 2>&1 | tail -5
  ```
  Expected: 0 errors.

- [ ] **Step 4.3: Commit**

  ```bash
  git add apps/web/src/app/dashboard/schedule/_components/schedule-types.ts
  git commit -m "feat(schedule): add ProposalSource type + source field to ShiftProposal variants"
  ```

---

## Task 5 — Create `services/voice-agent/src/tools-schedule.ts`

**Spec ref:** §3 Three Proposal Tools. §5 Channel Guard. §6 Path-Gating. §7 Path-Derived Tool Exposure (V0 hardwired via path check in execute()).

Three flat tools: `propose_create_shift`, `propose_update_shift`, `propose_delete_shift`. No DB writes. No `gate_action`. Path-gating with dialogic redirect.

- [ ] **Step 5.1: Create the file**

  Create `services/voice-agent/src/tools-schedule.ts`:

  ```typescript
  // tools-schedule.ts — Schedule proposal tools for the LiveKit voice agent.
  //
  // Botsson proposes. The human accepts. The uncommitted dies quietly.
  //
  // These tools NEVER write to the database directly. Each publishes a
  // data-channel event (type: "shift_proposal_*") over botsson-activity.
  // BotssonShell forwards to window event "botsson:shift-proposal".
  // ScheduleVoiceToolsBridge listens and calls addProposal() in
  // AgentProposalsContext — the existing human-approval pipeline.
  //
  // Path-gating: tools return a dialogic redirect if the user is not on
  // /dashboard/schedule. Botsson offers to navigate; no proposal published.
  //
  // Channel guard (ADR-0078):
  //   L1: description strings mark these as voice-safe
  //   L2: no chat twin in V0 (voice-only path)
  //   L3: execute() validates UUID format + path prefix
  //
  // No gate_action needed: no mutation touches domain tables.
  // No emit() needed: activity_trail entry comes from stage-engine recorder
  // (flows automatically after Task 2 auth fix).
  //
  // ADR-0289: last deliberate additions to the parallel tool array before R1.3.

  import { llm } from "@livekit/agents";
  import { _publishActivity } from "./adapter-internal.js";
  import { getSessionContextSnapshot } from "./context.js";

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const SCHEDULE_PATH_PREFIX = "/dashboard/schedule";

  function checkSchedulePath(): string | null {
    const ctx = getSessionContextSnapshot();
    const path = ctx.route?.path ?? "";
    if (!path.startsWith(SCHEDULE_PATH_PREFIX)) {
      return (
        "Du må være på vaktplan-siden for at jeg skal kunne foreslå dette. " +
        "Vil du at jeg navigerer deg dit?"
      );
    }
    return null;
  }

  export const scheduleTools = {
    // ── propose_create_shift ──────────────────────────────────
    propose_create_shift: llm.tool({
      description: [
        "Foreslå å lage en ny vakt i vaktplanen.",
        'Bruk når brukeren sier "lag vakt", "sett opp vakt", "legg til vakt",',
        '"planlegg vakt til [navn] [dag] kl [tid]-[tid]".',
        "Forslaget vises som et ghost card i vaktplanen som brukeren må godkjenne.",
        "Kun tilgjengelig når brukeren er på vaktplan-siden.",
      ].join(" "),
      parameters: {
        type: "object" as const,
        properties: {
          employee_id: {
            type: "string",
            description: "UUID til den ansatte som skal ha vakten.",
          },
          employee_name: {
            type: "string",
            description: "Visningsnavn på den ansatte (for ghost card label).",
          },
          date_id: {
            type: "string",
            description: 'Dato i YYYY-MM-DD format, f.eks. "2026-05-09".',
          },
          role: {
            type: "string",
            description: 'Stillingstittel eller rolle, f.eks. "Servitør", "Kjøkken".',
          },
          start_time: {
            type: "string",
            description: 'Starttid HH:MM, f.eks. "16:00".',
          },
          end_time: {
            type: "string",
            description: 'Sluttid HH:MM, f.eks. "22:00".',
          },
        },
        required: ["employee_id", "date_id", "role", "start_time", "end_time"],
        additionalProperties: false,
      },
      execute: async ({
        employee_id,
        employee_name,
        date_id,
        role,
        start_time,
        end_time,
      }: {
        employee_id: string;
        employee_name?: string;
        date_id: string;
        role: string;
        start_time: string;
        end_time: string;
      }) => {
        const redirect = checkSchedulePath();
        if (redirect) return redirect;

        if (!UUID_RE.test(employee_id)) {
          return `employee_id "${employee_id}" er ikke en gyldig UUID. Søk opp ansatt-ID først.`;
        }

        const [sh, sm] = start_time.split(":").map(Number);
        const [eh, em] = end_time.split(":").map(Number);
        if (
          isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em) ||
          sh < 0 || sh > 23 || eh < 0 || eh > 23
        ) {
          return `Ugyldig tid: start="${start_time}", slutt="${end_time}". Bruk HH:MM format.`;
        }

        const workHours = ((eh * 60 + em) - (sh * 60 + sm)) / 60;

        _publishActivity({
          type: "shift_proposal_create",
          payload: {
            id: crypto.randomUUID(),
            type: "create",
            source: "agent_response",
            employeeId: employee_id,
            employeeName: employee_name,
            dateId: date_id,
            role,
            startTime: start_time,
            endTime: end_time,
            workHours,
            dayCategory: "evening", // default; UI can override
            indicator: "blue",
            breaks: 0,
          },
        });

        return `Forslag sendt: vakt for ${employee_name ?? employee_id} ${date_id} kl ${start_time}–${end_time}. Brukeren må godkjenne det i vaktplanen.`;
      },
    }),

    // ── propose_update_shift ──────────────────────────────────
    propose_update_shift: llm.tool({
      description: [
        "Foreslå å endre en eksisterende vakt (tid, rolle, dato).",
        'Bruk når brukeren sier "endre vakten til", "flytt vakten", "oppdater vakt",',
        '"forleng vakten til". Sender endringsforslag som ghost card.',
        "Kun tilgjengelig når brukeren er på vaktplan-siden.",
      ].join(" "),
      parameters: {
        type: "object" as const,
        properties: {
          shift_id: {
            type: "string",
            description: "UUID til vakten som skal endres.",
          },
          employee_id: {
            type: "string",
            description: "UUID til den ansatte (for kontekst i ghost card).",
          },
          date_id: {
            type: "string",
            description: "Dato for vakten i YYYY-MM-DD format.",
          },
          patch: {
            type: "object",
            description:
              'Felter som skal endres. Gyldige nøkler: "startTime" (HH:MM), "endTime" (HH:MM), "role" (string), "dateId" (YYYY-MM-DD).',
            additionalProperties: true,
          },
        },
        required: ["shift_id", "employee_id", "date_id", "patch"],
        additionalProperties: false,
      },
      execute: async ({
        shift_id,
        employee_id,
        date_id,
        patch,
      }: {
        shift_id: string;
        employee_id: string;
        date_id: string;
        patch: Record<string, unknown>;
      }) => {
        const redirect = checkSchedulePath();
        if (redirect) return redirect;

        if (!UUID_RE.test(shift_id)) {
          return `shift_id "${shift_id}" er ikke en gyldig UUID.`;
        }

        _publishActivity({
          type: "shift_proposal_update",
          payload: {
            id: crypto.randomUUID(),
            type: "update",
            source: "agent_response",
            shiftId: shift_id,
            employeeId: employee_id,
            dateId: date_id,
            patch,
          },
        });

        const patchSummary = Object.entries(patch)
          .map(([k, v]) => `${k}=${String(v)}`)
          .join(", ");
        return `Endringsforslag sendt: vakt ${shift_id} — ${patchSummary}. Brukeren må godkjenne det.`;
      },
    }),

    // ── propose_delete_shift ──────────────────────────────────
    propose_delete_shift: llm.tool({
      description: [
        "Foreslå å slette en eksisterende vakt.",
        'Bruk når brukeren sier "slett vakten", "fjern vakten til [navn]", "ta bort vakt".',
        "Sender sletteforslag som ghost card — vakten beholdes til brukeren godkjenner.",
        "Kun tilgjengelig når brukeren er på vaktplan-siden.",
      ].join(" "),
      parameters: {
        type: "object" as const,
        properties: {
          shift_id: {
            type: "string",
            description: "UUID til vakten som skal slettes.",
          },
          employee_id: {
            type: "string",
            description: "UUID til den ansatte (for kontekst i ghost card).",
          },
          date_id: {
            type: "string",
            description: "Dato for vakten i YYYY-MM-DD format.",
          },
        },
        required: ["shift_id", "employee_id", "date_id"],
        additionalProperties: false,
      },
      execute: async ({
        shift_id,
        employee_id,
        date_id,
      }: {
        shift_id: string;
        employee_id: string;
        date_id: string;
      }) => {
        const redirect = checkSchedulePath();
        if (redirect) return redirect;

        if (!UUID_RE.test(shift_id)) {
          return `shift_id "${shift_id}" er ikke en gyldig UUID.`;
        }

        _publishActivity({
          type: "shift_proposal_delete",
          payload: {
            id: crypto.randomUUID(),
            type: "delete",
            source: "agent_response",
            shiftId: shift_id,
            employeeId: employee_id,
            dateId: date_id,
          },
        });

        return `Sletteforslag sendt for vakt ${shift_id}. Vakten beholdes til brukeren godkjenner.`;
      },
    }),
  };
  ```

- [ ] **Step 5.2: Run voice-agent typecheck**

  ```bash
  cd /home/sxtnl/dev/smartout.ai/services/voice-agent && npx tsc --noEmit 2>&1 | tail -10
  ```
  Expected: 0 errors.

- [ ] **Step 5.3: Commit**

  ```bash
  git add services/voice-agent/src/tools-schedule.ts
  git commit -m "feat(voice-agent): add propose_create/update/delete_shift tools with path-gating"
  ```

---

## Task 6 — Wire `scheduleTools` into `adapter.ts:buildAllBotssonTools()`

**File:** `services/voice-agent/src/adapter.ts`

- [ ] **Step 6.1: Add import and spread**

  Add import at top of file (after existing tool imports):

  ```typescript
  import { scheduleTools } from "./tools-schedule.js";
  ```

  Update `buildAllBotssonTools()` return:

  ```typescript
  export function buildAllBotssonTools(): llm.ToolContext {
    const personalTools = buildPersonalTools(ask);
    const capabilityTools = buildCapabilityQueryTools(ask);
    return {
      ...orbTools,
      ...personalTools,
      ...capabilityTools,
      ...scheduleTools,   // ← added (ADR-0289: last addition to parallel array)
    };
  }
  ```

- [ ] **Step 6.2: Run typecheck**

  ```bash
  cd /home/sxtnl/dev/smartout.ai/services/voice-agent && npx tsc --noEmit 2>&1 | tail -5
  ```
  Expected: 0 errors.

- [ ] **Step 6.3: Commit**

  ```bash
  git add services/voice-agent/src/adapter.ts
  git commit -m "feat(voice-agent): wire scheduleTools into buildAllBotssonTools"
  ```

---

## Task 7 — Update `BOTSSON_VOICE_INSTRUCTIONS` in `agent.ts`

**File:** `services/voice-agent/src/agent.ts`

- [ ] **Step 7.1: Edit instructions string**

  Replace the existing `"Bruk expand_orb/collapse_orb/set_orb_state/navigate_to når det er naturlig for UX."` line with:

  ```typescript
  "Bruk expand_orb/collapse_orb/set_orb_state/navigate_to når det er naturlig for UX.",
  "For vaktforslag: bruk propose_create_shift, propose_update_shift, eller propose_delete_shift.",
  "Du lager ALDRI vakter direkte — forslaget må godkjennes av brukeren.",
  "Hvis brukeren ikke er på vaktplan-siden og ber om vaktforslag, tilby å navigere dit.",
  ```

- [ ] **Step 7.2: Commit**

  ```bash
  git add services/voice-agent/src/agent.ts
  git commit -m "feat(voice-agent): add propose_* tools to BOTSSON_VOICE_INSTRUCTIONS"
  ```

---

## Task 8 — Extend `BotssonActivityEvent` union in `BotssonOrbVoiceMount.tsx`

**Spec ref:** §3 data-channel event types. **File:** `apps/web/src/app/Botsson/_components/BotssonOrbVoiceMount.tsx`

- [ ] **Step 8.1: Extend the union**

  Current last line of `BotssonActivityEvent` (line 61):
  ```typescript
  | { type: "navigate"; path: string; ts: number };
  ```

  Replace with:
  ```typescript
  | { type: "navigate"; path: string; ts: number }
  | { type: "shift_proposal_create"; payload: Record<string, unknown>; ts: number }
  | { type: "shift_proposal_update"; payload: Record<string, unknown>; ts: number }
  | { type: "shift_proposal_delete"; payload: Record<string, unknown>; ts: number };
  ```

  Note: `payload` typed as `Record<string, unknown>` — the schedule bridge casts to `ShiftProposal` after receiving. BotssonShell must not import schedule domain types (L1 must not import L4 domain).

- [ ] **Step 8.2: Run typecheck**

  ```bash
  pnpm --filter web typecheck 2>&1 | tail -5
  ```
  Expected: 0 errors.

- [ ] **Step 8.3: Commit**

  ```bash
  git add apps/web/src/app/Botsson/_components/BotssonOrbVoiceMount.tsx
  git commit -m "feat(botsson): extend BotssonActivityEvent with shift_proposal_* event types"
  ```

---

## Task 9 — Handle `shift_proposal` events in `BotssonShell.handleVoiceActivity`

**Spec ref:** §3 browser handler. **File:** `apps/web/src/app/Botsson/_components/BotssonShell.tsx`

- [ ] **Step 9.1: Add dispatch in `handleVoiceActivity`**

  Current handler ends at line ~112. Add three cases alongside the existing `navigate` case:

  ```typescript
  if (ev.type === "navigate" && ev.path.startsWith("/")) {
    router.push(ev.path);
  }
  // Forward shift proposals to the schedule page's AgentProposalsContext.
  // BotssonShell does not import schedule types — passes payload as-is.
  // ScheduleVoiceToolsBridge casts to ShiftProposal before calling addProposal().
  if (
    ev.type === "shift_proposal_create" ||
    ev.type === "shift_proposal_update" ||
    ev.type === "shift_proposal_delete"
  ) {
    window.dispatchEvent(
      new CustomEvent("botsson:shift-proposal", { detail: ev.payload }),
    );
  }
  ```

- [ ] **Step 9.2: Run typecheck**

  ```bash
  pnpm --filter web typecheck 2>&1 | tail -5
  ```
  Expected: 0 errors.

- [ ] **Step 9.3: Commit**

  ```bash
  git add apps/web/src/app/Botsson/_components/BotssonShell.tsx
  git commit -m "feat(botsson-shell): forward shift_proposal_* events to botsson:shift-proposal window event"
  ```

---

## Task 10 — Add window-event listener in `ScheduleVoiceToolsBridge`

**Spec ref:** §3 schedule page listener. **File:** `apps/web/src/app/dashboard/schedule/_components/schedule-voice-tools-bridge.tsx`

- [ ] **Step 10.1: Add import and useEffect**

  Add `useEffect` to imports at top (already imported from React — check first).

  Add import for `ShiftProposal` type:
  ```typescript
  import type { ShiftProposal } from "./schedule-types";
  ```

  Add listener inside the component body, before the `useRegisterTools` call:

  ```typescript
  // Receive shift proposals from voice-agent via BotssonShell data-channel bridge.
  // Voice-agent publishes shift_proposal_* events → BotssonShell dispatches
  // "botsson:shift-proposal" → here we call addProposal() → ghost card renders.
  useEffect(() => {
    const handler = (e: Event) => {
      const proposal = (e as CustomEvent<ShiftProposal>).detail;
      if (proposal && typeof proposal === "object" && "type" in proposal) {
        addProposal(proposal);
      }
    };
    window.addEventListener("botsson:shift-proposal", handler);
    return () => window.removeEventListener("botsson:shift-proposal", handler);
  }, [addProposal]);
  ```

- [ ] **Step 10.2: Run typecheck**

  ```bash
  pnpm --filter web typecheck 2>&1 | tail -5
  ```
  Expected: 0 errors.

- [ ] **Step 10.3: Commit**

  ```bash
  git add apps/web/src/app/dashboard/schedule/_components/schedule-voice-tools-bridge.tsx
  git commit -m "feat(schedule): listen for botsson:shift-proposal window events → addProposal()"
  ```

---

## Task 11 — Remove auto-approve block + make `addProposal` synchronous

**Spec ref:** §4 Auto-Approve Removal. **File:** `apps/web/src/app/dashboard/schedule/_components/agent-proposals-context.tsx`

- [ ] **Step 11.1: Delete lines 66–92 and replace with synchronous version**

  Current (lines 65–92):
  ```typescript
  const addProposal = useCallback(
    async (proposal: ShiftProposal) => {
      // Auto-approve single creates (up to 4 pending) — no ghost card needed
      if (proposal.type === "create") {
        const pendingCreates = proposals.filter((p) => p.type === "create").length;
        if (pendingCreates < 4) {
          await createShift({
            id: crypto.randomUUID(),
            ...
          });
          return;
        }
      }
      // 5+ creates, removes, deploys → queue as ghost for batch approval
      setProposals((prev) => [...prev, proposal]);
    },
    [createShift, proposals],
  );
  ```

  Replace with:
  ```typescript
  // Ghost-only per Pontus corrected mental model (2026-05-06): Botsson NEVER
  // mutates domain data directly. Every proposal goes through human approval.
  // Auto-approve was violating this principle — removed in Fase 4.
  const addProposal = useCallback(
    (proposal: ShiftProposal) => {
      // Idempotency: skip duplicate proposal IDs (voice retry safety).
      setProposals((prev) => {
        if (prev.some((p) => p.id === proposal.id)) return prev;
        return [...prev, proposal];
      });
    },
    [],
  );
  ```

  Note: `useCallback` deps array is now `[]` (no deps — pure state setter). Remove `createShift` from the deps array.

- [ ] **Step 11.2: Update `AgentProposalsContextValue` type**

  `addProposal` type in the context value interface changes from `(proposal: ShiftProposal) => Promise<void>` to `(proposal: ShiftProposal) => void`:

  ```typescript
  addProposal: (proposal: ShiftProposal) => void;
  ```

- [ ] **Step 11.3: Verify grep shows zero direct mutations in `addProposal`**

  ```bash
  grep -n "createShift\|updateShift\|deleteShift" \
    apps/web/src/app/dashboard/schedule/_components/agent-proposals-context.tsx
  ```
  Must appear ONLY inside `approveProposal` and `approveAllProposals`. Zero lines in `addProposal`.

- [ ] **Step 11.4: Run typecheck**

  ```bash
  pnpm --filter web typecheck 2>&1 | tail -5
  ```
  Expected: 0 errors.

- [ ] **Step 11.5: Commit**

  ```bash
  git add apps/web/src/app/dashboard/schedule/_components/agent-proposals-context.tsx
  git commit -m "fix(schedule): remove auto-approve block — ghost-only per Fase 4 spec, add idempotency guard"
  ```

---

## Task 12 — Add reject audit `emit()` in `rejectProposal`

**Spec ref:** §6 Reject Audit. Reuses existing `ChangeProposalRejected` event (`"change_proposal rejected"`) from `packages/telemetry/src/registry.ts:1722`.

**File:** `apps/web/src/app/dashboard/schedule/_components/agent-proposals-context.tsx`

- [ ] **Step 12.1: Add telemetry import**

  At top of file, add:
  ```typescript
  import { emit } from "@smartout/telemetry";
  ```

- [ ] **Step 12.2: Add `workspaceId` and `profileId` to provider props**

  The context needs workspace + profile IDs for telemetry. Add to `AgentProposalsProviderProps`:
  ```typescript
  type AgentProposalsProviderProps = {
    children: ReactNode;
    createShift: (input: Record<string, unknown>) => Promise<unknown>;
    updateShift: (input: { id: string; patch: Record<string, unknown> }) => Promise<unknown>;
    deleteShift: (id: string) => Promise<unknown>;
    workspaceId: string;    // ← added for telemetry
    profileId: string;      // ← added for telemetry
  };
  ```

  Destructure in the provider function body.

- [ ] **Step 12.3: Update `rejectProposal` to emit**

  Replace the current `rejectProposal` (lines 129–131):
  ```typescript
  const rejectProposal = useCallback((id: string) => {
    setProposals((prev) => prev.filter((proposal) => proposal.id !== id));
  }, []);
  ```

  With:
  ```typescript
  const rejectProposal = useCallback(
    (id: string) => {
      setProposals((prev) => prev.filter((proposal) => proposal.id !== id));
      // Audit trail: rejected proposals leave a trace even though no domain
      // row is written. Reuses ChangeProposalRejected from telemetry registry.
      void emit({
        event: "change_proposal rejected",
        workspace_id: workspaceId,
        actor_id: profileId,
        properties: { data: { proposal_id: id } },
      });
    },
    [workspaceId, profileId],
  );
  ```

- [ ] **Step 12.4: Update callsites of `AgentProposalsProvider`**

  Find and update the provider composition in `schedule/page.tsx` (~line 960) to pass `workspaceId` and `profileId`. Both are available in the schedule page from `useWorkspace()` and session context.

  ```tsx
  <AgentProposalsProvider
    createShift={createShift}
    updateShift={updateShift}
    deleteShift={deleteShift}
    workspaceId={workspaceId ?? ""}
    profileId={profileId ?? ""}
  >
  ```

- [ ] **Step 12.5: Run typecheck**

  ```bash
  pnpm --filter web typecheck 2>&1 | tail -5
  ```
  Expected: 0 errors.

- [ ] **Step 12.6: Commit**

  ```bash
  git add apps/web/src/app/dashboard/schedule/_components/agent-proposals-context.tsx \
          apps/web/src/app/dashboard/schedule/page.tsx
  git commit -m "feat(schedule): emit change_proposal rejected on ghost-card reject for audit trail"
  ```

---

## Task 13 — Rebuild voice-agent container (final) — §11 Migration Discipline

**Spec ref:** §11 — zero new migrations in this plan. All changes are TypeScript additions + one block deletion. No SQL files written.

All voice-agent source changes are now complete.

- [ ] **Step 13.1: Rebuild and restart**

  ```bash
  op run --env-file=.env.template -- docker compose -f infra/docker-compose.yml build --no-cache voice-agent
  op run --env-file=.env.template -- docker compose -f infra/docker-compose.yml up -d voice-agent
  ```

  Expected log: `"registered worker"` with a new worker ID.

- [ ] **Step 13.2: Verify new tools in container dist**

  ```bash
  docker exec infra-voice-agent-1 grep -c "propose_create_shift\|propose_update_shift\|propose_delete_shift" \
    /app/services/voice-agent/dist/tools-schedule.js 2>/dev/null
  ```
  Expected: 3 (one match per tool name in the compiled output).

---

## Task 14 — End-to-end test: propose → ghost card → accept → audit

**Spec ref:** §10 Test Matrix.

- [ ] **Step 14.1: Test auth end-to-end**

  Start voice session via Orb mic. Speak: "Hvem er jeg?" (triggers `get_my_profile`).

  Check: `docker logs --tail 10 infra-stage-engine-1` should show a request arriving.

  Check recorder:
  ```bash
  npx supabase db connect -- -c "SELECT turn_kind, phase, created_at FROM agent_session_recording ORDER BY created_at DESC LIMIT 5;"
  ```
  Expected: rows with `turn_kind = 'agent_response'`, `phase = 'llm_response'`.

- [ ] **Step 14.2: Test path-gating**

  Navigate to `http://localhost:3060/dashboard/people`. Start voice session. Say: "Lag en vakt til Ola fredag kl 16-22."

  Expected: Botsson says "Du må være på vaktplan-siden..." and offers to navigate. No ghost card appears.

- [ ] **Step 14.3: Test propose_create_shift**

  Navigate to `http://localhost:3060/dashboard/schedule`. Start voice session. Say: "Lag en vakt til [employee name from seed] fredag kl 16-22."

  Expected:
  - Ghost card appears in schedule grid
  - Zero new `schedule_shift` rows (verify in Supabase Studio)

- [ ] **Step 14.4: Test accept**

  Click accept on the ghost card.

  Expected:
  - Ghost card disappears
  - New `schedule_shift` row appears in Supabase Studio

- [ ] **Step 14.5: Test reject**

  Queue another proposal via voice. Click reject on the ghost card.

  Expected:
  - Ghost card disappears
  - Zero `schedule_shift` INSERT
  - `activity_trail` row with event matching `"change_proposal rejected"` and `proposal_id` in properties

  Verify:
  ```bash
  npx supabase db connect -- -c "
    SELECT event_type, properties
    FROM activity_trail
    WHERE event_type LIKE '%proposal%'
    ORDER BY created_at DESC
    LIMIT 3;
  "
  ```

- [ ] **Step 14.6: Test idempotency**

  Manually dispatch the same `CustomEvent` twice from the browser console:
  ```javascript
  // Replace <employee-uuid> with a real profile.id from Supabase Studio local → profile table
  const detail = { id: 'test-uuid-1234-5678-9abc', type: 'create', source: 'agent_response', employeeId: '<employee-uuid>', dateId: '2026-05-09', role: 'Test', startTime: '16:00', endTime: '22:00', workHours: 6, dayCategory: 'evening', indicator: 'blue', breaks: 0 };
  window.dispatchEvent(new CustomEvent('botsson:shift-proposal', { detail }));
  window.dispatchEvent(new CustomEvent('botsson:shift-proposal', { detail }));
  ```
  Expected: only one ghost card rendered.

- [ ] **Step 14.7: Test browser-close-without-action (passing scenario)**

  Queue a proposal via voice. Close the tab / navigate away from schedule.

  Expected: no `schedule_shift` row, no `activity_trail` row. The uncommitted dies quietly. This is correct.

---

## Task 15 — Final typecheck and commit summary

- [ ] **Step 15.1: Full typecheck**

  ```bash
  pnpm turbo typecheck 2>&1 | tail -10
  ```
  Expected: 0 errors across all packages.

- [ ] **Step 15.2: Verify auto-approve is gone (final grep)**

  ```bash
  grep -n "auto-approve\|Auto-approve\|pendingCreates\|if (pendingCreates" \
    apps/web/src/app/dashboard/schedule/_components/agent-proposals-context.tsx
  ```
  Expected: 0 lines.

- [ ] **Step 15.3: Verify no raw JWT value in git**

  ```bash
  git diff HEAD~10..HEAD -- services/voice-agent/ | grep -i "eyJhbG\|Bearer eyJ"
  ```
  Expected: 0 lines (only `process.env.BOTSSON_SERVICE_JWT` references, never raw token).

- [ ] **Step 15.4: Update SMA-295 due date**

  Set due = today + 25 days in Linear (SMA-295). Post ✅ Done comment on SMA-296 once R1.3 sortie is planned.

---

## Approval Criteria Checklist

| # | Criterion | Covered by |
|---|---|---|
| 1 | No direct mutation tools on Botsson | Task 5 — tools publish events only |
| 2 | Consolidated tool registration | ADR-0289 waiver; SMA-296 tracks R1.3 |
| 3 | Path-derived exposure as principle | Task 5 path-gating + §8 mechanism doc |
| 4 | Memory writes mapped to four layers | Spec §9 — no new memory writes in this plan |
| 5 | Voice PII three-layer guard | Task 5 tool description + UUID validation |
| 6 | Idempotency specified | Task 11 `addProposal` dedup + Task 5 `crypto.randomUUID()` |
| 7 | Authority derivation explicit | Task 2+3 — service JWT → `deriveProfileId` → 403 on miss |
| 8 | Reject audited | Task 12 `emit("change_proposal rejected", ...)` |
| 9 | Recorder fixed | Task 3 verification |
| 10 | Test matrix complete | Task 14 — 7 scenarios including browser-close |
| 11 | No migrations | Zero SQL files |
| 12 | ADR-0289 referenced | Preamble + Task 6 comment |
| 13 | Linear tasks anchored | SMA-295 + SMA-296 in preamble |
| 14 | Session boundary documented | Task 14.7 explicitly passing |
