# Botsson on Platform Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mount Botsson Provider + Shell on `/platform-admin/*` so godmode users get Orb + voice + chat across all platform-admin pages, and switch wizard-chat to admin BFF (`/api/botsson/chat`).

**Architecture:** Reuse existing `BotssonProvider` + `BotssonShell` from onboarding pattern. Wizard becomes one consumer of the same Botsson surface — voice and chat both work, journey_authoring capability already wired through stage-engine.

**Tech Stack:** Next.js 16 App Router, React 19, `@smartout/ai` capabilities, stage-engine (Hono), `/api/botsson/chat` BFF.

---

## File Structure

| File | Action | Why |
|---|---|---|
| `apps/web/src/app/platform-admin/layout.tsx` | Modify | Wrap children in BotssonProvider; mount BotssonShell |
| `apps/web/src/app/platform-admin/journeys/wizard/[sessionId]/_components/wizard-chat.tsx` | Modify | Swap `/api/emma/chat` → `/api/botsson/chat`, drop wizardSessionId rewire if BotssonShell takes over |
| `apps/web/src/app/api/botsson/chat/route.ts` | Modify | Accept `wizardSessionId` field + forward to stage-engine (mirror /api/emma/chat fix) |

---

## Task 1: Mount BotssonProvider on platform-admin layout

**Files:**
- Modify: `apps/web/src/app/platform-admin/layout.tsx`

- [ ] **Step 1: Read current layout**

```bash
cat apps/web/src/app/platform-admin/layout.tsx
```

Expected: 14-line file with sidebar + main only. No Botsson wrapper.

- [ ] **Step 2: Add BotssonProvider import + wrap**

Edit `apps/web/src/app/platform-admin/layout.tsx`:

```tsx
import { BotssonProvider } from "@/app/Botsson/_components/BotssonProvider";
import { BotssonShell } from "@/app/Botsson/_components/BotssonShell";
import { PlatformAdminSidebarNav } from "@/components/platform-admin/sidebar-nav";
import { QueryProvider } from "@/app/dashboard/query-provider";

export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <BotssonProvider initialRank="admin" initialPersona="puls" initialBlend={5}>
      <div className="dark bg-background text-foreground flex h-screen">
        <aside className="border-border bg-background w-56 shrink-0 border-r">
          <PlatformAdminSidebarNav />
        </aside>
        <main className="flex-1 overflow-y-auto p-6">
          <QueryProvider>{children}</QueryProvider>
        </main>
        <BotssonShell />
      </div>
    </BotssonProvider>
  );
}
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter web typecheck 2>&1 | tail -5`
Expected: 0 errors

- [ ] **Step 4: Test in browser**

