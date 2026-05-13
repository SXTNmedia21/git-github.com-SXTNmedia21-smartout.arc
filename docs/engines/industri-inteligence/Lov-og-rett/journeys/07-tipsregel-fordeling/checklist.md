# Checklist — Tipsregel-fordeling

| # | Sjekk | Lov | Pass-krav |
|---|-------|-----|-----------|
| 1 | Tipsregel finnes | `contract_tip_rule` | Workspace har minst én aktiv regel |
| 2 | Fordelings-metode satt | Skattetrekkforskrift | One of: per-time-vekt / per-stilling-vekt / equal-split / shift-faktor |
| 3 | Skatteplikt fra første krone | Skattetrekkforskrift §2-1 | `taxable: true` flagget — tips beskattes som lønn |
| 4 | A-melding-kode 22 | A-meldingforskrift | Rapporteres separat fra grunnlønn |
| 5 | AGA (arbeidsgiveravgift) | Folketrygdloven §23-2 | AGA betales av tips-utbetaling |
| 6 | OTP-grunnlag | OTP-loven | Tips inkluderes i pensjons-grunnlag (debattert — sjekk avtale) |
| 7 | Feriepenge-grunnlag | Ferieloven §10 | Tips inkluderes i grunnlag for feriepenger |
| 8 | Cash vs digital | — | Begge må rapporteres, kontant tips IKKE eksempt |
| 9 | Fordelings-transparens | Arbeidsmiljølovens medvirkning | Ansatte må kunne se hvordan tips fordeles |
| 10 | Tipspott vs personlig | Avtale-spørsmål | Workspace må ha tydelig regel: pott eller personlig |

## Fordelings-metoder (`contract_tip_rule.distribution_method`)

| Metode | Beskrivelse | Eksempel |
|--------|-------------|----------|
| `equal_split` | Lik fordeling på alle på shift | 4 personer, 2000 kr tips → 500 hver |
| `hours_weighted` | Vektet etter timer | Person A 8t, B 4t → A får 2/3, B får 1/3 |
| `role_weighted` | Vektet etter stilling | Servitør vs runner ulik vekt |
| `personal_assigned` | Ansatt får sine egne tips | Personlig kort-tips (vanlig i bar) |
| `shift_factor` | Vektet etter dag/kveld-faktor | Kveldsservitør får mer enn lunsj |

## Phase 0c stub

Hardkodet `equal_split` som default. Real implementation Phase 0c+ via `contract_tip_rule`-CRUD + commit-flow.
