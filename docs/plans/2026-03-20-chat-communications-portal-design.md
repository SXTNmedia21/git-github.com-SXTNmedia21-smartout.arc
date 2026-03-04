---
title: "Design — Chat Communications Portal"
status: draft
updated: 2026-03-20
created: 2026-03-20
module: communications
tags: [chat, realtime, supabase, whatsapp, redesign]
---

# Design — Chat Communications Portal

> WhatsApp Business-inspirerad kommunikationsportal for Smartout dashboardet.
> Ersatter nuvarande 1282-raders monolitisk mock med riktig backend, realtid och modulara komponenter.

---

## 1. Bakgrund

Smartout har en chatt-widget pa dashboardet (`apps/web/src/app/dashboard/chat/page.tsx`) som idag ar:

- **1282 rader** i en enda fil — all UI, state och logik
- **Mockdata** — inga riktiga meddelanden sparas
- **Hardcoded farger** — `#050505`, `cyan-500` istallet for CSS-variabler
- **Walkie-talkie** via Ultravox — tas bort (LiveKit/WebRTC planeras)
- **Ingen databas** — all state lokal till komponenten

### Mal

Bygga en fullstandig kommunikationsportal som:

1. Passar visuellt in i dashboardets designsystem
2. Har riktig persistence och realtid via Supabase
3. Stodjer grupp, DM och AI-assistent-konversationer
4. Ger managers extra oversikt (olasta, obesvarade)
5. Kanns som WhatsApp Business — snabbt, minimalistiskt, konversationsfokuserat

---

## 2. Designbeslut

| Beslut     | Val                      | Alternativ                | Motivering                                                      |
| ---------- | ------------------------ | ------------------------- | --------------------------------------------------------------- |
| UX-modell  | WhatsApp Business        | Slack, Teams              | Shift-baserade businesses behover snabbhet, inte komplexitet    |
| Chatttyper | Grupp + DM + AI          | Bara grupp                | Alla tre behov finns fran dag ett                               |
| Realtid    | Supabase Realtime        | Polling                   | Akta chattkansla kraver direkt feedback                         |
| Voice      | Borttagen (placeholder)  | Behall Ultravox           | LiveKit/WebRTC planeras — ingen mening att investera i Ultravox |
| Roller     | Fritt + manager-oversikt | Top-down                  | Alla ska kunna kommunicera, men managers behover extra verktyg  |
| Arkitektur | Komponentbibliotek       | Monolith / Headless paket | Bast balans mellan underhallbarhet och pragmatism               |

---

## 3. Databasschema

### 3.1 Enum

```sql
CREATE TYPE chat_conversation_type AS ENUM ('group', 'dm', 'ai');
```

### 3.2 Tabeller

#### `chat_conversation`

Huvudtabell for alla konversationer.

| Kolumn         | Typ                      | Constraint                      | Beskrivning                |
| -------------- | ------------------------ | ------------------------------- | -------------------------- |
| `id`           | `uuid`                   | PK, default `gen_random_uuid()` |                            |
| `workspace_id` | `uuid`                   | FK → `workspace(id)`, NOT NULL  | Workspace-isolering        |
| `type`         | `chat_conversation_type` | NOT NULL                        | `group`, `dm`, eller `ai`  |
| `name`         | `text`                   | NULL for DM                     | Visningsnamn               |
| `description`  | `text`                   | NULL                            | Kort beskrivning (grupper) |
| `avatar_url`   | `text`                   | NULL                            | Anpassad avatar            |
| `created_by`   | `uuid`                   | FK → `profile(id)`, NOT NULL    | Skaparen                   |
| `is_archived`  | `boolean`                | DEFAULT `false`                 | Soft-arkivering            |
| `created_at`   | `timestamptz`            | DEFAULT `now()`                 |                            |
| `updated_at`   | `timestamptz`            | DEFAULT `now()`                 |                            |

**Regler:**

- DM-konversationer har `name = NULL` — visa andra deltagarens namn i UI
- AI-konversationer har `created_by` = profilen som startade, AI:n ar deltagare
- `workspace_id` pa allt — RLS-isolering

#### `chat_participant`

Kopplar profiler till konversationer.

