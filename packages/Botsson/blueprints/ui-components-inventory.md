---
title: "UI Components Inventory — WalkAi Blueprint"
status: draft
updated: 2026-03-10
created: 2026-03-10
module: walkAi
tags: [blueprint, ui, components, design]
---

# UI Components Inventory

Reference document for building WalkAi. Catalogues every existing voice, chat, animation, and panel component in the Smartout codebase with file paths, dimensions, props, color tokens, and reuse recommendations.

---

## 1. Voice Chat Components

### 1.1 VoiceAssistant (Dashboard)

| Property   | Value                                         |
| ---------- | --------------------------------------------- |
| File       | `apps/web/src/components/voice-assistant.tsx` |
| Lines      | 511                                           |
| Framework  | Raw React + Ultravox SDK (no Framer Motion)   |
| Dimensions | 350 x 600 px, `rounded-2xl`                   |

**Architecture:** Self-contained component managing its own `UltravoxSession`. Props accept `missionId`, `sessionContext`, `clientTools`, `autoStart`, and `onClose`.

**State machine:** `idle` -> `connecting` -> `listening/thinking/speaking` -> `disconnected`

**Key features:**

- Chat-first: mic starts muted, user must explicitly enable
- Agent speaks toggle: switches between voice and text output medium (`muteSpeaker`/`unmuteSpeaker` + `setOutputMedium`)
- Client tool registration before `joinCall`
- 15-second connect watchdog with auto-cleanup
- PostHog telemetry on every state transition
- Error recovery with retry button and Norwegian error messages

**Message bubbles:**

- User: `bg-orange-500 text-white rounded-2xl rounded-br-none`
- Agent: `bg-zinc-800 text-zinc-200 border border-zinc-700/50 rounded-2xl rounded-bl-none`
- Max width: `max-w-[85%]`
- Entry animation: `animate-in fade-in slide-in-from-bottom-2 duration-200`

**Controls layout:**

- Idle: single orange CTA button (`bg-orange-500`, `shadow-orange-500/20`)
- Connected: 3 stacked rounded-full buttons (agent speaks, mic mute, close)
- Mic muted: `bg-red-500/20 text-red-500 border-red-500/20`
- Mic live: `bg-emerald-500 text-white border-emerald-300 shadow-emerald-500/30`

**Header:** Bot avatar circle (orange-500 when connected, zinc-800 when idle), ping indicator dot, agent name from `MISSION_MANIFEST`, status line.

---

### 1.2 VoiceAssistant (Landing)

| Property   | Value                                             |
| ---------- | ------------------------------------------------- |
| File       | `apps/landing/src/components/voice-assistant.tsx` |
| Lines      | 283                                               |
| Framework  | Framer Motion `m` (tree-shaken) + Ultravox SDK    |
| Dimensions | Full height of parent container, `rounded-2xl`    |

**Differences from dashboard variant:**

- Uses Framer Motion `m.div` for message entry animations (not CSS `animate-in`)
- Supports `useEngine` flag for Stage Engine routing vs. direct Ultravox
- Supports `variantContext` for per-landing-variant persona adaptation
- Simpler controls: mic toggle + visualizer bars + close (no agent speaks toggle)
- No PostHog integration
- Default mission: `landing-demo` (not `mr-botsson`)

**Inline voice visualizer:** 5 bars, `w-1.5 rounded-full bg-orange-500`, animated height when connected and unmuted. Transition: `repeat: Infinity, duration: 1.5, delay: i * 0.1`.

---

### 1.3 VoiceDemoWidget (Landing)

| Property  | Value                                                     |
| --------- | --------------------------------------------------------- |
| File      | `apps/landing/src/components/landing/VoiceDemoWidget.tsx` |
| Lines     | 150                                                       |
| Framework | Framer Motion `m` + `AnimatePresence` + `next/dynamic`    |

**Purpose:** Wrapper around the landing VoiceAssistant that adds a themed placeholder card with open/close state management. Used by all 7 landing page variants.

