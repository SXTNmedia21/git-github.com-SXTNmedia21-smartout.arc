---
title: "Existing Components Inventory"
status: draft
updated: 2026-03-10
module: walkAi
tags: [blueprint, components, reuse]
---

# Existing Components Inventory

Comprehensive reference of ALL existing components that WalkAi can reuse or adapt. Verified against source code on the `feat/agent-chat` branch.

---

## 1. Draggable & Floating Components

### BotssonAvatar.tsx

- **Path:** `apps/web/src/app/onboarding/components/BotssonAvatar.tsx`
- Fully draggable with framer-motion (`drag`, `dragMomentum={false}`, `dragElastic={0.1}`)
- Fixed bottom-right (`fixed right-8 bottom-8 z-50`), cursor-grab / cursor-grabbing
- 3 states: idle, connecting, connected
- Voice visualizer (5 bars, 3px width, 3px gap, `bg-white/70`)
- Breathing ring (`border-2 border-white/20`, scale/opacity pulse via motion.div)
- Speech bubble (`max-w-[280px] rounded-2xl rounded-br-sm border border-white/10 bg-black/80 backdrop-blur-xl`)
- Key code: `motion.div` with `drag` props, `AnimatePresence mode="wait"` for state transitions
- Props: `status`, `isConnected`, `isSpeaking`, `isMuted`, `currentText`, `onToggleMic`, `onStart`, `onEnd`, `onShowCard`
- Avatar sizes: idle `h-14 w-14`, connected `h-16 w-16`
- Connection indicator: top-right emerald-400 dot with `animate-ping` when connected, `bg-white/20` when idle
- Entry animation: `initial={{ opacity: 0, y: 20 }}`, `animate={{ opacity: 1, y: 0 }}`, delay 1s

### AgentControlPanel.tsx

- **Path:** `apps/web/src/app/onboarding/components/AgentControlPanel.tsx`
- Fixed bottom-left (`fixed bottom-8 left-8 z-50`), collapsible via toggle button
- Stage commands (7 stages A-G) + referral buttons (8 quick actions)
- Only visible when `botsson.isConnected`
- Sends system messages via `botsson.sendContext(message)`
- Confirmation flash: "Sendt: {label}" in emerald-400/60, auto-clears after 2s
- Stage buttons: `border-white/[0.06] bg-white/[0.03]` with Send icon
- Referral buttons: `border-amber-500/[0.08] bg-amber-500/[0.03]` with Zap icon
- Panel container: `rounded-2xl border border-white/[0.06] bg-black/80 backdrop-blur-xl`

---

## 2. Voice & Chat Panels

### VoiceAssistant.tsx (Web)

- **Path:** `apps/web/src/components/voice-assistant.tsx`
- 350x600px fixed panel (`rounded-2xl border border-zinc-800 bg-zinc-950/80 shadow-2xl backdrop-blur-xl`)
- Orange glow shadow: `shadow-[0_0_50px_rgba(249,115,22,0.15)]`
- Ultravox session management with `UltravoxSession` in `useRef`
- Chat-first: mic starts muted, user must explicitly enable
- Agent speaks toggle: switches between voice/text output medium (`muteSpeaker`/`unmuteSpeaker` + `setOutputMedium`)
- Client tool registration before `joinCall`
- 15-second connect watchdog with auto-cleanup and retry
- PostHog telemetry on every state transition
- Message bubbles: user `bg-orange-500 text-white rounded-br-none`, agent `bg-zinc-800 text-zinc-200 border-zinc-700/50 rounded-bl-none`
- Controls: idle = single orange CTA, connected = 3 stacked rounded-full buttons
- Props: `onClose`, `autoStart`, `missionId`, `sessionContext`, `clientTools`

### VoiceAssistant.tsx (Landing)

