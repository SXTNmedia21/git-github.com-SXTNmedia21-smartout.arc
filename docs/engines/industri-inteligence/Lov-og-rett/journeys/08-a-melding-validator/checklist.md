# Checklist — A-melding validator

| # | Sjekk | Rapport-krav |
|---|-------|--------------|
| 1 | Org-nummer | 9-sifret + gyldig MOD11 |
| 2 | Periode | YYYY-MM, ikke fremtid |
| 3 | Per ansatt: fødselsnr eller D-nr | 11 siffer + gyldig MOD11 + MOD7 |
| 4 | Stillingskode (STYRK-08) | 7-sifret kode fra K-koder-tabell |
| 5 | Lønnskode 10/11 (fastlønn/timelønn) | min én av disse hvis utbetalt grunnlønn |
| 6 | Lønnskode 20 (overtid) | hvis overtid utbetalt |
| 7 | Lønnskode 22 (feriepenger/tips/bonus) | matcher feriepenger-utbetaling |
| 8 | Lønnskode 23 (sluttvederlag) | hvis sluttoppgjør |
| 9 | Skattetrekk-tabell + prosent | matcher skattekort |
| 10 | AGA-grunnlag | sum brutto eks. visse poster |
| 11 | OTP-grunnlag | hvis OTP-pliktig |
| 12 | Arbeidsforhold-status | aktiv / sluttet / permisjon-kode |
| 13 | Sluttdato hvis sluttet | matcher contract.end_date |
| 14 | Sluttkode | korrekt iht. årsak (oppsigelse / avslutning / annet) |
| 15 | Summer matcher | brutto = sum 10+11+20+22+23, etc. |
| 16 | Ingen duplikater | per ansatt-måned ikke rapportert flere ganger |