| Kolumn            | Typ           | Constraint                                           | Beskrivning            |
| ----------------- | ------------- | ---------------------------------------------------- | ---------------------- |
| `id`              | `uuid`        | PK, default `gen_random_uuid()`                      |                        |
| `conversation_id` | `uuid`        | FK → `chat_conversation(id)` ON DELETE CASCADE       |                        |
| `profile_id`      | `uuid`        | FK → `profile(id)`, NOT NULL                         |                        |
| `role`            | `text`        | DEFAULT `'member'`, CHECK IN (`'member'`, `'admin'`) | Konversationsroll      |
| `last_read_at`    | `timestamptz` | DEFAULT `now()`                                      | For olast-raknare      |
| `is_muted`        | `boolean`     | DEFAULT `false`                                      | Tysta notiser          |
| `joined_at`       | `timestamptz` | DEFAULT `now()`                                      |                        |
| `left_at`         | `timestamptz` | NULL                                                 | NULL = aktiv deltagare |

**Constraints:**

- `UNIQUE(conversation_id, profile_id)` — en profil per konversation
- `left_at IS NOT NULL` → dolj fran UI men behall historik

#### `chat_message`

Alla meddelanden.

| Kolumn            | Typ           | Constraint                                     | Beskrivning                      |
| ----------------- | ------------- | ---------------------------------------------- | -------------------------------- |
| `id`              | `uuid`        | PK, default `gen_random_uuid()`                |                                  |
| `conversation_id` | `uuid`        | FK → `chat_conversation(id)` ON DELETE CASCADE |                                  |
| `sender_id`       | `uuid`        | FK → `profile(id)`, NOT NULL                   |                                  |
| `content`         | `text`        | NOT NULL                                       | Meddelandetext                   |
| `reply_to_id`     | `uuid`        | FK → `chat_message(id)`, NULL                  | Tradar / citat                   |
| `reactions`       | `jsonb`       | DEFAULT `'{}'`                                 | `{"emoji": ["profile_id", ...]}` |
| `attachments`     | `jsonb`       | DEFAULT `'[]'`                                 | Framtida filbilagor              |
| `is_system`       | `boolean`     | DEFAULT `false`                                | Systemmeddelanden                |
| `edited_at`       | `timestamptz` | NULL                                           | NULL = ej redigerat              |
| `deleted_at`      | `timestamptz` | NULL                                           | Soft delete                      |
| `created_at`      | `timestamptz` | DEFAULT `now()`                                |                                  |
| `updated_at`      | `timestamptz` | DEFAULT `now()`                                |                                  |

**Index:**

- `idx_chat_message_conversation_created` ON `(conversation_id, created_at DESC)` — paginering
- `idx_chat_message_reply_to` ON `(reply_to_id)` WHERE `reply_to_id IS NOT NULL` — tradar

### 3.3 RLS-policies

Alla tabeller anvander workspace-scoping via `chat_participant`-membership:

```sql
-- chat_conversation: lasa om du ar deltagare
CREATE POLICY "conversation_read" ON chat_conversation FOR SELECT USING (
  id IN (
    SELECT conversation_id FROM chat_participant
    WHERE profile_id IN (SELECT id FROM profile WHERE user_id = auth.uid())
    AND left_at IS NULL
  )
);

-- chat_message: lasa om du ar deltagare i konversationen
CREATE POLICY "message_read" ON chat_message FOR SELECT USING (
  conversation_id IN (
    SELECT conversation_id FROM chat_participant
    WHERE profile_id IN (SELECT id FROM profile WHERE user_id = auth.uid())
    AND left_at IS NULL
  )
);

-- chat_message: skicka om du ar deltagare
CREATE POLICY "message_insert" ON chat_message FOR INSERT WITH CHECK (
  conversation_id IN (
    SELECT conversation_id FROM chat_participant
    WHERE profile_id IN (SELECT id FROM profile WHERE user_id = auth.uid())
    AND left_at IS NULL
  )
  AND sender_id IN (SELECT id FROM profile WHERE user_id = auth.uid())
);
```

API-key-policies laggs till for `profiles:read`-scope.

### 3.4 Supabase Realtime

```
Kanal: chat:{conversation_id}
Event: postgres_changes (INSERT, UPDATE pa chat_message)
Filter: conversation_id=eq.{id}
```

- INSERT → nytt meddelande visas direkt
- UPDATE → reaktioner, redigeringar synkas

---

## 4. Komponentarkitektur

### 4.1 Filstruktur

