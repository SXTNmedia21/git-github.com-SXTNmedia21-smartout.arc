---
title: Schedule Card Density — 4-Tier View Preference
status: done
updated: 2026-05-15
created: 2026-05-15
module: schedule
tags: [schedule, density, ui, voice]
---

# Schedule Card Density — 4-Tier View Preference

Four user flows enabled by `feat/schedule-card-density`. E2E coverage in `apps/e2e/schedule/density.spec.ts`.

---

## Journey 1: Manager bytter density-mode via UI

**Precondition:** Manager er pålogget og befinner seg på `/dashboard/schedule`. Default density (`"default"`, 100px-rader) rendres. Ingen `user_view_preference`-rad eksisterer for denne profilen enda.

1. Manager ser segmentert `DensitySelector`-gruppe i kommandolinjen: `[ Cozy | Default | Compact | Pulse ]` → klikker `Compact`
2. System bytter `scheduleDensity` state optimistisk til `"compact"` → dagsgrid viser 52px-rader umiddelbart
3. Setter kaller `setScheduleDensityAction({ density: "compact" })` fire-and-forget (Server Action)
4. Server Action verifiserer JWT-identity → `gateAction` sjekker `roleFloor: "employee"` → OK → upsert til `user_view_preference (surface="schedule", preference_key="density", preference_value="compact")` → `emit("schedule.density_changed", { density: "compact", source: "ui" })` → PostHog + activity_trail
5. Manager reloader siden → page-level server component henter `getScheduleDensity(profileId, workspaceId)` → returnerer `"compact"` → context initialiseres med `initialDensity="compact"` → Compact rendres direkte uten flash

**Postcondition:** `scheduleDensity = "compact"` persistert i `user_view_preference`. Neste page-load på samme eller annen enhet gir identisk resultat.

**Error paths:**
- Server Action returnerer 4xx (DB-feil) → optimistisk UI-state beholdes, `console.warn` + Sentry-breadcrumb logges; bruker bytter density igjen → ny upsert-attempt
- `gateAction` avviser (deaktivert profil e.l.) → Server Action returnerer `{ ok: false, error }` → fanger opp via `.catch`, logger breadcrumb; UI-state beholdes

---

## Journey 2: Manager aktiverer Pulse + conflict-escape

**Precondition:** Manager på `/dashboard/schedule`, flerukers oversikt med minst én konfliktmarkert vakt i neste uke.

1. Manager klikker `Pulse` i DensitySelector → System bytter til `"pulse"`, 28px heatmap-rader
2. Celler uten konflikter rendres som solide fargeceller (heatmap-farge fra `SHIFT_INDICATOR_STYLES[indicator]` ved 60% opacity)
3. Celle med konfliktvakt: render-decision-tree finner `shifts.some(s => s.hasConflict) === true` → conflict-escape mini-card path (40px rad): `<DensityStrip hasConflict />` (rød rail) + rollebokstaver + time-streng (`10–22`)
4. Manager klikker conflict-escape mini-card → standard drag-handler aktiveres (Pulse er ikke read-only)
5. Persistence: identisk med J1 — upsert `preference_value="pulse"` + telemetry-emit

**Postcondition:** Manager ser hele uken på én skjerm. Konfliktvakter er synlige og klikkbare selv i Pulse-modus.

**Error paths:**
- Alle celler er heatmap (ingen konflikter) → ingen mini-cards; Pulse er ren heatmap-overside
- Tom celle → grå `bg-muted/20`-celle, ingen mini-card

---

## Journey 3: Conflict-strip overlever alle density-tiers

**Precondition:** En vakt er merket med `hasConflict = true` (overlapper annen vakt). Manager veksler gjennom alle 4 tiers.

1. **Cozy (120px):** `<DensityStrip hasConflict />` — 4px rød rail + `ring-destructive/60` på kortet
2. **Default (100px):** Samme stripe + ring — identisk signal
3. **Compact (52px):** Rail ved `w-0.5` (eksisterende kompakt bredde) + rød farge + ring
4. **Pulse (28px):** Conflict-escape mini-card path — rød rail synlig + celle er 40px; heatmap-cellen finnes aldri for konflikt-vakter

I alle tiers: ringen fra `grid-cards.tsx` er i tillegg til rail (defence-in-depth, ring kan skjules av overlapp men rail ikke).

**Postcondition:** Konfliktsignal er aldri supprimert av visuell komprimering. C2-constraint (ADR-0331 D3) er oppfylt.

**Error paths:** (Ingen — dette er en defensiv passiv egenskap, ikke en brukerflyt med alternativ utgang.)

---

## Journey 4: Manager bytter density via voice

**Precondition:** Manager befinner seg på `/dashboard/schedule`. Voice-Orb er aktiv (LiveKit-tilkobling etablert). Gjeldende density er `"default"`.

1. Manager sier "gi meg kompakt visning" → LiveKit Realtime LLM matcher `set_schedule_density` tool med `density="compact"`
2. Tool sjekker `checkSchedulePath()` — bruker er på riktig side → OK
3. Tool publiserer `{ type: "schedule_view_change", payload: { action: "set_density", density: "compact" } }` over LiveKit data channel
4. `schedule-voice-tools-bridge.tsx` mottar event, `case "set_density":` → kaller `setScheduleDensity("compact")` via `useDashboard`-bag — identisk setter som UI-knapp bruker (L-0233: single source of truth)
5. Setter bytter state optimistisk → Server Action fires fire-and-forget → persistence + telemetry identisk med J1

**Postcondition:** `scheduleDensity = "compact"` i UI og persistert i `user_view_preference`. Voice og UI konvergerer ved React-setter; ingen separat persistence-path for voice.

**Error paths:**
- Tool kalt mens bruker er på annen side → `checkSchedulePath()` returnerer redirect-melding ("Gå til vaktplanen for å bruke denne kommandoen") → ingen state-endring
- Bridge mottar ukjent `action` → `default` branch i switch-case ignorerer event, ingen krasj
- Server Action-persistens feiler (se J1) → Sentry-breadcrumb, voice-tool-returstrengen er allerede sendt ("Bytter til kompakt-visning") — brukeren ser suksessmelding, feil logges

---

> E2E specs: `apps/e2e/schedule/density.spec.ts` (J1: reload-persistence, J2: Pulse-conflict-escape-40px, J3: voice-command + DB-assert, J4: new-user-no-row-defaults-to-default)
> ADR: `docs/decisions/0331-schedule-density-persistence.md`
