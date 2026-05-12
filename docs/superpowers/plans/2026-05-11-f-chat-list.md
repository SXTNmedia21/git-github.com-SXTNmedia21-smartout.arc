---
title: "F-CHAT-LIST — Botsson Chat-List MVP"
status: ready
created: 2026-05-11
updated: 2026-05-11
module: MODULE_BOTSSON
campaign: botsson-arena
tags: [chat, history, engine_sessions, deprecation, sortie, g1]
adr: [ADR-0151, ADR-0152, ADR-0163, ADR-0184, ADR-0216, ADR-0296]
learnings: [L-0042, L-0176, L-0177, L-0229, L-0232]
sortie: feat/f-chat-list
gates: []
council: 2026-05-11-g1-plan-validation
po_decisions:
  persistence_surface: engine_sessions
  archive_axis: boolean
  bff_count: 3
  search: deferred-post-mvp
  mobile: follow-up-pr
  url_param: session
---

# F-CHAT-LIST — Botsson Chat-List MVP

## Goal

Replace dead-flush `emma_conversation` ghost-write path with live chat-list UI backed by `engine_sessions` (canonical conversation surface — 5 rows locally, 0 on emma tables). Ship 3 BFF endpoints + soft-archive via `is_archived BOOLEAN` + history list grouped by relative time + "Ny chat" action + archive with sonner-undo + URL-param session persistence + full deletion of dead emma-* surface in single atomic migration.

## Architecture Decision (per Council G1 2026-05-11)

**Single source of truth:** `engine_sessions.collected_data.conversation` (ADR-0296 + L-0232). All chat writes already land there via `services/stage-engine/src/routes/agent/chat.ts:336,400` (`append_conversation_turn` RPC). F-CHAT-LIST is BFF + UI only — no capability tools added, no stage-engine code touched.

**Option B confirmed by code-trace** at `services/stage-engine/src/routes/agent/chat.ts:278-325`: when `sessionId === undefined`, stage-engine calls `createAgentSession()` and returns the new UUID in `response.sessionId`. BotssonChat.tsx:134 already persists this. **No POST endpoint needed.**

**Archive ⊥ lifecycle:** `is_archived BOOLEAN` column added to `engine_sessions`. NOT a new `status` enum value.

**Single atomic migration:** column-add + emma DROP + emma-route DELETE all ship in one commit (T3b) — no orphan endpoint window.

## File Manifest

### CREATE

| Path | Purpose | Track |
|---|---|---|
| `supabase/migrations/20260529000000_chat_list_engine_sessions_archive_drop_emma.sql` | ADD COLUMN is_archived + DROP emma_transcript + DROP emma_conversation CASCADE | T3b |
| `apps/web/src/app/api/botsson/sessions/route.ts` | GET list — 50 most recent agent+chat+non-archived sessions | T4 |
| `apps/web/src/app/api/botsson/sessions/[id]/route.ts` | GET single full conversation; DELETE soft-archive | T4 |
| `apps/web/src/app/api/botsson/sessions/_schema.ts` | Zod request/response shapes | T4 |
| `apps/web/src/app/api/botsson/sessions/__tests__/route.test.ts` | Vitest: list-filter, fail-fast, mapping | T4 |
| `apps/web/src/app/api/botsson/sessions/__tests__/id-route.test.ts` | Vitest: GET/DELETE :id handlers | T4 |
| `apps/web/src/app/Botsson/_components/BotssonHistory.tsx` | Extracted HistoryView, list/conversation states, archive, AnimatePresence | T5 |
| `apps/web/src/app/Botsson/_components/use-botsson-sessions.ts` | TanStack Query hooks | T5 |
| `apps/e2e/tests/chat-list/chat-list-happy-path.spec.ts` | Playwright E2E | T9 |
| `docs/journeys/JOURNEY-chat-list.md` | 3 user journeys | T9 |
| `docs/HANDOFF-chat-list.md` | Decisions + learnings + next steps | T9 |

### MODIFY

