---
title: Contract Employee Module — Design Spec
status: in_progress
updated: 2026-04-30
created: 2026-04-30
module: contracts
tags: [contracts, design-spec, mobile, acknowledgement-ring, legal-evidence, §14-6, lovsen]
---

# Contract Employee Module — Design Spec
## 5 Journeys · Web + Mobile · AcknowledgementRing Legal-Evidence Flow

> **Nordic Split design system is authoritative.** All token references in this document map to
> `packages/design-tokens/src/tokens.ts` → `tokens.css` (web) → `native.ts` (mobile).
> Hardcoded colors, fonts, or magic-number motion values are forbidden.

---

## 0. Document Purpose and Scope

This spec retroactively covers the visual design contract for the employee contract module
(Phases 0–2 already shipped) and sets the standard for Phases 3–7 and all mobile screens.

**Why now:** Six ADRs, one sub-plan, and Phase 0/1/2 code shipped without a visual spec pass.
The implementation surfaces (`HrTabSections.tsx`, `CompositionDrawer.tsx`, `my-contract/page.tsx`)
were built to functional correctness — this document closes the design gap and governs all
forward work.

**Surfaces covered:**
- Web: `/dashboard/people/[id]` HR tab (admin compose)
- Web: `/dashboard/my-contract` (employee read-only fallback)
- Mobile: ContractInboxScreen, ContractDetailScreen, AcknowledgementRingScreen,
  PdfPreviewGateScreen, ContractSignScreen, biometric prompt, push notifications
- Shared components: AcknowledgementRing, TariffBadge, RevealableField,
  ContractAmendmentDiff, DestructiveConfirmDialog, MutationDropdownMenuItem,
  UnsavedChangesGuard

**ADR authority chain for this spec:**
- `docs/decisions/0245-employee-contract-mobile-flow.md` (ADR-0245) — mobile flow architecture
- `docs/decisions/0244-amendment-flow-acknowledgement-as-legal-evidence.md` (ADR-0244) —
  legal-evidence chain, WCAG AAA, per-block timestamps, Lovsen amendment notes
- `docs/decisions/0241-contract-schema-migration-foundation.md` (ADR-0241) — schema,
  Lovsen amendments, `constructive_dismissal_risk` flag
- `docs/decisions/0242-contract-payroll-capability-split.md` (ADR-0242) — high-PII isolation
- `docs/decisions/0078-engine-process-channel-restriction.md` (ADR-0078) — voice forbidden
  for personnummer/bank/amounts
- `docs/decisions/0133-web-composes-mobile-executes.md` (ADR-0133) — surface boundary

---

## 1. Design Principles

### Why contracts deserve first-class design

A contract is not a form. It is a legal instrument under Norwegian arbeidsmiljøloven §14-6.
When an employee signs their arbeidsavtale in Smartout, they are creating a legally binding
record with consequences for both parties. The visual design must communicate:

1. **Weight and permanence.** The signing moment must feel deliberate, not casual. A button
   that looks like "add to cart" for a legal commitment is a liability — literally.

2. **Trust signals.** High-PII data (personnummer, kontonummer, lønn) demands masked-by-default
   treatment with explicit reveal gestures. The visual feedback of a `RevealableField` is not
   cosmetic — it is the UX enforcement of ADR-0242 isolation policy.

3. **Legal-evidence chain visibility.** The `AcknowledgementRing` component exists because
   ADR-0244 requires per-block timestamps as legal evidence of informed consent. The design
   must make the chain visible and credible — each block acknowledged, each timestamp
   machine-readable and human-readable.

4. **Constructive dismissal protection.** ADR-0241 introduces the `constructive_dismissal_risk`
   flag. When this flag is true, the visual design is the last line of defense before an
   admin accidentally sends a contract that constitutes illegal pressure. The banner is not
   a warning toast — it is a hard gate.

5. **Nordic warmth at a serious moment.** The design language does not become cold or clinical
   to signal seriousness. Nordic Split warmth (OKLCH hue 50-60 surfaces, spring physics, ambient
   glow) is the trust signal. A cold grey form says "bureaucracy." A warm, considered, deliberate
   interface says "we take this seriously and so should you."

### Design constraints non-negotiable for this module

- Every interactive element must have a `focus-visible` ring meeting WCAG AAA contrast
  per ADR-0244 line 70-74.
- No voice channel for any PII per ADR-0078. The Botsson Orb must suppress to passive
  mode on all contract screens per L-0178 + ADR-0238 (salary queries routed to chat-only
  Botsson surface, never voice).
- Mobile is the primary signing surface per ADR-0245. Web is a read-only fallback.
- All data reads in this module must use the payroll capability isolation boundary per ADR-0242.

---

## 2. Tone and Norwegian Copy Guidelines

### Register matrix

| Surface | Audience | Register | Example |
|---------|----------|----------|---------|
| HR tab field labels | Admin | Formell, norsk bokmål | "Stillingstittel", "Ansettelsesdato" |
| HR tab validation errors | Admin | Direkte, ikke-aggressiv | "Feltet er påkrevd for §14-6-kontrakt" |
| CompositionDrawer | Admin | Profesjonell, handlingsorientert | "Send kontrakt til [Navn]" |
| AcknowledgementRing blocks | Employee | Varm + tydelig, ikke-juridisk | "Her ser du din stillingsbeskrivelse" |
| PDF preview gate | Employee | Rolig, ingen hastverk | "Les kontrakten nøye før du signerer" |
| Biometric prompt | Employee | Kortfattet, trygg | "Bekreft med Face ID" |
| Push notifications | Employee | Kort, handlingsorientert | "Ny kontrakt klar til signering" |
| Constructive dismissal banner | Admin | Advarende, eksplisitt | "Denne endringen kan utgjøre endringsoppsigelse" |
| Amendment review | Employee | Nøytral, komparativ | "Dette har endret seg i kontrakten din" |

### Lovsen-review-ready legal copy

The following copy has been pre-staged for review by arbeidsrettsadvokat (per ADR-0244 and
ADR-0241 Lovsen amendment notes). Do not change without a new Lovsen review cycle.

**§14-6 field completion notice:**
> "Kontrakten din inneholder alle påkrevde opplysninger etter arbeidsmiljøloven §14-6."

**Amendment summary header:**
> "Arbeidsgiveren foreslår en endring i arbeidsavtalen din. Les nøye gjennom hva som er endret."

**Constructive dismissal warning (admin-facing):**
> "Advarsel: Denne endringen kan oppfattes som endringsoppsigelse etter arbeidsmiljøloven.
> Vi anbefaler at du konsulterer en arbeidsrettsadvokat før du sender denne kontrakten."

**AcknowledgementRing block CTA:**
> "Jeg har lest og forstått dette"

**PDF preview gate instruction:**
> "Scroll til bunnen av kontrakten for å aktivere signeringsknappen."

**Biometric failure:**
> "Vi kan ikke bekrefte deg. Logg ut og inn igjen, eller kontakt administrator."

**Amendment constructive dismissal acknowledgement checkbox:**
> "Jeg bekrefter at jeg har vurdert risikoen for endringsoppsigelse og ønsker å gå videre."

### Standard CTAs (frozen — do not vary)

| Context | Norwegian CTA | English fallback |
|---------|---------------|------------------|
| Admin sends contract | "Send kontrakt" | "Send contract" |
| Employee initiates signing | "Sign nå" | "Sign now" |
| Cancel any flow | "Avbryt" | "Cancel" |
| Employee declines | "Avslå" | "Decline" |
| Employee accepts amendment | "Aksepter endring" | "Accept amendment" |
| Close without action | "Lukk" | "Close" |
| Admin confirms send | "Bekreft og send" | "Confirm and send" |
| Employee re-signs after amendment | "Gjennomgå og signer på nytt" | "Review and re-sign" |

