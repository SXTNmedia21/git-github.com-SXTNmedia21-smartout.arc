---
title: Helpdesk Phase 1 UI Specification
status: draft
module: helpdesk
created: 2026-04-20
updated: 2026-04-20
tags: [ui, phase-1, adr-0161, adr-0133, helpdesk, komm]
---

# Helpdesk Phase 1 UI Specification

> Ground truth for implementation. Every decision locked. No open questions left for the implementation agent.

**Backend:** shipped at `70103fc0`. `helpdesk_query` capability exposes `open_ticket`, `list_my_queue`, `get_ticket`, `resolve_ticket`.
**Data model:** ADR-0161. Desk = `channel_type='desk'` + `responsible_profile_id`. Ticket = `engine_state` (`process_id='helpdesk_query_lifecycle'`). Thread = `channel_type='query_thread'`.
**Verb boundary:** ADR-0133. Web authors. Mobile executes.
**Design system:** Nordic Split. OKLCH warm, hue 40-60. Spring physics. 40% reduction. Glassmorphism with noise. Lucide only. Geist + Instrument Serif.

---

## Named Patterns Introduced by This Spec

Documented here; referenced throughout.

| Pattern name | Definition |
|---|---|
| **Lighthouse avatar** | Avatar ringed by a soft radial-gradient orb. Denotes "this person is responsible." Orb uses base hue 50 chroma 0.06 radius 28px, feathered via 60% stop at 65% radius. Pulsing disabled by default; only on `waiting` tickets with pulse duration 2.4s max. |
| **Responsibility orb** | Pure presentation form of the lighthouse halo without an avatar inside. Used when a ticket status itself needs orb treatment (status badge, FAB). |
| **Darkening orb (SLA)** | A responsibility orb whose hue shifts from hue 50 (warm neutral) toward hue 40 (brand orange) as an SLA clock approaches breach. Phase 1: static at hue 50, chroma 0.06 (no SLA yet). Phase 2: hue lerps hue50→hue40, chroma 0.06→0.18. Never red. Never a ticking counter. |
| **Orphan desk badge** | Dashed 1px border at `border-dashed border-border/60` + muted foreground text + `AlertCircle` icon. Used when desk has no `responsible_profile_id`. |
| **Ghost ticket row** | Dashed-border placeholder in a queue when a ticket is locally optimistic (mobile offline enqueue). Same visual language as the AI-suggested ghost card in join wizard. |
| **Desk rail** | Left-hand vertical list of desks on `/dashboard/komm/desks`. Not a sidebar — a list with generous whitespace, never a framed panel. |

---

# Spec 1 — Desks Admin Page (web only)

**Route:** `/dashboard/komm/desks`
**Gate:** workspace-company-admin only. Non-admins redirected to `/dashboard/komm` with toast `toast.helpdesk.desks.forbidden`.
**Files (new):**
- `apps/web/src/app/dashboard/komm/desks/page.tsx` — Server Component, fetches desks + responsible profiles + open-ticket counts.
- `apps/web/src/app/dashboard/komm/desks/_components/DesksClient.tsx` — Client shell with AnimatePresence, optimistic CRUD.
- `apps/web/src/app/dashboard/komm/desks/_components/DeskCard.tsx`
- `apps/web/src/app/dashboard/komm/desks/_components/CreateDeskDialog.tsx`
- `apps/web/src/app/dashboard/komm/desks/_components/ResponsibleRepCombobox.tsx`
- `apps/web/src/app/dashboard/komm/desks/_actions/desk-actions.ts` — Server Actions: `createDesk`, `updateDeskResponsible`, `archiveDesk`.

## 1.1 Information Architecture

Single-pane list with an inline create affordance at the top. No tabs. No secondary nav.

```
┌──────────────────────────────────────────────────────────────┐
│  Helpdesk · Skranker                          [ Ny skranke ] │   ← h-16 page header
│  Skranker binder ansatte til den som svarer.                 │   ← lede, muted-foreground
├──────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐    │
│  │  [Lighthouse avatar]   HR                      3 nye │    │   ← DeskCard
│  │                        Linn Andersen                  │    │
│  │                        Sist aktiv 14 min siden       │    │
│  └──────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  [AlertCircle]         Lønn                    0 nye │    │   ← Orphan DeskCard
│  │                        Ingen ansvarlig                │    │
│  │                        [ Tildel ansvarlig ]           │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

**Page container:** `max-w-[880px] mx-auto px-8 pt-12 pb-24`. No cards around the page. No frame. Desks list breathes.

**Header typography:**
- Title: `font-heading text-[44px] leading-[1.05] tracking-[-0.02em] text-foreground` ("Helpdesk · Skranker")
- Subtitle: `text-sm text-muted-foreground mt-2 max-w-[520px]`
- Action: shadcn `Button variant="default"` with `Plus` icon, top-right.

No tabs. No list/grid toggle. No filters. Max ~20 desks in Phase 1; scan by scrolling. If >10 desks, consider a search field in Phase 2 — not now.

## 1.2 Create-Desk Form (CreateDeskDialog)

Triggered by `[ Ny skranke ]`. shadcn `Dialog` (new-york).

**Fields:**

| Field | Control | Validation | Zod |
|---|---|---|---|
| `name` | `Input` autofocus | 2–40 chars, required, unique within workspace | `z.string().min(2).max(40).regex(/^[^<>]+$/)` |
| `description` | `Textarea` (optional) | ≤140 chars | `z.string().max(140).optional()` |
| `responsible_profile_id` | `ResponsibleRepCombobox` (see 1.3) | required | `z.string().uuid()` |

No "slug", no "code", no "icon picker". Keep it brutal.

**Submit:** Server Action `createDesk`. On success: close dialog (exit spring below), prepend the new `DeskCard` to the list with entrance animation, toast `toast.helpdesk.desks.created` with the desk name.

**Validation errors:** inline below each field with `text-xs text-destructive mt-1`. Button disables while pending. Button label transitions `"Opprett skranke"` → `"Oppretter…"` (no spinner; the text change is the state).

**Dialog shell (glass):**
```tsx
<DialogContent
  className="max-w-[480px] bg-background/80 backdrop-blur-xl border border-border/60
             shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_24px_60px_-20px_rgba(0,0,0,0.45)]
             p-0 overflow-hidden">
  {/* 1px gradient top-edge */}
  <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
  {/* noise overlay: .noise-overlay class, opacity 0.03 */}
  <div className="p-8">
    ...
  </div>
