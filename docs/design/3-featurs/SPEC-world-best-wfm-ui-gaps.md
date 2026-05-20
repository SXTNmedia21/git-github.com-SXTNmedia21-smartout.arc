---
title: SPEC — World-Best-WFM UI Gap Closure
status: draft
updated: 2026-05-14
created: 2026-05-14
module: design
tags: [design, spec, world-best-wfm, pos, marketplace, onboarding-manual, ui-gap]
---

# SPEC — World-Best-WFM UI Gap Closure

Three surfaces missing post-campaign-merge (PR #385). This doc tells Pontus exactly what each page must do, what data it consumes, what the user accomplishes, and which Nordic Split patterns to apply. Pontus designs the visuals; this spec locks the contracts.

## Cross-cutting design rules (Nordic Split — non-negotiable)

- All colors via CSS variables (`bg-background`, `text-foreground`, `border-border`, `bg-muted`). NO hardcoded zinc/slate/gray.
- Headings: `font-heading` (Instrument Serif). Body: Geist Sans default. Data: `font-mono`.
- Motion: `motion as motionTokens from "@smartout/design-tokens"`. Use `motionTokens.spring` (default), `motionTokens.springSnappy` (button/badge), `motionTokens.springGentle` (ambient). Never inline magic numbers.
- Icons: Lucide React only. No emojis.
- 40% reduction principle: prefer space + typography hierarchy over borders/boxes.
- Glassmorphism: `bg-background/80 + backdrop-blur-xl + 1px gradient border`.
- Layout: Server Component shell + Client interactive bridge (ADR-0021). `loading.tsx` skeleton matches final layout shape (no skeleton flash, no layout shift).
- Telemetry: every mutation `emit()`s in `onSuccess`. `getProfileContext()` fail-fast before emit.
- Auth: capability tools mounted via `<XToolsBridge>` — never inline `supabase.from(...)` for mutations; route through BFF + `mutateWithGate`.

---

## 1. POS Account Management — admin web page

### Purpose

Workspace owner/admin connects, lists, and disconnects POS integrations (V1 = Lightspeed K-Series). Backend tools already exist (`pos_account_management.connect_lightspeed`, `disconnect`, `list_accounts`); Botsson chat can drive them today, but admins want a visual surface.

### Route + role

| | |
|---|---|
| Route | `/dashboard/pos-accounts/` |
| Role gate | `admin` or `owner` only (`min_role: admin` per ADR-0305) |
| Channel | chat-only on mutations (already enforced by capability); web page is the chat-bridge surface |
| ADR | 0305 (POS account management), 0319 (POS adapter contract — V2 dispatcher) |

### Page anatomy

| Block | Content |
|---|---|
| Page header | H1 `font-heading`: "POS-integrasjoner" + subtitle: "Koble kassasystemet til Smartout for automatisk salgsdata + scheduler-kalibrering." |
| Empty state (no accounts) | Centered illustration + Lightspeed wordmark + CTA primary button "Koble til Lightspeed" + secondary text "Krever Lightspeed-konto med K-Series API-tilgang." |
| Account-list state (≥1 account) | Card per connected account: business name + currency + last-sync timestamp + status pill (`connected`/`error`/`syncing`) + 3-dot menu (View details / Disconnect) |
| Add-account row | Bottom CTA: "+ Koble til ny konto" — opens connect drawer |

### Connect flow (drawer or sheet)

Step 1: choose vendor (V1 = Lightspeed only; design must support adding rows for V2 — POS Pro, ResEngine, ePos Now).
Step 2: OAuth handoff — opens `https://cloud.lightspeedapp.com/oauth/authorize?...` in popup.
Step 3: callback returns to `/dashboard/pos-accounts?connected=<vendor>`.
Step 4: success state — green pulse on the new card + auto-trigger first sync.

### Data contract

```typescript
type PosAccount = {
  pos_account_id: string;
  workspace_id: string;
  vendor: "lightspeed_k" | "lightspeed_x" | "pos_pro" | "..."; // dispatcher-keyed
  vendor_account_label: string;        // "Strøm Mat & Bar — K-Series"
  currency: "NOK" | "EUR" | "USD" | "SEK" | "DKK";
  status: "connected" | "syncing" | "error" | "disconnected";
  last_synced_at: string | null;       // ISO timestamp
  connected_at: string;
  connected_by_profile_id: string;
};
```

### Read endpoint

`GET /api/pos-accounts/list` → `{ accounts: PosAccount[] }`. Server-fetched in `page.tsx`, hydrated to client.

### Mutations (must route through capability tools, NOT inline Supabase)

- Connect: `pos_account_management.connect_lightspeed` (chat-only; web triggers via `<PosAccountsToolsBridge>` propose tool that opens Botsson with pre-filled context).
- Disconnect: `pos_account_management.disconnect` (chat-only; same bridge pattern, confirmation dialog on web first).

### Empty / loading / error states

- Loading: skeleton card grid with shimmer using `motionTokens.springGentle`.
- Empty: see anatomy above. Use ambient orb radial-gradient as background flourish.
- Error (connect failed): inline alert with `text-destructive` + Lightspeed-specific remediation hint ("Sjekk at K-Series API er aktivert i Lightspeed Backoffice").
- Status `error`: red pulse on card + inline error message + "Prøv på nytt"-button.

### Mobile

Per ADR-0133 boundary: POS = admin/Compose verb → web only. NO mobile route.

---

## 2. Shift Marketplace — web manager page

### Purpose

Manager/admin posts an open shift to the workforce, monitors claims, approves+confirms. Backend tools exist (`post_open`, `approve_claim`, `cancel_offer`, `list_open_offers`); Botsson chat handles `post_open` today, but managers want a visual board to see all open offers + claim status at a glance.

### Route + role

| | |
|---|---|
| Route | `/dashboard/marketplace/` |
| Role gate | `manager`, `admin`, or `owner` |
| Channel | `post_open` chat-only V1; `approve_claim` chat-only V1 (per ADR-0306); web page = chat-bridge + read-only dashboard |
| ADR | 0306 (open-shift marketplace), 0321 (V2 swap+marketplace convergence — future) |

### Page anatomy

| Block | Content |
|---|---|
| Page header | H1 `font-heading`: "Vaktbørs" + subtitle: "Tilby åpne vakter til hele teamet — første som klarer kravene godkjennes." |
| KPI strip (3 KpiAccentTile) | Åpne (count) · Krevet (count, awaiting approval) · Godkjent siste 7 dager (count) |
| Filter row | Department dropdown · status pills (Åpne / Krevet / Godkjent / Kansellert) · date range |
| Offer list (cards) | Each card: shift-date + time + role + department + open-since timestamp + claim-state pill + claimer name (if claimed) + 3-dot menu (Approve / Cancel) |
| Bottom CTA | "+ Tilby ny åpen vakt" — opens compose drawer |

### Compose flow (drawer)

Pre-flight: select existing unfilled `schedule_shift` (dropdown) OR create ad-hoc shift inline. Reason field (optional, free-text). Visibility: "Hele workspace" / "Spesifikk avdeling".

Submit: triggers `<MarketplaceComposeBridge>` which propose-tools the action to Botsson; Botsson confirms with manager via chat (per `post_open` chat-only V1), then `mutateWithGate` writes the offer.

### Approve flow (per card)

3-dot menu → "Godkjenn krav" → opens compact dialog with claimer profile (avatar + name + readiness score + role match badge) → manager clicks "Bekreft" → propose tool to `approve_claim` → Botsson chat confirmation → DB transition `claimed → approved` + `schedule_shift.assigned_profile_id` set.

### Cancel flow (per card)

3-dot menu → "Kanseller tilbud" → confirmation dialog ("Er du sikker? Krevende ansatt blir varslet.") → propose tool to `cancel_offer`. Both channels OK per ADR-0306.

### Data contract

```typescript
type OpenShiftOffer = {
  shift_offer_id: string;
  workspace_id: string;
  schedule_shift_id: string;
  posted_by_profile_id: string;
  posted_at: string;
  claim_window_until: string | null;     // optional expiry
  status: "open" | "claimed" | "approved" | "cancelled" | "expired";
  claimed_by_profile_id: string | null;
  claimed_at: string | null;
  approved_at: string | null;
  cancel_reason: string | null;          // L-0273 verified column name
  reason: string | null;                 // why offered (optional)
  visibility: "workspace" | "department";
  visibility_department_id: string | null;
  // joined fields for display
  shift: { date: string; start_time: string; end_time: string; role: string; department_name: string; };
  claimer: { profile_id: string; display_name: string; avatar_url: string | null; readiness_score: number | null; } | null;
};
```

### Read endpoints

- `GET /api/marketplace/offers` → `{ offers: OpenShiftOffer[] }` (filters via query params)
- Polling: `refetchInterval: 30_000` when tab focused (mobile pattern, applies here too)

### Mutations

All route through capability tools via `<MarketplaceToolsBridge>`. NEVER inline Supabase. Existing BFF: `apps/web/src/app/api/marketplace/action/route.ts` (already shipped — handles approve_claim + cancel_offer). New BFF needed: post_open route (currently only mobile flow exists).

### Empty / loading / error states

- Loading: 3 skeleton cards.
- Empty filter result: "Ingen åpne vakter akkurat nå." — small CTA "+ Tilby ny åpen vakt".
- Approve race (claimer no longer eligible): inline error + auto-refresh card.
- Cancel after claim: warn-confirm dialog first.

### Mobile

Already exists (`apps/mobile/app/(app)/(shifts)/marketplace.tsx`) — employee claim list. Manager web is the missing piece.

---

## 3. End-User Onboarding Manual — `/docs/manuals/world-best-wfm/`

### Purpose

Customers (workspace owners + managers + employees) need a written guide on how each capability works at the human level. Voice/chat alone is not sufficient for first-time setup or for offline reference. Manual lives in repo as Markdown so it ships with the product + can be linked from in-app help.

### File structure

```
docs/manuals/world-best-wfm/
├── README.md                          # Index — who-reads-what map
├── 01-pos-integration-admin.md        # Owner/admin: connect Lightspeed
├── 02-marketplace-manager.md          # Manager: post + approve open shifts
├── 03-marketplace-employee.md         # Employee: browse + claim shifts
├── 04-scheduler-manager-compose.md    # Manager: scheduler propose + accept (web)
├── 05-scheduler-manager-approve.md    # Manager: scheduler approve on mobile
└── assets/                            # Screenshots (post-design phase)
```

### Per-page template (write each manual to this shape)

```markdown
---
title: <Capability> — <Role>
audience: owner | admin | manager | employee
prerequisites: <what must be true before starting>
estimated_reading_time: <X min>
last_updated: YYYY-MM-DD
---

# <Capability> for <Role>

## What this capability does
2-3 sentences. Plain language. No ADR references.

## When to use it
Bullet list of trigger scenarios.

## Step-by-step: <golden path>
1. Step (with screenshot reference)
2. Step
...

## Step-by-step: <error recovery>
1. Step
...

## What you should see
Screenshot + caption per major state.

## Frequently asked
- Q: ... A: ...

## What if Botsson asks me to confirm?
Brief explanation of the chat-only confirmation pattern (per ADR-0078).

## Related
- Other manuals
- ADR references (linked, optional reading)
```

### Per-manual content scope

#### 01 POS Integration (admin/owner)

- What: connect Lightspeed K-Series so Smartout knows your real sales numbers.
- When: at workspace setup; or when adding a second location.
- Steps: navigate to `/dashboard/pos-accounts/` → "+ Koble til Lightspeed" → OAuth popup → return → verify "connected" pill.
- Error path: OAuth failure / API not enabled in K-Series Backoffice.
- FAQ: what data flows in (sales totals per hour, NOT individual transactions); when does first sync happen (within 5 min of connect).

#### 02 Marketplace Manager

- What: hand off an unfilled shift to the team — first qualified employee claims it, you approve.
- When: someone calls in sick, scheduler can't fill it, you don't have time to call around.
- Steps: navigate to `/dashboard/marketplace/` → "+ Tilby ny åpen vakt" → choose shift + reason → confirm in Botsson chat → see card appear in "Åpne" pill → wait for claim → 3-dot menu "Godkjenn krav" → confirm in Botsson chat → done.
- Visibility: workspace-wide vs single department.
- FAQ: can I cancel after someone claimed (yes, but they get notified); what happens if no one claims (offer expires per claim_window).

#### 03 Marketplace Employee

- What: see open shifts your colleagues posted, claim the ones that fit your schedule.
- When: you want extra hours, you saw a shift you can cover.
- Steps: open Smartout app → Vakter-tab → Vaktbørs → tap a card → "Krev denne vakten" → wait for manager approval → notification when approved.
- Mobile-only: this manual is for the phone app.
- FAQ: how do I know if I qualify (you'll see "Du oppfyller kravene" or "Mangler: <X>"); can I cancel my claim before approval (yes, in card menu).

#### 04 Scheduler Manager Compose (web)

- What: let Botsson generate a shift plan for the upcoming week, then review + accept.
- When: weekly planning, ad-hoc replan after big absence.
- Steps: navigate to `/dashboard/schedule/proposed-plan/` → "Generer forslag" → wait 10-30s → review proposal table → "Godta alle" or "Avslå" → confirm in Botsson chat.
- FAQ: how does Botsson decide (greedy constraint solver per ADR-0307; honors framework rules + tariff + availability + readiness); can I edit before accepting (V1: no, accept-or-reject; V2: shift-level edits planned).

#### 05 Scheduler Manager Approve (mobile)

- What: same proposal, mobile bundle view for accept/reject on the go.
- When: away from desk, urgent decision needed.
- Steps: open app → Vakter-tab → "Foreslått plan" → review BundleCard summary + ReadOnlyShiftList → "Godta alle" / "Avslå alle".
- Mobile-native: V1 has no per-shift edit (Compose verb stays web-only per ADR-0133).

### Out-of-scope for V1

- Video tutorials (defer to post-launch)
- Per-niche customization (one manual per role, niche differences in callouts)
- Localization beyond Norwegian (NB only V1; EN translation Phase 2)

---

## Open questions for Pontus (before page design starts)

1. **POS page header art** — same orb pattern as `/dashboard/setup/` or different ambient palette? (Lightspeed brand orange + Smartout warm OKLCH could clash if too literal.)
2. **Marketplace tab placement** — new top-level dashboard tab, or sub-tab under `/dashboard/schedule/`? (My recommendation: top-level — manager workflow is distinct from compose.)
3. **Manual delivery** — markdown only (in-app render via existing docs/ pipeline) OR also static-site export at `manuals.smartout.ai`? (Recommend: ship Markdown V1, defer site to Phase 2.)
4. **Compose drawer for `post_open`** — full-screen sheet (mobile pattern) or right-side drawer (desktop pattern)? Both work; pick once and reuse for `connect_lightspeed`.

## Implementation order (recommended)

| Step | What | Owner | ADR-0133 verb-class |
|---|---|---|---|
| 1 | Marketplace web manager page | sortie | Compose |
| 2 | POS admin page | sortie | Compose |
| 3 | Onboarding manuals (5 files) | docs sortie | n/a |
| 4 | Screenshots + asset capture | post-design | n/a |
| 5 | In-app help links from each surface | sortie | Witness |

Marketplace first — bigger ROI (managers use weekly), simpler scope (read-heavy + 2-3 actions). POS second (admin-only, less frequent). Manuals can run in parallel with steps 1-2.