### Forbidden phrases

These phrases may create legal risk or mislead the employee. They are forbidden in all copy:

- Any phrasing implying the employee "chooses" to accept a constructive dismissal, e.g.
  "Du godtar disse endringene frivillig."
- Any phrasing suggesting the employee waives rights by signing, unless explicitly reviewed
  by Lovsen and marked as approved.
- "Oppsigelse med tilbud om ny stilling" — use "endringsoppsigelse" which is the legally
  precise term.
- Colloquial "bare sign her" — always use the full CTA "Sign nå."
- Any phrasing suggesting urgency around signing, e.g. "Du må signere innen 24 timer."
  (Due dates may be communicated as obligation chips, not imperative copy.)

---

## 3. Journey 1 — Define (Admin `/dashboard/people/[id]`)

**Reference implementation:** `apps/web/src/app/dashboard/people/[id]/complete-data/HrTabSections.tsx` (60.8 KB)

### 3.1 HR Tab Visual Hierarchy

The HR tab currently renders as a long vertical form. The spec calls for grouping the 15
§14-6 mandatory fields into six logical clusters, each rendered as a visually distinct
section with a spacious header and 40%-reduced border density.

**Six clusters:**

| Cluster | Fields | Visual weight |
|---------|--------|---------------|
| Identifikasjon | Fullt navn, personnummer, adresse | Secondary — `bg-muted`, small label |
| Ansettelse | Stillingstittel, ansettelsesdato, type (fast/midlertidig), oppsigelsestid | Primary — `bg-background`, larger label |
| Arbeidstid | Stillingsprosent, timer per uke, arbeidssted | Primary |
| Lønn | Lønnstrinn/sats, lønnsprofil-ref, tipsregel-ref | High-PII — RevealableField treatment |
| Varighet | Sluttdato (if midlertidig), prøvetidsperiode | Conditional — only shown if relevant |
| Opplæring | Onboarding-obligasjoner count, protokoll-count | Read-only summary row |

**Layout:**

```
[ Cluster header — large text, no box border, warm left-accent line 2px bg-primary/20 ]
  Field row: label (text-muted-foreground, 12px) · value (text-foreground, 15px)
  [ ... ]
[ Cluster header ]
  [ ... ]
```

The 40% reduction principle applies: remove all card borders between clusters.
Use vertical space (24px gap between clusters, 12px between fields) and the warm left-accent
line as the only visual separator.

Font: Geist Sans throughout. Cluster headings: `text-sm font-semibold text-muted-foreground
uppercase tracking-wide`. Field values: `text-foreground font-mono` for numeric data
(personnummer, lønn, arbeidstimer), Geist Sans for text data.

### 3.2 Status Badges

A status badge sits at the top of the HR tab, always visible:

| State | Badge label | Token | Icon |
|-------|------------|-------|------|
| All §14-6 fields complete, not sent | "Klar til å sende" | `bg-success/15 text-success` | CheckCircle (Lucide) |
| Missing fields | "Mangler N felt av M" | `bg-warning/15 text-warning` | AlertCircle |
| Contract active | "Aktiv" | `bg-primary/15 text-primary` | FileCheck |
| Contract overdue | "Forfalt" | `bg-destructive/15 text-destructive` | Clock |

Badge anatomy: `px-3 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1.5`.
No border on badges — background color provides sufficient container signal.

Motion: badge state transitions use `motionTokens.springSnappy`
(`{ stiffness: 45, damping: 24, mass: 2 }`) with `layout` prop from Framer Motion.
Width animates when label text changes length.

### 3.3 Lønnsprofil Section

**Reference implementation:** `apps/web/src/app/dashboard/people/[id]/_components/LonnsprofilSection.tsx` (Wave 5 commit `65dd47ec9`)

High-PII fields (timelønn, fastlønn, bonusprosent, kontonummer) use `RevealableField`
treatment (see Section 8.2). By default, all salary values are masked: `•••• kr/t`.

The Lønnsprofil section heading carries an explicit trust signal:
```
[ ShieldCheck icon, 16px, text-muted-foreground ]  Lønnsprofil  [ Locked badge ]
```
The locked badge reads "Begrenset tilgang" in `text-muted-foreground text-xs`.

**PII disclosure notice** (always visible, under the section heading):
> "Lønnsdata er kun synlig for deg og HR-ansvarlige. Tilgang logges."

This copy is `text-muted-foreground text-xs` italic, not a warning — it is ambient trust.

### 3.4 Tipsregel Modal

**Reference implementation:** `apps/web/src/app/dashboard/people/[id]/_components/TipsregelModal.tsx` (Wave 5 commit `65dd47ec9`)

The `distribution_method` field has four enum values. These must be rendered as cards,
not a `<select>`. The modal is full-width on mobile, 480px max-width centered on desktop.

**Card layout (vertical stack on all breakpoints):**

```
[ Card: distribution_method = 'individual' ]
  Icon: User (Lucide)  ·  "Individuelt tips"
  Description: "Tips fordeles til den ansatte som mottok det"

[ Card: distribution_method = 'pool_equal' ]
  Icon: Users  ·  "Lik fordeling"
  Description: "Tips deles likt mellom alle på vakten"

[ Card: distribution_method = 'pool_weighted' ]
  Icon: Scale  ·  "Vektet fordeling"
  Description: "Tips fordeles etter arbeidstimer"

[ Card: distribution_method = 'none' ]
  Icon: Ban  ·  "Ingen tips"
  Description: "Ansatt mottar ikke tips"
```

Card anatomy: `border border-border rounded-xl p-4 cursor-pointer transition-colors`.
Selected state: `border-primary bg-primary/5`. Hover state: `bg-muted/50`.
No motion on card selection — instant color swap (`transition-colors duration-150`).
This is an exception to the spring-first rule because it is a form control, not content.

The modal footer has two actions: "Avbryt" (ghost) + "Lagre" (primary). The "Lagre" button
is disabled until a card is selected.

### 3.5 Inline Validation Feedback

All required fields for §14-6 show inline validation. Validation runs on blur, not on change.

**Error state:**
- Border: `border-destructive`
- Below-field copy: `text-destructive text-xs` with AlertCircle icon (14px, inline)
- Example: "⚬ Stillingstittel er påkrevd for §14-6-kontrakt"

**Warning state** (field present but potentially incomplete, e.g. sluttdato missing for
midlertidig):
- Border: `border-warning`
- Below-field copy: `text-warning text-xs` with AlertTriangle icon

**Success state** (field complete):
- No border change — success is the default, not a special state
- Exception: personnummer field shows `CheckCircle` icon on valid format (11 digits)

Motion: error/warning appearance uses `motion.initial { opacity: 0, y: -4 }` →
`animate { opacity: 1, y: 0 }` with `motionTokens.springSnappy`.

---

## 4. Journey 2 — Send (Admin CompositionDrawer)

**Reference implementation:** `apps/web/src/components/contracts/CompositionDrawer.tsx`

### 4.1 2-Step Drawer Architecture

The `CompositionDrawer` is a right-panel drawer (width: `min(480px, 100vw - 48px)`) with
two sequential steps rendered inside a single scroll container:

**Step 1: Mal-valg**
- Heading: "Velg kontraktmal" (`font-heading text-xl`)
- Template list: one card per available mal, showing name, last-updated date, TariffBadge
- Selected template: `border-primary bg-primary/5` ring
- "Neste" button activates only when a template is selected

**Step 2: Forhåndsvisning + AcknowledgementRing**
- Heading: "Gjennomgå kontrakten" (`font-heading text-xl`)
- Framework snapshot freeze badge (see 4.3)
- AcknowledgementRing (see 4.2)
- TariffBadge (see Section 8.2)
- Primary CTA: "Send kontrakt" with confirm-modal (see 4.4)

