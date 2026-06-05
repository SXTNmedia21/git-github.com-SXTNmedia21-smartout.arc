---
title: Telemetry L3 — arkitektur, baktanke og hvordan det fungerer
status: in_progress
created: 2026-06-04
updated: 2026-06-04
module: campaign
tags: [telemetry, activity-trail, l3, provider, correlation, communication, done-oracle]
---

# Telemetry L3 — arkitektur, baktanke og hvordan det fungerer

> **Hva dette er.** Den lesbare oppsummeringen av telemetri-spinen: hva vi løser, hvordan rør-et
> henger sammen fra `emit()` til en rad i `activity_trail`, og hvorfor de konkrete avgjørelsene
> (broadcast, chat, tier-override) ble som de ble. Skrevet etter Communication-sweepen 2026-06-03/04.
>
> Relaterte dokumenter (overlapper ikke — peker):
> - `docs/decisions/0122-governance-telemetry-quad-destination.md` — ADR for 4-destinasjons-routing
> - `docs/campaign/TELEMETRY-E2E-GATE.md` — *gaten* (verifikasjonsmekanismen, live status-lys)
> - `/home/sxtnl/plugins/sxtn/skills/sxtn-l3-probe/SKILL.md` — done-orakelet (gjenbrukbart, plugin)

---

## 1. Hva vi løser

**Problemet:** "Grønt" i telemetri-registeret betyr ikke at noe faktisk skjer. En event kan være
registrert, rutet, typecheck-ren, og returnere 200 — og likevel lande **null rader**. Det kaller vi
en **phantom**. Dashbordet til Pontus var tomt fordi vi stolte på registeret (L2) i stedet for å
sjekke at raden lander (L3).

**To sannhetsnivåer:**

| Nivå | Betyr | Bevis |
|------|-------|-------|
| **L2** | Event registrert i `registry.ts` + rutet til en destinasjon | Grønt i registeret = rute-*intensjon* |
| **L3** | Event lander faktisk en rad i lagringen ved handlingstidspunkt | En ekte `SELECT` finner raden |

**Regelen:** et domene er ikke ferdig før hver event som ruter til `activity_trail` enten er
**L3-ekte** (lander rad) eller **ærlig-L2** (lover ingen audit-rad den ikke kan levere). En phantom
er ingen av delene — det er en bug.

---

## 2. Arkitektur — rør-et fra emit til rad

```
  app-kode                packages/telemetry              Supabase (lokal/prod)
 ┌─────────┐   emit()   ┌──────────────────┐  insert   ┌──────────────────┐
 │ onSuccess├──────────►│ EVENT_ROUTING    ├──────────►│ activity_trail   │  ← dashbord-feed leser her
 │ / server │  {event,  │ (registry.ts)    │           │ posthog          │  ← produkt-metrikk
 │ action   │   ws,actor│ 4 destinasjoner: │           │ logger           │  ← observability
 └─────────┘   entity,  │ activity_trail · │           │ engine_event     │  ← agent-reaksjoner
               data}    │ posthog · logger·│           └──────────────────┘
                        │ engine_event     │
                        └──────────────────┘
```

**Lag-for-lag:**

1. **Call-site** (`emit({...})`) — fyres i `onSuccess` (TanStack) eller etter DB-skriv (server action).
   Bærer: `event`-navn, `workspace_id`, `actor_id`, valgfri `entity`-ref, `properties.data`,
   `correlation_id`.
2. **Registeret** (`packages/telemetry/src/registry.ts`) — ÉN sannhet. `EVENT_ROUTING[event]` gir
   `{ destinations, category }`. Destinasjon avgjør hvilke providere som kjøres.
3. **Provideren** (`packages/telemetry/src/providers/activity-trail.ts`) — oversetter eventen til en
   `activity_trail`-rad. Dette laget er der phantoms oppstår (se §3).
4. **Lagringen** — `activity_trail` (workspace-scoped audit), `posthog` (metrikk), `logger`
   (observability), `engine_event` (agent-reaksjoner). ADR-0122 dekker hvorfor fire.

**Hvorfor `activity_trail` er spesiell:** det er den eneste destinasjonen dashbordets ActivityFeed
(`use-activity-feed.ts`) leser. Lander ikke raden der, ser brukeren ingenting — uansett hvor grønt
registeret er.

---

## 3. Provideren i detalj — hvorfor en rutet event phantom-er

`writeActivityTrail(event, meta)` bygger raden. Den **svelger insert-feil** (logger, kaster aldri) —
derfor ser app-flyten fin ut mens ingen rad lander. Tre feller (funnet empirisk 2026-06-03):

1. **Entity-ref er PÅKREVD.** Provideren utleder raden fra en `entity` (type+id) — nested
   `properties.entity`, flat `entity_type/entity_id`, eller top-level `event.entity`. Resolver ingen
   → `console.warn` + return, **ingen insert**. Mange interfaces deklarerer ingen `entity` (f.eks.
   `communication sent`), så hvert call-site MÅ hånd-feste entity, ellers droppes raden stille.
2. **`correlation_id` er en UUID-kolonne.** En label-streng (`"l3-probe-comm-123"`) feiler inserten
   (`22P02 invalid input syntax for type uuid`) og raden droppes. Bruk en ekte UUID.
3. **`action_verb` = `event.split(".").pop()`.** Punkt-navn (`channel.message.sent` → `sent`) blir
   riktig. Mellomrom-navn (`communication sent`) har ingen punkt → verbet blir hele strengen.