- **Path:** `apps/landing/src/components/voice-assistant.tsx`
- Draggable variant using framer-motion `m` (tree-shaken import)
- Full height of parent container, `rounded-2xl`
- 5-bar animated equalizer (`w-1.5 rounded-full bg-orange-500`, `repeat: Infinity, duration: 1.5, delay: i * 0.1`)
- Supports `useEngine` flag for Stage Engine routing vs direct Ultravox
- Supports `variantContext` for per-landing-variant persona adaptation
- Simpler than web version: no PostHog, no agent speaks toggle, no watchdog
- Default mission: `landing-demo` (web version defaults to `mr-botsson`)

### VoiceSessionOverlay.tsx

- **Path:** `apps/web/src/app/onboarding/components/VoiceSessionOverlay.tsx`
- Full-screen overlay (`fixed inset-0 z-50 bg-black/60 backdrop-blur-xl`)
- Large 7-bar visualizer (`w-[5px] rounded-full bg-white/70`, gap 5px)
  - Speaking heights: `[8, 40+i*5, 12, 50+i*4, 8]`
  - Connected idle: `[6, 16, 6]`
  - Disconnected: height 6, opacity 0.15
- Breathing ring with glow (speaking: scale `[1, 1.2, 1]`, duration 0.8s; outer glow at `-inset-4`)
- Bottom subtitle bar (`max-w-lg rounded-2xl border border-white/10 bg-black/40 px-6 py-4 text-white/80 backdrop-blur-sm`)
- Controls: mic toggle (h-12 w-12) + "Fortsett" button
- Consumes `useOnboarding()` context directly

### AssistantPanel.tsx

- **Path:** `apps/landing/src/components/demo/AssistantPanel.tsx`
- Chat sidebar for guided demo experience, connected to DemoShell parent
- Quick reply chips (`rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-300`)
- Typing indicator: 3 bouncing dots (y: `[0, -4, 0]`, duration 0.6s, staggered delay `i * 0.15`)
- Message bubbles: user `bg-orange-500/20 text-orange-100`, agent `bg-white/[0.06] text-zinc-200`
- `AnimatePresence mode="popLayout"` for smooth layout animations
- Text input with voice mode toggle, auto-scroll via `scrollRef.scrollTop = scrollRef.scrollHeight`
- Header: Bot icon in `bg-orange-500/20`, agent name "Lise Botsson"
- Props: `messages`, `isTyping`, `isVoiceActive`, `onToggleVoice`, `onSendMessage`, `onQuickReply`
- Exports `ChatMessage` type: `{ id, role, content, quickReplies? }`

### AiChatPanel.tsx

- **Path:** `apps/web/src/components/contract-editor/ai-chat-panel.tsx`
- Contextual AI chat for contract editing, sends editor state to `/api/contract-agent`
- Quick actions: Forenkle (Sparkles), Oversett (Languages), Legg til (Plus), Valider (CheckCircle)
- Message bubbles: user `bg-primary text-primary-foreground`, agent `bg-muted text-foreground` (CSS variable classes)
- Actions rendered inline in messages as `rounded bg-white/5 px-2 py-1 text-xs` chips
- Timestamps on every message
- Enter to send, Shift+Enter for newline
- Uses shadcn/ui: Button, Textarea, ScrollArea
- Auto-scroll via `messagesEndRef.scrollIntoView({ behavior: "smooth" })`

### DocsAgentPanel.tsx

- **Path:** `apps/landing/src/app/docs/_components/docs-agent-panel.tsx`
- Gradient background (`rounded-3xl bg-gradient-to-b from-[#0d0d11] to-[#09090c]`)
- `max-h-[420px]` scrollable message area
- Lightweight documentation Q&A chat, sends to `/api/docs-agent`
- Message bubbles: agent `bg-white/5 text-zinc-200 border border-white/10`, user `ml-8 bg-orange-500/15 text-orange-100 border border-orange-500/30`
- Loading: `Loader2 animate-spin` + "Tenker..."
- Input: `rounded-xl border border-white/10 bg-white/5`, Enter to send

### ReportsChatPanel.tsx