</DialogContent>
```

**Noise overlay class** (add to `globals.css` if missing):
```css
.noise-overlay::after {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background-image: url("/textures/noise-128.png");
  opacity: 0.03; mix-blend-mode: overlay;
}
```

## 1.3 ResponsibleRepCombobox pattern

A shadcn `Command` inside `Popover`. Triggered by a button that itself uses the **Lighthouse avatar** pattern:

- Empty state: `[ Circle dashed ring ]  Velg ansvarlig` — the dashed ring IS the orphan affordance repeating itself at component level.
- Selected state: `[ Lighthouse avatar, 32px ]  Linn Andersen` — avatar with orb halo.

**Search behavior:**
- Autofocus input on open.
- Query: only `active` profiles in the current workspace with `role IN ('manager', 'admin', 'owner')`. No employees — enforce in the Server Action too (don't trust the client).
- Each row: 40px, avatar 28px, name, role (muted).
- Keyboard: `ArrowUp/ArrowDown` navigates, `Enter` selects, `Esc` closes.

## 1.4 DeskCard anatomy

**Dimensions:** `min-h-[104px]` desktop. Full width of container. Radius `rounded-2xl` (`var(--radius-2xl)`).

**Structure (at rest, assigned):**
```
┌─ card, p-6, border border-border/40, bg-card ────────────────┐
│                                                               │
│  [Lighthouse avatar 56px]   HR                    [3 nye]    │
│                             Linn Andersen                     │
│                             Sist aktiv 14 min siden           │
│                                                               │
│  · 3 åpne saker                                · Åpne kø →    │
└───────────────────────────────────────────────────────────────┘
```

**Rest-state tokens:**
- Background: `bg-card` (CSS var `--color-card`)
- Border: `border border-border/40`
- Shadow: none. Depth comes from border + gradient top-edge only.
- Title: `font-heading text-2xl text-foreground` (desk name)
- Responsible name: `text-sm text-foreground mt-1`
- Last-active: `text-xs text-muted-foreground mt-0.5`
- Count badge (top-right): `[ 3 nye ]` — `Badge variant="outline"` with warm fill `bg-muted/50 text-foreground font-mono text-[11px] px-2 py-0.5 rounded-full`. Only shown when `open_count > 0`. Never shown in red, even on breach (Phase 2 uses hue shift only).

**Hover:** `border-border/40 → border-border/80`; 200ms tween. No lift, no scale. Resist the urge.
**Focus:** `ring-2 ring-ring ring-offset-2 ring-offset-background` on card when container has `:focus-visible`.

**Click target:** entire card. Primary action = "open queue preview". Secondary action "Endre ansvarlig" is a `DropdownMenu` triggered by `MoreHorizontal` icon top-right (only visible on hover/focus for admin, always visible on touch).

**Orphan state (no responsible_profile_id):**
```
┌─ card, border-dashed border-border/60, bg-card/60 ───────────┐
│                                                               │
│  [AlertCircle 40px muted-foreground]   Lønn          [— nye] │
│                                        Ingen ansvarlig       │
│                                        [ Tildel ansvarlig ]  │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

- Border changes to `border-dashed border-border/60`. No drop shadow.
- Title opacity `text-foreground/70`.
- Icon: `AlertCircle` at 40px, `text-muted-foreground`. NOT red. Never red.
- Button `[ Tildel ansvarlig ]`: `Button variant="outline" size="sm"`, opens `ResponsibleRepCombobox` inline (no dialog for this path — fewer clicks).

**Why no red?** The Council was explicit. Orphan is warm concern, not alarm. A desk without an owner is a quiet lapse — the dashed border communicates that without triggering cortisol.

## 1.5 Queue preview per desk

Phase 1 shows a single line: `· 3 åpne saker`. No expansion, no inline queue. Clicking the card navigates to `/dashboard/komm/desks/[deskChannelId]/queue` — but that route is **out of Phase 1 scope**. The click instead opens a `Sheet` from the right with the queue preview.

