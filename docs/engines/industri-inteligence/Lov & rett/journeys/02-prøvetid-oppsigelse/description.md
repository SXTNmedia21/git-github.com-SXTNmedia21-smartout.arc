# Beskrivelse — Prøvetid-oppsigelse

## Use case

Pontus tester en ny servitør Jonas. Etter 3 uker ser han at Jonas ikke møter til avtalt tid og misforstår bestillinger. Pontus spør Lovsen: "Kan jeg si opp Jonas i prøvetid?"

Lovsen kjører checklist + svarer:

> Ja — Aml. §15-6 første ledd tillater oppsigelse i prøvetid for "manglende tilpasning, faglig dyktighet eller pålitelighet". Det er en lavere terskel enn saklig grunn etter §15-7, men ikke "ingen grunn".
>
> [HØY confidence — Aml. §15-6 sitert direkte]
>
> **Sjekk før du går videre:**
> 1. Kontrakten har 6 måneders prøvetid (utløper 2026-08-15) — du er innenfor ✅
> 2. Sykefravær-dager fratrekkes prøvetiden (§15-6 4. ledd) — Jonas har vært syk 2 dager, prøvetid utvides til 2026-08-17
> 3. Oppsigelsesfristen i prøvetid er 14 dager hvis ikke annet er avtalt (§15-3 7. ledd) — kontrakten har 14 dager ✅
>
> **Anbefaling:**
> - Dokumenter de spesifikke episodene (datoer + observasjoner)
> - Skriftlig oppsigelse leveres personlig eller rekommandert (§15-4)
> - Oppgi begrunnelse hvis ansatt ber om det
> - Informer om forhandlingsrett (§17-3)
>
> *Disclaimer: jeg gir veiledning, ikke juridisk rådgivning. Hvis Jonas mener oppsigelsen er ugyldig — kontakt advokat før møte.*

## Hvorfor Lovsen er bra på dette

1. **Sykefravær-pause regnet inn automatisk** — mange admins glemmer §15-6 4. ledd som forlenger prøvetid med antall sykedager. Lovsen sjekker `schedule_absence` for `absence_type='sick'` og justerer.

2. **Skiller §15-6 fra §15-7** — prøvetid har egen lavere terskel. Lovsen tar ikke admin med på "saklig grunn"-jakt unødvendig.

3. **Diskriminering-sjekk** — siste checklist-punkt fanger hvis grunnen er reell (faglig svikt) vs ulovlig (gravid, alder, etnisitet). Stopper feil der.

4. **C4 read-only** — Lovsen kan ikke commit oppsigelse direkte. Admin må gjøre det selv via dashboard (governance gate). Lovsen leverer ammunisjon, admin trekker.

## Når Lovsen IKKE skal kjøres

- Bulk-cleanup av "døde" profiler (`profile.status='inactive'` lenge) — bruk separat archival-flow
- Avskjedigelser (§15-14 grov mislighold) — eskaler direkte til advokat
- Innleide vikarer på `is_temp_worker=true` — innleier-arbeidsgiver har ansvar

## Eskalerings-vei

- Tvist om grunn = LAV confidence = anbefal advokat
- Sykmeldt på oppsigelses-tidspunkt = §15-8 verneperiode-vurdering = kompleks, eskaler
- Gravid/foreldrepermisjon = §15-9 strengt forbud = HARD STOPP

## Phase 0c+ kobling

- Skill `prøvetid-tracker` (Tier 3, ROADMAP v0.2.0) automatiserer denne checklisten
- Integrasjon med `schedule_absence`-sjekk
- A-melding sluttkode generering når oppsigelse committes