**Key features:**

- Dynamic import of VoiceAssistant (`ssr: false`) to avoid WebRTC SSR issues
- Placeholder card: gradient overlay, hover glow, pulsing mic icon, variant-aware accent colors
- `AnimatePresence mode="wait"` for smooth open/close transitions
- Configurable height (default 600px)
- Accent color system via `ACCENT_COLORS` map

---

### 1.4 VoiceSessionOverlay (Onboarding)

| Property  | Value                                                            |
| --------- | ---------------------------------------------------------------- |
| File      | `apps/web/src/app/onboarding/components/VoiceSessionOverlay.tsx` |
| Lines     | 224                                                              |
| Framework | Framer Motion + `AnimatePresence`                                |
| Layout    | Full-screen fixed overlay (`fixed inset-0 z-50`)                 |

**Purpose:** Full-screen immersive voice session UI for onboarding. Centered visualizer with breathing ring animations.

**States:**

- Connecting: breathing ring (scale 1 -> 1.15 -> 1, opacity 0.2 -> 0.4 -> 0.2, 2s loop) + Loader2 spinner
- Connected: 7-bar visualizer inside breathing ring, mic toggle + "Fortsett" button

**LargeVoiceVisualizer:** 7 bars, `w-[5px] rounded-full bg-white/70`, gap `5px`. Speaking heights: `[8, 40+i*5, 12, 50+i*4, 8]`. Idle connected: `[6, 16, 6]`. Disconnected: height 6, opacity 0.15.

**Subtitle bar:** Bottom-fixed, `max-w-lg rounded-2xl border border-white/10 bg-black/40 px-6 py-4 text-white/80 backdrop-blur-sm`.

**Breathing ring (speaking):** scale `[1, 1.2, 1]`, opacity `[0.3, 0.6, 0.3]`, duration 0.8s. Outer glow ring at `-inset-4`.

---

### 1.5 BotssonAvatar (Onboarding)

| Property  | Value                                                         |
| --------- | ------------------------------------------------------------- |
| File      | `apps/web/src/app/onboarding/components/BotssonAvatar.tsx`    |
| Lines     | 231                                                           |
| Framework | Framer Motion                                                 |
| Layout    | Fixed bottom-right (`fixed right-8 bottom-8 z-50`), draggable |

**Purpose:** Floating pill avatar with speech bubble. Draggable via Framer Motion `drag` prop.

**Three visual states:**

1. **Idle:** Speech bubble "Botsson er klar" + Bot icon, `bg-black/60` pill
2. **Connecting:** Loader2 spinner + "Kobler til..." bubble
3. **Connected:** Live speech bubble with `currentText`, 5-bar visualizer, mic toggle, info button

**VoiceVisualizer (small):** 5 bars, `w-[3px] rounded-full bg-white/70`, gap `3px`. Speaking heights: `[4, 14+i*3, 6, 18+i*2, 4]`. Idle connected: `[3, 6, 3]`.

**Avatar sizes:** Idle: `h-14 w-14`, Connected: `h-16 w-16`. Border: `border-white/10`.

**Connection indicator:** Top-right dot. Connected: emerald-400 with animate-ping. Idle: `bg-white/20`.

**Speech bubble styling:** `rounded-2xl rounded-br-sm border border-white/10 bg-black/80 px-4 py-3 text-white/80 shadow-2xl backdrop-blur-xl`, max-width 280px.

---

### 1.6 useBotsson Hook

| Property | Value                                             |
| -------- | ------------------------------------------------- |
| File     | `apps/web/src/app/onboarding/hooks/useBotsson.ts` |
| Lines    | 713                                               |

**Purpose:** Full Ultravox session lifecycle hook with 13 client tool implementations for onboarding (searchCompany, identifyCompany, scrapeWebsite, updateBusiness, addDepartments, addLocations, addZones, addProcedures, updateSeason, advanceToNextSection, addKeyFact, saveMemory, finalizeOnboarding).

