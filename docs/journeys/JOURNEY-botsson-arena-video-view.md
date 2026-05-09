---
title: "Journey: Botsson Arena — Video View"
status: draft
created: 2026-05-09
updated: 2026-05-09
module: MODULE_BOTSSON
tags: [botsson, arena, video-view, journey, training]
---

# Journey: Botsson Arena — Video View

> **Current status: Video-view is a placeholder.** `BotssonArena.tsx` renders the string "Video"
> only. This journey documents the INTENDED flow for when the view is implemented.
> Reference: BOTSSON-SYSTEM-MAP.md §Component map (🟡 Form-view + Video-view er placeholders).

## Journey: Employee Watches a Training Video via Botsson Arena

**Precondition:**
- Employee is authenticated.
- BotssonShell is open, expanded to Arena mode.
- Video-view tab is selected.
- Training videos exist for the employee's workspace (via `knowledge_test` or video-content table — TBD).

**Steps (intended — not yet implemented):**

1. Employee opens BotssonArena → taps "Video" tab
   → System renders Video-view panel
   → Employee sees a list of available training videos for their role

2. Employee selects a video
   → System loads video metadata and stream URL
   → Video player renders inside the Arena panel
   → Playback begins (or employee taps play)

3. Employee watches the video
   → System tracks playback progress (percentage watched)
   → Progress is stored per-employee per-video

4. Employee completes the video (100% watched or explicit "Merk som fullført")
   → System records completion in training / protocol tracking table
   → System emits telemetry event: `training.video_completed`
   → Employee sees "Video fullført" confirmation

**Postcondition:**
- Video completion recorded in training system.
- Telemetry emitted.
- If the video is part of a protocol, protocol progress is updated.

**Error paths:**
- No videos available for workspace/role → empty state: "Ingen videoer tilgjengelig for din rolle."
- Video stream fails to load → error state with retry button. Emit `training.video_load_failed`.
- Completion tracking API fails → completion NOT recorded. Show warning: "Fullføring ble ikke lagret. Kontakt leder." Do not silently mark as complete.

## Implementation Notes

- Video-view is currently a placeholder string — full implementation is pending.
- Video content storage model (Supabase Storage vs external CDN vs Remotion-rendered) not yet decided.
- Requires a dedicated sub-sortie: `feat/botsson-arena-video-view`.
- Remotion (`packages/remotion`) is already in the stack — evaluate for dynamic video generation.
- No ADR exists yet for video content model; create ADR before building.