Step transitions: `AnimatePresence` with `motion.div` sliding out left (`x: -20, opacity: 0`)
and new step sliding in from right (`x: 20, opacity: 0`) → `{ x: 0, opacity: 1 }`.
Spring: `motionTokens.spring` (`{ stiffness: 35, damping: 22, mass: 2.2 }`).

### 4.2 AcknowledgementRing — Web Layout Decision

Three options were evaluated:

**Option A — Horizontal ring:** 4 blocks displayed as a horizontal progress chain with
connecting lines. Block status: empty circle → filled circle with checkmark. Clicking each
block expands an accordion with the block content.

**Option B — Stacked cards:** 4 blocks rendered as full-width cards in a vertical list.
Each card has a header (block title) and expandable body. An overall "All reviewed" badge
at top updates as each card is acknowledged.

**Option C — Stepper:** Linear top-bar with numbered steps (1–4). One block visible at a
time; "Neste blokk" advances.

**Recommendation: Option B — Stacked cards.**

Rationale: The horizontal ring (A) compresses information into a narrow affordance that
does not communicate content weight on desktop. The stepper (C) is appropriate for mobile
(sequential AcknowledgementRingScreen — see Section 5.3) but on desktop forces the admin
through a linear flow when they may want to jump to a specific block. Stacked cards allow
non-linear review, keep all content scannable, and communicate the four blocks as four
distinct legal sections rather than a progress meter.

**Stacked card anatomy:**

```
[ Block card ]
  Header row: [ numbered dot ] [ block title ] [ "Gjennomgått" badge OR empty ]
  Expandable body (default: collapsed for blocks 2–4, expanded for block 1):
    Block text content (Geist Sans, text-foreground, line-height-relaxed)
    [ "Merk som gjennomgått" button — ghost, small ] (until acknowledged)
    [ CheckCircle + "Gjennomgått [timestamp]" ] (after acknowledged)
```

After all 4 blocks acknowledged, the stacked cards region transitions to a summary state:
```
[ CheckCircle icon, 20px, text-success ]
"Alle nøkkelblokker er gjennomgått"
[ Timestamp of last acknowledgement ]
```
This state enables the "Send kontrakt" button.

### 4.3 Framework Snapshot Freeze Badge

When the admin reaches Step 2, the active `regulatory_framework` and `tariff_rate_table`
are frozen into `framework_snapshot` on the contract draft (per ADR-0241 schema).
The UI must communicate this freeze:

```
[ Snowflake icon (Lucide), 14px, text-muted-foreground ]
"Frosset: [date] — Tarifffastsettelse låst til regelverket gjeldende på sendedato"
```

Token: `bg-muted/50 border border-border/50 rounded-lg px-3 py-2 text-xs text-muted-foreground`.

If the admin revisits the drawer before sending and the framework has drifted (newer
tariff available), the TariffBadge shows `drift` state (see Section 8.2) and an inline
prompt appears:
> "Tariffgrunnlaget har endret seg siden du åpnet skjemaet. Vil du oppdatere til nyeste versjon?"
Actions: "Oppdater" (primary) + "Behold nåværende" (ghost).

### 4.4 Send-CTA with Confirm Modal

"Send kontrakt" is a primary button (`bg-primary text-primary-foreground`) in the drawer
footer. It is disabled until AcknowledgementRing is complete.

Clicking "Send kontrakt" opens a `DestructiveConfirmDialog` (see Section 8.5) with:
- Title: "Send kontrakt til [Ansatts fulle navn]?"
- Body: "Kontrakten vil sendes til ansattes e-post og mobilapp. Ansatte vil bli bedt om å signere."
- Confirm CTA: "Bekreft og send" (primary)
- Cancel: "Avbryt" (ghost)

Loading state after confirm: the drawer's primary button shows a spinner (Loader2, Lucide,
16px, `animate-spin`). The drawer is non-dismissible during the send operation.

On success: drawer closes with spring exit animation, a `sonner` toast fires:
> "Kontrakt sendt til [Navn]."

On error: toast fires with destructive variant:
> "Sending feilet. Prøv igjen eller kontakt support."

---

## 5. Journey 3 — Sign (Employee Mobile-First per ADR-0245)

**ADR authority:** `docs/decisions/0245-employee-contract-mobile-flow.md`

Per ADR-0133 (`docs/decisions/0133-web-composes-mobile-executes.md`), signing is a mobile
execution verb. Web provides a read-only fallback. Mobile is the canonical signing surface.

### 5.1 ContractInboxScreen

**Layout:** Full-screen list, `bg-background`, safe-area aware.

**Top area:**
```
[ Back chevron ]  "Kontrakter"  [ (empty for now — future: filter) ]
```

**Section: Ventende signering** (if any pending):
- Section header: `text-muted-foreground text-xs font-semibold uppercase tracking-wide px-4 pt-4 pb-2`
- Each pending contract: card with `bg-card border border-border rounded-2xl mx-4 mb-3 p-4`
  - Top row: Company name (font-semibold) + TariffBadge (small, right-aligned)
  - Middle: Stillingstittel (text-foreground) + Ansettelsesdato (text-muted-foreground text-sm)
  - Bottom: "Due-soon" obligation chip if signing deadline within 7 days:
    `bg-warning/15 text-warning text-xs px-2 py-0.5 rounded-full`
    Copy: "Fristen er om [N] dager"
  - Sign badge: a pulsing warm dot (3px, `bg-primary`, `animate-pulse`) + "Signer nå" in
    `text-primary text-sm font-medium`

**Section: Aktive kontrakter** (signed, no action needed):
- Same card anatomy, no sign badge, no pulse, status = "Aktiv" badge

**Empty state:**
```
[ FileText icon, 48px, text-muted-foreground/50 ]
"Ingen kontrakter ennå"
[ text-muted-foreground text-sm ]
```

**Push-driven refresh:** Screen listens to realtime channel `contracts:employee:[profile_id]`.
On new contract push, a notification banner slides in from top (spring entrance):
> "Ny kontrakt fra [Arbeidsgiver]. Trykk for å åpne."

### 5.2 ContractDetailScreen

**Layout:** ScrollView with sticky header.

**Sticky header:**
```
[ Back chevron ]  [ Company name truncated ]  [ "Signer nå" button if pending ]
```

**Hero section:**
```
[ bg-card rounded-3xl mx-4 mt-4 p-6 ]
  Stillingstittel — font-heading text-2xl text-foreground
  Arbeidsgiver — text-muted-foreground text-base
  Ansettelsesdato — text-muted-foreground text-sm
  [ TariffBadge ]
  [ ContractStatusBadge ]
```

**Framework section:**
```
Tariff og regelverk
  [Framework name]  ·  [Snapshot date badge if frozen]
```

**Obligation list:**
Each obligation rendered as a row:
```
[ CheckCircle (complete) or Circle (pending) ]  Protokoll: [name]
[ text-muted-foreground text-sm ] Frist: [date or "Ingen frist"]
```
Tapping a pending obligation deep-links to the protocol/procedure screen.

**Signing CTA (if pending):**
Full-width primary button fixed at bottom (above safe area):
```
[ bg-primary text-primary-foreground rounded-2xl py-4 mx-4 ]
"Gjennomgå og signer kontrakt"
```
Tapping this enters the AcknowledgementRingScreen flow.

### 5.3 AcknowledgementRingScreen (Sequential Blocks)

**This is the legal-evidence-critical screen per ADR-0244.**

**Layout:** Full-screen single-block reader. No scroll — one block fills the viewport.
This is the mobile counterpart to the web's stacked cards. The deliberate constraint of
one-block-at-a-time prevents the employee from scrolling past blocks without reading.

