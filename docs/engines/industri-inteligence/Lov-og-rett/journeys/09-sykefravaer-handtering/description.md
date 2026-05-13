# Beskrivelse — Sykefravær-håndtering

## Use case

Anna er syk dag 1 (egenmelding). Lovsen registrerer + setter opp tidslinje:
> Anna er sykmeldt fra 2026-11-15.
>
> **Tidslinje + frister:**
> - Dag 1-3: egenmelding (uten lege) — OK iht. §8-23
> - Dag 4: sykmelding kreves fra lege
> - Dag 1-16: arbeidsgiverperiode — du betaler 100% lønn
> - Dag 17+: NAV tar over (inntil 6G), refusjon ved gravid/IA
> - **2026-12-13** (4 uker): oppfølgings-plan skriftlig (frist)
> - **2027-01-03** (7 uker): dialog-møte 1 — du innkaller
> - **2027-05-15** (26 uker): dialog-møte 2 — NAV innkaller
> - **2027-11-15** (1 år): verneperiode mot oppsigelse pga sykdom utløper (Aml. §15-8)

## Use case 2 — IA-bedrift

Workspace har IA-avtale → Lovsen flagger:
> Egenmelding utvidet: 8 dager om gangen, max 24 dager/år (vs 3+24 standard).
> Refusjon fra dag 1 hvis sykdommen er knyttet til arbeidet.

## Hvorfor Lovsen er bra

1. **Tidslinje med frister automatisk** — admins glemmer 4-uker-frist for oppfølgings-plan. Lovsen lager kalender-event.
2. **Refusjons-rett-detection** — gravide / kronisk sykdom / IA-avtale = refusjon fra dag 1. Lovsen sjekker `profile`-flagg + workspace-config.
3. **Verneperiode-varsling** — admin kan ikke si opp pga sykdom innen 1 år (§15-8). Lovsen blokkerer terminate-flow + viser dato.
4. **A-melding-status** — sykepenger rapporteres som lønn med kode 10/11 + permisjon-status. Lovsen velger riktig kode.

## Phase 0c+ kobling

- Tier 3 skill (ikke i v0.1.0 ROADMAP — vurder for v0.4.0)
- Integrasjon mot `schedule_absence` + auto-payroll-justering
- NAV-API for sykmelding-import (krever sertifisering)
