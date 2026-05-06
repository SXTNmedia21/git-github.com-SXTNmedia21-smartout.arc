---
title: Linear Follow-up — Cartography Sortie 2 (Reverse-Scan)
status: ready
updated: 2026-04-27
created: 2026-04-27
module: architecture
tags: [cartography, linear, sortie-2, reverse-scan]
---

# Linear Issue Draft — Cartography Sortie 2 (Reverse-Scan)

Klar for å opprettes i Linear. Status: ikke opprettet (Linear MCP krevde OAuth — utsatt til Pontus autoriserer eller oppretter manuelt).

---

## Title

`Cartography Sortie 2: Reverse-scan dashboard moduler — finn eksterne konsumenter`

## Labels

- **Operation →** `audit`
- **Stack →** `TypeScript`
- **Path →** `apps/web/src/app/dashboard`
- **Path →** `scripts/cartography`

## Project / Cycle

Architecture / Modularization

## Body

### 👀 Looking — Hvorfor

Cartography Sortie 1 (PR #268) skannet `apps/web/src/app/dashboard/` og fant **17 fullstendig isolerte moduler**. Listen er en NØDVENDIG men ikke TILSTREKKELIG betingelse for mod-worktree-pilot. Cartography v1 så ikke om disse modulene konsumeres EKSTERNT.

### 🎯 Mål

Skann fra alle ikke-dashboard kilde-områder INN til dashboard-moduler. Output: ny seksjon "External Consumers" i `module-graph.md`.

### 📋 Scope

**Skann FROM:**
- `apps/web/src/app/` (alle ruter UTENFOR `dashboard/`)
- `apps/web/src/components/`, `apps/web/src/lib/`, `apps/web/src/hooks/`
- `apps/mobile/src/`
- `apps/landing/src/`
- `apps/e2e/`
- `packages/*/src/`
- `services/*/src/`

**Skann TO:**
- Imports som peker til `apps/web/src/app/dashboard/<modul>/...`

**Output-format:** `docs/architecture/external-consumers.csv`
```
to_module,from_area,from_file,symbol,import_kind,line_number
```

**Oppdater `module-graph.md`** med:
- Ny seksjon "g) External Consumers per Modul" — tabell sortert etter to_module
- Oppdater "Isolerte moduler"-listen med kun de som er bekreftet isolert (0 cross-module + 0 shared-leakage + 0 external)

### ✅ Akseptansekriterier

- [ ] `external-consumers.csv` finnes og dekker alle 5 from-områder over
- [ ] `module-graph.md` har ny seksjon g) "External Consumers"
- [ ] Liste "Isolerte moduler" oppdatert til "fully-isolated" (alle 3 dimensjoner null)
- [ ] Validering: spot-check 5 random rader mot kilde
- [ ] PR mot development med tittel: `docs(architecture): cartography v2 — reverse-scan`

### ⚠ Forventede funn

Sannsynlige eksterne konsumenter for "isolerte" moduler:
- `schedule` — sannsynlig konsumert av `apps/mobile/`, `packages/ai/` (capabilities)
- `notifications` — sannsynlig konsumert av `packages/notifications/`
- `setup` — sannsynlig konsumert av onboarding-flow utenfor dashboard
- `shift-clock` — sannsynlig konsumert av `apps/mobile/`

Hvis funnene viser at flere moduler ikke er virkelig isolert, må listen smalnes — kanskje bare 5–8 moduler er reelle pilot-kandidater.

### 🚀 Hvorfor det betyr noe

Pontus' tentative pilot-kandidat er `schedule` (forretningsverdi). Hvis reverse-scan viser at `schedule` har 30+ eksterne konsumenter, er den IKKE en god pilot-kandidat — den må avkobles først. Sortie 2 forhindrer at vi velger feil pilot.

### 📌 Beslutning

Bruk samme verktøyvalg som Sortie 1 (ts-morph + tsx). Utvid `scripts/cartography/scan-imports.ts` med en `--reverse` flag, eller skriv `scan-external.ts` som søsterskript.

### 🔗 Links

- Sortie 1 PR: https://github.com/SXTNmedia21/smartout.ai/pull/268
- Spec referanse: `docs/architecture/.cartography/summary.md` (seksjon "Anbefalte neste steg")
- Validering forbehold: `docs/architecture/.cartography/validation.md` (seksjon "Notes for future iterations")

### Estimat

1 arbeidsdag (samme verktøy, samme metode, motsatt retning).

---

## Slik oppretter du

```bash
# Med Linear MCP (etter authenticate):
mcp__plugin_linear_linear__create_issue(
  team="<team-id>",
  title="Cartography Sortie 2: Reverse-scan dashboard moduler — finn eksterne konsumenter",
  description=<body fra over>,
  labels=["audit", "TypeScript", "Path:dashboard"]
)

# Eller manuelt i Linear UI med teksten over.
```