**Header (sticky):**
```
[ "Tilbake" ghost button, left ]
  "Blokk [N] av [M]"  ← center, text-foreground font-semibold
[ (empty right — no skip allowed) ]
```

`accessibilityLiveRegion="polite"` on the "Blokk N av M" text.
`aria-label="Du er på blokk N av totalt M blokker"` on the wrapper.

**Block content area:**
```
[ ScrollView, full height minus header and footer ]
  Block title — font-heading text-xl mb-4
  Block body — text-foreground text-base line-height-relaxed
    (Geist Sans, 16px, 1.6 line-height — optimized for sustained reading)
```

**Footer (fixed above safe area):**
```
[ bg-background/95 backdrop-blur-sm border-t border-border/50 ]
  [ Timestamp of this block's acknowledgement, if already done:
    "Bekreftet kl. HH:MM" text-muted-foreground text-xs ]
  [ "Jeg har lest og forstått dette" — full-width primary button ]
```

The CTA is always enabled (the employee can acknowledge at any scroll position). The per-block
timestamp is recorded server-side the moment the employee taps the CTA
(per ADR-0244 legal-evidence chain requirements).

**Block-to-block transition:**
`AnimatePresence` with horizontal swipe-like transition:
- Exiting block: `x: 0 → x: -screenWidth` with opacity 0 → 0
- Entering next block: `x: screenWidth → x: 0` with opacity 0 → 1
- Spring: `motionTokens.spring` (`{ stiffness: 35, damping: 22, mass: 2.2 }`)
- Entrance duration guided by `motionTokens.enterMs` (500ms)

**After all blocks acknowledged:**
A completion screen appears (same full-screen layout):
```
[ CheckCircle icon, 64px, text-success, scale entrance spring ]
"Du har gjennomgått alle delene av kontrakten"
[ text-muted-foreground text-sm ]
"Neste steg: Les gjennom og signer PDF-kontrakten"
[ "Gå til kontrakt" primary button, full-width ]
```

**Per-block timestamp visualization:**
A thin progress bar below the sticky header. Each block gets one segment. Completed
segments: `bg-primary`. Current segment: animated fill from 0% → 100% as the employee
scrolls (scroll-driven, not time-driven). Future segments: `bg-muted`.

### 5.4 PdfPreviewGateScreen

**Layout:** Full-screen with embedded PDF viewer (`react-native-pdf`) and a fixed footer.

**Header:**
```
[ "Tilbake" ghost button ]  "Din kontrakt"
[ "Del" icon button, right — share sheet for PDF ]
```

**PDF area:** Full remaining height. React Native PDF viewer renders the DocuSeal-generated
PDF document. Pinch-to-zoom enabled.

**Scroll-to-end detection:** A flag `hasScrolledToEnd` is false until the user scrolls within
200px of the PDF bottom. This is detected via the PDF viewer's `onPageChanged` callback
combined with total page count.

**Footer (fixed):**
While `hasScrolledToEnd === false`:
```
[ bg-background border-t border-border px-4 py-4 ]
"Les gjennom kontrakten for å aktivere signeringsknappen"
[ text-muted-foreground text-xs, centered ]
[ "Signer kontrakt" — full-width button, DISABLED, opacity 0.5 ]
```

When `hasScrolledToEnd === true`, the footer transitions:
- The instruction text fades out (`motionTokens.exitMs`)
- The button becomes enabled and animates to full opacity (`motionTokens.enterMs`)
- A subtle upward scale (`scale: 0.98 → 1.0`) with `motionTokens.springSnappy`

The scroll-to-end gate is per ADR-0244's requirement for obligatorisk PDF preview before
signing.

### 5.5 ContractSignScreen

**Layout:** Full-screen WebView embedding the DocuSeal signing interface.

**Native shell wrapper:**
```
[ Safe-area-aware container, bg-background ]
  [ Header: "Signer kontrakt" + company name, height 44px ]
  [ WebView: DocuSeal, flex: 1 ]
  [ Footer: "Avbryt" ghost button, only shown if signingState !== 'completed' ]
```

The header is native (React Native), not part of the WebView, to prevent spoofing.

**WebView navigation guard:** `onNavigationStateChange` handler prevents the WebView from
navigating away from the DocuSeal domain. Any unexpected navigation shows a native alert:
> "Navigering utenfor signeringssiden er ikke tillatt."

**On signing complete:** DocuSeal fires a `postMessage` with `{ type: 'signing_complete' }`.
The native handler:
1. Dismisses the WebView
2. Triggers biometric confirmation (see 5.6)
3. Emits the C4 governance acceptance event

### 5.6 Biometric Prompt UX

Biometric confirmation occurs after DocuSeal signing completes, before the C4 acceptance
event is emitted. This is per ADR-0245 Section D (biometric gate).

**Screen layout:** Full-screen, centered, dark overlay over the blurred previous screen.

```
[ bg-background/95 backdrop-blur-xl rounded-3xl mx-6 p-8 ]
  [ company icon / contract icon, 48px ]
  "Bekreft signeringen din"
  [ text-muted-foreground text-sm ]
  "Bruk Face ID for å bekrefte at du har signert kontrakten."
  [ Spacer ]
  [ Native biometric prompt trigger button, styled as primary, full-width ]
  "Bekreft med Face ID"  (or "Bekreft med Touch ID" per device capability)
  [ Spacer ]
  [ "Avbryt" ghost button, text-muted-foreground ]
```

**3-retry pattern:**

- Attempt 1 failure: toast "Face ID gjenkjente deg ikke. Prøv igjen." — retry button remains.
- Attempt 2 failure: same toast, retry remains.
- Attempt 3 failure: screen transitions to hard failure state:

```
[ XCircle icon, 48px, text-destructive ]
"Vi kan ikke bekrefte deg."
[ text-muted-foreground text-sm ]
"Logg ut og inn igjen, eller kontakt administrator."
[ "Logg ut" primary button ]
[ "Kontakt support" ghost button ]
```

No more retries. The signing is not finalized until biometric succeeds or admin manually
overrides from the web dashboard (future Phase 7 capability).

**Reduced-motion guard:** `useReducedMotion()` from React Native's `AccessibilityInfo`.
If true, all spring entrance/exit animations for this screen are replaced with instant
opacity transitions.

### 5.7 Push Notification Design

Per ADR-0245 Section H. All push payloads must respect APNs/FCM constraints (no PII in
payload — personnummer, lønn, kontonummer must never appear in notification body).

**Notification types and copy:**

| Type | APNs title | APNs body | Deep-link |
|------|-----------|-----------|-----------|
| New contract | "Ny kontrakt fra [Arbeidsgiver]" | "Gjennomgå og signer din arbeidsavtale" | `smartout://contracts/[id]` |
| Due soon (3 days) | "Kontrakt venter på signering" | "Fristen er om 3 dager" | `smartout://contracts/[id]` |
| Overdue | "Kontrakten din er forfalt" | "Ta kontakt med administrator" | `smartout://contracts/[id]` |
| Amendment | "Endring i arbeidsavtalen din" | "Arbeidsgiveren foreslår en endring. Se detaljer." | `smartout://contracts/[id]/amendment` |
| Signing confirmed | "Kontrakt signert" | "Din signering er bekreftet og registrert." | `smartout://contracts/[id]` |

**Iconography:**

- Contract icon: `contract` APNs category with a document+pen icon (configured in
  `apps/mobile/src/lib/notifications/categories.ts`)
- Due-soon: clock overlay badge on document icon
- Overdue: red badge on document icon
- Amendment: document with diff lines icon

