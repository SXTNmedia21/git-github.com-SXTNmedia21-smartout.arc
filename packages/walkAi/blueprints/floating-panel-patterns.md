---
title: "Floating Panel Patterns & Architecture"
status: draft
updated: 2026-03-10
module: walkAi
tags: [blueprint, floating, drag, resize, panel]
---

# Floating Panel Patterns & Architecture

Reference for building the WalkAi floating multi-purpose panel.

---

## 1. Panel Modes

WalkAi must support these visual modes, all in the same component:

| Mode           | Size                    | Position                     | Use Case                                 |
| -------------- | ----------------------- | ---------------------------- | ---------------------------------------- |
| **Minimized**  | 56x56px avatar pill     | Fixed corner, draggable      | Passive — agent available but not active |
| **Compact**    | 320x400px floating card | Draggable anywhere           | Chat, quick notes, task list             |
| **Expanded**   | 480x600px panel         | Draggable, resizable         | Full conversation, video, detailed tasks |
| **Docked**     | 480px x full-height     | Snapped to edge (right/left) | Side panel — persistent workspace        |
| **Fullscreen** | 100vw x 100vh           | Fixed inset-0                | Voice session, video playback, immersive |

---

## 2. Content Tabs

The panel can show different content types via tabs:

| Tab       | Content                                   | Components to Reuse                     |
| --------- | ----------------------------------------- | --------------------------------------- |
| **Chat**  | Agent conversation with message bubbles   | VoiceAssistant, AssistantPanel patterns |
| **Voice** | Voice visualizer, mic controls, subtitles | VoiceSessionOverlay, BotssonAvatar      |
| **Notes** | Rich text notepad for user                | Tiptap from document-mode               |
| **Tasks** | Checklist / todo from mission stages      | New component                           |
| **Video** | Video playback (Remotion or native)       | New component                           |

---

## 3. Drag Implementation

Based on existing patterns (BotssonAvatar, SwipeReconciliation, grid-cards):

```typescript
// Core drag setup with framer-motion
<motion.div
  drag
  dragMomentum={false}
  dragElastic={0.1}
  dragConstraints={{
    top: 0,
    left: 0,
    right: window.innerWidth - panelWidth,
    bottom: window.innerHeight - panelHeight,
  }}
  onDragEnd={(_, info) => {
    // Snap to edge if within 50px
    const snapThreshold = 50;
    if (info.point.x < snapThreshold) dockTo("left");
    else if (info.point.x > window.innerWidth - snapThreshold) dockTo("right");
  }}
  className="fixed z-[65] cursor-grab active:cursor-grabbing"
  style={{ x, y }}
>
```

---

## 4. Resize Implementation

Based on grid-cards.tsx pointer event pattern:

```typescript
const handleResizeStart = (
  edge: "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw",
  e: React.PointerEvent,
) => {
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;
  const startW = panelWidth;
  const startH = panelHeight;

  const onMove = (ev: PointerEvent) => {
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    // Calculate new dimensions based on edge
    // Constrain to min/max (320x400 to 800x900)
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener(
    "pointerup",
    () => {
      window.removeEventListener("pointermove", onMove);
    },
    { once: true },
  );
};
```

---

## 5. Mode Transitions

All transitions use framer-motion AnimatePresence:

| From -> To           | Animation                          | Duration |
| -------------------- | ---------------------------------- | -------- |
| Minimized -> Compact | Scale 0.5->1 + fade                | 300ms    |
| Compact -> Expanded  | Width/height expand + fade content | 250ms    |
| Expanded -> Docked   | Slide to edge + height stretch     | 300ms    |
| Any -> Fullscreen    | Scale to viewport + backdrop blur  | 400ms    |
| Any -> Minimized     | Scale 1->0.5 + slide to corner     | 300ms    |