| Path | Lines | What | Track |
|---|---|---|---|
| `packages/telemetry/src/registry.ts` | ~4298 + ~9826 + BotssonEvent union | Append `BotssonSessionCreated` + `BotssonSessionArchived` interfaces + routing entries + union | T3a |
| `packages/supabase/src/database.types.ts` | regenerated | `npx supabase gen types typescript --local` (NOT under op-wrap) | T3b |
| `apps/web/src/app/Botsson/_components/BotssonArena.tsx` | 2434-2481 + 2538 | Delete inline HistoryView, import BotssonHistory | T5 |
| `apps/web/src/app/Botsson/_components/BotssonProvider.tsx` | 103-171 + 770-859 | ADD currentSessionId state + startNewChat + loadSession; DELETE dead-flush block + JSDoc atomically | T6 |
| `apps/web/src/app/Botsson/_components/BotssonChat.tsx` | 79, 134 | Read currentSessionId from Provider; reset messages on change | T6 |
| `docs/decisions/0000-decision-log.md` | append | Register ADR-0296 row | T9 |
| `docs/learnings/0000-learning-log.md` | append | Register L-0232 row | T9 |
| `docs/architecture/BOTSSON-SYSTEM-MAP.md` | line 56, 142, frontmatter | Flip emma route 🔴 deprecated, add 3 new sessions rows, bump verified_against_code | T9 |

### DELETE

| Path | Why | Track |
|---|---|---|
| `apps/web/src/app/api/emma/history/route.ts` | Ghost-table route per ADR-0296. Same commit as DROP TABLE. | T3b |

## Commit Sequence (1 PR `feat/f-chat-list`)

1. `chore(telemetry): register botsson.session.created + botsson.session.archived events` — T3a
2. `feat(migration): add engine_sessions.is_archived + drop emma_conversation/transcript + delete /api/emma/history` — T3b
3. `feat(bff): /api/botsson/sessions endpoints (3) — GET list, GET :id, DELETE :id` — T4
4. `feat(ui): BotssonHistory.tsx + ny-chat button + sessions list + AnimatePresence transitions` — T5
5. `refactor(provider): currentSessionId state + remove dead-flush + URL-param persistence` — T6
6. `test(chat-list): vitest BFF + Playwright E2E happy-path` — T9
7. `docs(chat-list): JOURNEY + HANDOFF + register ADR-0296 + L-0232 in 0000 logs + system-map flip` — T9

Telemetry MUST land in commit 1 (registry-first sequencing per Council G1 mandate — `emit('botsson.session.archived', …)` in commit 3 fails registry validation otherwise).

## Migration spec (T3b)

**Verify timestamp at write-time (L-0042):**

```bash
ls supabase/migrations/ | grep -v rollback | tail -1
# Must output: 20260528010000_revoke_engine_world_observe_platform_from_clients.sql
# If newer migration exists, bump filename to next-higher timestamp.
```

**Migration body:** see T3b agent prompt for full SQL. Key operations:
- `ALTER TABLE engine_sessions ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;`
- `DROP TABLE IF EXISTS emma_transcript CASCADE;`
- `DROP TABLE IF EXISTS emma_conversation CASCADE;`

**Companion deletion in same commit:**
- `git rm apps/web/src/app/api/emma/history/route.ts`

**Types regen (NOT under op-wrap, L "op run corrupts supabase gen types"):**
```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

**Verification commands:**
```bash
npx supabase db reset --debug 2>&1 | tail -30
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -d postgres -c \
  "SELECT to_regclass('public.emma_conversation'), to_regclass('public.emma_transcript');"
# Expected: (null, null)
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -d postgres -c \
  "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='engine_sessions' AND column_name='is_archived';"
# Expected: is_archived | boolean | NO | false
grep -rn "emma_conversation\|emma_transcript\|EmmaConversation\|EmmaTranscript" \
  apps/ packages/ services/ supabase/ \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.next-e2e-web \
  --exclude-dir=dist
# Expected: zero hits OUTSIDE docs/ + the new migration file itself
```

## BFF spec (T4) — 3 endpoints

### Shared schema `_schema.ts`

```typescript
import { z } from "zod";

export const sessionListItemSchema = z.object({
  id: z.string().uuid(),
  summary: z.string().nullable(),
  started_at: z.string(),
  last_turn_at: z.string(),
  turn_count: z.number().int().min(0),
  channel: z.enum(["chat", "voice"]),
  mode: z.literal("agent"),
});

export const conversationTurnSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  timestamp: z.string(),
});

export const sessionDetailResponseSchema = z.object({
  id: z.string().uuid(),
  summary: z.string().nullable(),
  channel: z.enum(["chat", "voice"]),
  mode: z.literal("agent"),
  status: z.enum(["active", "complete", "expired", "abandoned"]),
  is_archived: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  conversation: z.array(conversationTurnSchema),
});