**Payload shape** (no PII):
```json
{
  "aps": {
    "alert": { "title": "...", "body": "..." },
    "badge": 1,
    "sound": "default",
    "category": "CONTRACT_ACTION"
  },
  "contractId": "[uuid]",
  "type": "new_contract | due_soon | overdue | amendment | signed"
}
```

`contractId` is a UUID — not a PII value. The app resolves the contract details from the
API on tap, not from the payload.

### 5.8 Web Fallback `/dashboard/my-contract`

**Reference implementation:** `apps/web/src/app/dashboard/my-contract/page.tsx` (23.8 KB)

The web fallback is read-only for employees. It does not support signing (per ADR-0133
and ADR-0245 Section B). Its purpose is to let employees review their contract on desktop
without the mobile app.

**Layout:**

```
[ Hero card: bg-card border border-border rounded-3xl p-8 max-w-2xl mx-auto mt-8 ]
  Stillingstittel — font-heading text-3xl
  Arbeidsgiver — text-muted-foreground text-lg
  Ansettelsesdato — text-muted-foreground text-sm
  [ TariffBadge ]
  [ Status: "Aktiv" or "Venter på signering" ]

[ Separator with label "Din kontrakt" ]

[ Obligation list section ]
  Each obligation: icon + title + status + deep-link button

[ "Signer på mobil" section — if signing is pending ]
  [ Smartphone icon, 32px, text-primary ]
  "Signing skjer på mobilappen"
  "Last ned Smartout-appen for å signere arbeidsavtalen din."
  [ App Store / Google Play badges — OPEN QUESTION: see Section 11 ]
  [ "Send lenke til telefon" button — OPEN QUESTION: see Section 11 ]
```

**"Continue on phone" CTA:** This is flagged as an open design question in Section 11.

---

## 6. Journey 4 — Enforce (Mobile Clock-In + Push)

### 6.1 ObligationBlocker Component

When an employee has a blocking obligation (e.g., an unacknowledged protocol required before
starting work), the clock-in flow is interrupted with a full-screen blocker.

**Visual spec:**

```
[ Full-screen, bg-background, safe-area aware ]

[ Center content: ]
  [ AlertTriangle icon, 64px, text-warning, slight bounce entrance spring ]
  "Du kan ikke starte vakten ennå"  — font-heading text-2xl text-foreground text-center
  [ Spacer 16px ]
  Reason text (from obligation.blocking_reason or default):
  "Du må fullføre [Protokoll: Navn] før du starter."
  — text-muted-foreground text-base text-center max-w-sm

  [ Spacer 32px ]

  [ Primary button, full-width ]
  "Fullfør protokoll"
  → deep-links to the protocol completion flow

  [ Ghost button, full-width, mt-3 ]
  "Kontakt administrator"
  → opens Botsson chat (salary/obligation queries — chat only per ADR-0078)

[ Bottom: Cannot dismiss. No back button visible. ]
```

The blocker is cannot-dismiss by design. The only exits are:
1. Complete the obligation (returns to clock-in on success)
2. Contact admin via chat (Botsson chat surface, not voice — ADR-0078)

The native back gesture is suppressed via `usePreventRemove` hook while the blocker is active.

**Reduced-motion guard:** AlterTriangle entrance uses `motionTokens.springGentle`
(`{ stiffness: 30, damping: 20, mass: 2.5 }`). With `useReducedMotion()` true: no animation.

### 6.2 Salary-Query Botsson Chat Surface

Per ADR-0078 (`docs/decisions/0078-engine-process-channel-restriction.md`):
> Voice is forbidden for personnummer, bank data, and amounts.

Salary queries from employees (e.g., "Hva er timelønnen min?" during clock-in or on the
contract detail screen) must route to the Botsson chat surface exclusively.

On any screen where salary data is contextually relevant, the Botsson Orb suppresses to
passive mode (icon-only, "Botsson ser på denne siden" tooltip) per L-0178 + ADR-0238.

A dedicated "Spør Botsson" chip appears on the ContractDetailScreen (employee):
```
[ bg-muted rounded-full px-4 py-2 inline-flex items-center gap-2 ]
[ MessageSquare icon, 14px ]  "Spør om lønnen din"
```
This chip opens the Botsson chat drawer (not voice). The chat is pre-seeded with context:
`"Medarbeider [name] spør om lønn for kontrakt [id]."` — Botsson knows the contract context
without the employee typing it.

### 6.3 Daily Push for Due-Soon Obligations

Sent at 08:00 local time, one per day, for any obligation with deadline within 7 days:

| Title | Body |
|-------|------|
| "Huskeliste for i dag" | "Du har [N] protokoller som utløper snart. Se kontrakten din." |

Deep-link: `smartout://contracts/obligations` (obligation list screen).
The notification batches all due-soon obligations into one — never one push per obligation
(notification fatigue prevention).

---

## 7. Journey 5 — Amendment (Admin Proposes → Employee Re-Signs)

**ADR authority:** ADR-0244 (`docs/decisions/0244-amendment-flow-acknowledgement-as-legal-evidence.md`)
**Schema:** ADR-0241 Section §5.4 (`docs/decisions/0241-contract-schema-migration-foundation.md`)

### 7.1 Admin Amendment Composer

The admin initiates an amendment from the HR tab. Two amendment types per ADR-0241 §5.4:

**Type A — Stillingsendring:** Role change, position change, or material employment change.
These are higher-risk and have a higher likelihood of triggering `constructive_dismissal_risk`.

**Type B — Justering:** Salary adjustment, hours adjustment, location change. Lower risk but
still require employee re-signing per §14-6.

The amendment type selector is a two-card picker (same pattern as Tipsregel modal):
```
[ Card: type_a — "Stillingsendring" ]
  Briefcase icon · "Endring i stilling, rolle eller ansvarsområde"

[ Card: type_b — "Justering" ]
  Edit icon · "Justering av lønn, arbeidstid eller arbeidssted"
```

After type selection, the admin sees a field-level diff editor:
- Only changed fields are shown (ADR-0244 mandates field-level only diff)
- Each field shows: old value → new value, with `bg-destructive/10` on old,
  `bg-success/10` on new

### 7.2 Constructive Dismissal Risk Banner

When `constructive_dismissal_risk === true` (set by the server-side logic in ADR-0241):

```
[ Full-width banner, ABOVE the amendment form, cannot scroll past ]
[ bg-destructive/10 border border-destructive/50 rounded-xl p-4 mx-0 ]
[ AlertTriangle icon, 20px, text-destructive ]
"Advarsel: Endringsoppsigelse"
[ text-destructive font-semibold text-base ]

"Denne endringen kan oppfattes som endringsoppsigelse etter arbeidsmiljøloven.
Vi anbefaler at du konsulterer en arbeidsrettsadvokat før du sender denne kontrakten."
[ text-destructive/80 text-sm mt-2 ]

[ Checkbox + label — REQUIRED before "Send" activates ]
[ Checkbox: border-destructive, checked state: bg-destructive text-destructive-foreground ]
"Jeg bekrefter at jeg har vurdert risikoen for endringsoppsigelse og ønsker å gå videre."
```

The "Send kontrakt" / "Send endringsforslag" button remains disabled until the checkbox
is checked. The checkbox is not pre-checked.

This banner is per ADR-0244 line 114 (cited directly).

### 7.3 Employee Amendment Review Screen

The employee receives a push notification (type: `amendment`). On opening:

**Mobile layout:**