```
apps/web/src/app/dashboard/chat/
├── page.tsx                        -- Server component: hamta workspace + profil
├── _components/
│   ├── ChatShell.tsx               -- "use client" huvudlayout
│   ├── ConversationList.tsx        -- Vansterpanel
│   ├── ConversationItem.tsx        -- Rad i listan
│   ├── ChatHeader.tsx              -- Konversationsrubrik + actions
│   ├── MessageList.tsx             -- Scrollbart meddelandeomrade
│   ├── MessageBubble.tsx           -- Enskilt meddelande
│   ├── MessageInput.tsx            -- Textfalt + actions
│   ├── ReplyPreview.tsx            -- "Svarer X..." banner
│   ├── CreateConversation.tsx      -- Modal for ny konversation
│   └── MemberPanel.tsx             -- Hoger sidopanel
├── _hooks/
│   ├── useConversations.ts         -- TanStack Query: konversationslista
│   ├── useMessages.ts             -- TanStack Query: meddelanden + paginering
│   ├── useRealtimeMessages.ts     -- Supabase Realtime subscription
│   ├── useSendMessage.ts          -- Mutation: skicka meddelande
│   ├── useReaction.ts             -- Mutation: toggle reaktion
│   └── useMarkAsRead.ts           -- Mutation: uppdatera last_read_at
```

### 4.2 Komponentansvar

| Komponent            | Ansvar                                             | Max rader |
| -------------------- | -------------------------------------------------- | --------- |
| `ChatShell`          | Layout (3-kolumn flex), aktivt val, mobilresponsiv | ~120      |
| `ConversationList`   | Sok, filtrera, visa konversationer, ny-knapp       | ~100      |
| `ConversationItem`   | Avatar, namn, preview, olast-badge, tid            | ~60       |
| `ChatHeader`         | Namn, deltagare, telefon-placeholder, meny         | ~80       |
| `MessageList`        | Scroll, paginering (ladda mer uppat), daggrupper   | ~120      |
| `MessageBubble`      | Bubbla, avsandare, tid, reaktioner, reply-knapp    | ~100      |
| `MessageInput`       | Text, skicka, attachment-ikon, emoji-ikon          | ~80       |
| `ReplyPreview`       | Visar vem du svarar, stang-knapp                   | ~30       |
| `CreateConversation` | Steg: valj typ → namn/deltagare → skapa            | ~120      |
| `MemberPanel`        | Deltagarlista, roller, klickbara profiler          | ~80       |

### 4.3 Dataflode

```
page.tsx (server)
  └── hamtar workspace, profil, skickar som props
      └── ChatShell (client)
          ├── useConversations() → ConversationList
          ├── useMessages(activeId) → MessageList
          ├── useRealtimeMessages(activeId) → uppdaterar cache
          └── useSendMessage() → MessageInput
```

---

## 5. Visuell design — WhatsApp Business-stil

### 5.1 Fargpalett (CSS-variabler)

| Element            | Fardig klass                           | Effekt                        |
| ------------------ | -------------------------------------- | ----------------------------- |
| Bakgrund           | `bg-background`                        | Tema-aware, morkt eller ljust |
| Bubblor (andra)    | `bg-muted`                             | Subtil kontrast               |
| Bubblor (mina)     | `bg-primary/10`                        | Svag primary-tint             |
| Text               | `text-foreground`                      | Automatisk kontrast           |
| Avsandarnamn       | `text-muted-foreground text-xs`        | Diskret                       |
| Aktiv konversation | `bg-accent border-l-2 border-primary`  | Tydlig markering              |
| Olast-badge        | `bg-primary text-primary-foreground`   | Sma runda badges              |
| Input focus        | `ring-ring`                            | Standard theme                |
| Systemmeddelanden  | `text-muted-foreground text-xs italic` | Tyst, ej storande             |

### 5.2 Layout