- **Path:** `apps/web/src/app/dashboard/reports/_components/ReportsChatPanel.tsx`
- Chat panel wrapped in shadcn Sheet drawer
- Callbacks for report data propagation (`onReportData`, `onReportSaved`)
- Quick actions: Ny rapport, Mine rapporter, Medarbeidere, Protokoll-status
- Same structure as AiChatPanel (both use shadcn Button, Textarea, ScrollArea)
- Message bubbles: user `bg-primary text-primary-foreground`, agent `bg-muted text-foreground`
- Inline report data indicator + saved report confirmation
- Sends to `/api/reports-agent`

---

## 3. Monitoring & Control

### MissionControlPanel.tsx

- **Path:** `apps/web/src/components/dashboard/MissionControlPanel.tsx`
- Fixed right sidebar, 480px, `max-w-[90vw]`
- Z-layers: backdrop `z-[60]`, panel `z-[70]`
- Slide-in animation via `translate-x-full`/`translate-x-0`, `duration-300 ease-out`
- Two tabs: Hendelser (events) + Samtale (conversation)
- Real-time via `useGuardianSocket` WebSocket hook
- Whisper input: sends text to agent without user seeing it
- Stage controls: dropdown to force-switch conversation stage
- Color-coded actors (user/agent/guardian/admin):
  - user: emerald-400/emerald-500/10
  - agent: blue-400/blue-500/10
  - guardian: purple-400/purple-500/10
  - admin: amber-400/amber-500/10
- Dark/light mode via `isDark` prop
- Escape key to close
- Elapsed time display with auto-update every 60s
- Event row: monospace timestamp `text-[10px]`, actor badge with icon, summary text
- Conversation bubbles: user `bg-emerald-600/20 text-emerald-100 rounded-br-md`, agent `bg-blue-600/20 text-blue-100 rounded-bl-md`

### AgentCard.tsx

- **Path:** `apps/web/src/components/agent-card.tsx`
- Radix Sheet (right), `w-full sm:max-w-md`, `bg-black/90 backdrop-blur-xl`
- 4 tabs: Live / Stages / Prompt / Settings
- Live tab: referral quick commands (`rounded-full bg-white/[0.06]`), transcript viewer, context log, debug entries with color coding
- Stages tab: 7 onboarding stages (A-G) as clickable buttons with descriptions
- Prompt tab: system prompt display in monospace `pre` block
- Settings tab: config grid (temperature, voice, language, maxDuration, firstSpeaker)
- Debug entry colors: status=blue-400, tool_call=amber-400, tool_result=emerald-400, context_push=purple-400, inference=rose-400
- Props: `open`, `onOpenChange`, `name`, `description`, `greeting`, voice/language config, `transcript`, `debugLog`, `contextLog`, `instruction`, `onSendContext`

---

## 4. Animation Components

### TypewriterText.tsx

- **Path:** `apps/web/src/app/onboarding/components/TypewriterText.tsx`
- Char-by-char reveal, configurable speed (30ms default), delay before start, cursor toggle
- `onComplete` callback when full text is revealed
- Cursor: blinking `motion.span` (opacity `[1, 0]`, 0.5s repeat), `w-[2px] h-[1em] bg-current`
- Implementation: `setInterval` incrementing index, `text.slice(0, i)`
- Fully generic, no Smartout dependencies

### Voice Visualizers

Three variants across the codebase:

| Variant                     | Bars | Bar width   | Gap         | Color           | Context                |
| --------------------------- | ---- | ----------- | ----------- | --------------- | ---------------------- |
| Small (BotssonAvatar)       | 5    | 3px         | 3px         | `bg-white/70`   | Floating pill avatar   |
| Large (VoiceSessionOverlay) | 7    | 5px         | 5px         | `bg-white/70`   | Full-screen overlay    |
| Landing (VoiceAssistant)    | 5    | w-1.5 (6px) | gap-1 (4px) | `bg-orange-500` | Landing voice controls |

Shared animation pattern:

- Speaking: oscillating height array with per-bar offset, duration 0.6-0.8s + per-bar delay `i * 0.07-0.1`
- Connected idle: gentle pulse `[low, mid, low]`, duration 2s
- Disconnected: static minimum height, low opacity (0.15)
- Shape: `rounded-full`, `repeat: Infinity`