```
[ Header: "Endring i arbeidsavtalen din" ]

[ Info banner: bg-muted border border-border rounded-xl p-4 mx-4 mt-4 ]
[ Info icon ] "Arbeidsgiveren foreslår en endring. Les nøye gjennom hva som er endret."

[ Diff section — field-level only per ADR-0244 ]
  For each changed field:
  [ Field name — text-muted-foreground text-sm uppercase tracking-wide ]
  [ Old value — bg-destructive/10 text-destructive rounded px-2 py-1 line-through ]
  [ Arrow right icon ]
  [ New value — bg-success/10 text-success rounded px-2 py-1 ]

[ Spacer ]

[ Footer: two full-width actions ]
  [ "Avslå endring" ghost/destructive variant ]
  [ "Aksepter endring" primary — leads to re-sign flow ]
```

**Web layout (≥ md breakpoint):**

Side-by-side diff using a two-column grid:
```
[ Left column: "Nåværende kontrakt" ]    [ Right column: "Foreslått endring" ]
  Field: [old value]                       Field: [new value]
  Unchanged fields: both columns show value in text-muted-foreground
  Changed fields: left = destructive, right = success
```

On mobile, the two-column layout collapses to vertical-stacked (old above, new below)
per the spec requirement.

**Constructive dismissal banner for employee:**

If `constructive_dismissal_risk === true`, the employee also sees a banner — but with a
different tone (informational, not a form gate):

```
[ bg-warning/10 border border-warning/30 rounded-xl p-4 mx-4 mt-4 ]
[ Info icon, text-warning ]
"Merk: Denne endringen kan ha rettslige konsekvenser."
[ text-foreground text-sm ]
"Dersom du er usikker på om dette påvirker dine rettigheter, anbefaler vi at du
kontakter Arbeidstilsynet eller en fagforening før du signerer."
```

No checkbox required on the employee side — the acknowledgement is recorded via the
AcknowledgementRing re-sign flow.

### 7.4 Re-Sign Flow

After the employee taps "Aksepter endring," the flow resumes at AcknowledgementRingScreen
(Section 5.3) with the amendment-specific blocks, then PdfPreviewGateScreen, then
ContractSignScreen, then biometric confirmation.

The AcknowledgementRing blocks for amendments are different from initial signing:
- Block 1: "Hva har endret seg" — shows only the diff
- Block 2: "Dine rettigheter" — standard rights block
- Block 3: "Hva signeringen betyr" — legal consequence of acceptance
- Block 4 (if constructive_dismissal_risk): "Advarsel: Endringsoppsigelse" — additional
  informational block, mandatory acknowledgement

Each block still generates a per-block timestamp per ADR-0244.

---

## 8. Component-Level Specs

### 8.1 AcknowledgementRing

**Two layouts: web stacked cards + mobile sequential.**

**Web: Stacked Cards**

```tsx
// Token references:
// bg-card border-border rounded-2xl — card container
// text-foreground font-semibold — block title
// text-muted-foreground text-sm — block body
// bg-success/10 text-success — acknowledged state
// motionTokens.spring — card expand/collapse
```

Props:
```ts
type AcknowledgementRingProps = {
  blocks: AcknowledgementBlock[];
  onAllAcknowledged: (timestamps: Record<string, string>) => void;
  readOnly?: boolean; // for admin preview — shows all blocks expanded, no CTA
}

type AcknowledgementBlock = {
  id: string;
  title: string;
  body: string; // may contain markdown
  acknowledgedAt?: string; // ISO-8601, set server-side
}
```

**Mobile: Sequential (one at a time)**

```ts
type AcknowledgementRingScreenProps = {
  blocks: AcknowledgementBlock[];
  onBlockAcknowledged: (blockId: string, timestamp: string) => void;
  onAllAcknowledged: () => void;
}
```

Accessibility:
- `aria-current="step"` on current block header (web)
- `accessibilityLiveRegion="polite"` on "Blokk N av M" (mobile)
- `role="region"` on each block with `aria-label="Blokk [N]: [title]"` (web)
- Focus management: on block expand (web), focus moves to block content;
  on block-to-block transition (mobile), focus moves to new block title

### 8.2 TariffBadge

Three states, corresponding to the `framework_snapshot` lifecycle:

| State | Label | Token | Icon |
|-------|-------|-------|------|
| `live` | "Gjeldende tariff" | `bg-success/15 text-success` | CheckCircle |
| `frozen` | "Frosset [date]" | `bg-muted text-muted-foreground` | Snowflake |
| `drift` | "Tariff utdatert" | `bg-warning/15 text-warning` | AlertTriangle |

Badge anatomy: `px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1`.
`font-mono` for date in `frozen` state.

`drift` state addition: a pulsing ring around the badge (`ring-2 ring-warning/30 animate-pulse`).

### 8.3 RevealableField

Used for all high-PII fields: personnummer, kontonummer, hourly/monthly rate.

**States:**
1. **Masked:** Value shows as `•••• •••••` (correct number of dots for field type).
   `text-muted-foreground font-mono`. Eye icon (Lucide, 16px) is the reveal trigger.
2. **Revealing:** 200ms fade-in of actual value. Simultaneously, a subtle amber flash
   on the field container (`bg-warning/10` for 300ms then fades to transparent) signals
   to the user that an audit event was emitted.
3. **Revealed:** Actual value visible. `text-foreground font-mono`. EyeOff icon replaces Eye.
   A 5-second countdown shown as a thin progress bar below the field (warm color,
   `bg-primary/40` depleting from right to left). After 5s: auto-mask.
4. **Auto-masked:** Returns to state 1, with a brief "Skjult igjen" tooltip for 1s.

**Audit emit:** On reveal, a telemetry event fires:
`emit('pii_field_revealed', { field, profile_id, revealed_by, timestamp })`.
The amber flash is the visual confirmation of this emit.

Motion:
- Mask→reveal: `opacity: 0 → 1` with `motionTokens.spring`
- Reveal→mask: `opacity: 1 → 0` with `motionTokens.exitMs` (250ms)
- Countdown bar: `scaleX: 1 → 0` over 5000ms linear (not spring — linear depletion
  communicates a countdown accurately)

`useReducedMotion()`: if true, omit all transitions; mask/unmask is instant.

### 8.4 ContractAmendmentDiff

Field-level only per ADR-0244.

**Web (horizontal ≥ md):**
```tsx
// Two-column grid, 1fr 1fr gap-4
// Each row: field label spanning both columns, then old | new
// Changed rows: bg-destructive/5 on old side, bg-success/5 on new side
// Unchanged rows: both sides text-muted-foreground (subdued)
```

**Mobile (vertical stack):**
```tsx
// Each changed field:
//   Label: text-muted-foreground text-xs uppercase
//   Old: bg-destructive/10 rounded px-2 py-1 line-through text-destructive
//   Arrow icon (ArrowDown, 14px, text-muted-foreground)
//   New: bg-success/10 rounded px-2 py-1 text-success
// Unchanged fields: collapsed by default, "Vis uendrede felt" toggle
```

### 8.5 DestructiveConfirmDialog

Existing component — visual polish gaps identified in Section 12.

**Spec (authoritative):**
- Title: `font-heading text-xl text-foreground`
- Body: `text-muted-foreground text-sm`
- Two buttons: Cancel (ghost, left) + Confirm (destructive, right)
- Destructive button: `bg-destructive text-destructive-foreground`
- Dialog: `bg-background border border-border rounded-2xl p-6 max-w-sm shadow-lg`
- Backdrop: `bg-background/60 backdrop-blur-sm`
- Enter: scale from 0.95 + opacity 0 → 1 with `motionTokens.spring`
- Exit: scale to 0.95 + opacity to 0 with `motionTokens.exitMs` (250ms)

### 8.6 MutationDropdownMenuItem

Existing component — loading state spec:

When a mutation is in-flight:
- Menu item is disabled: `opacity-50 pointer-events-none`
- Left icon (if present) is replaced by `<Loader2 className="animate-spin" size={16} />`
- Text remains unchanged (do not show "Laster..." — the spinner communicates state)
- The menu does not close during mutation; it stays open and re-enables on success/error

