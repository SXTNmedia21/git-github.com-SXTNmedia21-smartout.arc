---
title: "Plan — Botsson Overlay Pixel-Parity Implementation (Phase D3)"
status: draft
updated: 2026-04-22
created: 2026-04-22
module: MODULE_BOTSSON
tags: [plan, botsson, design, overlay, d3, phase-d]
---

# PLAN — Botsson Overlay Pixel-Parity Implementation (Phase D3)

> Implementere Claude Design-handoff-bundlen i `docs/design/botsson/` pixel-perfekt inn i `apps/web/src/app/Botsson/_components/`.
>
> Eier: `frontend-designer`-agenten. Harness-støtte (prop-kontrakter, tool-id-er, view-routing): `botsson-harness-builder`. Reviewer: `system-steward` + `supervisor` via `/run-council` ved Phase 2.5-fact-check og Phase 5-trust-gate.

---

## Bakgrunn

2026-04-22: Pontus eksporterte en Claude Design-handoff-bundle fra claude.ai/design til `docs/design/botsson/project/`. Bundlen inneholder HTML/CSS/JSX-prototyper for hele Botsson Arena-overlay-en (orb, sticky, arena, immersive, 12 views, Emma-illustrasjon, dashboard-underlay som referanse).

Dagens implementasjon i `apps/web/src/app/Botsson/_components/` dekker strukturen, men:

- Form-view + Video-view i `BotssonArena.tsx` viser bare strengen "Skjema"/"Video"
- `EmmaProfile.tsx` rendrer bare bokstaven "E" på gradient
- Immersive-modus er bare `radius: 0`, ingen bakgrunnsdesign
- Orb notification-state mangler partikler + ripples + shimmer per brief
- Settings-view-layout trenger polish
- Ingen pixel-parity-sjekk mot mockup er gjort

Dette er Phase D3 i `CAMPAIGN-botsson-arena`.

---

## Forutsetninger

- Bundlen ligger i `docs/design/botsson/project/` og **skal ikke endres** — den er frosset handoff-input.
- `frontend-designer` leser `botsson/README.md` + `project/Botsson Arena.html` + alle `project/components/*.jsx` + `project/botsson.css` + `project/tokens.css` før implementasjon.
- Tokens skal mappes til eksisterende CSS-variabler i `globals.css` (Nordic Split). Nye hardkodede verdier krever ADR eller token-tillegg via `smartout-nordic-split`-skillet.
- Morph-animasjon er låst: `280ms cubic-bezier(0.4, 0, 0.2, 1)` på width/height/border-radius/box-shadow/transform. Ikke endre.

---

## Implementasjonsrekkefølge

### Fase D3.1 — Audit (0.5 uke)

1. Les hele handoff-bundlen (rekkefølge per `botsson/README.md`).
2. Lag en diff-rapport: hver handoff-komponent vs sin target-fil. Kolonner: [komponent, handoff-fil, target-fil, diff-kategorier (layout, farger, animasjon, states, ikoner, tekst), severity].
3. Legg rapporten i `docs/design/botsson/AUDIT-2026-04-22.md` (ny fil).
4. Oppdater `BOTSSON-SYSTEM-MAP.md` L1-rader med audit-resultat.

Deliverable: audit-rapport med prioritert backlog.

### Fase D3.2 — Token-mapping (0.5 uke)

1. Sammenlign `project/tokens.css` med `apps/web/src/app/globals.css` + `packages/design-tokens/src/tokens.ts`.
2. Hver handoff-token som allerede finnes → bekreft mapping.
3. Hver handoff-token som **ikke** finnes → flag som forslag, krever `smartout-nordic-split`-review. Ingen hardkoding.
4. Skriv mapping-tabell i audit-rapporten.

Deliverable: token-mapping med null hardkodede farger.

### Fase D3.3 — Komponentimplementasjon (1 uke)

Rekkefølge (verdi først, risiko sist):