### Breathing Ring Pattern

- Speaking: scale `[1, 1.2, 1]`, opacity `[0.3, 0.6, 0.3]`, duration 0.8s
- Connected idle: scale `[1, 1.05, 1]`, opacity `[0.1, 0.2, 0.1]`, duration 3s
- Outer glow (speaking only): `-inset-2` or `-inset-4`, scale `[1, 1.1, 1]`, opacity `[0.1, 0.3, 0.1]`, duration 1.2s
- Border: `border-2 border-white/20`

---

## 5. Multi-Panel Patterns

### ChatShell.tsx

- **Path:** `apps/web/src/app/dashboard/chat/_components/ChatShell.tsx`
- 3-pane layout: ConversationList + Active conversation + MemberPanel
- `AnimatePresence` for member panel slide in/out
- TanStack Query hooks for conversations, messages (infinite query), reactions
- Realtime subscription via `useChatRealtime`
- Message features: reply-to, emoji reactions, mark-as-read
- Container: `rounded-lg border border-border bg-background`

### DocumentModeShell

- **Path:** `apps/web/src/app/dashboard/_components/document-mode/`
- Files: `document-mode-shell.tsx`, `document-mode-canvas.tsx` (Tiptap editor), `document-mode-panel.tsx`, `document-mode-sidebar.tsx`, `document-mode-toolbar.tsx`, `document-mode-context.tsx`
- Canvas (Tiptap) + 3-tab right panel (Verktoy/Handling/Innstillinger)
- Template picker and handbook content hooks

### ContractEditor

- **Path:** `apps/web/src/components/contract-editor/`
- Files: `contract-editor.tsx`, `sidebar-panel.tsx` (3 tabs), `ai-chat-panel.tsx`, `editor-toolbar-v2.tsx`, `document-outline.tsx`, `diff-overlay.tsx`, `metadata-bar.tsx`, `status-bar.tsx`
- Custom Tiptap extensions: signature-field, placeholder-field, clause-block, highlight-section, date-field, section-summary
- Editor + SidebarPanel (3 tabs) + AiChatPanel

---

## 6. UI Primitives (shadcn/Radix)

| Component       | Behavior                                                      | Key for WalkAi                                  |
| --------------- | ------------------------------------------------------------- | ----------------------------------------------- |
| **Sheet**       | Side panel slide-in (top/bottom/left/right), Portal rendering | Used by AgentCard, ReportsChatPanel             |
| **Dialog**      | Centered modal with zoom+fade, Portal                         | Confirmation dialogs, create flows              |
| **Popover**     | Anchored floating content, position-aware                     | Tooltips, quick menus                           |
| **ScrollArea**  | Custom scrollbar wrapper                                      | All chat panels use this or raw overflow-y-auto |
| **Tabs**        | Tab navigation with active underline                          | Used in document mode, contract editor          |
| **Command**     | Command palette (cmdk-based)                                  | Global command bar                              |
| **Collapsible** | Expandable sections                                           | Settings panels                                 |

All components: `apps/web/src/components/ui/` (new-york style, lucide icons)

---

## 7. Drag & Resize Libraries Available

| Library                 | Version      | Package                    | Usage                                                         |
| ----------------------- | ------------ | -------------------------- | ------------------------------------------------------------- |
| framer-motion           | ^12.34.3     | `apps/web`, `apps/landing` | Animations, gestures (drag, dragConstraints, AnimatePresence) |
| @dnd-kit/core           | ^6.3.1       | `apps/web`                 | Drag & drop with DragOverlay                                  |
| @dnd-kit/sortable       | ^10.0.0      | `apps/web`                 | Sortable lists                                                |
| @dnd-kit/utilities      | ^3.2.2       | `apps/web`                 | DnD helper utilities                                          |
| @radix-ui/react-dialog  | (via shadcn) | `apps/web`                 | Floating modals                                               |
| @radix-ui/react-popover | (via shadcn) | `apps/web`                 | Floating anchored content                                     |