**Returns:** `{ status, isConnected, isSpeaking, isMuted, currentText, transcript, contextLog, debugLog, startSession, endSession, toggleMic, sendContext }`

**Pattern:** Refs for actions (`actionsRef`) to avoid stale closures in tool callbacks. Debug log captures all data_message events including tool calls.

---

### 1.7 AssistantPanel (Landing Demo)

| Property  | Value                                                 |
| --------- | ----------------------------------------------------- |
| File      | `apps/landing/src/components/demo/AssistantPanel.tsx` |
| Lines     | 213                                                   |
| Framework | Framer Motion `m` + `AnimatePresence`                 |

**Purpose:** Text-based chat sidebar for the guided demo experience. Connected to DemoShell parent and useDemoJourney state.

**Key features:**

- Message bubbles with `AnimatePresence mode="popLayout"` for smooth layout animations
- Quick reply chips: `rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-300`
- Typing indicator: 3 bouncing dots (y: `[0, -4, 0]`, duration 0.6s, staggered delay `i * 0.15`)
- Text input with voice mode toggle
- Auto-scroll via `scrollRef.scrollTop = scrollRef.scrollHeight`

**Message bubble colors (landing variant):**

- Assistant: `bg-white/[0.06] text-zinc-200`
- User: `bg-orange-500/20 text-orange-100`

**Header:** Bot icon in `bg-orange-500/20`, voice toggle button, agent name "Lise Botsson".

---

### 1.8 AiChatPanel (Contract Editor)

| Property  | Value                                                       |
| --------- | ----------------------------------------------------------- |
| File      | `apps/web/src/components/contract-editor/ai-chat-panel.tsx` |
| Lines     | 267                                                         |
| Framework | shadcn/ui (Button, Textarea, ScrollArea)                    |

**Purpose:** Contextual AI chat for contract template editing. Sends editor state (HTML + text) to `/api/contract-agent` and renders proposed `EditorAction[]` inline.

**Key features:**

- 4 quick actions: Forenkle (Sparkles), Oversett (Languages), Legg til (Plus), Valider (CheckCircle)
- Actions rendered inline in message bubbles as `rounded bg-white/5 px-2 py-1 text-xs` chips
- Timestamps on every message
- Enter to send, Shift+Enter for newline
- Uses shadcn CSS variable classes: `bg-primary`, `bg-muted`, `text-foreground`

**Message bubble colors (dashboard variant):**

- User: `bg-primary text-primary-foreground rounded-lg`
- Assistant: `bg-muted text-foreground rounded-lg`

---

### 1.9 VoiceToolsContext

| Property | Value                                             |
| -------- | ------------------------------------------------- |
| File     | `apps/web/src/components/voice-tools-context.tsx` |
| Lines    | 53                                                |

**Purpose:** React context for passing client tool definitions and implementations to the VoiceAssistant from any page. Provider wraps the dashboard layout; pages register tools via `useVoiceTools().setClientTools()`.

**Types exported:** `ClientToolDefinition`, `ClientToolImplementation`, `ClientTools`

---

## 2. Animation & Motion Patterns

### 2.1 TypewriterText

| Property | Value                                                       |
| -------- | ----------------------------------------------------------- |
| File     | `apps/web/src/app/onboarding/components/TypewriterText.tsx` |
| Lines    | 61                                                          |

**Props:** `text`, `speed` (ms per char, default 30), `delay` (ms before start), `cursor` (boolean, default true), `onComplete` callback, `className`.

**Implementation:** `setInterval` with character-by-character reveal. Cursor: blinking `motion.span` (opacity `[1, 0]`, 0.5s repeat), `w-[2px] h-[1em] bg-current`.

---

### 2.2 SectionReveal

| Property | Value                                                      |
| -------- | ---------------------------------------------------------- |
| File     | `apps/web/src/app/onboarding/components/SectionReveal.tsx` |
| Lines    | 56                                                         |