### 8.7 UnsavedChangesGuard

When the admin navigates away from the HR tab with unsaved changes:

Dialog copy:
- Title: "Lagre endringer?"
- Body: "Du har ulagrede endringer i kontraktdataene. Hva vil du gjøre?"
- Actions:
  - "Forkast endringer" (destructive ghost)
  - "Avbryt" (ghost)
  - "Lagre og fortsett" (primary)

The guard fires on `beforeunload` (web) and `usePreventRemove` (mobile). The "Forkast"
action fires immediately; "Lagre og fortsett" runs the save mutation then navigates.

---

## 9. Motion and Transitions

All motion in the contract module uses Nordic Split spring tokens from
`packages/design-tokens/src/tokens.ts`. No inline magic numbers.

### 9.1 Token Reference for This Module

| Token | Value | Used for |
|-------|-------|----------|
| `motionTokens.spring` | `{ stiffness: 35, damping: 22, mass: 2.2 }` | Drawer slide, block transitions, card expand, dialog |
| `motionTokens.springSnappy` | `{ stiffness: 45, damping: 24, mass: 2 }` | Button press, badge pop, PDF footer enable |
| `motionTokens.springGentle` | `{ stiffness: 30, damping: 20, mass: 2.5 }` | ObligationBlocker icon entrance, ambient |
| `motionTokens.enterMs` | `500` | Screen/drawer enter |
| `motionTokens.exitMs` | `250` | Screen/drawer exit, mask transition |
| `motionTokens.easingExpoArray` | `[0.16, 1, 0.3, 1]` | Expo-out for screen entrances |

### 9.2 AcknowledgementRing Block-to-Block (Mobile)

```tsx
// Exit: block slides left off-screen
<motion.div
  key={currentBlockId + '_exit'}
  exit={{ x: '-100%', opacity: 0 }}
  transition={{ type: 'spring', ...motionTokens.spring }}
/>

// Enter: next block slides in from right
<motion.div
  key={nextBlockId}
  initial={{ x: '100%', opacity: 0 }}
  animate={{ x: 0, opacity: 1 }}
  transition={{ type: 'spring', ...motionTokens.spring }}
/>
```

### 9.3 RevealableField Fade

```tsx
// Reveal
<motion.span
  key="revealed"
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  transition={{ type: 'spring', ...motionTokens.spring }}
>
  {actualValue}
</motion.span>

// Amber flash container
<motion.div
  animate={{ backgroundColor: ['oklch(0.85 0.12 60 / 0)', 'oklch(0.85 0.12 60 / 0.10)', 'oklch(0.85 0.12 60 / 0)'] }}
  transition={{ duration: 0.3, times: [0, 0.3, 1] }}
/>
```

### 9.4 Skeleton vs. Spinner

| Situation | Pattern |
|-----------|---------|
| Screen initial load (contract list, contract detail) | NordicSkeleton rows (same height as content rows) |
| Mutation in-flight (send, save, sign) | Button spinner (Loader2, inline) — no full-screen overlay |
| AcknowledgementRing block submission | Button spinner only |
| PDF load in PdfPreviewGateScreen | Skeleton placeholder (gray rectangle, full PDF height) |
| Between-screen navigation | No spinner — spring transition is the feedback |

Full-screen loading overlays are forbidden except for the initial app boot sequence.

### 9.5 useReducedMotion Guard

Every `motion.div` in this module must include:

```tsx
const prefersReducedMotion = useReducedMotion(); // Framer Motion

// In transition prop:
transition={prefersReducedMotion
  ? { duration: 0 }
  : { type: 'spring', ...motionTokens.spring }
}
```

React Native equivalent: `AccessibilityInfo.isReduceMotionEnabled()` checked in a hook
`useReducedMotion()` in `apps/mobile/src/lib/accessibility.ts`.

---

## 10. Accessibility (WCAG AAA per ADR-0244 line 70-74)

ADR-0244 (`docs/decisions/0244-amendment-flow-acknowledgement-as-legal-evidence.md`)
lines 70-74 mandate WCAG AAA compliance for the AcknowledgementRing and signing flows.
The following applies to the full contract module.

### 10.1 Aria Roles

| Component | Role/Attribute |
|-----------|---------------|
| AcknowledgementRing (web) | `role="list"` on container, `role="listitem"` on each block |
| AcknowledgementRing block header | `aria-expanded` on collapsible trigger |
| AcknowledgementRing block content | `id` referenced by `aria-controls` on trigger |
| "Blokk N av M" counter (mobile) | `aria-live="polite"` `aria-label="Du er på blokk N av totalt M"` |
| ContractStatusBadge | `role="status"` |
| RevealableField masked state | `aria-label="[fieldname], verdi skjult. Trykk for å vise."` |
| RevealableField revealed state | `aria-label="[fieldname], verdi synlig. Trykk for å skjule."` |
| TariffBadge | `role="status"` `aria-label="Tariffstatus: [state label]"` |
| ObligationBlocker | `role="alertdialog"` `aria-modal="true"` |
| DestructiveConfirmDialog | `role="alertdialog"` `aria-modal="true"` `aria-describedby` on body text |
| PDF footer enable state change | `aria-live="polite"` — announces "Signeringsknapp aktivert" |

### 10.2 Focus Management

- **CompositionDrawer open:** Focus moves to drawer heading on open.
- **CompositionDrawer step advance:** Focus moves to step 2 heading.
- **AcknowledgementRing block expand (web):** Focus moves to block content area.
- **AcknowledgementRing block-to-block (mobile):** Focus moves to new block title (after
  spring transition completes — 500ms delay on focus move to avoid announcing mid-transition).
- **AcknowledgementRing completion screen:** Focus moves to "Gå til kontrakt" button.
- **ObligationBlocker mount:** Focus moves to the "Fullfør protokoll" button.
- **DestructiveConfirmDialog open:** Focus moves to Cancel button (not Confirm — Fitts's
  law: destructive action should require deliberate pointer movement).
- **Biometric failure state:** Focus moves to "Logg ut" button.

### 10.3 Keyboard Navigation

All web components must be keyboard-operable:
- Tab order: left-to-right, top-to-bottom within sections
- RevealableField reveal: `Enter` or `Space` on the Eye icon button
- AcknowledgementRing block expand: `Enter` or `Space` on block header
- "Merk som gjennomgått": `Enter` activates
- Drawer close: `Escape` — except when mutation is in-flight
- DestructiveConfirmDialog: `Escape` = Cancel, `Enter` while on Confirm button = Confirm

### 10.4 Color Contrast

All text on `bg-background` must meet WCAG AAA (7:1 ratio minimum).
- `text-foreground` on `bg-background`: verified at design-token level (OKLCH warm palette)
- `text-muted-foreground` on `bg-background`: must be verified — flag as gap if < 7:1
- `text-destructive` on `bg-destructive/10`: verify contrast meets AAA on both light/dark
- `text-success` on `bg-success/10`: verify contrast meets AAA on both light/dark

**Gap flagged:** The warning and success overlay tints (`/10` opacity modifiers) may not
meet AAA contrast for the text on top in light mode. Verify with `colorContrastChecker`
before shipping Phase 3.

### 10.5 Screen Reader Copy

All Lucide icons in the contract module must have `aria-hidden="true"` (they are decorative).
All actionable icons must have a sibling visually-hidden `<span>` with the action label,
or use `aria-label` on the button.

---

## 11. Open Design Questions

These questions are unresolved as of 2026-04-30 and require decisions before Phases 3–7
can be fully designed.

