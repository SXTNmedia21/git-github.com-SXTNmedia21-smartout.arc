---
title: "Mobile Component Ledger"
status: active
updated: 2026-04-18
created: 2026-04-18
module: ai
tags: [agent, mobile, components, design-system]
---

# Mobile Component Ledger

Registry of all reusable UI components in `apps/mobile/src/components/`.
Updated by the mobile-designer agent when new patterns are introduced.

## UI Primitives (`components/ui/`)

| Component   | File              | Variants                                          | Haptics          | A11y                             |
| ----------- | ----------------- | ------------------------------------------------- | ---------------- | -------------------------------- |
| Card        | `Card.tsx`        | default, noPadding, pressable                     | Light (on press) | role=button (when pressable)     |
| Button      | `Button.tsx`      | primary, secondary, ghost, destructive × sm/md/lg | Light (on press) | role=button, state=disabled/busy |
| Input       | `Input.tsx`       | default, with label, with error                   | —                | —                                |
| Badge       | `Badge.tsx`       | —                                                 | —                | —                                |
| BottomSheet | `BottomSheet.tsx` | —                                                 | —                | —                                |
| EmptyState  | `EmptyState.tsx`  | —                                                 | —                | —                                |

## Common Components (`components/common/`)

| Component     | File                | Purpose                                                        |
| ------------- | ------------------- | -------------------------------------------------------------- |
| Avatar        | `Avatar.tsx`        | Profile image with initials fallback                           |
| StatusBadge   | `StatusBadge.tsx`   | Profile status indicator (trainee/active/inactive/offboarding) |
| SectionHeader | `SectionHeader.tsx` | Section title with optional action button                      |
| SyncIndicator | `SyncIndicator.tsx` | Offline/syncing status display                                 |

## Shift Components (`components/shift/`)

| Component         | File                    | Purpose                                    |
| ----------------- | ----------------------- | ------------------------------------------ |
| ShiftCard         | `ShiftCard.tsx`         | Compact shift display                      |
| ShiftCardRich     | `ShiftCardRich.tsx`     | Detailed shift card with colleagues, tasks |
| PunchButton       | `PunchButton.tsx`       | Clock in/out action                        |
| HandoffForm       | `HandoffForm.tsx`       | End-of-shift handoff notes                 |
| HoursConfirmation | `HoursConfirmation.tsx` | Confirm worked hours                       |

## Home Views (`components/home/`)

| Component       | File                  | Shift Phase                          |
| --------------- | --------------------- | ------------------------------------ |
| NoShiftView     | `NoShiftView.tsx`     | `no_shift` — no upcoming shifts      |
| BeforeShiftView | `BeforeShiftView.tsx` | `before_shift` — shift approaching   |
| DuringShiftView | `DuringShiftView.tsx` | `during_shift` — currently working   |
| AfterShiftView  | `AfterShiftView.tsx`  | `after_shift` — shift ended, wrap-up |

## Task Components (`components/task/`)

| Component     | File                | Purpose                      |
| ------------- | ------------------- | ---------------------------- |
| TaskFeed      | `TaskFeed.tsx`      | Scrollable task list         |
| TaskModal     | `TaskModal.tsx`     | Task detail/completion modal |
| DeviationForm | `DeviationForm.tsx` | Report deviation             |
| HACCPForm     | `HACCPForm.tsx`     | HACCP check logging          |

## Chat Components (`components/chat/`)

| Component     | File                | Purpose                |
| ------------- | ------------------- | ---------------------- |
| ChannelRow    | `ChannelRow.tsx`    | Conversation list item |
| MessageBubble | `MessageBubble.tsx` | Chat message display   |
| MessageInput  | `MessageInput.tsx`  | Chat text input        |
| ReactionBar   | `ReactionBar.tsx`   | Message reactions      |

## AI Components (`components/ai/`)

| Component      | File                 | Purpose                   |
| -------------- | -------------------- | ------------------------- |
| BotssonSheet   | `BotssonSheet.tsx`   | AI assistant bottom sheet |
| BotssonMessage | `BotssonMessage.tsx` | AI message bubble         |

## Navigation (`components/navigation/`)

| Component    | File               | Purpose                      |
| ------------ | ------------------ | ---------------------------- |
| TabBar       | `TabBar.tsx`       | Bottom tab navigation        |
| QuickActions | `QuickActions.tsx` | Context-aware shortcuts      |
| AIFab        | `AIFab.tsx`        | Floating AI assistant button |

## Auth Components (`components/auth/`)

| Component       | File                  | Purpose                   |
| --------------- | --------------------- | ------------------------- |
| CodeEntry       | `CodeEntry.tsx`       | Workspace join code input |
| InviteEntry     | `InviteEntry.tsx`     | Invitation code input     |
| WorkspaceSearch | `WorkspaceSearch.tsx` | Search/browse workspaces  |