**Exports:** `SectionReveal` (container), `RevealItem` (child), `revealItem` (variant object).

**Container variant:** `staggerChildren: 0.18`, `delayChildren: 0.25`. Triggers on `whileInView` with `viewport: { once: true, amount: 0.3 }`.

**Item variant:** `hidden: { opacity: 0, y: 40 }` -> `visible: { opacity: 1, y: 0 }`. Duration 1.0s, ease `[0.16, 1, 0.3, 1]` (custom spring-like cubic bezier).

---

### 2.3 BigBoard

| Property | Value                                                 |
| -------- | ----------------------------------------------------- |
| File     | `apps/web/src/app/onboarding/components/BigBoard.tsx` |
| Lines    | 271                                                   |

**Purpose:** Animated 2-column grid of data panels that progressively reveal business information during onboarding scrape.

**6 panels:** Bedrift, Online, Sesong, Avdelinger, Lokasjoner, Prosedyrer. Each with icon, fields, optional chips.

**Animation layers:**

1. Panel stagger: 300ms between panels, entry `{ opacity: 0, y: 24, scale: 0.97 }` -> visible, ease `[0.16, 1, 0.3, 1]`
2. Field stagger: 400ms between fields within each panel, entry `{ opacity: 0, x: -12 }` -> visible
3. Skeleton shimmer during scraping: `h-3 w-20 animate-pulse rounded bg-white/[0.04]`
4. Completion check: spring animation `{ type: "spring", stiffness: 500, damping: 25 }` on Check icon

**Chip styling:** `rounded-full border border-white/[0.06] bg-white/[0.05] px-2.5 py-0.5 text-xs text-white/60`

---

### 2.4 AmbientBackground

| Property | Value                                                          |
| -------- | -------------------------------------------------------------- |
| File     | `apps/web/src/app/onboarding/components/AmbientBackground.tsx` |
| Lines    | 142                                                            |

**Purpose:** Decorative full-screen background with 3 OKLCH gradient orbs that shift position/color per onboarding section. Purely visual, `pointer-events-none`.

**8 section configs:** hero, business, departments, locations, procedures, season, contract, welcome. Each defines 3 orbs with `x`, `y`, `scale`, `color` (OKLCH), `size` (px), `blur` (px).

**OKLCH color range:** Hues 30-290, lightness 0.42-0.65, chroma 0.06-0.16.

**Orb implementation:** `radial-gradient(circle, ${color} 0%, transparent 70%)`, `filter: blur(${blur}px)`, `willChange: "transform, left, top"`.

**Orb transition:** duration 1.8s, ease `[0.25, 0.1, 0.25, 1.0]`.

**Drift layers:** 3 CSS keyframe animations (`onboarding-drift-1/2/3`) at 22-28s cycle, using `vw`/`vh` units for viewport-relative micro-movement. Layered on top of Framer Motion position changes.

**Noise overlay:** SVG `feTurbulence` fractalNoise at `opacity-[0.03] mix-blend-overlay` to prevent color banding.

**Performance:** `contain: "layout style paint"` on root, `aria-hidden="true"`.

---

## 3. Sidebar & Panel Components

### 3.1 MissionControlPanel

| Property | Value                                                             |
| -------- | ----------------------------------------------------------------- |
| File     | `apps/web/src/components/dashboard/MissionControlPanel.tsx`       |
| Lines    | 681                                                               |
| Width    | 480px (`max-w-[90vw]`)                                            |
| Layout   | Fixed right-side slide-in (`fixed top-0 right-0 bottom-0 z-[70]`) |

**Purpose:** Admin oversight panel for live AI agent sessions. Shows real-time events and conversation, with whisper input and stage controls.

**Key features:**

