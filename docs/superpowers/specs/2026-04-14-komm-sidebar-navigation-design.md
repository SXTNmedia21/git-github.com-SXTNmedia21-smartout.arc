---
title: Komm Sidebar Navigation & Page Redesign
status: approved
updated: 2026-04-14
created: 2026-04-14
module: communication
tags: [komm, ux, design, navigation, nordic-split]
---

# Komm Sidebar Navigation & Page Redesign

## Summary

Split the Komm module from a single page with SubTabs into 4 separate sidebar-navigated pages under "Kommunikasjon" in DashboardShell. Each page gets a focused, role-aware UX following Nordic Split.

## Navigation Structure

```
DashboardShell Sidebar
  Kommunikasjon (section header)
    # Kanaler        /dashboard/komm           Hash icon
    Chat             /dashboard/komm/chat       MessageCircle icon
    Nyheter          /dashboard/komm/nyheter    Newspaper icon
    Oversikt         /dashboard/komm/oversikt   BarChart3 icon
```

## Page 1: Kanaler (`/dashboard/komm`)

**Layout:** 2-panel. Left channel sidebar (w-72) + right message pane (flex-1).

**Left panel:**
- Header: "Kanaler" title + Plus button (create channel)
- Search input with Search icon
- Channel groups via shadcn Collapsible: Avdeling, Team, Sesjon, Egendefinert, Nyheter, Kompetanse
- Active channel: `bg-accent/50` + 2px left border `border-komm-accent`
- Unread badge: `bg-komm-accent` circle with count
- Live session channels: pulsing green dot

**Right panel:**
- ChannelHeader: hash + name + description + member count + [Users] [Phone] buttons
- MessageTimeline (existing, reused)
- MessageInput (existing, reused)
- MemberPanel as shadcn Sheet (side="right"), triggered by Users button

**Mobile:** Left panel becomes Sheet (side="left"). Top bar: [menu] #channel-name [members] [call].

## Page 2: Chat (`/dashboard/komm/chat`)

**Layout:** 2-panel. Left chat sidebar (w-72) + right message pane (flex-1).

**Left panel — two sections in one scrollable area:**
1. **Aktive samtaler** — existing DMs sorted by recency. Each: Avatar (32px) + name + last message preview + timestamp + unread dot.
2. **Alle personer** — full workspace member directory. Avatar + name + department + role. Searchable. Click = start/open DM (one tap, zero friction).

Sections separated by dashed Separator.

**Right panel:**
- ChatHeader: Avatar (40px) + name + role/department + [Phone] [Info] buttons
- MessageTimeline (reused)
- MessageInput (reused)
- Own messages right-aligned `bg-primary/10`, theirs left-aligned `bg-muted/50`

**Mobile:** Left panel is Sheet. Default view is conversation list. Back arrow returns from chat.

## Page 3: Nyheter (`/dashboard/komm/nyheter`)

**Layout:** Single column, centered. `max-w-2xl mx-auto`. No split panel.

**Header row:** "Nyheter" (font-heading) + Filter dropdown + "Ny kunngjoring" button (managers only).

**Card feed:**
- Each card: glassmorphism (`bg-card/80 backdrop-blur-sm border-border/30 rounded-xl p-5`)
- Author: Avatar + name + role + timestamp
- Title: `font-heading text-base` (Instrument Serif)
- Body: `text-sm leading-relaxed text-foreground/80`
- Attachments: icon + filename chips
- Footer: ReactionBar (emoji buttons) + ReadReceipt ("Sett av X av Y")
- Unread cards: left accent border `border-l-2 border-komm-accent`

**Compose:** Sheet (bottom on mobile, right on desktop). Title + body textarea + audience selector (Alle/per department/per team) + Publiser button.

**Mobile:** Already single-column. Compose button becomes FAB bottom-right.

## Page 4: Oversikt (`/dashboard/komm/oversikt`)

**Layout:** Single column, `max-w-5xl p-6 space-y-8`.

**Stat cards (grid-cols-4, grid-cols-2 on mobile):**
- Kanaler count, Samtaler i dag, Uleste meldinger, Ventende hjelp
- Number: `font-mono text-2xl font-semibold`. Label: `text-xs text-muted-foreground`
- Ventende hjelp card gets accent border when count > 0
- Role-based: employees see personal counts + "Neste vakt" card

**Hurtighandlinger (grid-cols-4):**
- Spor Botsson (Sparkles), Rapporter problem (AlertTriangle), Finn manual (BookOpen), Ring leder (Phone)
- Icon in `w-10 h-10 rounded-xl bg-komm-accent/10` + label

**Siste aktivitet:**
- Card with divide-y list of events
- Each: icon square + description + timestamp
- Types: Megaphone (announcement), ArrowRight (handoff), HelpCircle (help), Sparkles (AI), Phone (call)
- Managers see workspace-wide. Employees see department + mentions.
- Max 20 items + "Vis mer"

## Shared Patterns

**Spring animations:** `{ type: "spring", stiffness: 35, damping: 22, mass: 2.2 }` for structural, `{ stiffness: 45, damping: 24, mass: 2.0 }` for interactions.

**Glassmorphism:** `bg-background/80 backdrop-blur-xl border border-border/50` for panels.

**Typography:** Instrument Serif for page/card headings. Geist Sans for everything else. Geist Mono for stat numbers.

**Colors:** All `--color-komm-*` CSS variables. Zero hardcoded Tailwind colors.

**Components to reuse:** MessageTimeline, MessageBubble, MessageInput, ChannelItem, CreateChannel, CallRoom, IncomingCallOverlay.

**Components to create:** ChannelSidebar, ChatSidebar, ConversationItem, PersonItem, ChatHeader, NewsCard, ComposeAnnouncement, ReactionBar, ReadReceipt, StatCard, QuickActionCard, ActivityItem.

**Components to remove:** SubTabs (replaced by sidebar nav), KommShell (split into per-page clients).

## Files to Modify

- `apps/web/src/components/dashboard/DashboardShell.tsx` — add 3 NavItems under Kommunikasjon
- `apps/web/src/app/dashboard/komm/page.tsx` — Kanaler page (refactored)
- `apps/web/src/app/dashboard/komm/chat/page.tsx` — new
- `apps/web/src/app/dashboard/komm/nyheter/page.tsx` — new
- `apps/web/src/app/dashboard/komm/oversikt/page.tsx` — new
- `apps/web/src/app/dashboard/komm/_components/` — new + refactored components