export type SessionListItem = z.infer<typeof sessionListItemSchema>;
export type SessionDetail = z.infer<typeof sessionDetailResponseSchema>;
export type ConversationTurn = z.infer<typeof conversationTurnSchema>;
```

### GET `/api/botsson/sessions` — list

- Predicate: `mode='agent' AND channel='chat' AND is_archived=false AND profile_id=$jwt_profile AND workspace_id=$jwt_ws`
- Order `created_at DESC`, limit 50
- **L-0177 fail-fast:** 403 if `ctx.profile.workspace_id` or `profile_id` null/empty (no silent fallback)
- Return `{ sessions: SessionListItem[] }`, derive turn_count from `jsonb_array_length(collected_data->'conversation')`, last_turn_at from last turn timestamp OR updated_at fallback
- anon+JWT client only (NO service-role per Law 5)

### GET `/api/botsson/sessions/[id]`

- RLS-scoped via `eq(workspace_id, $ws).eq(profile_id, $profile)` (belt-and-braces)
- Returns full `SessionDetail` with `collected_data.conversation` array
- 404 if not found OR not owned (RLS makes this transparent)

### DELETE `/api/botsson/sessions/[id]`

- Fetch row first → build `entity_label` = summary OR first user turn slice(0, 60) OR "Botsson chat"
- UPDATE is_archived=true + updated_at=now()
- Emit `botsson.session.archived` with ADR-0152 entity discriminator:
  ```typescript
  entity: { entity_type: "engine_session", entity_id: row.id, entity_label }
  ```
- Return 204 No Content

## Telemetry spec (T3a)

### Interface additions

Insert near line 4298 of `packages/telemetry/src/registry.ts`, BEFORE `BotssonEvent` union type:

```typescript
export interface BotssonSessionCreated extends BaseEvent {
  event: "botsson.session.created";
  properties: {
    entity: EntityRef;
    data: {
      session_id: string;
      channel: "chat" | "voice";
      mode: "agent";
    };
  };
}

export interface BotssonSessionArchived extends BaseEvent {
  event: "botsson.session.archived";
  properties: {
    entity: EntityRef;
    data: {
      session_id: string;
      archived_by: string;
      archived_at: string;
    };
  };
}
```

### Routing entries

Insert near line 9826:
```typescript
"botsson.session.created": {
  destinations: ["logger", "activity_trail"],
  category: "agent",
},
"botsson.session.archived": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "agent",
},
```

### Union update

Find existing `BotssonEvent` union via `grep -n "^export type BotssonEvent" packages/telemetry/src/registry.ts` and add `| BotssonSessionCreated | BotssonSessionArchived`.

## UI spec (T5)

### Hooks `use-botsson-sessions.ts`

- `useSessions()` → TanStack Query GET /api/botsson/sessions, staleTime 30s
- `useSession(id)` → conditional fetch by id
- `useArchiveSession()` → DELETE mutation with optimistic remove from cache, rollback on error, invalidate on settle

### BotssonHistory component

**Two-state internal: `view: 'list' | 'conversation'`**

**List state:**
- Header: title "Historikk" (font-heading) left + "Ny chat" button right with Lucide `MessageSquarePlus`
- Body: scroll area, `role="listbox"`, sessions grouped via `date-fns/formatDistanceToNow` + locale `nb`:
  - Groups: "I dag" / "I går" / "Denne uka" / "Eldre"
  - Group headers: Geist Sans (NOT font-heading), `text-[10px] uppercase tracking-wide text-muted-foreground/60 font-sans`
- Per-row: 
  - Title: summary OR first user-msg slice(0, 60) OR "Botsson chat"
  - Meta: relative-time + "·" + "{turn_count} turer"
  - Hover archive icon: `opacity-0 group-hover:opacity-100 transition-opacity duration-200`, Lucide `Archive`, `text-muted-foreground/40 hover:text-destructive/60`
- Empty state: warm text "Start en samtale — Botsson husker alt" + Lucide `MessageSquare` icon `text-brand-orange/30`
- Keyboard: `tabIndex={0}`, Enter to open, ↑↓ optional

**Conversation state:**
- Header: back-button (`ChevronLeft`) + title + dropdown with archive action
- Body: reuse existing transcript visual treatment

**Transitions via AnimatePresence:**
```tsx
<AnimatePresence mode="wait" initial={false}>
  {view === "list" ? (
    <motion.div key="list" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ type: "spring", stiffness: 120, damping: 18, mass: 0.6 }}>
      {/* list */}
    </motion.div>
  ) : (
    <motion.div key="conversation" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ type: "spring", stiffness: 120, damping: 18, mass: 0.6 }}>
      {/* conversation */}
    </motion.div>
  )}