1. **"Continue on phone" CTA shape (ADR-0245 #6, open).**
   The web my-contract page needs a CTA for employees without the mobile app.
   Options:
   a. "Send lenke til telefon" — sends an SMS/email with a deep-link. Requires SMS
      integration (Twilio) or email (SendGrid). Neither is currently wired to this flow.
   b. App Store / Google Play badges only — passive CTA, no active send.
   c. QR code on-screen — employee scans with phone camera, no PII in QR payload.
   Recommendation: option c (QR code) for Phase 3 MVP; option a deferred to Phase 4
   when Twilio employee-facing integration is ready.

2. **Biometric vs BankID interaction.**
   ADR-0245 specifies biometric (Face ID/Touch ID) as the C4 confirmation gate.
   BankID is not referenced in the current ADR. If Norwegian regulatory requirements
   mandate BankID for arbeidsmiljøloven §14-6 acceptance (an open legal question), the
   biometric gate would be replaced or supplemented. Flag for Lovsen review.

3. **Multi-arbeidsgiver inbox switcher (ADR-0245 #3).**
   Employees working for multiple employers (multi-workspace) will have contracts from
   multiple workspaces in the same inbox. The spec currently shows a flat list. A workspace
   switcher or grouped-by-employer section header is needed. Design deferred to Phase 5
   when multi-workspace mobile is scoped.

4. **Lovsen review schedule + sign-off process.**
   The Norwegian copy in Section 2 is pre-staged but not yet reviewed by an arbeidsrettsadvokat.
   Copy in the constructive dismissal banner, the amendment review banner, and the biometric
   failure state must be reviewed before Phase 3 ships to any employee. Proposed: one-week
   async review cycle with sign-off tracked in `docs/legal/LOVSEN-REVIEW-LOG.md`.

5. **AcknowledgementRing block content ownership.**
   Who authors the four block texts? Are they template-level (admin-editable per contract
   template), platform-level (Smartout-authored, same for all), or role-level (different
   blocks for manager vs employee)? Currently unresolved. The component API accepts `body`
   as a string — content governance is a product decision, not a design one.

6. **PDF preview gate on web fallback.**
   The web my-contract page is read-only. If an employee uses the web to read the PDF
   but cannot sign there, the PDF preview gate (scroll-to-end detection) is meaningless.
   Clarify: does the web PDF viewer need the same scroll gate, or can web employees read
   freely since they cannot sign on web anyway?

---

## 12. Existing-Implementation Gap List

This section audits the three main implementation files against this spec. Gaps are
classified for future sortie scoping.

Total gaps identified: **21** across 3 files.

### HrTabSections.tsx (60.8 KB)

**`apps/web/src/app/dashboard/people/[id]/complete-data/HrTabSections.tsx`**

| # | Gap | Location | Sortie |
|---|-----|----------|--------|
| 1 | No cluster grouping — fields render as a flat list. Spec calls for 6 visual clusters with left-accent separator lines and section headings. | top-level field render | polish-sortie-1 |
| 2 | Status badge missing. No "Klar til å sende / Mangler N felt" badge at tab top. | tab header area | polish-sortie-1 |
| 3 | Field labels use default styling — not the spec's `text-muted-foreground text-xs uppercase tracking-wide` for cluster headings. | label elements | polish-sortie-1 |
| 4 | Numeric fields (lønn, timer, stillingsprosent) do not use `font-mono`. | value elements | polish-sortie-1 |
| 5 | No inline validation feedback shape (no icon, no color, plain text error). Spec requires `AlertCircle` icon + `text-destructive` with spring entrance. | validation errors | polish-sortie-1 |
| 6 | LonnsprofilSection does not implement RevealableField — salary values are visible by default with no masking. High-PII violation against ADR-0242. | LonnsprofilSection.tsx | polish-sortie-2 (HIGH — ADR-0242) |
| 7 | LonnsprofilSection has no PII disclosure notice ("Lønnsdata er kun synlig for deg..."). | LonnsprofilSection.tsx | polish-sortie-2 |
| 8 | TipsregelModal uses a `<select>` for distribution_method. Spec requires 4 card-picker layout. | TipsregelModal.tsx | polish-sortie-1 |

### CompositionDrawer.tsx

**`apps/web/src/components/contracts/CompositionDrawer.tsx`**

| # | Gap | Location | Sortie |
|---|-----|----------|--------|
| 9 | Single-step layout — no 2-step architecture (mal selection → preview + AcknowledgementRing). | drawer structure | polish-sortie-3 |
| 10 | AcknowledgementRing not implemented — blocks are not rendered. The drawer goes straight to send CTA without any legal-evidence flow. Critical — ADR-0244 compliance failure. | drawer body | polish-sortie-3 (CRITICAL) |
| 11 | No framework snapshot freeze badge. Spec requires "Frosset [date]" badge in step 2. | drawer body | polish-sortie-3 |
| 12 | TariffBadge not used in drawer — no tariff state indication. | drawer header | polish-sortie-3 |
| 13 | Send CTA has no confirm modal — no DestructiveConfirmDialog before send. | send button | polish-sortie-3 |
| 14 | Step transition animation missing — no spring-based slide between steps. | step change | polish-sortie-3 |
| 15 | Drawer exit animation missing — closes abruptly. `motionTokens.exitMs` not applied. | drawer close | polish-sortie-3 |

### my-contract/page.tsx (23.8 KB)

**`apps/web/src/app/dashboard/my-contract/page.tsx`**

| # | Gap | Location | Sortie |
|---|-----|----------|--------|
| 16 | No hero card with spring entrance — page renders with no entrance animation. | page mount | polish-sortie-4 |
| 17 | No "Continue on phone" CTA section — employees on web see the contract but no guidance to sign on mobile. Per ADR-0245, signing is mobile-only but the web page doesn't communicate this. | page bottom | polish-sortie-4 |
| 18 | TariffBadge not shown on employee contract page — no tariff state visible. | hero section | polish-sortie-4 |
| 19 | Obligation list uses plain text rows — no icon (CheckCircle/Circle), no deep-link to protocol, no due-date chip. | obligation list | polish-sortie-4 |
| 20 | No Botsson suppression / DomainChatOwnership declaration. The Orb is active on this page despite salary data being present. ADR-0238 requires passive mode. | page root | polish-sortie-4 (HIGH — L-0178) |
| 21 | No reduced-motion guard on any animation in the page — `useReducedMotion()` not imported. | all animated elements | polish-sortie-4 |

### Top 5 gaps by severity

1. **Gap #10** — AcknowledgementRing not in CompositionDrawer: CRITICAL. ADR-0244 legal-evidence chain is not satisfied. No per-block timestamps are being collected. Contracts are being sent without the admin completing the required acknowledgement flow. Blocks Phase 3 sign flow.

2. **Gap #6** — RevealableField not implemented in LonnsprofilSection: HIGH. Salary values exposed by default violates ADR-0242 high-PII isolation. Audit events not firing.

3. **Gap #20** — No DomainChatOwnership on my-contract page: HIGH. Botsson Orb is in active (interactive) mode on a page with salary context. L-0178 + ADR-0238 classify this as shipping-blocker class silent-failure UX.

4. **Gap #13** — No DestructiveConfirmDialog before contract send: MEDIUM-HIGH. Admins can accidentally fire a contract send with a single click. Should be blocked before any further phase work.

5. **Gap #8** — TipsregelModal uses `<select>` not card picker: MEDIUM. Functional but spec-divergent. The select collapses the four options into an opaque dropdown — the card picker communicates the semantic difference between the four distribution methods.

---

*Document authority: frontend-designer agent. For Lovsen review schedule, see open question #4.*
*Next design pass: polish-sortie-1 through polish-sortie-4 as scoped above.*
*ADR-0244 compliance gate for shipping: Gaps #10 and #6 must close before Phase 3 contracts reach employees.*
