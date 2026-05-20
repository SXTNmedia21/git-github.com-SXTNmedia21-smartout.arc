---
title: Timeline Templates — Static HTML Mockup Frames
status: draft
updated: 2026-05-16
created: 2026-05-16
module: web-day-control
tags: [design, mockup, timeline-template, d6]
---

# Timeline Templates — Mockup Frame Index

Three self-contained static HTML frames covering the core user-facing surfaces of the Timeline Templates feature. Each frame is production-faithful in visual language (Nordic Split CSS variables, Instrument Serif headings, Geist Mono for data, Lucide inline SVG icons) and is intended as a handoff artifact for T2/T5 implementers.

Spec reference: `docs/superpowers/specs/2026-05-16-timeline-templates-design.md`
Journey reference: `docs/journeys/JOURNEY-timeline-templates.md`

---

## frame-1-filter-and-dropdown.html

**Mode intent.** The manager arrives at Dagslinjen and immediately understands the three-zone top bar: time navigation on the left, scope filter in the centre, and the saved-timelines entry point on the right. The split-panel layout within the same frame lets a reviewer compare the dropdown's closed and open states without needing interaction. The location-scope inset at the bottom communicates the filter-matrix constraint (shifts only) so implementers know the warning must render inline, not as a toast.

**CSS variables used.** `--background`, `--foreground`, `--card`, `--popover`, `--popover-foreground`, `--muted`, `--muted-foreground`, `--border`, `--primary`, `--primary-foreground`, `--warning`, `--warning-foreground`. Light and dark themes are both rendered stacked vertically; the dark variant overrides all OKLCH values inside `.dark-theme`.

**Affordances.** The segmented scope pill carries `role="group"` + `aria-label`; each segment uses `aria-pressed`. The dropdown trigger declares `aria-haspopup="listbox"` + `aria-expanded`. Each template row in the open panel carries `role="option"` and a descriptive `aria-label`. The location warning notice uses `role="alert"` + `aria-live="polite"`.

**Edge cases shown.** (1) Scope pill in active state ("Team: Servitørteam Lørdag") includes an inline clear button — keyboard-accessible via Enter. (2) Three template rows with three distinct scope chip variants (team/dept/location) validate the colour-coding system. (3) Location-scope inset shows the warning notice inline in the top bar, which is the correct placement per Journey 5 — not a modal or toast.

---

## frame-2-slot-picker.html

**Mode intent.** The user clicked an empty 14:00 slot; the SlotPicker popover replaces SlotQuickAddPopover and presents 6 item kinds organised into three labelled lanes: Produksjon (D6 items: Hook, Oppgave, Notat, Avvik), Bemanning (D2: Vakt), and Fri tekst (free-form). The contextual mockup at the top shows the popover floating over the timeline strip to communicate spatial origin. The side-by-side variant comparison shows the normal state and the location-scope-disabled state without toggling.

**CSS variables used.** `--background`, `--foreground`, `--popover`, `--muted`, `--muted-foreground`, `--border`, `--input`, `--ring`, `--primary`, `--accent`, `--accent-foreground`, `--card`. Icon tints are bespoke OKLCH values (blue 250°, green 145°, amber 55°, red 25°, purple 310°) that sit within the Nordic Split warm-hue palette.

**Affordances.** The popover shell declares `role="dialog"` + `aria-modal="true"` + `aria-label`. Each lane has a `<div class="lane-label">` that serves as a visual section heading. Each item button has a descriptive `aria-label` (e.g. "Hook — koble til procedure eller routine"). Disabled buttons in the location-scope variant carry `aria-disabled="true"` + `tabindex="-1"` so they are skipped in keyboard navigation. The notice banner uses `role="note"`.

**Edge cases shown.** (1) Location-scope variant: all D6 and free-form buttons disabled, notice banner explains why, only Vakt enabled. (2) Icon tinting per lane to aid at-a-glance kind identification — matches the timeline event colour convention from Frame 1.

---

## frame-3-apply-dialog.html

**Mode intent.** The manager confirmed a template from the dropdown and now sees the ApplyTemplateDialog. The dialog makes two things immediately legible: (1) a structured list of what will be created — grouped by kind with item counts — so the manager can verify before committing; (2) a per-chip radio picker for free-form items that defers materialization type to apply time (task, note, or skip). The modal renders centred on a dimmed backdrop to reinforce its blocking nature. Footer makes the action count explicit in the confirm button.

**CSS variables used.** `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--muted`, `--muted-foreground`, `--border`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--ring`, `--warning`, `--warning-foreground`, `--success`. The free-form section header row uses a warm-amber tint (`oklch(0.97 0.012 60)` + border `oklch(0.82 0.08 65)`) to signal it requires action before confirming.

**Affordances.** Dialog root: `role="dialog"` + `aria-modal="true"` + `aria-labelledby="dialog-title"` + `aria-describedby="dialog-subtitle"`. Items list: `role="list"` with each row as `role="listitem"` + `aria-label` carrying the count. Each chip row: `role="group"` + `aria-labelledby` pointing to the chip's text label. Radio options: native `<input type="radio">` inside `<label>` — visually hidden but accessible to assistive technology. The confirm button's `aria-label` includes the element count for screen-reader clarity.

**Edge cases shown.** (1) Chip 1 defaults to Oppgave (pre-selected per spec § apply flow); Chip 2 pre-selected as Notat — demonstrating mixed-choice state. (2) The free-form section row in "Will be created" uses a distinct warm-amber background and italic sub-label to signal it is conditional on the choices below. (3) The primary button footer shows the total count (5) as a Geist Mono badge — stays accurate regardless of skip choices once wired to live state.