</AnimatePresence>
```

Spring values match Nordic Split house style (existing pattern at WelcomeClient.tsx:144,168,193).

**Sonner toast for archive (NO modal, NO undo in MVP):**
```typescript
archiveSession.mutate(id, {
  onSuccess: () => toast.success("Samtale arkivert", { duration: 3000 }),
  onError: () => toast.error("Kunne ikke arkivere. Prøv igjen."),
});
```

### BotssonArena.tsx changes

- Delete inline `function HistoryView() { … }` (lines 2434-2481)
- Add `import { BotssonHistory } from "./BotssonHistory";`
- Replace `history: HistoryView,` (line 2538) with `history: BotssonHistory,`

## Provider spec (T6)

### Context additions to BotssonContextValue

```typescript
currentSessionId: string | null;
setCurrentSessionId: (id: string | null) => void;
startNewChat: () => void;
loadSession: (id: string) => void;
```

### State + handlers

```typescript
import { useRouter, useSearchParams } from "next/navigation";

const router = useRouter();
const searchParams = useSearchParams();

const [currentSessionId, setCurrentSessionIdState] = useState<string | null>(() => {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("session");
  return fromUrl && /^[0-9a-f-]{36}$/i.test(fromUrl) ? fromUrl : null;
});

const startNewChat = useCallback(() => {
  setCurrentSessionIdState(null);
  const params = new URLSearchParams(searchParams?.toString() ?? "");
  params.delete("session");
  const next = params.toString();
  router.replace(next ? `?${next}` : window.location.pathname, { scroll: false });
}, [router, searchParams]);

const loadSession = useCallback((id: string) => {
  setCurrentSessionIdState(id);
  const params = new URLSearchParams(searchParams?.toString() ?? "");
  params.set("session", id);
  router.replace(`?${params.toString()}`, { scroll: false });
}, [router, searchParams]);

// Server-recall fallback: on mount, if no URL param and null state, adopt most-recent
useEffect(() => {
  if (currentSessionId !== null) return;
  if (searchParams?.get("session")) return;
  let cancelled = false;
  void (async () => {
    try {
      const res = await fetch("/api/botsson/sessions");
      if (!res.ok || cancelled) return;
      const body = (await res.json()) as { sessions: Array<{ id: string }> };
      if (cancelled || body.sessions.length === 0) return;
      // Adopt but do NOT push URL param (only explicit load actions do)
      setCurrentSessionIdState(body.sessions[0]!.id);
    } catch { /* silent */ }
  })();
  return () => { cancelled = true; };
}, []); // mount-only
```

### DELETIONS — lines 769-859 (L-0176 5th-occurrence avoidance — delete docstring atomically with body)

Remove entirely:
- `conversationIdRef` ref (line 770)
- `prevConnected` ref (line 771)
- `transcriptBuffer` ref (line 772)
- `flushTranscript` function + any JSDoc (lines 774-785)
- start/end session useEffect (lines 787-829)
- `lastTranscriptLen` ref (line 832)
- transcript-log useEffect (lines 833-854)
- transcript-len-reset useEffect (lines 856-859)
- Section header comment at line 769
- TypeScript types `EmmaConversation` / `EmmaTranscript` if exist (grep first)

**Verification grep (must return zero hits):**
```bash
grep -rn "flushTranscript\|conversationIdRef\|transcriptBuffer\|lastTranscriptLen\|EmmaConversation\|EmmaTranscript" \
  apps/ packages/ services/ --exclude-dir=node_modules --exclude-dir=.next