Provideren resolver også `actor_id` → `profile_id` (direkte match, eller via `user_id` i workspace),
og setter `actor_kind` (default `'user'`). `workspace_id = null` → tidlig return (plattform-events
auditeres via `billing_activity_log`, ADR-0262).

---

## 4. Hvordan det fungerer — ekte eksempel (broadcast)

En admin sender en kringkasting fra dashbordet (`use-send-broadcast.ts` / `send-broadcast-action.ts`):

```
1. RPC publish_announcement_atomic → setter inn channel_message + announcement_meta (atomisk)
2. emit("communication.broadcast_sent")  → posthog (metrikk). INGEN entity → INGEN audit-rad (by design)
3. emitAnnouncementPublished() → emit("channel.message.sent")
                                  entity = { channel_message, message_id }  → LANDER audit-rad ✓
4. dashbordets ActivityFeed leser activity_trail, kategori "channels" → viser "sendte channel_message"
```

**Poenget:** den varige auditen lander via `channel.message.sent` (som bærer entity), ikke via
`communication.broadcast_sent`. Det er to forskjellige events for samme handling — én metrikk, én audit.

---

## 5. De konkrete avgjørelsene (Communication-sweepen)

27 comms-events ruter til `activity_trail`. **24 var allerede L3-korrekte** (bærer entity → lander
rad; vi beviste 4 representative). **3 var phantoms** — de lovet `activity_trail` men kunne aldri
lande (ingen entity by design), og kastet en stille reject hver gang. Fikset til ærlig-L2:

| Event | Før | Etter | Baktanke |
|-------|-----|-------|----------|
| `communication.broadcast_sent` | `[activity_trail, posthog]` | `[posthog]` | Ekte audit lander allerede via `channel.message.sent`. Dette er en metrikk-signal — dobbel-ruting var umulig (ingen entity). |
| `announcement.tier_overridden` | `[posthog, activity_trail]` | `[posthog]` | Composer-onChange fyres FØR publisering — ingen entity finnes ennå. Søsken `kind_changed` var allerede posthog-only. |
| `chat message_sent` | `[posthog, logger, activity_trail]` | `[posthog, logger]` | Privat 1:1 DM / shift-chat — ikke en governance-handling. Offentlige kanal-poster auditeres via `channel.message.sent` (som bærer entity). DM-er holdes ute av audit-feeden. |

**Prinsippet bak alle tre:** ingen av dem representerer en varig workspace-audit-handling med en stabil
entity. Riktig "regnskap" er ærlig-L2 (posthog/logger), ikke en audit-rad-løgn. 381 telemetri-tester
fortsatt grønne; ingen test låste disse rutingene.

---

## 6. Done-orakelet — slik beviser vi L3

L3 er en før/etter-assertion rundt en ekte handling:

```
snapshot → tell rader i activity_trail som matcher <filter>     (vanligvis 0)
fyr      → kjør appens ekte mutation/emit (app-spesifikk)
assert   → tell igjen, ekte SELECT, delta ≥ forventet
```

- **App-spesifikk prober:** `scripts/l3-probe.mjs` — fyrer en registrert event gjennom den ekte
  provideren mot lokal Supabase, asserterer raden. (Brukt til å bevise de 4 core-eventene.)
- **Prosjekt-agnostisk assert-halvdel:** `bin/sxtn-l3-probe.sh` (sxtn-plugin) — `--table --where
  --expect-min`, skriver `reports/l3-probe.json`, exit 0 = L3 bevist / exit 1 = phantom.

"Fyr"-steget er alltid app-spesifikt (appens egen emit); "bevis-at-den-landet" er gjenbrukbart.

---

## 7. Hvorfor dashbordet var tomt (og hvordan det blir grønt)

**Ikke ødelagt wiring.** Core-pathen er L3-korrekt, og feeden viser per kategori. Feeden var tom
fordi **Demo-seeden hadde null comms-aktivitet** — `50-communication.sql` seedet *entitetene*
(kanaler/meldinger) men ingen `activity_trail`-rader (de kommer normalt fra `emit()` ved
handlingstid; en seed-INSERT omgår emit). Ærlig-tomt, ikke phantom.

**Løsning (venter på godkjenning):** `51-communication-activity-trail.sql` lander 4× `channel.created`
+ 2× `channel.message.sent` (ekte broadcasts) for Demo Restaurant, speiler nøyaktig provider-output.
Committet UNAPPLIED (`1192aea2f`) — DB-wall, `supabase db reset` påføres etter Pontus' ja. Da viser
feeden ekte grønt. **Ingen fabrikkering** (no-ghost): probe-rader ble slettet etter bevis.

---

## 8. Status + neste

| Ting | Hvor | Status |
|------|------|--------|
| 3 phantom-routings fikset | smartout `60cb706cc` | ✅ pushet (origin/campaign) |
| Comms `activity_trail`-seed | smartout `1192aea2f` | ⏳ UNAPPLIED — venter db reset-godkjenning |
| L3 done-orakel (bin+skill) | sxtn-plugin `92a23b1` | ⏳ committet lokalt, ikke pushet |
| Denne arkitektur-docen | `docs/campaign/TELEMETRY-L3-ARCHITECTURE.md` | nå |

**Neste domene:** samme sweep-mønster (map emit-sites → kryss mot routing → fiks phantoms → bevis med
orakel) for vaktplan / lønn / ansatte / hms. Communication er malen.