- Backdrop blur overlay at `z-[60]`
- Two tabs: Hendelser (events) and Samtale (conversation)
- Real-time via `useGuardianSocket` WebSocket hook
- Whisper input: sends text to agent without user seeing it
- Stage controls: dropdown to force-switch conversation stage
- Escape key to close
- Elapsed time display with auto-update every 60s
- Light/dark mode support via `isDark` prop

**Actor color system:**
| Actor | Dark text | Dark bg |
|-------|-----------|---------|
| user | emerald-400 | emerald-500/10 |
| agent | blue-400 | blue-500/10 |
| guardian | purple-400 | purple-500/10 |
| admin | amber-400 | amber-500/10 |

**Conversation bubbles (MCP variant):**

- User (dark): `bg-emerald-600/20 text-emerald-100 rounded-br-md`
- Assistant (dark): `bg-blue-600/20 text-blue-100 rounded-bl-md`
- User (light): `bg-emerald-50 text-emerald-900`
- Assistant (light): `bg-blue-50 text-blue-900`

**Event row:** Monospace timestamp `text-[10px]`, actor badge with icon, summary text, event_type in mono.

---

## 4. Message Bubble Patterns

Summary of all bubble variants across the codebase:

| Context                  | User bubble                                        | Agent bubble                                                   |
| ------------------------ | -------------------------------------------------- | -------------------------------------------------------------- |
| Dashboard VoiceAssistant | `bg-orange-500 text-white rounded-br-none`         | `bg-zinc-800 text-zinc-200 border-zinc-700/50 rounded-bl-none` |
| Landing VoiceAssistant   | Same as dashboard                                  | Same as dashboard                                              |
| Landing AssistantPanel   | `bg-orange-500/20 text-orange-100`                 | `bg-white/[0.06] text-zinc-200`                                |
| Contract AiChatPanel     | `bg-primary text-primary-foreground`               | `bg-muted text-foreground`                                     |
| MCP Conversation (dark)  | `bg-emerald-600/20 text-emerald-100 rounded-br-md` | `bg-blue-600/20 text-blue-100 rounded-bl-md`                   |
| MCP Conversation (light) | `bg-emerald-50 text-emerald-900`                   | `bg-blue-50 text-blue-900`                                     |

**Common patterns:**

- Max width: `max-w-[85%]` everywhere
- Padding: `px-4 py-2.5` (voice), `px-3 py-2` (contract)
- Border radius: `rounded-2xl` (voice/demo), `rounded-lg` (contract)
- Alignment: user `justify-end`, assistant `justify-start`
- Text size: `text-sm` everywhere, `leading-relaxed` on MCP/demo

---

## 5. Voice Visualization Patterns

| Variant                     | Bars | Bar width   | Gap         | Context                |
| --------------------------- | ---- | ----------- | ----------- | ---------------------- |
| Small (BotssonAvatar)       | 5    | 3px         | 3px         | Floating pill avatar   |
| Large (VoiceSessionOverlay) | 7    | 5px         | 5px         | Full-screen overlay    |
| Landing (inline)            | 5    | w-1.5 (6px) | gap-1 (4px) | Landing voice controls |

**Shared animation pattern:**

- Speaking: oscillating height array with per-bar offset (`i * 3` or `i * 5`), duration 0.6-0.8s + per-bar delay `i * 0.07-0.1`
- Connected idle: gentle pulse `[low, mid, low]`, duration 2s
- Disconnected: static minimum height, low opacity (0.15)
- Color: `bg-white/70` (overlay variants), `bg-orange-500` (landing)
- Shape: `rounded-full`

**Breathing ring pattern:**

- Speaking: scale `[1, 1.2, 1]`, opacity `[0.3, 0.6, 0.3]`, duration 0.8s
- Connected idle: scale `[1, 1.05, 1]`, opacity `[0.1, 0.2, 0.1]`, duration 3s
- Outer glow (speaking only): `-inset-2` or `-inset-4`, scale `[1, 1.1, 1]`, opacity `[0.1, 0.3, 0.1]`, duration 1.2s

---

## 6. Design Tokens

### 6.1 Brand Colors (OKLCH)

