# Handoff — Nyheter Engagement Wave A

Surface: `/dashboard/komm/nyheter`
Branch: `feat/nyheter-engagement-wave-a`
Prototype: `Nyheter Wave A.html` i prosjektroten
Plan: `docs/plans/PLAN-nyheter-engagement-wave-a.md`

Denne mappen beskriver **UX-en** som er designet i prototypen, slik at implementasjonen i kodebasen treffer riktig. Den er ikke et nytt scope-dokument — den utfyller `PLAN-nyheter-engagement-wave-a.md` med interaksjonsdetaljene som ble bestemt i designfasen.

---

## 1) Forskjell ansatt vs leder

Samme surface, ulik chrome.

| Element | Leder | Ansatt |
| --- | --- | --- |
| «Ny kunngjøring»-knapp i topbar | synlig | skjult |
| Overflow-meny (`MoreVertical`) på NewsCard | synlig | skjult |
| PinnedStrip | synlig, hver chip har inline «Løsne» | synlig (les-only) |
| Pin-ikon på kort | synlig hvis `is_pinned=true` | synlig hvis `is_pinned=true` |
| Målrettet kunngjøring man er utenfor | filtreres bort av RLS før kortet når klienten | filtreres bort av RLS før kortet når klienten |

Gating: `useProfileRole().isAtLeast("manager")`. Ikke render menyen i det hele tatt for ansatte — ikke skjul med CSS.

---

## 2) Item A — Notification priority bump

Ingen UI. Trigger-migrasjonen er som spesifisert i planen. Designet eksponerer **ett synlig løfte** i compose-modalen:

> Push leveres som operasjonell varsel — `priority=1`, `mode='operational'`. Passerer stille timer der vanlig chat blir holdt tilbake.

Denne linjen står alltid (announcements er per definisjon `priority=1`). Den er ikke en toggle. Den finnes for å redusere «vent, blir dette en push?»-spørsmål til leder.

I kortets fot, på `message_type='announcement'`, vises et 9px «Operasjonell»-badge med klokke-ikon. Dette gjør det enkelt å skille kunngjøringer fra vanlig chat i listen.

---

## 3) Item B — Audience picker

### Form
**Segmented control med 5 segmenter**, ikke en Select. Hvert segment har ikon + label. Aktivt segment får `bg-card` + `box-shadow: 0 1px 3px rgba(0,0,0,0.06)` (subtil løft) og brand-orange ikon. Resten er muted.

| Segment | `audience_kind` | `visibility_scope` | Drilldown |
| --- | --- | --- | --- |
| Alle | `all_members` | `all_members` | ingen |
| På vakt | `on_duty` | `targeted_members` | ingen — resolves via `useBroadcastRecipients` |
| Avdeling | `department` | `targeted_members` | grid 2-kol av dept-tiles, multi-select |
| Rolle | `role` | `targeted_members` | grid 2-kol av role-tiles, multi-select |
| Personer | `individuals` | `targeted_members` | søk + scrollbar liste + valgte som pill-tokens |

### Drilldown-mønster
- **Dept/role tile**: 1px border, 14px radius, hover gir `translateY(-1px)` + varm border. Aktiv: brand-border + 2px ring (8% opacity) + svak orange-tinted bg.
- **Personer-listen**: 8px-radius rader, hover `bg-secondary`. Checkbox er en 18px tile som fylles brand-orange ved valg, ikke en native check.
- Valgte personer rendres som **pill-tokens** under listen — navn + X. Dette gir et raskt overblikk når listen scrolles.

### Recipient count pill
- Plassert **rett under audience picker**, før publiser-knappen. Aldri inni picker-segmentet.
- `aria-live="polite"`, `aria-atomic="true"` — leser opp ny count når brukeren bytter målgruppe.
- Visuell stat: 8% brand-orange bg, 18% border, Geist Mono 16px black for tallet.
- **Bump-animasjon** på tall-bytte: `scale(1) → 1.18 → 1`, 400ms elastic. Dette er den lille belønningen som forteller brukeren at picker-valget faktisk traff resolveren.
- Når count = 0: skifter til muted tone (secondary bg). Publiser-knappen disables.
- En monospace-linje ved siden av oppsummerer payload: `audience_kind: department · Bar, Kjøkken` — fungerer som dev/QA-affordance og forklarer hva som lagres.

### Publiser-disable-regler
Publiser disables når:
- `title.trim()` er tomt
- `body.trim()` er tomt
- `recipientCount === 0` (f.eks. valgt «Avdeling» men ingen avdeling)

