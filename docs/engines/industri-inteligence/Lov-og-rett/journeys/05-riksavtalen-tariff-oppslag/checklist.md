# Checklist — Riksavtalen tariff-oppslag

| # | Sjekk | Pass-krav |
|---|-------|-----------|
| 1 | Workspace har aktiv `workspace_framework_binding` med Riksavtalen | Binding `is_active=true`, `framework.name LIKE '%Riksavtalen%'` |
| 2 | Stilling matcher Riksavtalen-kategori | servitør, kokk, bartender, hotellresepsjonist, etc. |
| 3 | Tariff-versjon gyldig | `tariff_rate_table.valid_from <= today < valid_to` |
| 4 | Min-sats > 0 | sanity-sjekk |
| 5 | Helgetillegg-sats hentet | tilskudd lørdag/søndag |
| 6 | Kveldstillegg-sats | etter 18:00 hverdager |
| 7 | Natt-tillegg | 21:00 / 23:00 / 24:00 alt etter spec |
| 8 | Tarifftillegg overstyrt på workspace? | sjekk `framework_rule.overrides[]` for workspace-spesifikke avtaler |

## Eksempel-output

```json
{
  "confidence": "HØY",
  "valid_from": "2026-04-01",
  "valid_to": "2027-03-31",
  "position": "servitør",
  "min_hourly_rate": 198.50,
  "tillegg": {
    "lørdag": 47.00,
    "søndag": 64.00,
    "kveld_18-21": 23.00,
    "natt_21-06": 56.00,
    "helligdag": 100.00
  },
  "source": "nho-reiseliv.fetch_riksavtalen(version='2026-04')",
  "next_revision": "2027-04-01"
}
```

## Phase 0c stub

Hardkodet snapshot fra siste kjente Riksavtalen. Ikke live-fetch. Real implementation Phase 0c+ via `nho-reiseliv` MCP-server.