Source: `packages/design-tokens/src/tokens.css`

| Token                  | OKLCH Value                 | Usage                                      |
| ---------------------- | --------------------------- | ------------------------------------------ |
| `--brand-orange`       | `oklch(0.65 0.22 40)`       | Primary CTA, ring focus, active indicators |
| `--brand-orange-light` | `oklch(0.75 0.18 40)`       | Hover states                               |
| `--brand-orange-dark`  | `oklch(0.55 0.22 40)`       | Pressed states                             |
| `--success`            | `oklch(0.65 0.2 145)`       | Connected status, positive actions         |
| `--warning`            | `oklch(0.75 0.18 85)`       | Caution indicators                         |
| `--info`               | `oklch(0.6 0.15 250)`       | Informational badges                       |
| `--destructive` (dark) | `oklch(0.704 0.191 22.216)` | Error, end session                         |

### 6.2 Dark Mode Surfaces

| Token          | OKLCH Value          | Hex approximation |
| -------------- | -------------------- | ----------------- |
| `--background` | `oklch(0.145 0 0)`   | ~#1a1a1a          |
| `--card`       | `oklch(0.205 0 0)`   | ~#2a2a2a          |
| `--secondary`  | `oklch(0.269 0 0)`   | ~#383838          |
| `--muted`      | `oklch(0.269 0 0)`   | ~#383838          |
| `--border`     | `oklch(1 0 0 / 10%)` | white/10          |
| `--input`      | `oklch(1 0 0 / 15%)` | white/15          |

### 6.3 Voice Component Hardcoded Colors

These are used inline in voice components (not via CSS variables):

| Color                        | Usage                               |
| ---------------------------- | ----------------------------------- |
| `bg-zinc-950/80`             | VoiceAssistant body                 |
| `bg-zinc-900/50`             | VoiceAssistant header/footer        |
| `bg-zinc-800`                | Agent bubble, idle avatar, controls |
| `bg-orange-500`              | User bubble, connected avatar, CTA  |
| `shadow-orange-500/20`       | CTA glow                            |
| `shadow-orange-500/15`       | Panel outer glow                    |
| `bg-red-500/20 text-red-500` | Muted mic indicator                 |
| `bg-emerald-500 text-white`  | Live mic indicator                  |
| `bg-black/60`                | Overlay panels, speech bubbles      |
| `border-white/10`            | Glass borders                       |
| `bg-white/[0.05]`            | Glass backgrounds                   |

### 6.4 Onboarding Color Temperature

Source: `apps/web/src/app/globals.css`

| Section     | OKLCH                  | Hue    |
| ----------- | ---------------------- | ------ |
| hero        | `oklch(0.13 0.01 250)` | Blue   |
| business    | `oklch(0.12 0.02 60)`  | Warm   |
| season      | `oklch(0.11 0.03 35)`  | Orange |
| departments | `oklch(0.1 0.02 150)`  | Green  |
| locations   | `oklch(0.11 0.02 180)` | Teal   |
| procedures  | `oklch(0.1 0.02 220)`  | Blue   |
| contract    | `oklch(0.12 0.01 280)` | Purple |
| welcome     | `oklch(0.11 0.03 80)`  | Gold   |

### 6.5 Spacing & Radius

| Token                | Value                                                   |
| -------------------- | ------------------------------------------------------- |
| `--radius`           | `0.625rem` (10px)                                       |
| Panel border-radius  | `rounded-2xl` (1rem)                                    |
| Button border-radius | `rounded-xl` (0.75rem) or `rounded-full`                |
| Bubble border-radius | `rounded-2xl` with one corner `rounded-br-none/bl-none` |
| Chip border-radius   | `rounded-full`                                          |
| Glass panel border   | `border border-white/[0.06]`                            |
| Glass panel bg       | `bg-white/[0.04]` or `bg-black/60`                      |

---

## 7. Shared UI Components (shadcn/ui)