`QueueSheet` contents:
- Header: `[Lighthouse avatar 40px]  HR`
- Subheader: `Linn Andersen · 3 åpne saker`
- List: up to 10 most recent open tickets (from `list_my_queue`, scoped to this desk's tickets where `context->>'desk_channel_id' = desk.id`). Each row: requester avatar 28px, summary truncated, relative time (e.g. `14 min`).
- Row click → navigates to `/dashboard/komm/[channelId]` where channelId is the thread.
- Footer: `[ Vis alle i Kanaler → ]` linking to the desk's channel filter view (backlog for Phase 2).

Sheet motion: spring `{ type: 'spring', stiffness: 32, damping: 22, mass: 2.2 }`, direction right-to-left, 420px wide, `bg-background/85 backdrop-blur-xl`.

## 1.6 Empty state (no desks)

The workspace has never had a desk. Server Component detects this, renders:

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│       [Large warm orb, 240px, hue 50 chroma 0.06]            │
│                                                              │
│       Ingen skranker ennå                                    │
│       En skranke er en dør til en ansvarlig kollega.         │
│       Opprett en når dere vet hvem som svarer på hva.        │
│                                                              │
│                      [ Opprett første skranke ]              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

- Heading: `font-heading text-[32px] text-foreground`
- Body: `text-muted-foreground text-base max-w-[440px] mx-auto`
- Orb: pure CSS radial-gradient positioned behind heading, `opacity-40 blur-[0.5px]`. Not a Lucide icon. Not an illustration.

Copy must be exactly as above — no lorem, no placeholder English.

## 1.7 Motion Choreography

**List enter (initial page load):**
```ts
const list = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};
const card = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0,
    transition: { type: 'spring', stiffness: 38, damping: 22, mass: 2.2 } },
};
```

**Create-desk dialog:**
- Backdrop: `opacity 0 → 1`, duration 260ms, ease-out.
- Panel: `opacity 0, scale 0.97, y 8 → opacity 1, scale 1, y 0`, spring `{ stiffness: 34, damping: 22, mass: 2.3 }`.
- Exit: reverse, minimum 250ms.

**New desk inserted optimistically:**
- New card: `opacity: 0, scale: 0.98, y: -8` → `1, 1, 0`, spring same as list cards. The neighbor below shifts via `layout` prop.

**Archive desk (Phase 1 = hide, soft-delete):**
- Card exits: `opacity: 1, x: 0 → opacity: 0, x: 24, filter: 'blur(2px)'`, duration 320ms, ease-in.

**Orphan → Assigned transition:**
- Dashed border → solid border: CSS transition on `border-style` + `border-color`, 400ms ease.
- `AlertCircle` icon exits upward (y: -8, opacity 0) while `LighthouseAvatar` enters downward (y: 8 → 0, opacity 0 → 1). Both tweens 380ms.

Max 3 pulsing elements per viewport rule: DeskCards never pulse. Only the orphan-state `AlertCircle` has a subtle breathing opacity `0.8 ↔ 1.0` at 2.8s cycle, and only when count of orphan desks ≤ 2. If ≥ 3 orphans, none pulse (over-pulse fatigue).

## 1.8 Token Map (Spec 1)

| Property | Value |
|---|---|
| Page background | `bg-background` |
| Card background | `bg-card` (solid) |
| Card border rest | `border border-border/40` |
| Card border hover | `border-border/80` |
| Card border orphan | `border-dashed border-border/60` |
| Card radius | `rounded-2xl` (→ `--radius-2xl`) |
| Card padding | `p-6` |
| Dialog background | `bg-background/80 backdrop-blur-xl` |
| Dialog border | `border border-border/60` |
| Dialog top-edge | `bg-gradient-to-r from-transparent via-border to-transparent` |
| Primary text | `text-foreground` |
| Secondary text | `text-muted-foreground` |
| Count badge bg | `bg-muted/50` |
| Count badge text | `text-foreground font-mono text-[11px]` |
| Focus ring | `ring-2 ring-ring ring-offset-2 ring-offset-background` |
| Orb base (lighthouse) | `radial-gradient(circle at 50% 50%, oklch(from var(--color-muted) l c 50) 0%, transparent 70%)` |

No raw hex. No raw rgba. If a value appears that is not in this table, reject it in review.

## 1.9 Accessibility

- Page role: implicit `main`. Heading structure: single `<h1>` ("Helpdesk · Skranker"), desk names as `<h2>` within cards.
- `DeskCard`: wrapped in `<button>` or `<a>` — not a div with `onClick`. Accessible name = desk name + " · " + responsible name + " · " + open count sentence. Example: `aria-label="HR, ansvarlig Linn Andersen, 3 åpne saker. Åpne kø."`.
- Orphan card: `aria-label="Lønn, ingen ansvarlig. Tildel ansvarlig for å åpne skranken."`.
- `CreateDeskDialog`: shadcn Dialog already provides `aria-modal`, trap focus. First focus = name input.
- `ResponsibleRepCombobox`: shadcn Command already `role=listbox`; ensure `aria-label` on trigger.
- `Toast` messages via Sonner, live region `assertive` for errors, `polite` for success. Use `sonner.Toaster` already mounted in DashboardShell.
- Keyboard nav:
  - `Tab` cycles: create button → desk card 1 → desk card 2 → ... → footer (if any).
  - Inside card: `Enter` opens queue sheet. `Space` does same. Shift+Tab moves back.
  - Card's three-dot menu: reachable via `Tab` after the primary click target OR via `Shift+F10` (platform convention).
- Screen reader announcement when desk is created: `aria-live="polite"`: "Skranken HR ble opprettet."
- Focus on returning from dialog: restore to the `Ny skranke` button.
- Contrast: all text must pass AA against `bg-card`. `text-muted-foreground` is the lowest-contrast class allowed; never `opacity-50` on foreground text.

---

# Spec 2 — Ticket Conversation Surface (web)

**Route:** existing `/dashboard/komm/[channelId]`.
**Behavior fork:** when the resolved channel row has `channel_type = 'query_thread'`, render `TicketConversationView` instead of the default `ChannelConversation`.

**Files (new/changed):**
- `apps/web/src/app/dashboard/komm/[channelId]/_components/TicketConversationView.tsx` (new)
- `apps/web/src/app/dashboard/komm/[channelId]/page.tsx` (change: branch on `channel_type`)
- `apps/web/src/app/dashboard/komm/[channelId]/_components/TicketHeader.tsx` (new)
- `apps/web/src/app/dashboard/komm/[channelId]/_components/ResolveTicketDialog.tsx` (new)
- `apps/web/src/app/dashboard/komm/[channelId]/_actions/resolve-ticket.ts` (new — wraps `resolve_ticket` capability tool)

**Reuse from existing Komm:**
- Message list: whatever component the current `/dashboard/komm/[channelId]` uses for `channel_message` rendering (do not duplicate). The ticket view wraps it unchanged.
- Composer: same as Komm — do not fork the message composer. It already emits to `channel_message`; that's all we need.

## 2.1 Header anatomy

The Komm header is replaced (not augmented) when `channel_type='query_thread'`. Renders `TicketHeader`:

```
┌─ header, h-20, border-b border-border/40, px-6 flex items-center ─┐
│                                                                     │
│  [ChevronLeft]  [Status orb]  Kan jeg jobbe i romjula?              │
│                 Venter        Linn → Kari                           │
│                                                                     │
│                                   [ Reassign ▾ ]   [ Løs sak ]     │
└─────────────────────────────────────────────────────────────────────┘
```

**Left cluster:**
- `ChevronLeft` icon-button, `aria-label="Tilbake til kanaler"`, 40px touch target, routes to `/dashboard/komm`.
- **Status orb** (48px): Responsibility orb styled per ticket status.
  - `waiting`: hue 50, chroma 0.06. Subtle breathing pulse (2.8s). This is one of the max 3 pulses on the viewport.
  - `active`: hue 50, chroma 0.10. No pulse.
  - `complete`: hue 50, chroma 0.04, plus `Check` icon overlaid at 24px centered. No pulse.
  - NEVER red. NEVER ticking. Phase 1 has no SLA — the orb looks the same whether a ticket is 2 minutes old or 2 days old.
- Title area:
  - Status label: `text-[11px] font-mono uppercase tracking-[0.08em] text-muted-foreground` — `Venter` | `Aktiv` | `Løst`.
  - Summary: `font-heading text-2xl text-foreground leading-tight` — one line, truncated at ~58 chars.
  - Participant line: `text-sm text-muted-foreground mt-1` — `[Requester avatar 20px] Linn → [Assignee avatar 20px] Kari`. If requester === assignee (self-opened), show just assignee avatar and `Linn (selv)`.

**Right cluster:**
- `Reassign ▾`: shadcn `DropdownMenu`. Phase 1 — **owner-only**. For the assignee themselves this button is absent. For workspace admin:
  - Dropdown options: list of workspace managers/admins/owners, selectable. Selecting calls a Server Action that updates `engine_state.assignee_id` and emits `helpdesk.query.reassigned` (new event — backend contract requires an extension; if not shipped, hide this button entirely in Phase 1 and document as Phase 2).
  - Label uses current assignee avatar + name.
- `Løs sak`: shadcn `Button variant="default"`. Click → opens `ResolveTicketDialog`. Disabled + visually muted when status === 'complete'. When status === 'complete', this slot shows a `Badge` instead: `[✓ Løst 14:23]`.

**Header background:** `bg-background/70 backdrop-blur-md` with bottom 1px gradient border. No heavy shadow.

## 2.2 Message list (reuse)

Render the workspace's existing Komm message list component unchanged. Pass it the same `channelId` prop. No ticket-specific styling on messages — a thread is a thread.

Phase 1 does NOT add system-message pills like `Opprettet av Botsson`. The Komm `channel_message` table already records sender; that's enough. Phase 2 may add a first-message adornment.

## 2.3 Empty conversation state

A freshly-opened ticket from voice/chat may have zero messages in the `channel_message` table (the "summary" lives in `engine_state.context`). Empty-conversation render:

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│             [Warm orb 160px, hue 50 chroma 0.05]             │
│                                                              │
│             Linn åpnet denne saken nettopp.                  │
│             Ingen meldinger ennå.                            │
│             Skriv et svar for å komme i gang.                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

- Centered, above the composer.
- No Lucide icon. The orb is the focal element.
- Do not show the ticket summary a second time here — the header already has it.

## 2.4 Resolve flow

**Step 1 — click `Løs sak`:** opens `ResolveTicketDialog`.

```
┌─ Dialog, 440px, glass shell as Spec 1.2 ──────────────────┐
│                                                            │
│  Løs saken                                                │
│  Kari — dette lukker saken for Linn.                      │
│                                                            │
│  Hva var løsningen? (valgfritt)                           │
│  ┌──────────────────────────────────────────────────┐    │
│  │ f.eks. «Avklart — gjelder ikke romjul 24.–26.»   │    │
│  │                                                   │    │
│  └──────────────────────────────────────────────────┘    │
│                                                            │
│                        [ Avbryt ]  [ Løs sak ]            │
└────────────────────────────────────────────────────────────┘
```

- Title: `font-heading text-2xl`
- Sub-lede: `text-sm text-muted-foreground`, pulls requester name from ticket context.
- `Textarea`: shadcn, 4 rows, max 280 chars, optional. Placeholder in Norwegian only.
- Primary action: `Løs sak`. Calls `resolve_ticket({ ticket_id, resolution_note })` via Server Action → capability router.
- Secondary: `Avbryt`. Closes dialog; focus returns to `Løs sak` button.

**Step 2 — submit:**
- Button text → `Løser…`. Disabled.
- Server Action response < 500ms in happy path → close dialog.
- Close animation (dialog exit) runs 260ms.
- Header status orb transitions:
  - `waiting`/`active` → `complete`.
  - Chroma tween: `0.06` → `0.04` over 600ms.
  - Pulse: fades out over 400ms if pulsing.
  - `Check` icon: `opacity: 0, scale: 0.6` → `1, 1`, spring `{ stiffness: 40, damping: 18, mass: 2.0 }`, delayed 200ms after chroma starts.
- Status label swaps `AKTIV` → `LØST` via crossfade 280ms.
- `Løs sak` button swaps to `[✓ Løst 14:23]` badge via shared `layoutId="ticket-resolve-slot"`.
- Toast `toast.helpdesk.ticket.resolved`: `"Saken er løst. Linn får beskjed."`

**Step 3 — on resolved ticket view:**
- Composer is still enabled. A resolved ticket is a closed loop, but messages can still flow for follow-up. If product decides Phase 1 composer must lock on resolve, disable it: `Textarea disabled` + `placeholder="Saken er løst. Åpne på nytt for å skrive."`. **Recommendation for Phase 1: keep composer enabled**; reopening is not in scope and locking creates dead-end UX.

## 2.5 Motion Choreography

- Header enter (page mount): `opacity 0 → 1` over 320ms, no Y-translate (the page below renders immediately).
- Status orb: renders at final state on mount; state-change transitions described in 2.4.
- Resolve dialog: same spring config as Spec 1.2.
- Shared `layoutId`: `ticket-resolve-slot` so the button-to-badge transition feels like one object morphing.

## 2.6 Token Map (Spec 2)

| Property | Value |
|---|---|
| Header bg | `bg-background/70 backdrop-blur-md` |
| Header border bottom | `border-b border-border/40` |
| Status label | `text-[11px] font-mono uppercase tracking-[0.08em] text-muted-foreground` |
| Summary title | `font-heading text-2xl text-foreground leading-tight` |
| Status orb base | `radial-gradient(circle at 50% 50%, oklch(from var(--color-muted) calc(l * 1.1) 0.06 50) 0%, transparent 68%)` |
| Status orb active | chroma token `oklch(... 0.10 50)` |
| Status orb complete | chroma `oklch(... 0.04 50)` plus check icon `text-foreground/80` |
| Resolved badge | `bg-muted/50 text-foreground font-mono text-[11px] px-2 py-0.5 rounded-full` |
| Participant avatars | `h-5 w-5` (20px) ring-1 `ring-border/40` |
| Dialog tokens | identical to Spec 1.2 |

## 2.7 Accessibility

- `role="region"` on header with `aria-label="Saksinformasjon"`.
- Status orb is decorative (`aria-hidden="true"`). The status label text is the accessible name.
- `ChevronLeft` back button: `aria-label="Tilbake til kanaler"`.
- `Løs sak` button: `aria-label="Løs saken: {summary}"`.
- Resolve dialog: first focus on Textarea. `Esc` closes.
- Live region announces status transition: "Saken er løst."
- Composer reuse inherits existing Komm a11y; no changes.
- Reduced motion (`prefers-reduced-motion: reduce`):
  - Orb pulse disabled.
  - Chroma tweens → instant swaps.
  - Dialog: fade only, no scale.
  - Status transitions: 150ms fades, no springs.

---

# Spec 3 — Mobile Queue + Ticket View

**Platform:** `apps/mobile/` (Expo).
**Verbs allowed (ADR-0133):** read queue, read ticket, reply (send message), resolve own assigned ticket.
**Verbs forbidden:** create desk, assign/reassign, edit desk settings, list all tickets across desks.

**Files (new):**
- `apps/mobile/app/(tabs)/queue.tsx` — queue tab screen
- `apps/mobile/app/ticket/[id].tsx` — ticket detail screen (stack child of queue)
- `apps/mobile/src/components/helpdesk/QueueList.tsx`
- `apps/mobile/src/components/helpdesk/QueueRow.tsx`
- `apps/mobile/src/components/helpdesk/TicketHeaderMobile.tsx`
- `apps/mobile/src/components/helpdesk/ResolveFAB.tsx`
- `apps/mobile/src/components/helpdesk/ResolveSheet.tsx`
- `apps/mobile/src/hooks/useMyQueue.ts` — wraps `list_my_queue` via BFF
- `apps/mobile/src/hooks/useTicket.ts` — wraps `get_ticket`
- `apps/mobile/src/hooks/useResolveTicket.ts` — wraps `resolve_ticket`

All data calls route through BFF `/api/emma/chat` per ADR-0132. No direct capability invocation from mobile.

## 3.1 Navigation placement

Bottom tab bar gains a new tab: **Min kø** (`queue`).

Tab order (left to right):
1. Hjem (`index`)
2. Vakt (`shift`)
3. **Min kø** — new, only visible for profiles that are `responsible_profile_id` on at least one desk. Non-responsible users never see this tab.
4. Meldinger (`komm`)
5. Profil (`profile`)

**Tab icon:** `LifeBuoy` from Lucide (via `lucide-react-native`).

**Badge:** A dot `[•]` on the tab icon when `count > 0 && any ticket has status='waiting'`. Dot uses the Responsibility orb at 8px, hue 50, chroma 0.10 (NOT a red notification dot). The dot pulses 2.8s. This is the first of max 3 pulses on the mobile viewport.

Gating logic:
```ts
const showQueueTab = await supabase
  .from('channel')
  .select('id', { count: 'exact', head: true })
  .eq('channel_type', 'desk')
  .eq('responsible_profile_id', profile.id);
// showQueueTab.count > 0
```

Load this at app boot, cache for the session, invalidate on auth change.

## 3.2 Queue list screen

**Layout:**
```
┌──────────────────────────────┐
│ Min kø                       │   ← header, 64px, sticky
│ 3 åpne · 1 venter            │
├──────────────────────────────┤
│ [avatar] Linn Andersen       │
│          Kan jeg jobbe i ro… │   ← summary, 2 lines max
│          14 min              │   ← relative time
│                         [•]  │   ← waiting dot (if waiting)
├──────────────────────────────┤
│ [avatar] Kari Holm           │
│          ...                 │
└──────────────────────────────┘
```

**Header:**
- Title: `fontFamily: 'InstrumentSerif-Regular'` (via expo-font), size 32, color `colors.foreground`.
- Sub-count: `fontFamily: 'Geist-Regular'`, size 14, color `colors.mutedForeground`. Format: `"{totalOpen} åpne · {waitingCount} venter"`. Drop the `· X venter` clause when `waitingCount === 0`.
- Background: `colors.background`, no blur on mobile header (blur is expensive; reserve for iOS native large-title if desired).

**Row anatomy (76pt tall):**
- Left: requester avatar, 40pt, `ring-1 border border-border/40`. No lighthouse orb on requester — they are not responsible. The orb is reserved for the assignee, which in the queue view is always "me" and hence implicit (don't re-state).
- Middle column (flex): requester name (`Geist-Medium`, 15pt), summary (`Geist-Regular`, 14pt, `mutedForeground`, numberOfLines: 2), relative time (`Geist-Mono`, 11pt, `mutedForeground`, marginTop 4).
- Right: waiting dot. Only rendered if `status === 'waiting'`. Uses `ResponsibilityOrb` primitive (see 3.5).

**Pull-to-refresh:** `RefreshControl`, tint `colors.foreground`, title (`"Henter kø…"`) optional on iOS. Pulls `list_my_queue({ limit: 50 })`.

**Separator:** `StyleSheet` hairline (`StyleSheet.hairlineWidth`), color `colors.border + "66"` (40% alpha). No inset — full width.

**Empty state:**
```
       [Warm orb 160px]
       Ingen åpne saker
       Alt er løst. Nyt pausen.
```
- Orb via `expo-linear-gradient` (radial simulation using two stacked linear gradients, or use `react-native-svg`'s `RadialGradient` — recommended). Hue 50, chroma 0.06.
- Text blocks centered, vertical offset 25% from top.

**Error state:**
```
       [AlertCircle icon, 48pt, mutedForeground]
       Kunne ikke hente kø
       [ Prøv igjen ]
```
- Single touch target for retry. Button style: bordered, `borderColor: colors.border`, `borderRadius: 12`, `padding: 12 16`.

**FlashList:** use `@shopify/flash-list` (`estimatedItemSize={76}`) — not `FlatList`. Per vercel-react-native-skills list performance rule.

## 3.3 Ticket detail screen

**Route:** `/ticket/[id]` within the Queue stack. Presented as a push, not a modal.

**Header (custom, 88pt):**
```
┌──────────────────────────────┐
│ [←]                          │
│                              │
│ [Status orb 40pt] VENTER     │
│ Kan jeg jobbe i romjula?     │
│ Linn Andersen · 14 min       │
└──────────────────────────────┘
```
- Back chevron: top-left 44pt touch target.
- Status orb (40pt): same darkening-orb primitive as web. Phase 1 = static hue 50 chroma 0.06/0.10/0.04 by status.
- Status label: 11pt mono uppercase, mutedForeground.
- Summary: InstrumentSerif-Regular, 22pt, foreground, numberOfLines: 2.
- Meta line: 13pt Geist-Regular, mutedForeground, includes requester name and relative time.

NO reassign dropdown on mobile. If user taps where it "should" be, nothing happens — the control doesn't exist on this surface.

**Message list:** Reuse the mobile Komm message component (`apps/mobile/src/components/komm/MessageList.tsx` or equivalent — use whatever currently renders `channel_message` rows for `channel_type='direct_message'`). Pass `channelId = ticket.channel_id`.

**Reply composer:** Reuse mobile Komm's composer component unchanged. Enabled for both `waiting` and `active` status. On `complete` status: composer shows `"Saken er løst. Botsson har stengt kanalen."` in place of the input — NOT disabled gray, but replaced with a static text strip at same height. Muted foreground.

**Resolve FAB (`ResolveFAB`):**
- Fixed bottom-right, 56pt circular, offset `{ bottom: 24 + safeAreaBottom, right: 16 }`.
- Shown only when `status !== 'complete'` AND current user is `assignee_profile_id`.
- Icon: `Check` 24pt, `colors.foreground`.
- Background: Responsibility orb rendered as `expo-linear-gradient` + `View` with `borderRadius: 28`. Hue 50 chroma 0.12 base, active-press chroma 0.18. Solid-looking but internally a soft radial.
- Border: 1pt `colors.border/60`.
- Shadow: `shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 18, elevation: 8`.
- Pulse: breathing scale 1.0 ↔ 1.04 at 2.8s cycle (driven by Reanimated `withRepeat(withTiming)`), ONLY when `status === 'waiting'`. This is the second of max 3 pulses on the mobile viewport. When `status === 'active'`, FAB is still, but visible.

**FAB tap:** Opens `ResolveSheet` (bottom sheet via `@gorhom/bottom-sheet` if installed, else custom slide-up modal).

## 3.4 ResolveSheet

- Snap points: `['40%', '70%']`. Start at 40%.
- Handle indicator: 36pt wide, 4pt tall, `colors.border`, top 8pt.
- Content padding: 24pt horizontal, 20pt top.
- Title: "Løs saken" — InstrumentSerif 22pt.
- Sub-lede: 14pt mutedForeground, "{requesterName} — dette lukker saken for dem."
- `TextInput` (multiline, 4 lines, max 280 chars): placeholder `"f.eks. «Avklart — gjelder ikke romjul 24.–26.»"`. Border `colors.border`, borderRadius 12, padding 12.
- Primary button: full-width, height 52pt, label `"Løs sak"`. Background uses same orb gradient as FAB (chroma 0.18 base for pressed feel).
- Secondary: `"Avbryt"`, text-only, centered, 14pt mutedForeground.
- Submit: calls `useResolveTicket` mutation → BFF `/api/emma/chat` with tool `resolve_ticket`. On success: sheet dismisses (spring 300ms), screen's status orb transitions to complete, FAB fades out 320ms, toast via mobile toast layer ("Saken er løst").

## 3.5 What's NOT on mobile

| Action | Mobile behavior |
|---|---|
| Create desk | Not linkable from anywhere on mobile. No orphan "try web" card — we don't surface the concept at all. |
| Edit desk responsible | Not linkable. Admin opens web. |
| View all desks as admin | Not linkable. |
| Reassign ticket | Not reachable. The dropdown doesn't exist; no affordance, no redirect. If a push notification deep-linked to a reassign URL, show the ticket view (no reassign panel). |
| Open ticket as anyone other than the assigned user | Blocked at capability (backend). On mobile, queue only shows own-assigned. If a direct URL is hit, render the "Ikke tilgang" screen: |

**"Ikke tilgang" screen** (when user hits a ticket they're neither assignee nor admin of):
```
       [LifeBuoy icon 48pt, mutedForeground, opacity 0.4]
       Denne saken er ikke din
       Be administratoren om å tildele den til deg.
```
No "go to web" affordance in Phase 1. The screen accepts the dead-end without pretending there's another path.

## 3.6 Native-specific motion

**Reanimated patterns:**
- FAB pulse: `useSharedValue(1)` + `withRepeat(withTiming(1.04, { duration: 1400 }), -1, true)` wrapped in `useAnimatedStyle({ transform: [{ scale }] })`. Gate behind `useReducedMotion()` from `react-native-reanimated`.
- Queue row enter: driven by FlashList `CellRendererComponent` is overkill for Phase 1. Accept that rows appear without stagger. Do NOT add enter animations per-row on mobile — scroll performance wins.
- Sheet: use `bottom-sheet`'s built-in spring. Do not override unless needed.
- Status orb chroma transitions on resolve: `useDerivedValue` over status, interpolate chroma via `interpolate()`, then set as background color via `useAnimatedStyle`. Gate behind reduced motion.

**expo-linear-gradient:** Used for orb backgrounds. Example (FAB):
```tsx
<LinearGradient
  colors={[
    'oklch(0.68 0.12 50 / 0.95)',  // center-ish
    'oklch(0.60 0.08 50 / 0.70)',  // mid
    'oklch(0.55 0.05 50 / 0.30)',  // edge
  ]}
  start={{ x: 0.35, y: 0.25 }} end={{ x: 0.75, y: 0.85 }}
  style={styles.fabGradient}
/>
```
Note: React Native expo-linear-gradient doesn't support radial natively; layer two linear gradients or use `react-native-svg` `<RadialGradient>` inside a `<Svg>` for true radial. **Recommended:** svg for orbs, linear-gradient for flat chroma fills.

All color values come from `@smartout/design-tokens/native` — never inline OKLCH literals in component files. The example above is for spec clarity; in code, use `colors.orb.base`, `colors.orb.midWaiting`, etc. (add these tokens to `native.ts` in the same PR).

## 3.7 Token Map (Spec 3)

All tokens below live in `packages/design-tokens/src/native.ts`. Add any missing ones in the same PR.

| Token path | Value |
|---|---|
| `colors.background` | existing, unchanged |
| `colors.foreground` | existing |
| `colors.mutedForeground` | existing |
| `colors.border` | existing |
| `colors.card` | existing |
| `colors.orb.neutral` | `oklch(0.68 0.06 50)` (waiting/active base) |
| `colors.orb.neutralMid` | `oklch(0.60 0.04 50 / 0.65)` |
| `colors.orb.neutralEdge` | `oklch(0.55 0.03 50 / 0.25)` |
| `colors.orb.activeCenter` | `oklch(0.70 0.10 50)` (active status) |
| `colors.orb.completeCenter` | `oklch(0.72 0.04 50)` (resolved) |
| `colors.orb.slaPhase2MaxCenter` | `oklch(0.68 0.18 40)` — documented, unused in Phase 1 |
| `typography.heading.xl` | `{ fontFamily: 'InstrumentSerif-Regular', fontSize: 32, lineHeight: 36 }` |
| `typography.heading.lg` | `{ fontFamily: 'InstrumentSerif-Regular', fontSize: 22, lineHeight: 26 }` |
| `typography.body.md` | `{ fontFamily: 'Geist-Regular', fontSize: 15, lineHeight: 20 }` |
| `typography.meta` | `{ fontFamily: 'GeistMono-Regular', fontSize: 11, letterSpacing: 0.8 }` |
| `radii.sheetHandle` | 2 |
| `radii.fab` | 28 |
| `radii.card` | 16 |
| `spacing.fabOffsetRight` | 16 |
| `spacing.fabOffsetBottom` | 24 |

## 3.8 Accessibility

- Queue row: `accessibilityRole="button"`, `accessibilityLabel={`${requesterName}, ${status === 'waiting' ? 'venter' : 'aktiv'}, ${relativeTime}. ${summary}`}`, `accessibilityHint="Åpne saken"`.
- Waiting dot: `accessibilityElementsHidden={true}` (status is already in the row label).
- FAB: `accessibilityRole="button"`, `accessibilityLabel="Løs saken"`, `accessibilityHint="Åpner dialog for å løse saken"`.
- Resolve sheet: announces title on mount. First focus on TextInput.
- Dynamic Type: all font sizes must respect `PixelRatio.getFontScale()`. Use `useWindowDimensions()` + scale-aware sizing OR rely on React Native's default text scaling (leave `allowFontScaling` at default `true`). Never set `allowFontScaling={false}` on any user-facing text.
- VoiceOver order on ticket detail: back button → status orb (hidden) → status label → summary → meta line → message list → composer → FAB.
- Reduced motion: all Reanimated drivers gated on `useReducedMotion()`. Sheet still animates (native convention); FAB pulse disabled; orb chroma transitions → instant.
- High-contrast mode (iOS): borders automatically strengthen via OS — no custom handling required; verify in testing.

---

# Spec 4 — Cross-Cutting Design Decisions

## 4.1 SLA Phase 1 vs Phase 2 visual treatment

**Phase 1 (now):** No SLA. Status orb uses static chroma per status:

| Status | Hue | Chroma | Pulse |
|---|---|---|---|
| `waiting` | 50 | 0.06 | Yes, 2.8s |
| `active` | 50 | 0.10 | No |
| `complete` | 50 | 0.04 | No, check icon overlay |

No clock. No deadline. No red. Orphan desks also use chroma 0 territory (warm neutral, border-dashed).

**Phase 2 (SLA lands):** Same orb primitive, SLA drives a second derived chroma+hue shift layered on top of status chroma:

```
progress = elapsed / sla_duration   // clamped 0..1
hue      = lerp(50, 40, progress)   // warm → brand orange
chroma   = lerp(statusChroma, 0.18, progress)
```

At `progress = 1.0` (breach), orb is fully saturated brand orange. Still no red. Still no ticking counter. Still no countdown text. The orb is the only visual.

Post-breach (`progress > 1.0`): orb stays at breach state; an `AlertCircle` icon appears to the left of the status label, subtly animated in. No color change beyond the breach state. Breach is a one-way door; the orb doesn't get "more angry."

**Why not red?** Red creates panic, trains staff to ignore reds ("the HR queue is always red"), and doesn't compose with our warm palette. The orb's hue shift says "attention needed" without triggering stress cortisol. Validated by Council 2026-04-19.

**Implementation note for Phase 1 code:** Build the darkening-orb primitive (`<ResponsibilityOrb status={...} slaProgress={...} />`) now, with `slaProgress` prop defaulting to `undefined`. Phase 2 wiring becomes one prop pass-through.

## 4.2 i18n keys

All strings in Specs 1–3. Create in `packages/i18n/locales/{nb,en}/helpdesk.json`.

| Key | nb-NO | en |
|---|---|---|
| `page.desks.title` | `Helpdesk · Skranker` | `Helpdesk · Desks` |
| `page.desks.lede` | `Skranker binder ansatte til den som svarer.` | `Desks connect employees to the person who answers.` |
| `page.desks.create` | `Ny skranke` | `New desk` |
| `page.desks.empty.title` | `Ingen skranker ennå` | `No desks yet` |
| `page.desks.empty.body` | `En skranke er en dør til en ansvarlig kollega. Opprett en når dere vet hvem som svarer på hva.` | `A desk is a door to a responsible colleague. Create one when you know who answers what.` |
| `page.desks.empty.cta` | `Opprett første skranke` | `Create first desk` |
| `desk.card.open_count_one` | `1 åpen sak` | `1 open ticket` |
| `desk.card.open_count_other` | `{count} åpne saker` | `{count} open tickets` |
| `desk.card.new_badge` | `{count} nye` | `{count} new` |
| `desk.card.orphan.label` | `Ingen ansvarlig` | `No responsible` |
| `desk.card.orphan.cta` | `Tildel ansvarlig` | `Assign responsible` |
| `desk.card.last_active` | `Sist aktiv {rel}` | `Last active {rel}` |
| `desk.card.open_queue` | `Åpne kø` | `Open queue` |
| `desk.dialog.title` | `Opprett skranke` | `Create desk` |
| `desk.dialog.field.name` | `Navn` | `Name` |
| `desk.dialog.field.name.placeholder` | `f.eks. «HR»` | `e.g. "HR"` |
| `desk.dialog.field.description` | `Kort beskrivelse (valgfritt)` | `Short description (optional)` |
| `desk.dialog.field.responsible` | `Ansvarlig` | `Responsible` |
| `desk.dialog.submit` | `Opprett skranke` | `Create desk` |
| `desk.dialog.submit.pending` | `Oppretter…` | `Creating…` |
| `desk.dialog.cancel` | `Avbryt` | `Cancel` |
| `desk.combobox.placeholder` | `Velg ansvarlig` | `Choose responsible` |
| `desk.combobox.empty` | `Ingen tilgjengelige ledere` | `No available managers` |
| `desk.queue.sheet.title` | `Skrankekø` | `Desk queue` |
| `desk.queue.sheet.view_all` | `Vis alle i Kanaler` | `View all in Channels` |
| `ticket.status.waiting` | `Venter` | `Waiting` |
| `ticket.status.active` | `Aktiv` | `Active` |
| `ticket.status.complete` | `Løst` | `Resolved` |
| `ticket.status.waiting.upper` | `VENTER` | `WAITING` |
| `ticket.status.active.upper` | `AKTIV` | `ACTIVE` |
| `ticket.status.complete.upper` | `LØST` | `RESOLVED` |
| `ticket.header.back` | `Tilbake til kanaler` | `Back to channels` |
| `ticket.header.reassign` | `Tildel på nytt` | `Reassign` |
| `ticket.action.resolve` | `Løs sak` | `Resolve` |
| `ticket.action.resolve.pending` | `Løser…` | `Resolving…` |
| `ticket.resolved_at` | `Løst {time}` | `Resolved {time}` |
| `ticket.empty.title` | `{name} åpnet denne saken nettopp.` | `{name} just opened this ticket.` |
| `ticket.empty.body` | `Ingen meldinger ennå. Skriv et svar for å komme i gang.` | `No messages yet. Reply to get started.` |
| `ticket.resolve.dialog.title` | `Løs saken` | `Resolve ticket` |
| `ticket.resolve.dialog.lede` | `{name} — dette lukker saken for {requester}.` | `{name} — this closes the ticket for {requester}.` |
| `ticket.resolve.dialog.field.label` | `Hva var løsningen? (valgfritt)` | `What was the resolution? (optional)` |
| `ticket.resolve.dialog.field.placeholder` | `f.eks. «Avklart — gjelder ikke romjul 24.–26.»` | `e.g. "Clarified — doesn't apply 24–26 Dec."` |
| `ticket.resolve.dialog.submit` | `Løs sak` | `Resolve` |
| `ticket.composer.locked` | `Saken er løst. Botsson har stengt kanalen.` | `The ticket is resolved. Botsson closed the channel.` |
| `mobile.tab.queue` | `Min kø` | `My queue` |
| `mobile.queue.header.subcount.no_waiting` | `{count} åpne` | `{count} open` |
| `mobile.queue.header.subcount.with_waiting` | `{open} åpne · {waiting} venter` | `{open} open · {waiting} waiting` |
| `mobile.queue.empty.title` | `Ingen åpne saker` | `No open tickets` |
| `mobile.queue.empty.body` | `Alt er løst. Nyt pausen.` | `All clear. Enjoy the break.` |
| `mobile.queue.error.title` | `Kunne ikke hente kø` | `Couldn't load queue` |
| `mobile.queue.error.retry` | `Prøv igjen` | `Try again` |
| `mobile.ticket.forbidden.title` | `Denne saken er ikke din` | `This ticket isn't yours` |
| `mobile.ticket.forbidden.body` | `Be administratoren om å tildele den til deg.` | `Ask your admin to assign it to you.` |
| `mobile.fab.resolve` | `Løs saken` | `Resolve` |
| `toast.helpdesk.desks.created` | `Skranken "{name}" ble opprettet.` | `Desk "{name}" created.` |
| `toast.helpdesk.desks.forbidden` | `Bare administratorer kan endre skranker.` | `Only admins can manage desks.` |
| `toast.helpdesk.ticket.resolved` | `Saken er løst. {requester} får beskjed.` | `Ticket resolved. {requester} is notified.` |
| `toast.helpdesk.ticket.resolve_failed` | `Kunne ikke løse saken. Prøv igjen.` | `Couldn't resolve ticket. Try again.` |

## 4.3 UI Telemetry events (beyond backend)

Backend already emits `helpdesk.query.opened` and `helpdesk.query.resolved`. The UI adds these for product analytics (PostHog only — not activity_trail, not engine_event):

| Event | Where | Props |
|---|---|---|
| `helpdesk.desks.page_viewed` | Desks page mount | `workspace_id`, `desk_count`, `orphan_count` |
| `helpdesk.desk.created_ui` | After `createDesk` Server Action succeeds | `workspace_id`, `desk_id`, `has_description: boolean` |
| `helpdesk.desk.create_dialog_opened` | Dialog open | `workspace_id`, `trigger: 'header_button' \| 'empty_state'` |
| `helpdesk.desk.create_dialog_cancelled` | Dialog closed without submit | `workspace_id` |
| `helpdesk.desk.responsible_assigned_ui` | Orphan card `Tildel ansvarlig` succeeds | `workspace_id`, `desk_id` |
| `helpdesk.desk.queue_sheet_opened` | Sheet opens from desk card click | `workspace_id`, `desk_id`, `open_count` |
| `helpdesk.ticket.view_opened_web` | TicketConversationView mounts | `workspace_id`, `ticket_id`, `status`, `age_seconds` |
| `helpdesk.ticket.resolve_dialog_opened` | Resolve dialog opens | `workspace_id`, `ticket_id`, `status` |
| `helpdesk.ticket.resolve_dialog_cancelled` | Resolve dialog dismissed without submit | `workspace_id`, `ticket_id` |
| `helpdesk.ticket.resolved_ui` | After `resolve_ticket` Server Action succeeds (UI side) | `workspace_id`, `ticket_id`, `has_resolution_note: boolean`, `age_seconds` |
| `helpdesk.mobile.queue_viewed` | Queue screen mount | `workspace_id`, `queue_size`, `waiting_count` |
| `helpdesk.mobile.queue_refreshed` | Pull-to-refresh fires | `workspace_id`, `queue_size_before`, `queue_size_after` |
| `helpdesk.mobile.ticket_opened` | Ticket detail mount on mobile | `workspace_id`, `ticket_id`, `opened_from: 'queue' \| 'push_notification' \| 'deep_link'` |
| `helpdesk.mobile.resolve_fab_tapped` | FAB tap | `workspace_id`, `ticket_id`, `status` |
| `helpdesk.mobile.ticket_forbidden_shown` | Forbidden screen mount | `workspace_id`, `ticket_id`, `entry_path` |

All events flow through `@smartout/telemetry` `emit()`. Per ADR-0134, mobile events MUST resolve `workspace_id` and `actor_id` via `getProfileContext()` before `emit()`. Empty-string fallbacks are forbidden.

## 4.4 Component decomposition — shared vs app-specific

Per ADR-0158 (dual-platform primitives) and the Nordic Split mobile parity rule:

### Shared in `packages/ui/src/helpdesk/` (new directory)

Pure presentational primitives, no data coupling, no platform-specific APIs (no RN-specific, no Next-specific):

- `ResponsibilityOrb` — React + React Native variants. Props: `{ status: 'waiting' | 'active' | 'complete'; slaProgress?: number; size: number; pulse?: boolean }`. Renders CSS radial-gradient on web, SVG `<RadialGradient>` on RN. This IS the darkening-orb primitive.
- `LighthouseAvatar` — wraps an avatar in a `ResponsibilityOrb`. Takes `profile` and `size` + `haloState: 'idle' | 'active' | 'waiting'`.
- `OrphanBadge` — the dashed-border treatment used on empty states and orphan desk cards. Props: `{ icon?: LucideIcon; label: string }`.
- `StatusLabel` — uppercase mono label primitive. Props: `{ status; size: 'sm' | 'md' }`.

### Web-only in `apps/web/src/app/dashboard/komm/...`

Everything that touches Server Actions, Next.js routing, or shadcn/Radix:

- `DesksClient`, `DeskCard`, `CreateDeskDialog`, `ResponsibleRepCombobox`, `TicketConversationView`, `TicketHeader`, `ResolveTicketDialog`, `QueueSheet`.

### Mobile-only in `apps/mobile/src/components/helpdesk/`

Everything that touches Reanimated, FlashList, bottom-sheet, or native modules:

- `QueueList`, `QueueRow`, `TicketHeaderMobile`, `ResolveFAB`, `ResolveSheet`.

**Reason the list isn't shared:** `FlashList` has subtly different APIs from a web list; forcing a shared `<Queue>` creates polymorphism debt. `ResponsibilityOrb` is shared because the math is identical; the list is not because the data-fetching and rendering primitives differ.

### Data hooks in `packages/ai/` or app-specific?

`open_ticket`, `list_my_queue`, `get_ticket`, `resolve_ticket` are capability tools already. The UI calls them via:

- Web: Server Action → `capability-router` → `helpdesk_query` tool. No shared hook needed; pages use Server Components + Actions.
- Mobile: Custom React Query hooks (`useMyQueue`, `useTicket`, `useResolveTicket`) that POST to BFF `/api/emma/chat`. These live in `apps/mobile/src/hooks/`.

Do NOT create a shared `@smartout/helpdesk-hooks` package in Phase 1. The mobile hooks are thin wrappers around `fetch`; abstracting prematurely hides the BFF shape. Reconsider in Phase 2 when voice + push notifications add complexity.

## 4.5 Breaking-change risks for existing Komm

The existing Komm (`KanalerClient`, `ChannelList`, `channel_type='direct_message'` + `'group'` + others) must not regress.

**Risks identified:**

1. **`channel_type='query_thread'` leaking into `ChannelList`.** Per ADR-0161, query_thread rows MUST NOT appear in TYPE_ORDER. **Mitigation:** audit the current Komm sidebar query. If it fetches by `channel_type IN (...)`, ensure `'query_thread'` and `'desk'` are excluded. Write a Vitest/Playwright regression test: create a query_thread row, open `/dashboard/komm`, assert sidebar length unchanged.

2. **`/dashboard/komm/[channelId]` branch logic.** Today the page unconditionally renders `ChannelConversation`. Adding a fork on `channel_type='query_thread'` risks:
   - SSR/hydration mismatch if branch decision flips between server and client. **Mitigation:** decide on server-side only; pass a discriminated union `{ kind: 'channel' } | { kind: 'ticket'; ticket }` as props.
   - Existing deep links like `/dashboard/komm/{uuid}` for DMs continue to work — the branch only fires for query_thread rows. Test: open an existing DM channel, assert existing rendering path runs.

3. **Shared message list component.** The message list is reused. If someone adds ticket-specific logic inside the message list "just for this case," it pollutes DM/group rendering. **Mitigation:** enforce that `TicketConversationView` passes only `channelId` to the message list — no ticket-specific props. Code review gate: grep for `ticket` or `helpdesk` in the message list component — should be zero hits.

4. **Token + i18n cleanup debt in touched Komm files.** Per Council frontend gate: any Komm file touched in this PR must also get token + i18n cleanup. Specifically:
   - If `KanalerClient.tsx` has hardcoded colors (`zinc-*`, `gray-*`) or hardcoded Norwegian text, fix them in the same PR.
   - Do NOT touch Komm files we don't need to touch — scope creep kills velocity. Only files whose behavior changes for Phase 1 qualify.

5. **Sidebar unread badges.** Komm sidebar likely shows unread counts per channel. A `query_thread` with unread messages must NOT surface as an unread DM. **Mitigation:** the sidebar query already excludes `query_thread` (per risk 1); unread counts inherit that exclusion. Test: post a message in a query_thread as the requester, assert Komm sidebar unread count for the assignee does not increment (the mobile queue tab badge does instead).

6. **Realtime subscriptions.** Komm subscribes to `channel_message` insertions for sidebar counts. Ticket thread messages flow through the same table. Ensure the sidebar subscription filters out query_thread rows OR the ticket UI handles its own realtime independently. **Recommendation:** keep Komm's subscription as-is but filter by `channel_type IN ('direct_message', 'group', ...)` on the client when computing unread badges. Add a comment linking to ADR-0161.

7. **Search / command-k.** If Komm has a channel search, ensure query_thread + desk types are excluded from results.

## 4.6 What an implementation agent should NOT invent

Lock list. If the spec doesn't say it, you don't add it:

1. No SLA countdown text, progress bars, "expires in 2h 14m" labels — ever. Phase 1 has no SLA.
2. No red colors anywhere in the helpdesk surface. Not for orphan, not for breach, not for destructive actions. Use warm orb or dashed border instead.
3. No "Start voice call" button in the ticket header. Voice-channel routing is ADR-0078 + ADR-0135 territory, not Phase 1.
4. No "Transfer to other desk" control. Desks are independent silos in Phase 1.
5. No @-mention or emoji picker additions to the ticket composer. Reuse Komm's composer verbatim.
6. No "Mark as spam" / "Close without resolving" / "Snooze" actions. Only `resolve_ticket` exists.
7. No Kanban board, no columns by status, no drag-and-drop on queue.
8. No inline reassign on the queue row. Reassign is owner-only AND lives in the ticket header (web) or is forbidden (mobile).
9. No ticket list on mobile showing other people's queues. Only "Min kø". Admin wanting to see everyone's queue opens web.
10. No desk analytics, response-time stats, or leaderboards. Phase 1 is pure operations.
11. No notifications settings panel. Notifications are handled by the existing notifications module; Phase 1 just trusts it fires on `helpdesk.query.opened`.
12. No custom colors for "urgent" tickets. Priority is out of scope.
13. No browser push notifications wiring. Mobile push lands via the existing push module when the backend emits `helpdesk.query.opened` — no new web notification code.
14. No Storybook stories beyond the shared `ResponsibilityOrb`, `LighthouseAvatar`, `OrphanBadge`. Dialogs and page-level shells don't need stories for Phase 1.
15. No `react-query` on web. Use Server Components + Server Actions. Mobile uses React Query via BFF.
16. No raw color values in any component file (`#abcdef`, `rgba(...)`, `oklch(...)` literals). Only CSS variables or design-token imports.
17. No new database tables. No new enums. The backend is shipped; UI consumes it.
18. No new Edge Functions. Everything routes through existing capability router / BFF.
19. No additional pulsing elements beyond:
    - Web: status orb on `waiting` tickets (1 per viewport), orphan AlertCircle when orphan count ≤ 2 (up to 2 per viewport). Hard cap 3.
    - Mobile: queue tab badge dot (1), FAB on `waiting` (1). Hard cap 3.
20. No `framer-motion` stiffness/damping values outside the design system range (stiffness 30–45, damping 20–24, mass 2–2.5). If a motion feels wrong at those values, the design is wrong — don't tune the spring.
21. No "Try on web" CTAs on mobile. Dead-ends are honest; detours lie.
22. No Instrument Serif on mobile body text. Only headings. Geist for everything else.
23. No blur on mobile except where iOS large-title conventions already exist (`BlurView` on scroll). Mobile blurs are expensive.
24. No custom focus-ring colors. `ring-ring` only. No "ring-primary" unless already mapped.
25. No toast positions other than the existing Sonner config on web / existing mobile toast layer.

---

## Appendix A — Files summary

**New files (web):**
- `apps/web/src/app/dashboard/komm/desks/page.tsx`
- `apps/web/src/app/dashboard/komm/desks/_components/DesksClient.tsx`
- `apps/web/src/app/dashboard/komm/desks/_components/DeskCard.tsx`
- `apps/web/src/app/dashboard/komm/desks/_components/CreateDeskDialog.tsx`
- `apps/web/src/app/dashboard/komm/desks/_components/ResponsibleRepCombobox.tsx`
- `apps/web/src/app/dashboard/komm/desks/_components/QueueSheet.tsx`
- `apps/web/src/app/dashboard/komm/desks/_actions/desk-actions.ts`
- `apps/web/src/app/dashboard/komm/[channelId]/_components/TicketConversationView.tsx`
- `apps/web/src/app/dashboard/komm/[channelId]/_components/TicketHeader.tsx`
- `apps/web/src/app/dashboard/komm/[channelId]/_components/ResolveTicketDialog.tsx`
- `apps/web/src/app/dashboard/komm/[channelId]/_actions/resolve-ticket.ts`

**Changed files (web):**
- `apps/web/src/app/dashboard/komm/[channelId]/page.tsx` (branch on channel_type)
- `apps/web/src/app/dashboard/komm/_components/KanalerClient.tsx` (sidebar exclusion audit, token + i18n cleanup in same PR per Council gate)
- `apps/web/src/app/dashboard/komm/_components/ChannelList.tsx` (token + i18n cleanup)
- `apps/web/globals.css` (add `.noise-overlay` if missing)

**New files (mobile):**
- `apps/mobile/app/(tabs)/queue.tsx`
- `apps/mobile/app/ticket/[id].tsx`
- `apps/mobile/src/components/helpdesk/QueueList.tsx`
- `apps/mobile/src/components/helpdesk/QueueRow.tsx`
- `apps/mobile/src/components/helpdesk/TicketHeaderMobile.tsx`
- `apps/mobile/src/components/helpdesk/ResolveFAB.tsx`
- `apps/mobile/src/components/helpdesk/ResolveSheet.tsx`
- `apps/mobile/src/hooks/useMyQueue.ts`
- `apps/mobile/src/hooks/useTicket.ts`
- `apps/mobile/src/hooks/useResolveTicket.ts`

**Changed files (mobile):**
- `apps/mobile/app/(tabs)/_layout.tsx` (add queue tab, conditional visibility)

**New files (shared):**
- `packages/ui/src/helpdesk/ResponsibilityOrb.tsx` (web) + `.native.tsx`
- `packages/ui/src/helpdesk/LighthouseAvatar.tsx` + `.native.tsx`
- `packages/ui/src/helpdesk/OrphanBadge.tsx` + `.native.tsx`
- `packages/ui/src/helpdesk/StatusLabel.tsx` + `.native.tsx`
- `packages/i18n/locales/nb/helpdesk.json`
- `packages/i18n/locales/en/helpdesk.json`

**Changed files (shared):**
- `packages/design-tokens/src/native.ts` (orb color tokens, radii, spacing additions)
- `packages/design-tokens/src/tokens.ts` (if any orb tokens need exposing to web — optional; CSS `oklch()` literals in the orb component referencing existing muted/border are acceptable)

## Appendix B — Storybook stories

Phase 1 stories (minimum):
- `ResponsibilityOrb`: all status × all chroma levels × all sizes × reduced-motion ON/OFF.
- `LighthouseAvatar`: idle / active / waiting × small / medium / large, with and without a profile image.
- `OrphanBadge`: three representative icons (AlertCircle, HelpCircle, Circle-dashed), three label lengths.

No dialog stories. No page stories. Keep Phase 1 lean.

---

**End of spec.**