Navigate `http://localhost:3060/platform-admin/journeys/wizard`. Expected: Orb visible (bottom-right corner per existing BotssonShell layout). Click Orb → chat surface opens.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/platform-admin/layout.tsx
git commit -m "feat(platform-admin): mount BotssonProvider + BotssonShell on layout"
```

---

## Task 2: Wire /api/botsson/chat to forward wizardSessionId

**Files:**
- Modify: `apps/web/src/app/api/botsson/chat/route.ts`

- [ ] **Step 1: Read current schema**

```bash
grep -n "RequestSchema\|wizard_session_id\|wizardSessionId" apps/web/src/app/api/botsson/chat/route.ts
```

Expected: existing schema without wizard_session_id field.

- [ ] **Step 2: Add wizardSessionId to schema**

Edit `apps/web/src/app/api/botsson/chat/route.ts` — find `RequestSchema = z.object({...})` and add field:

```typescript
const RequestSchema = z.object({
  workspaceId: z.string().uuid(),
  userMessage: z.string().min(1).max(10000),
  sessionId: z.string().uuid().optional(),
  pageContext: z.string().optional(),
  mission: z.string().optional(),
  missionContext: z.record(z.unknown()).optional(),
  /** ADR-0226: forward wizard_session_id to stage-engine when
   *  mission="journey_authoring". */
  wizardSessionId: z.string().uuid().optional(),
});
```

- [ ] **Step 3: Forward wizard_session_id to stage-engine**

In the same file, find the `fetch(\`${STAGE_ENGINE_URL}/agent/chat\`)` call and add `wizard_session_id` to body:

```typescript
body: JSON.stringify({
  message: userMessage,
  session_id: body.sessionId,
  profile_id: profile.profile_id,
  channel: "chat",
  page_context: body.pageContext,
  user_jwt: accessToken,
  // ADR-0226: forward wizardSessionId for journey_authoring mission.
  wizard_session_id: body.wizardSessionId,
}),
```

- [ ] **Step 4: Add mission=journey_authoring prime context (mirror emma route)**

Find `if (!body.sessionId && body.mission === "contract_intake")` block; add a sibling:

```typescript
if (!body.sessionId && body.mission === "journey_authoring") {
  const contextLines = [
    "[Misjon: journey_authoring — definer ny journey via 6-fase wizard.]",
    "[6 faser: Discovery → Classification → Steps → Testing → Documentation → Review]",
    "[Lagre etter hver fase via save_draft. Phase 6 → publish_draft({confirm:true}).]",
    "[VIKTIG: Aldri auto-publish. Vent eksplisitt 'godkjent' fra bruker.]",
  ];
  userMessage = `${contextLines.join("\n")}\n\n${userMessage}`;
}
```

- [ ] **Step 5: Auth precedence — Bearer over x-api-key (mirror emma fix)**

Find:
```typescript
if (STAGE_ENGINE_API_KEY) { headers["x-api-key"] = STAGE_ENGINE_API_KEY; }
```

Replace with:
```typescript
if (accessToken) {
  headers["authorization"] = `Bearer ${accessToken}`;
} else if (STAGE_ENGINE_API_KEY) {
  headers["x-api-key"] = STAGE_ENGINE_API_KEY;
}
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter web typecheck 2>&1 | tail -3`
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/botsson/chat/route.ts
git commit -m "feat(api): wire /api/botsson/chat for journey_authoring + wizardSessionId forward"
```

---

## Task 3: Switch wizard-chat from /api/emma/chat to /api/botsson/chat

**Files:**
- Modify: `apps/web/src/app/platform-admin/journeys/wizard/[sessionId]/_components/wizard-chat.tsx`

- [ ] **Step 1: Find current endpoint**

```bash
grep -n "fetch.*chat\|/api/emma\|/api/botsson" apps/web/src/app/platform-admin/journeys/wizard/[sessionId]/_components/wizard-chat.tsx
```

Expected: line ~132 hits `/api/emma/chat`.

- [ ] **Step 2: Swap endpoint**

Edit the file: replace `"/api/emma/chat"` with `"/api/botsson/chat"`. Keep all body fields intact (workspaceId, userMessage, sessionId, mission, wizardSessionId).

- [ ] **Step 3: Update file header comments**

Top-of-file comment block currently references `/api/journey-agent` (legacy). Update to:

```typescript
// Sends messages to /api/botsson/chat (admin BFF) which proxies to
// stage-engine /agent/chat. journey_authoring capability handles
// 6-phase wizard; ctx.wizardSessionId resolves wizard_session row.
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter web typecheck 2>&1 | tail -3`
Expected: 0 errors

- [ ] **Step 5: Test in browser**

Hard refresh `/platform-admin/journeys/wizard/<sessionId>`. Send a message. Expected: 200 response, agent responds, save_draft persists. Verify with:

```bash
docker exec supabase_db_smartout.ai psql -U postgres -d postgres -c "select current_phase, jsonb_pretty(draft_journey) from wizard_session order by created_at desc limit 1;"
```

Expected: `draft_journey` populated, `current_phase` = phase agent advanced to.

- [ ] **Step 6: Test Orb visible on /platform-admin/journeys/wizard**

Open page. Expected: Orb in bottom-right (or wherever BotssonShell renders). Both wizard-chat textbox AND Orb available.

- [ ] **Step 7: Commit**

```bash
git add 'apps/web/src/app/platform-admin/journeys/wizard/[sessionId]/_components/wizard-chat.tsx'
git commit -m "feat(wizard): switch wizard-chat to /api/botsson/chat (admin BFF)"
```

---

## Task 4: Verify voice path works for journey_authoring

**Files:** (no edits — verification only)

- [ ] **Step 1: Click Orb → mic mode**

In browser at `/platform-admin/journeys/wizard/<sessionId>`, click Orb to open chat, then enable voice (existing BotssonShell control).

- [ ] **Step 2: Speak a journey-authoring trigger**

Say: "Definer en ny journey for ansatt-onboarding"

Expected: Stage-engine intent-classifier routes to `journey_authoring` capability. Tools available per authority config.

- [ ] **Step 3: Verify channel=voice rejected for save_draft**

Per ADR-0078, journey_authoring `allowedChannels: ["chat"]`. Voice attempts to write should fail with channel-guard error. Read back error from agent (Botsson should say "kan ikke lagre via tale, bytt til chat").

If voice DOES succeed at save_draft → channel-guard regression, FILE BUG.

- [ ] **Step 4: Switch to chat mode + send same prompt**

Expected: save_draft works, draft_journey persists.

- [ ] **Step 5: No commit** (verification task)

---

## Self-Review

**Spec coverage:**
- ✅ Mount Botsson on platform-admin → Task 1
- ✅ Voice + chat available → BotssonShell handles both surfaces
- ✅ Wizard uses /api/botsson/chat → Task 3
- ✅ wizardSessionId forwarded → Task 2 + Task 3 (already in wizard-chat.tsx body)
- ✅ ADR-0078 channel guard intact → Task 4 verification

**Placeholder scan:** None.

**Type consistency:** wizardSessionId field name consistent across schemas (BFF + stage-engine schema accepts wizard_session_id, capability ctx exposes wizardSessionId).

---

## Execution Handoff

Plan complete. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between, fast iteration.
2. **Inline Execution** — execute tasks in this session via executing-plans, batch with checkpoints.

Which approach?