Available in `apps/web/src/components/ui/`:

| Component     | Notes                                                    |
| ------------- | -------------------------------------------------------- |
| accordion     | Collapsible sections                                     |
| alert-dialog  | Confirmation dialogs                                     |
| avatar        | User avatars                                             |
| badge         | Status/label badges                                      |
| button        | Primary, secondary, outline, ghost, destructive variants |
| card          | Container with header/content/footer                     |
| checkbox      | Form checkbox                                            |
| collapsible   | Expandable sections                                      |
| command       | Command palette (cmdk)                                   |
| dialog        | Modal dialogs                                            |
| dropdown-menu | Context menus                                            |
| input         | Text input                                               |
| label         | Form labels                                              |
| popover       | Floating content                                         |
| progress      | Progress bars                                            |
| radio-group   | Radio buttons                                            |
| scroll-area   | Custom scrollbar wrapper                                 |
| select        | Dropdown select                                          |
| separator     | Horizontal/vertical dividers                             |
| sheet         | Side drawer (used for panels)                            |
| switch        | Toggle switch                                            |
| table         | Data tables                                              |
| tabs          | Tab navigation                                           |
| textarea      | Multi-line text input                                    |
| toggle        | Toggle button                                            |
| tooltip       | Hover tooltips                                           |

**Style:** new-york variant, CSS variable theming, lucide icons.

---

## 8. Interaction Patterns

### 8.1 Auto-scroll

Two patterns in use:

1. **Direct assignment:** `scrollRef.current.scrollTop = scrollRef.current.scrollHeight` (AssistantPanel, MissionControlPanel)
2. **scrollIntoView:** `messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })` (AiChatPanel)

Both trigger on message array changes via `useEffect`.

### 8.2 Status Indicators

| Indicator             | Implementation                                                           |
| --------------------- | ------------------------------------------------------------------------ |
| Connection dot (ping) | Two overlapping spans: `animate-ping` outer + solid inner                |
| Loading spinner       | `Loader2` from lucide with `animate-spin`                                |
| Active pulse          | `Activity` icon with `animate-pulse text-orange-500`                     |
| Status dot            | `h-1.5 w-1.5 rounded-full` with color (orange-500 active, zinc-600 idle) |
| WebSocket connected   | `Radio` icon with `animate-pulse text-emerald-500`                       |

### 8.3 Loading States

| Context          | Pattern                                                    |
| ---------------- | ---------------------------------------------------------- |
| Voice connecting | Loader2 spinner + "Kobler til..." text                     |
| Scraping data    | Skeleton shimmer (`animate-pulse rounded bg-white/[0.04]`) |
| AI thinking      | Bouncing dots or Loader2 + "Tenker..."                     |
| Dynamic import   | Placeholder div matching final dimensions                  |

### 8.4 Keyboard Shortcuts

| Shortcut    | Component                   | Action               |
| ----------- | --------------------------- | -------------------- |
| Escape      | MissionControlPanel         | Close panel          |
| Enter       | AiChatPanel, AssistantPanel | Send message         |
| Shift+Enter | AiChatPanel                 | New line in textarea |

---

## 9. Responsive & Accessibility

### 9.1 ARIA

- Voice toggle buttons use `aria-label` ("Sla av stemme" / "Sla pa stemme")
- Send buttons use `aria-label` ("Send melding")
- AmbientBackground uses `aria-hidden="true"`
- Disabled states set `disabled` attribute on buttons

### 9.2 Focus Management

- Input fields auto-focus not used (voice-first design)
- Tab navigation supported via native HTML button/input elements
- No custom focus trap implementations (panels use click-outside instead)

### 9.3 Responsive Sizing

- VoiceAssistant: Fixed 350x600px (dashboard), parent height (landing)
- MissionControlPanel: Fixed 480px width, `max-w-[90vw]` for mobile
- BigBoard: `grid-cols-1 md:grid-cols-2`
- VoiceDemoWidget: Configurable height, responsive padding `p-6 sm:p-10`
- Mic icons: `h-7 w-7 sm:h-10 sm:w-10` in landing