### Hvordan payload bygges
```ts
onPublish({
  title, body,
  visibilityScope: audience === "all" ? "all_members" : "targeted_members",
  targetProfileIds: audience === "all" ? [] : resolved.map(p => p.id),
  audienceKind: audience,          // → telemetry
  audienceLabel: humanLabel,       // → vises i NewsCard footer
});
```

`useSendAnnouncement` INSERT skal skrive `target_profile_ids` + `visibility_scope='targeted_members'` når listen er ikke-tom, ellers fall tilbake til `all_members`. `system_data` JSONB-kolonnen brukes til å encode hvilken avdeling/rolle/etc. valget representerte — slik som `sendBroadcastAction.ts:128–129` gjør for department_id/session_id.

---

## 4) Item C — Pin/unpin + PinnedStrip

### Trigger
Manager-only DropdownMenu på NewsCard, trigget via `MoreVertical` ikon top-right (32px hit target). Menypunkter:

1. **Fest øverst** (eller **Løsne** hvis pinnet) — primary action
2. Send påminnelse (placeholder — fremtidig)
3. Se hvem som har lest (placeholder — venter på ReadReceipt-sortie)
4. ──── separator ────
5. Slett (destructive)

Menyen åpnes med 200ms expo-easing scale + fade. Lukker på outside-click.

### Pin-marker på kortet
- Solid `Pin`-ikon, warm amber (`oklch(0.65 0.18 65)`), 16px, posisjon top-right 16/50 (offset for å ikke kollidere med meny-knappen).
- Ingen ekstra border eller bakgrunn på kortet — unread-state eier allerede den 3px venstre brand-orange-borderen.

### PinnedStrip
- **Sticky top** av main-content, full bredde innenfor page-padding (negativt margin -28 -32 for å bryte ut av page-padding).
- Backdrop: `oklch(0.985 0.008 60 / 0.85)` + `backdrop-filter: blur(20px)` + 1px border-bottom. Tre tone-varianter er eksponert som Tweaks i prototypen (Glass / Varm / Accent) — pick Glass som default.
- Header: Instrument Serif 20px **«Festet»** med solid pin-ikon foran og monospace count etter.
- Scroller: horisontal flex, `scroll-snap-type: x proximity`. Hver chip er **200×84px**, ikke 160×80 som planen sa — testen viste at norske titler på 2 linjer trenger litt mer plass. (Hvis 160×80 er hellig: kutt til 1 linje + ellipsis.)
- Hver chip: 3px venstre accent-border i dept-farge, deptLabel som 10px uppercase meta, tittel som 13px 600 line-clamp 2. Hover gir 2px løft + skygge.
- Manager ser **inline «Løsne»** i bunn-høyre på hver chip (12px tekst, ghost button).
- Klikk på chip-flate (ikke «Løsne») skroller til kortet i feeden og lyser det opp med en 700ms warm-orange highlight.

### Inn/ut-animasjon
- Strip animerer inn med `stripIn` (400ms expo): opacity 0 → 1, translateY(-10px) → 0, max-height 0 → 200px. Bruk `motion.spring` på samme verdier i produksjon.
- Strip fader ut når siste pin fjernes — samme keyframe i revers.

### Realtime
PinnedStrip må respektere `useChannelRealtime`. Når en annen klient setter `is_pinned=true`, skal stripen animere inn (eller chippen pope inn med stagger 60ms) hos alle ansatte i workspacet innen ~500ms. Prototypen simulerer dette med en «Realtime: festet · sendt til alle medlemmer»-toast — den finnes ikke i produksjon.