```typescript
const modeVariants = {
  minimized: { width: 56, height: 56, borderRadius: 28 },
  compact: { width: 320, height: 400, borderRadius: 16 },
  expanded: { width: 480, height: 600, borderRadius: 16 },
  docked: {
    width: 480,
    height: "100vh",
    borderRadius: 0,
    x: dockedSide === "right" ? "calc(100vw - 480px)" : 0,
    y: 0,
  },
  fullscreen: {
    width: "100vw",
    height: "100vh",
    borderRadius: 0,
    x: 0,
    y: 0,
  },
};
```

---

## 6. Z-Index Strategy

```typescript
export const WALKAI_LAYERS = {
  backdrop: 55, // Semi-transparent overlay (docked/fullscreen)
  panel: 65, // Main floating panel
  dragPreview: 80, // Panel preview during drag
  dockTargets: 75, // Edge dock indicators
  controls: 70, // Floating action buttons
} as const;
```

---

## 7. Keyboard Shortcuts

| Shortcut             | Action                     |
| -------------------- | -------------------------- |
| Escape               | Minimize panel             |
| Cmd/Ctrl + .         | Toggle panel visibility    |
| Cmd/Ctrl + Shift + F | Toggle fullscreen          |
| Tab                  | Cycle between content tabs |

---

## 8. Responsive Behavior

| Viewport            | Default Mode                 | Constraints                       |
| ------------------- | ---------------------------- | --------------------------------- |
| Desktop (>1024px)   | Compact, free drag           | All modes available               |
| Tablet (768-1024px) | Compact or docked            | No expanded, fullscreen available |
| Mobile (<768px)     | Minimized or fullscreen only | No floating, no docking           |

---

## 9. State Management

```typescript
type WalkAiPanelState = {
  mode: "minimized" | "compact" | "expanded" | "docked" | "fullscreen";
  activeTab: "chat" | "voice" | "notes" | "tasks" | "video";
  position: { x: number; y: number };
  size: { width: number; height: number };
  dockedSide: "left" | "right" | null;
  isVisible: boolean;
  isDragging: boolean;
};
```

---

## 10. Component Architecture

```
<WalkAiPortal>                    <- createPortal to document.body
  <WalkAiBackdrop />              <- Only in docked/fullscreen mode
  <motion.div layout>             <- Main container with mode variants
    <WalkAiDragHandle />          <- Top bar, visible in compact/expanded
    <WalkAiHeader />              <- Title, tabs, mode controls (min/max/close)
    <WalkAiContent>               <- Tab content area
      <ChatView />                <- Message bubbles, input
      <VoiceView />               <- Visualizer, mic, subtitles
      <NotesView />               <- Rich text editor
      <TasksView />               <- Checklist from stages
      <VideoView />               <- Video player
    </WalkAiContent>
    <WalkAiResizeHandles />       <- 8 edge/corner handles (compact/expanded only)
  </motion.div>
</WalkAiPortal>
```

---

## 11. Libraries to Use

Already installed:

- `framer-motion` -- drag, layout animations, AnimatePresence
- `@dnd-kit/core` -- advanced drag with DragOverlay if needed
- `@radix-ui/react-popover` -- anchored floating (minimized mode)
- `@radix-ui/react-dialog` -- portal rendering

May need:

- None -- existing libraries cover all needs

---

## 12. Existing Code to Extract

Priority order for building WalkAi panel:

1. **BotssonAvatar** -- Minimized mode template (drag, visualizer, status)
2. **VoiceAssistant (web)** -- Chat view template (bubbles, transcript, controls)
3. **MissionControlPanel** -- Docked mode template (sidebar, tabs, events)
4. **VoiceSessionOverlay** -- Fullscreen mode template (overlay, large visualizer)
5. **AiChatPanel** -- Chat input pattern (textarea, quick actions, auto-scroll)
6. **AgentCard** -- Tab system and debug views
7. **schedule-layers.ts** -- Z-index constants pattern
8. **grid-cards.tsx** -- Resize handle implementation