**NOT installed:** `@floating-ui/react`, `react-rnd`, `react-grid-layout`, `@ag-ui/*`, `@copilotkit/*`

---

## 8. Z-Index Strategy

From `apps/web/src/app/dashboard/schedule/_components/schedule-layers.ts`:

```typescript
export const SCHEDULE_LAYERS = {
  base: 0,
  stickyContent: 10,
  stickyHeaders: 20,
  stickyCorner: 30,
  floatingActionBar: 30,
  dayPlannerBackdrop: 60,
  dayPlannerSheet: 70,
} as const;
```

Current z-index usage across codebase:

| Layer                        | Z-Index  | Component           |
| ---------------------------- | -------- | ------------------- |
| Radix modals/sheets/popovers | z-50     | shadcn defaults     |
| BotssonAvatar                | z-50     | Floating avatar     |
| AgentControlPanel            | z-50     | Control panel       |
| VoiceSessionOverlay          | z-50     | Full-screen overlay |
| MissionControl backdrop      | z-[60]   | Dimmed overlay      |
| MissionControl sheet         | z-[70]   | Right panel         |
| Notification area            | z-[90]   | (reserved)          |
| Command palette              | z-[9999] | (reserved)          |

**Proposed WalkAi layers:**

| Layer             | Z-Index | Purpose                                       |
| ----------------- | ------- | --------------------------------------------- |
| walkaiBackdrop    | 55      | Semi-transparent overlay behind WalkAi panels |
| walkaiPanel       | 65      | Main WalkAi panel (above modals, below MCP)   |
| walkaiDragPreview | 80      | Drag preview elements during reposition       |

---

## 9. Design Patterns Summary

| Pattern             | Example              | Key Implementation                                                                |
| ------------------- | -------------------- | --------------------------------------------------------------------------------- |
| Draggable float     | BotssonAvatar        | `motion.div drag dragMomentum={false} dragElastic={0.1}`                          |
| Slide-in sidebar    | MissionControlPanel  | `fixed right-0 translate-x-full/translate-x-0 transition duration-300`            |
| Full-screen overlay | VoiceSessionOverlay  | `fixed inset-0 bg-black/60 backdrop-blur-xl`                                      |
| Chat bubbles        | All chat panels      | `max-w-[85%] rounded-2xl px-4 py-2.5 text-sm`, one corner flat, role-based color  |
| Voice visualizer    | 3 variants           | N animated bars with staggered delays, 3 states (speaking/idle/disconnected)      |
| Auto-scroll         | All feeds            | `useRef` + `scrollIntoView({ behavior: "smooth" })` or `scrollTop = scrollHeight` |
| Tab navigation      | AgentCard, MCP       | Active `border-b-2`, inactive lower opacity                                       |
| Glass morphism      | Overlay panels       | `bg-black/60 border border-white/10 backdrop-blur-xl shadow-2xl`                  |
| Quick actions       | AiChatPanel, Reports | Array of `{ label, icon, prompt }`, rendered as buttons that auto-send            |
| Quick reply chips   | AssistantPanel       | `rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-300`       |
| Typing indicator    | AssistantPanel       | 3 bouncing dots, `y: [0, -4, 0]`, staggered `delay: i * 0.15`                     |
| Entry animation     | All panels           | Framer Motion ease `[0.16, 1, 0.3, 1]` (1.0s) or `[0.25, 0.1, 0.25, 1]` (0.4s)    |
| Error messages      | VoiceAssistant       | Norwegian text via `sonner` toast + inline retry button                           |
| Loading states      | Multiple             | Skeleton shimmer, Loader2 spinner, bouncing dots                                  |

---

## 10. AG-UI Research Status

- **File:** `docs/research/ag-ui: Six technical questions and awnsers.md`
- 365-line research doc, NOT implemented yet
- Verdict: Use `@ag-ui/client` + `@copilotkit/react-core` (not full UI layer)
- Custom overlay architecture recommended
- No `@ag-ui/*` or `@copilotkit/*` packages installed in any workspace
