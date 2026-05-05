# Checklist — Feriepenger-kalkulator

| # | Sjekk | Lov | Pass |
|---|-------|-----|------|
| 1 | Feriepengegrunnlag korrekt | Ferieloven §10 (1) | Sum brutto utbetalt forrige år, eks. tidligere feriepenger, sluttvederlag, naturalia |
| 2 | Sats lovlig | Ferieloven §10 (3) | 10.20% min, 12% standard m/avtale, 14.30% m/6. ferieuke |
| 3 | Aldersgruppe | Ferieloven §10 (4) | Ansatt over 60 → +2.3% (totalt 12.5%/14.3%/16.6%) |
| 4 | Sluttoppgjør | Ferieloven §11 (3) | Ved fratreden: alt opptjent feriepenger utbetales + ikke-tatt ferie i året |
| 5 | Skatt-trekk | Skattetrekkforskriften | Trekkfri ved utbetaling neste år (juni). Skattes ved utbetaling samme år (sluttoppgjør) |
| 6 | A-melding-rapport | A-meldingforskriften | Kode 20 (lønn), Kode 22 (feriepenger), Kode 23 (sluttvederlag) |
| 7 | Tariff-bonus | Riksavtalen §X | Hvis tariff-bundet workspace + over-tariff-sats → bruk over-sats |

## Faktiske beregningseksempler

**Standard 12% / 22 år / 32 000 kr brutto/mnd:**
```
Grunnlag = 32 000 × 12 = 384 000
Feriepenger = 384 000 × 12% = 46 080
Utbetalt juni neste år, trekkfri
```

**6. ferieuke 14.3% / 35 år / 40 000 kr brutto/mnd:**
```
Grunnlag = 480 000
Feriepenger = 480 000 × 14.3% = 68 640
```

**Over 60 år tillegg / 12% + 2.3% = 14.3% / 60 000 kr/mnd:**
```
Grunnlag = 720 000
Feriepenger = 720 000 × 14.3% = 102 960
```

**Sluttoppgjør midt i året:**
```
Grunnlag = brutto utbetalt fra 1.1 til opphørsdato
Pluss = ikke-tatt ferie i året (verdsatt)
Skatt-trekk = ja (utbetales samme år)
A-melding = kode 22 + 23
```