```

### BotssonChat.tsx changes

Replace local sessionId state at line 79:
```typescript
const { currentSessionId, setCurrentSessionId } = useBotsson();
const sessionId = currentSessionId ?? undefined;
```

Replace line 134:
```typescript
if (data.sessionId && data.sessionId !== currentSessionId) {
  setCurrentSessionId(data.sessionId);
}
```

Add reset-on-external-change useEffect near line 83:
```typescript
useEffect(() => {
  setMessages([]);
  setInputValue("");
  setError(null);
}, [currentSessionId]);
```

## E2E spec (T9)

`apps/e2e/tests/chat-list/chat-list-happy-path.spec.ts` — 7-step happy path:
1. Login + open Arena
2. Send message → assert engine_sessions row appears
3. Open History → assert listbox visible + first option contains user message
4. Click "Ny chat" → assert no `?session=` in URL
5. Re-open History → assert prior session still visible
6. Hover row → click archive icon → assert sonner toast
7. Assert archived session gone from list (optimistic update)

Verify `data-testid="botsson-orb"` exists in current Botsson markup BEFORE writing E2E — if missing, add in T5.

## Docs spec (T9)

### JOURNEY-chat-list.md
3 journeys per Council G1:
- Journey 1: Employee browses chat history
- Journey 2: Employee starts a new chat
- Journey 3: Admin archives a chat session

Each with Precondition / Steps / Postcondition / Error paths per CLAUDE.md template. Frontmatter `e2e_test: apps/e2e/tests/chat-list/chat-list-happy-path.spec.ts`.

### HANDOFF-chat-list.md
- Summary, Decisions (Option B rationale, BOOLEAN over enum, search deferred, mobile follow-up), Learnings (L-0232 first occurrence), Known issues + debt (summary NULL by design, production audit gate, godmode unchanged), Next steps (Phase A3 Item 3 auto-summary, mobile chat-list, search, undo, bulk archive)

### Registries
- `docs/decisions/0000-decision-log.md` — append ADR-0296 row
- `docs/learnings/0000-learning-log.md` — append L-0232 row

### BOTSSON-SYSTEM-MAP.md
- Line 142 flip `/api/emma/history` → 🔴 deprecated by ADR-0296
- Insert 3 new L2 rows for `/api/botsson/sessions/*`
- Bump `verified_against_code: 2026-05-11`
- Line 56 text: remove "history" from emma list, add `/api/botsson/{chat, sessions, recorder/*, voice/*}`

## Pre-merge production gate (HANDOFF mandate)

```sql
SELECT count(*) FROM emma_conversation;  -- expect 0
SELECT count(*) FROM emma_transcript;    -- expect 0
```

If non-zero on Cloud, abort merge; export to cold storage first.

## Risks

| Risk | Tier | Mitigation |
|---|---|---|
| Migration timestamp drift (L-0042) | BLOCKER | Re-verify tip at write-time |
| Silent workspace fallback (L-0177) | BLOCKER | 403 fail-fast in all 3 BFF handlers; test enforces |
| Missing entity discriminator (ADR-0152) | BLOCKER | DELETE handler builds entity_label before emit; test asserts |
| Production has emma rows | BLOCKER | HANDOFF pre-merge SQL gate |
| URL param drop on layout-nav | TIER 2 | router.replace (App Router preserves); manual smoke |
| Dead-flush JSDoc orphan (L-0176) | TIER 2 | Delete docstrings atomic with bodies; grep gate |
| date-fns missing | TIER 2 | Confirmed ^4.1.0; if absent on fresh checkout: pnpm add |
| AnimatePresence loses key on rapid switch | TIER 3 | `mode="wait"` + stable `key={view}` |
| Sonner not mounted | TIER 3 | Verify imports |
| TanStack QueryClient not in Arena tree | TIER 3 | Verify via existing useQuery in BotssonArena memory view |

## Build Sequence (T3a-T9 checklist for build agents)

### T3a — Telemetry registry (Sonnet, ~30min)
- [ ] Read packages/telemetry/src/registry.ts, find botsson.* block
- [ ] Append BotssonSessionCreated + BotssonSessionArchived interfaces
- [ ] Append 2 routing entries
- [ ] Update BotssonEvent union
- [ ] `pnpm --filter @smartout/telemetry typecheck` passes
- [ ] Commit: `chore(telemetry): register botsson.session.created + botsson.session.archived events`

### T3b — Migration + emma drop (Sonnet, ~30min)
- [ ] Verify migration tip
- [ ] Write 20260529000000 migration
- [ ] `git rm apps/web/src/app/api/emma/history/route.ts`
- [ ] `npx supabase db reset` (NOT op-wrapped)
- [ ] `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`
- [ ] Verify zero emma references in code
- [ ] `pnpm --filter @smartout/supabase typecheck` passes
- [ ] Commit: `feat(migration): add engine_sessions.is_archived + drop emma_conversation/transcript + delete /api/emma/history`

### T4 — BFF endpoints (Sonnet, ~90min)
- [ ] Create _schema.ts
- [ ] Create route.ts (GET list)
- [ ] Create [id]/route.ts (GET + DELETE)
- [ ] Create __tests__/route.test.ts
- [ ] Create __tests__/id-route.test.ts
- [ ] `pnpm --filter web typecheck` passes
- [ ] `pnpm --filter web test -- sessions` passes
- [ ] Manual curl smoke
- [ ] Commit: `feat(bff): /api/botsson/sessions endpoints (3) — GET list, GET :id, DELETE :id`

### T5 — UI (Sonnet, ~2-3t)
- [ ] Verify date-fns 4.1.0 + locale nb
- [ ] Verify data-testid on Botsson orb (add if missing)
- [ ] Create use-botsson-sessions.ts
- [ ] Create BotssonHistory.tsx
- [ ] Modify BotssonArena.tsx
- [ ] `pnpm --filter web typecheck` passes
- [ ] Manual smoke render + hover-archive
- [ ] Commit: `feat(ui): BotssonHistory.tsx + ny-chat button + sessions list + AnimatePresence transitions`

### T6 — Provider (Sonnet, ~60min)
- [ ] Add currentSessionId state + actions + URL hydration + server-recall
- [ ] Delete dead-flush 770-859 entirely (bodies + JSDoc + types)
- [ ] Modify BotssonChat to read from Provider
- [ ] Verify zero hits on dead-flush grep
- [ ] `pnpm --filter web typecheck` passes
- [ ] Manual smoke session persist + new-chat clears + URL hydration
- [ ] Commit: `refactor(provider): currentSessionId state + remove dead-flush + URL-param persistence`

### T7 — Pre-PR review (Sonnet code-reviewer, ~30min)
- [ ] Verify registry-first sequence held
- [ ] Verify L-0177 fail-fast in BFF predicate
- [ ] Verify ADR-0152 entity discriminator in DELETE emit
- [ ] Verify dead-flush docstrings deleted (not stubbed)
- [ ] Verify no service-role on new BFF routes
- [ ] Verify migration timestamp > 20260528010000
- [ ] Block close-feature on findings

### T8 — Plan-vs-reality verify (Opus system-steward, ~30min)
- [ ] Verify 3 endpoints (not 4)
- [ ] Verify is_archived BOOLEAN (not enum)
- [ ] Verify Option B sessionId behavior
- [ ] Verify ADR-0296 + L-0232 registered in 0000 logs
- [ ] Verify BOTSSON-SYSTEM-MAP flipped

### T9 — Docs + tests + close-feature gate (Sonnet, ~90min)
- [ ] Create chat-list-happy-path.spec.ts
- [ ] Run E2E locally
- [ ] Write JOURNEY-chat-list.md
- [ ] Write HANDOFF-chat-list.md
- [ ] Register ADR-0296 + L-0232
- [ ] Update BOTSSON-SYSTEM-MAP
- [ ] `pnpm turbo typecheck` passes (CLOSURE gate)
- [ ] Commits: `test(chat-list)` + `docs(chat-list)`

## Reference files (build agents read these)

- `docs/decisions/0296-emma-conversation-deprecation.md`
- `docs/learnings/0232-ghost-table-dead-flush-pattern.md`
- `apps/web/src/app/Botsson/_components/BotssonArena.tsx` (lines 2434-2481, 2538)
- `apps/web/src/app/Botsson/_components/BotssonProvider.tsx` (lines 103-171, 770-859)
- `apps/web/src/app/Botsson/_components/BotssonChat.tsx` (lines 75-150)
- `apps/web/src/app/api/emma/history/route.ts` (to delete)
- `apps/web/src/app/api/emma/session/route.ts` (template for BFF style)
- `apps/web/src/app/api/emma/session/__tests__/route.test.ts` (template for vitest)
- `apps/web/src/lib/auth/get-server-context.ts` (canonical auth resolver)
- `services/stage-engine/src/routes/agent/chat.ts` (lines 278-325 — Option B proof)
- `services/stage-engine/src/core/agent-session.ts` (server-owned UUID)
- `supabase/migrations/20260301200000_engine_tables.sql` (engine_sessions base)
- `supabase/migrations/20260318130100_emma_conversation.sql` (tables to drop)
- `packages/telemetry/src/registry.ts` (lines 4222-4298, 9802-9826)
- `docs/architecture/BOTSSON-SYSTEM-MAP.md` (line 56 + 142)