---

## 10. Performance Optimizations

### 10.1 Rendering

| Technique                        | Where                                                | Why                                                 |
| -------------------------------- | ---------------------------------------------------- | --------------------------------------------------- |
| `AnimatePresence`                | All voice/chat components                            | Clean mount/unmount animations without layout shift |
| `willChange: "transform"`        | AmbientBackground orbs                               | GPU-accelerated layer promotion                     |
| `contain: "layout style paint"`  | AmbientBackground root                               | Isolate layout/paint from rest of DOM               |
| `next/dynamic` with `ssr: false` | VoiceDemoWidget                                      | Avoid SSR of WebRTC APIs                            |
| `useCallback`                    | All voice hooks, tool implementations                | Stable references for effect deps                   |
| `useMemo`                        | Mission manifest lookup, ambient config, event dedup | Avoid recalculation                                 |
| `useRef` for actions             | useBotsson `actionsRef`                              | Avoid stale closures in Ultravox callbacks          |

### 10.2 State Management

| Pattern                                                           | Usage                                |
| ----------------------------------------------------------------- | ------------------------------------ |
| Ref guards (`isStartingRef`)                                      | Prevent double-start on rapid clicks |
| Session identity checks (`sessionRef.current === currentSession`) | Prevent stale event handlers         |
| Deduplication set in `useMemo`                                    | MissionControlPanel event merging    |

---

## 11. Recommended Patterns for WalkAi

### Reuse directly

| Component                  | Why                                                   |
| -------------------------- | ----------------------------------------------------- |
| TypewriterText             | Generic, no dependencies on Smartout context          |
| SectionReveal / RevealItem | Generic stagger animation wrapper                     |
| VoiceToolsContext pattern  | Clean context-based tool injection for voice sessions |
| Design tokens (tokens.css) | OKLCH color system, CSS variables                     |
| shadcn/ui components       | All available, well-tested                            |

### Extract and adapt

| Component                  | What to take                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| VoiceAssistant (dashboard) | Session lifecycle, watchdog pattern, chat-first architecture, PostHog integration pattern |
| useBotsson                 | Client tool registration pattern, ref-based action injection, debug log                   |
| BotssonAvatar              | Draggable floating pill pattern, 3-state machine, speech bubble                           |
| MissionControlPanel        | WebSocket real-time feed, whisper input, actor color system, light/dark mode              |
| AmbientBackground          | OKLCH orb system, noise overlay, section-based mood shifting, CSS drift animations        |
| BigBoard                   | Progressive reveal with skeleton shimmer, staggered panel + field entry                   |

### Pattern recommendations

| Need                | Recommended pattern                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------- |
| Voice session state | `UltravoxSession` in `useRef`, status via event listener, identity check on all callbacks    |
| Message bubbles     | `max-w-[85%] rounded-2xl px-4 py-2.5 text-sm`, one corner flat, user right-aligned           |
| Voice visualizer    | N bars with per-bar height/delay offsets, 3-state (speaking/idle/disconnected)               |
| Panel slide-in      | Fixed positioning, `translate-x-full`/`translate-x-0` transition, backdrop blur overlay      |
| Loading             | Skeleton shimmer for data, Loader2 spinner for actions, bouncing dots for typing             |
| Glass morphism      | `bg-black/60 border border-white/10 backdrop-blur-xl shadow-2xl`                             |
| Entry animations    | Framer Motion variants with ease `[0.16, 1, 0.3, 1]` (1.0s) or `[0.25, 0.1, 0.25, 1]` (0.4s) |
| Auto-scroll         | `useEffect` on messages array, `scrollTop = scrollHeight`                                    |
| Error messages      | Norwegian text via toast (`sonner`) + inline error state with retry                          |
| Telemetry           | PostHog `capture()` on every state transition and user action                                |
