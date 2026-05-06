---
title: Module Cartography v1 — Sortie Summary
status: done
updated: 2026-04-27
created: 2026-04-27
module: architecture
tags: [cartography, sortie, summary]
---

# Cartography Sortie v1 — Summary

Read-only kartlegging ferdig. Branch: `chore/module-cartography`. Kun `docs/architecture/` og `scripts/cartography/` berørt — ingen produksjonskode endret.

## Tidsbruk

Alle 5 faser kjørt i én sesjon. Estimert spec-varighet: 1–2 arbeidsdager. Faktisk sortie: ~1 arbeidsøkt (mest interaktive stoppunkt med Pontus, ikke skripting).

## Hovedfunn

| Tall | Verdi |
|---|---|
| Moduler skannet | 30 |
| Source files parset | 684 |
| Import declarations | 3,616 |
| Cross-module symbol-rader | 35 |
| Cross-module unike kanter | **6** |
| Shared-leakage rader | 36 |
| Isolerte moduler | **17** |
| Klynger (≥5 kabler) | 1 (`season + year-wheel`) |

**Hovedbudskap:** Smartout-moduler er løsere koblet enn antatt. Modulariseringen som planlegges er en formalisering, ikke en refaktorering. Den ene reelle klyngen er semantisk meningsfull (kalenderår = sesong-domene). Den reelle koblingen ligger i shared-laget — ikke mellom moduler.

## Friksjonspunkter

1. `pnpm tsx` resolved fra nærmeste `package.json` (apps/web), ikke repo-root. Workaround: `pnpm -w tsx`.
2. `ts-morph` deklarert men ikke installert. `pnpm install --frozen-lockfile` krevd før første scan.
3. Private folders (`_hooks/`, `_components/` etc.) ble initielt scannet som "from"-moduler. Filtrert ut — disse er shared infrastructure, ikke moduler.
4. Spec's "19 hits"-foranalyse matchet ikke AST/grep (begge enige om 14 import-decls / 26 symbol-rader). Bruker reproduserbare tall.

## Kritisk forbehold

⚠ Cartography skanner KUN under `apps/web/src/app/dashboard/`. Imports fra andre app-områder eller `packages/*` til dashboard-moduler er **ikke målt**. Dette betyr at "isolert modul"-listen er en NØDVENDIG men ikke TILSTREKKELIG betingelse for mod-worktree-pilot. Reverse-scan (sortie 2) må kjøres før pilot-beslutning.

## Anbefalte neste steg

1. **Sortie 2 — Reverse-scan (1 dag).** Skann `apps/web/src/app/`, `packages/*`, `apps/*` for imports som peker INN i dashboard-moduler. Output: ny seksjon "External consumers" i `module-graph.md`.
2. **Beslutningsmøte etter sortie 2.** Pontus velger pilot-mod basert på bekreftet isolasjon.
3. **Pilot-mod sortie.** Implementér mod-worktree-arkitektur på valgt modul.

Pontus' tentative valg: `schedule` (størst forretningsverdi blant isolerte). Avhenger av reverse-scan-resultat.

## Leveranser

| Fil | Innhold |
|---|---|
| `docs/architecture/module-graph.md` | Lesbar rapport, 6 spec-seksjoner + TL;DR + edge-list |
| `docs/architecture/module-graph.csv` | Rådata, 35 cross-module symbol-rader |
| `docs/architecture/module-matrix.csv` | 30×30 sparsom matrise |
| `docs/architecture/shared-leakage.csv` | 36 shared-leakage symbol-rader |
| `docs/architecture/.cartography/modules.json` | Modul-liste fra Fase 1 |
| `docs/architecture/.cartography/validation.md` | Fase 4 valideringsrapport |
| `docs/architecture/.cartography/summary.md` | Denne filen |
| `scripts/cartography/scan-imports.ts` | Fase 2 AST-skanner |
| `scripts/cartography/aggregate.ts` | Fase 3 aggregator |

## Reprodusering

```bash
# from repo root
pnpm install --frozen-lockfile
pnpm -w tsx scripts/cartography/scan-imports.ts
pnpm -w tsx scripts/cartography/aggregate.ts
```

Idempotent. Kan kjøres på nytt etter kode-endringer for ferskt øyeblikksbilde.