1. **Orb notification-state** — `BotssonOrb.tsx` vs `project/components/orb.jsx`. Jaw-dropper må stemme: mørk core, roterende halo, 3 ripples med stagger 0.8s, throb, shimmer sweep, 5 partikler, bjelle-ikon. Keyframes skal være navngitt per brief (`botsson-notify-rotate`, `-ripple`, `-throb`, `-shimmer`, `botsson-particle-float`).
2. **Emma signature illustrasjon** — `EmmaProfile.tsx` vs `project/components/emma.jsx`. Erstatt "E"-bokstaven med faktisk illustrasjon. Behold eksisterende props.
3. **Immersive backdrop** — utvid `BotssonShell.tsx` immersive-modus vs `project/components/immersive.jsx`. Full-bleed bakgrunn, stemme-sesjon-stemning.
4. **Form-view + Video-view** — `BotssonArena.tsx` placeholders erstattes med faktisk layout fra `project/components/views-*.jsx`.
5. **Settings-view polish** — layout-fix per handoff.
6. **Sticky retract/peek/hover-stater** — revalider mot `project/components/sticky.jsx`. 4s retract-timer, neon sliver, hover voice-kontroller.
7. **Arena resize + drag-constraints** — revalider magnetiske kanter, 10px gap, 40px snap-sone.

Per komponent:
- Bevar eksisterende props som `botsson-harness-builder`-plumbing bruker (`onStateChange`, `density`, `viewId`, `orbState`).
- Kjør `pnpm turbo typecheck` etter hver komponent.
- Oppdater SYSTEM-MAP-raden 🔴 → 🟡 → 🟢 i samme commit.

Deliverable: alle 7 komponenter audited + implementert + type-safe.

### Fase D3.4 — Visuell parity-sjekk (0.5 uke)

1. Rendre `project/Botsson Arena.html` lokalt.
2. Rendre dev-server på port 3060, åpne dashboard med Botsson-overlay.
3. Side-by-side for hver state: orb (6 states) → sticky (3 modi) → arena (12 views) → immersive.
4. Dokumenter avvik → fiks → gjenta til parity.
5. Skjermbilder *kun* hvis Pontus ber om det (per handoff-README).

Deliverable: parity confirmed, alle L1-rader i SYSTEM-MAP er 🟢.

### Fase D3.5 — Handoff + ADR (0.5 uke)

1. Skriv `docs/HANDOFF-botsson-overlay-d3.md` per `/close-feature`-protokollen.
2. ADR hvis det er lagt til nye tokens eller animasjons-keyframes — reserver nummer via `git log --all`.
3. Oppdater `CAMPAIGN-botsson-arena.md` Phase D-rad til 🟢.
4. Oppdater `ROADMAP-ai-harness.md` evidence trail.

Deliverable: handoff + kampanjeoppdatering.

---

## Estimat

- D3.1 audit — 0.5 uke
- D3.2 token-mapping — 0.5 uke
- D3.3 komponenter — 1 uke
- D3.4 parity — 0.5 uke
- D3.5 close-out — 0.5 uke

**Totalt: 3 uker.**

---

## Risiko

| Risiko | Sannsynlighet | Mitigering |
|--------|---------------|------------|
| Handoff-tokens finnes ikke i Nordic Split, krever utvidelse | Høy | D3.2 gjør token-review før implementasjon. ADR for nye tokens. |
| `botsson-harness-builder` har parallelt arbeid i `BotssonTools.ts` som renamer props | Medium | Før D3.3 — verifiser prop-kontrakt med harness-builder-agenten (`useRegisterTools` tool-id-er, view-routing). |
| Immersive bakgrunn bryter DashboardShell-z-index (ADR-0021) | Lav | z-index 65 er allerede reservert for overlayen. Immersive stjeler hele viewport men respekterer shell-grensen. |
| Emma-illustrasjon krever asset som ikke finnes i bundle | Medium | `project/assets/` har `smartout-icon.png` + `smartout-logo.png` men ingen Emma. Hvis emma.jsx er CSS-art, OK. Hvis det referer til bilde som mangler → blokker + be Pontus om asset. |

---

## Ikke-mål

- Ikke endre stage-engine-plumbing (det er `botsson-harness-builder` sitt ansvar i Phase A/B/C).
- Ikke legge til nye views utover de 12 som er i handoffen.
- Ikke endre mobilapp — `apps/mobile/` er utenfor scope (se ADR-0133).
- Ikke re-designe — handoff ER designet.

---

## Links

- Handoff-bundle: `docs/design/botsson/`
- Overlay-brief: `docs/design/BOTSSON-OVERLAY-BRIEF.md`
- System-map L1-seksjon: `docs/architecture/BOTSSON-SYSTEM-MAP.md`
- Kampanje: `docs/plans/CAMPAIGN-botsson-arena.md`
- Eier-agent: `.claude/agents/frontend-designer.md` — seksjon "Botsson Arena Overlay — Implementation Ownership"
- Harness-kontrakt: `.claude/agents/botsson-harness-builder.md` — "First Read" entry #6