```
┌─────────────────────────────────────────────────────┐
│  Operations > Chat                    🔍 Search...  │
├──────────────┬──────────────────────────────────────┤
│  💬 Meddelanden  [+]                                │
│  ┌────────────┐  ┌────────────────────────────────┐ │
│  │ ● Alla..   │  │  Alle Ansatte - Oslo           │ │
│  │   Johan: J │  │  24 aktive na        📞  ···   │ │
│  ├────────────┤  ├────────────────────────────────┤ │
│  │   Leder..  │  │                                │ │
│  │   Husk le  │  │  ── I dag ──                   │ │
│  ├────────────┤  │                                │ │
│  │   Vaktan.. │  │  Kari (Manager)         10:00  │ │
│  │   Kan noe  │  │  ┌─────────────────────┐      │ │
│  ├────────────┤  │  │ Hvem tar oppgjort   │      │ │
│  │ ✦ Smartout │  │  │ i kveld?            │      │ │
│  │   Assisten │  │  └─────────────────────┘      │ │
│  │            │  │  👍2                           │ │
│  │            │  │                                │ │
│  │            │  │         Johan (Ansatt)  10:30  │ │
│  │            │  │   ┌──────────────────┐        │ │
│  │            │  │   │ Jeg kan ta       │        │ │
│  │            │  │   │ oppgjort.        │        │ │
│  │            │  │   └──────────────────┘        │ │
│  │            │  │   👍1                          │ │
│  │            │  │                                │ │
│  │            │  │  Kari (Manager)                │ │
│  │            │  │  Perfekt, takk!                │ │
│  │            │  │                                │ │
│  └────────────┘  ├────────────────────────────────┤ │
│                  │  📎  Skriv til Alle...  😊  ➤  │ │
│                  └────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 5.3 Interaktioner

- **Hover pa meddelande:** Diskret actions-rad (reply, reagera, mer)
- **Klick pa avsandare:** Popover med profilkort (namn, roll, status)
- **Swipe/drag (framtid):** Reply pa mobil
- **Scroll uppat:** Lazy-load aldre meddelanden (50 at gangen)
- **Ny meddelande-indikator:** "↓ Nya meddelanden" knapp vid scroll

---

## 6. Hooks & Datahämtning

### 6.1 useConversations

```typescript
// TanStack Query
queryKey: ["conversations", workspaceId];
queryFn: supabase
  .from("chat_conversation")
  .select(
    `
    *,
    participants:chat_participant!inner(profile:profile(id, full_name, avatar_url)),
    last_message:chat_message(content, created_at, sender:profile(full_name))
  `,
  )
  .order("updated_at", { ascending: false });
```

### 6.2 useMessages

```typescript
// TanStack Infinite Query (paginering)
queryKey: ["messages", conversationId];
queryFn: ({ pageParam = 0 }) =>
  supabase
    .from("chat_message")
    .select(
      `
    *,
    sender:profile(id, full_name, avatar_url, role),
    reply_to:chat_message(id, content, sender:profile(full_name))
  `,
    )
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(pageParam, pageParam + 49);
```

### 6.3 useRealtimeMessages

```typescript
// Supabase Realtime — uppdaterar TanStack cache direkt
useEffect(() => {
  const channel = supabase
    .channel(`chat:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "chat_message",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        queryClient.setQueryData(["messages", conversationId], (old) => {
          // Prepend nya meddelandet till cache
        });
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [conversationId]);
```

### 6.4 useSendMessage

```typescript
// Optimistic update
mutationFn: async ({ content, replyToId }) => {
  return supabase.from('chat_message').insert({
    conversation_id: conversationId,
    sender_id: profileId,
    content,
    reply_to_id: replyToId ?? null
  })
}
onMutate: // optimistic — lagg till i cache direkt
onError:  // rollback
onSettled: // invalidate
```

---

## 7. Manager-oversikt

Managers (roll `manager` eller `admin` i workspace) far:

- **Olast-raknare** pa varje konversation (badge med siffra)
- **Obesvarad-indikator** — om senaste meddelandet i en grupp ar fran en anstall och inget svar fran manager/admin inom 30 min
- **Konversationslista sorterad** efter obesvarade forst, sedan senaste aktivitet

Implementeras som en extra query i `useConversations` som jamfor `last_read_at` med senaste meddelandets `created_at`.

---

## 8. AI-assistent-konversation

- Typ: `chat_conversation_type = 'ai'`
- Skapas med en AI-"profil" som deltagare (sparas som en systemrofil i `profile`-tabellen med `role = 'system'`)
- Meddelanden skickas via Edge Function som routar till Stage Engine
- Svar kommer tillbaka som vanliga `chat_message` INSERT (syns via Realtime)
- Visuellt: liten ✦-ikon pa avatar, "AI Assistent" som namn

---

## 9. Avgransningar (YAGNI)

Foljande byggs **inte** i denna iteration:

- Filuppladdning/bilagor (attachments-kolumn finns, UI byggs senare)
- Emoji-picker (anvand enbart snabb-reaktioner: 👍 ❤️ 😂)
- Laskvitton / "sett av X"
- Typing-indikatorer
- Meddelandesokning
- Push-notiser (hanteras av notifications-paketet separat)
- Pinnade meddelanden
- Voice/video (vantar pa LiveKit)
- Mobil-specifik layout (fungerar responsivt men inte optimerat)

---

## 10. Migration-strategi

En enda migration som skapar:

1. Enum `chat_conversation_type`
2. Tabell `chat_conversation` + index + RLS
3. Tabell `chat_participant` + unique constraint + RLS
4. Tabell `chat_message` + index + RLS
5. Trigger for `updated_at` pa alla tre tabeller
6. API-key RLS-policies (for `profiles:read` scope)

Migration-fil: `supabase/migrations/YYYYMMDDHHMMSS_chat_communications.sql`

Efter migration: regenerera `database.types.ts`.