### Permission
- `is_pinned` UPDATE må kun være tilgjengelig for `manager+` i samme workspace. Verifiser RLS-policy på `channel_message` UPDATE før mutation går direkte fra klient. Hvis policyen er for løs eller for stram — bruk Server Action med eksplisitt rolle-check (planens trap #C).

---

## 5) Tilstander å teste

E2E-spec må dekke:

1. **Empty feed** (workspacet er nytt) — empty state med CTA hvis manager, uten hvis ansatt.
2. **Feed uten pinned** — ingen strip rendres.
3. **Feed med 1 pinned** — strip har 1 chip, ingen scrollbar.
4. **Feed med 3+ pinned** — strip scroller horisontalt med snap.
5. **Compose: alle 5 audience-modi** — count pill ≥ 1 og publiser enabled.
6. **Compose: tom multi-select** — count = 0, publiser disabled.
7. **Pin → unpin** — siste unpin fader stripen ut.
8. **Ansatt-viewport** — ingen meny, ingen knapp, samme pinned-strip.
9. **Realtime pin fan-out** — manager pinner, ansatt-tab ser stripen oppdatert innen 2s.

Tweaks-panelet i prototypen lar deg veksle alle disse uten å manipulere state for hånd.

---

## 6) Telemetri

Eksisterende events (allerede registrert i `packages/telemetry/src/registry.ts`):

```ts
// channel.message.sent — extend with:
{
  message_type: "announcement",
  visibility_scope: "all_members" | "targeted_members",
  target_profile_count: number,
  audience_kind: "all" | "on_duty" | "department" | "role" | "individuals",
  notification_priority: 0 | 1,
  notification_mode: "community" | "operational",
}

// channel.message.pinned
{ message_id, pinned_by, pinned_at, channel: "news" }

// channel.message.unpinned
{ message_id, unpinned_by, channel: "news" }
```

Ingen nye events. Ingen ny registry-edit.

---

## 7) i18n-nøkler å legge til

`packages/i18n/locales/{nb,en}/komm.json` under `nyheter`-blokken:

```json
{
  "compose_title": "Hva må teamet vite?",
  "title_label": "Tittel",
  "body_label": "Melding",
  "audience_label": "Målgruppe",
  "audience_all": "Alle",
  "audience_on_duty": "På vakt",
  "audience_department": "Avdeling",
  "audience_role": "Rolle",
  "audience_individuals": "Personer",
  "recipient_count_pill": "{count, plural, one {# ansatt vil få denne} other {# ansatte vil få denne}}",
  "publish": "Publiser",
  "pin": "Fest øverst",
  "unpin": "Løsne",
  "pinned_strip_header": "Festet",
  "pinned_label": "Festet",
  "operational_badge": "Operasjonell"
}
```

EN-strenger speiler de samme nøklene (`pin: "Pin to top"`, `unpin: "Unpin"`, `pinned_strip_header: "Pinned"`).

---

## 8) Filer som skal endres (oppsummert)

```
NEW  supabase/migrations/{ts}_announcement_notification_priority.sql
NEW  apps/web/src/app/dashboard/_components/RecipientCountPill.tsx
NEW  apps/web/src/app/dashboard/komm/_hooks/use-pin-message.ts
EDIT apps/web/src/app/dashboard/komm/_components/NyheterClient.tsx
EDIT apps/web/src/app/dashboard/komm/_hooks/use-send-announcement.ts
EDIT apps/web/src/app/dashboard/_components/QuickBroadcast.tsx        ← bruk shared pill
EDIT packages/i18n/locales/nb/komm.json
EDIT packages/i18n/locales/en/komm.json
```

Untouchable (per plan):
- `packages/ai/src/capabilities/communication/tools.ts`
- `packages/ai/src/gate/gatedMutation.js`
- `apps/mobile/**`
- `apps/web/src/app/dashboard/komm/_hooks/use-mark-as-read.ts`
- Eksisterende realtime + auto-mark-as-read-blokker i `NyheterClient.tsx`
- `packages/telemetry/src/registry.ts`

---

## 9) Designsystem-referanser

Alt visuelt holder seg innenfor Smartout Nordic Split:

- Card radius **16px**, padding 20–22px, hover `translateY(-2px)` + `shadow-card-hover`.
- Buttons radius **10px**, primary med `box-shadow: 0 2px 12px rgba(249,115,22,0.25)`.
- Inputs radius **12px**, 40px høyde, fokus-ring brand-orange 12% opacity.
- Badges: pill, 9px uppercase variant med 0.16em letter-spacing for «Operasjonell».
- Type: Instrument Serif for header, kort-tittel og «Festet»-header; Geist Sans for body; Geist Mono kun for tall (count, telemetry, mottakere).
- Farger: warm cream bg, brand-orange `oklch(0.65 0.22 40)`, pin-amber `oklch(0.65 0.18 65)`, dept-farger fra tokens.

Se prototypen for eksakt CSS — alt er bygd på tokens fra `packages/design-tokens`.

---

## 10) Spørsmål som fortsatt er åpne

1. **«Send påminnelse»-action**: skissert i menyen som placeholder. Skal den bygges nå eller flagges som hold? Min anbefaling: hold. Det berører notification_outbox og fortjener egen sortie.
2. **«Se hvem som har lest»**: venter på ReadReceipt-aggregering. Hold som placeholder eller skjul item helt? Min anbefaling: skjul til RPC-scope er bestemt.
3. **Pinned-strip max items**: prototypen tillater ubegrenset horisontal scroll. Bør vi cap'e på 5 eller 7? Hvis ja: «+N flere»-chip på enden.
4. **Hva skjer hvis manager pinner mens stripen allerede har 0 plass**: vises den nyeste først? Prototypen sorterer på `pinned_at DESC`. Bekreft.
