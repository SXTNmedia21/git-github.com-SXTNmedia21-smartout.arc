---
title: Handlingsplan for personvern og sikkerhet
status: draft
updated: 2026-04-13
created: 2026-04-13
module: legal
tags: [gdpr, personvern, sikkerhet, handlingsplan]
---

# Handlingsplan for personvern og sikkerhet

## Smartout AS — Slik jobber vi med personvern

Vi bygger Smartout med personvern som fundament, ikke som ettertanke. Denne planen beskriver konkrete steg vi tar for å sikre at plattformen vår oppfyller kravene i GDPR og norsk personvernlovgivning — og hva vi jobber med akkurat nå.

---

## Hva vi allerede har på plass

Smartout er bygget med sikkerhet og personvern fra dag én. Her er det vi har implementert i plattformen:

**Tilgangskontroll og autentisering**
- Radnivå-sikkerhet (Row-Level Security) på alle brukertilgjengelige databasetabeller — hver virksomhet ser kun sine egne data
- Fire rollenivåer (ansatt, leder, administrator, eier) med granulær tilgangsstyring
- JWT-basert autentisering med 1 times levetid og automatisk refresh-token rotasjon
- Hastighetsbegrensning på innlogging, OTP, API og kontoopprettelse — med fail-closed design som blokkerer trafikk ved systemfeil (heller for strengt enn for åpent)

**Kryptering**
- All trafikk mellom bruker og plattform er kryptert med TLS 1.2+
- Data kryptert i hvile (AES-256) hos databaseleverandør
- Webhook-signaturverifisering (ECDSA P-256 for e-post, HMAC for e-signatur og betaling)

**Beskyttelse av sensitive opplysninger**
- Personnummer og bankkontonummer kan kun registreres via en dedikert, auditert funksjon — selve verdiene lagres aldri i revisjonsloggen
- Administratorer må gjennom en sikret prosess for å oppdatere PII — hvem som gjorde hva logges, men ikke hva verdiene er

**Revisjonslogg**
- Uforanderlig aktivitetslogg: kun innsetting tillatt, ingen kan endre eller slette poster
- Full livsløpssporing av kontrakter med IP-adresse og nettleserinformasjon
- Dedikert logg for plattformadministrasjon og personifisering med begrunnelseskrav

**Infrastruktur**
- Primær database i EU (Supabase på AWS) — ingen personopplysninger lagres utenfor EOS som hovedregel
- Produktanalyse via PostHog EU-kluster (`eu.i.posthog.com`)
- Utvikling skjer alltid mot isolert lokalt miljø — aldri mot produksjonsdatabase

**Sletting og anonymisering**
- Anonymiseringsfunksjon for brukerprofiler som overskriver all PII med anonymiserte verdier
- Anonymisering av avslåtte/utløpte kontrakter etter 3 år (i tråd med bokføringsloven)
- Kontoen slettes fullstendig ved brukerens forespørsel (kaskaderende sletting)
- Konfigurerbare oppbevaringsregler per kommunikasjonskanal (standard: 365 dager meldinger, 90 dager media)
- Invitasjonslenker utløper automatisk etter 7 dager

---

## Det vi jobber med nå

### Leverandørgjennomgang

Vi gjennomgår alle underleverandører for å verifisere og dokumentere databehandlingsavtaler (DPA-er). Plattformen bruker 19 underleverandører, og de fleste store SaaS-leverandører har allerede standard DPA-er som del av sine tjenestevilkår.

**Verifisering av eksisterende DPA-er (de fleste er allerede tilgjengelige):**

Supabase, Stripe, Vercel, PostHog, Sentry, SendGrid, Twilio, OpenAI, Expo og Google har alle standard DPA-er tilgjengelig via sine nettsider eller dashboards. Oppgaven er å bekrefte at vi har akseptert disse og arkivere dokumentasjonen sentralt.

**Leverandører som krever direkte oppfølging:**

- **DocuSeal (e-signatur):** Vår e-signaturleverandør mottar personnummer, adresse og lønnsinformasjon som del av arbeidsavtaler. Vi vurderer om personnummer kan holdes utenfor selve signeringsflyten og i stedet påføres etter signering. Vi sjekker også DocuSeals sertifiseringer og gjennomfører en Transfer Impact Assessment (TIA) for denne overføringen.
- **OpenRouter (AI-gateway):** Vi formaliserer DPA og verifiserer at «no training on customer data»-klausuler gjelder for alle modeller vi bruker. Arbeidsplasskontekst sendes til AI-modeller for veiledning — vi implementerer systematisk PII-filtrering for å sikre at direkte personidentifiserbare opplysninger ikke inkluderes.
- **Ultravox, LiveKit, Serper:** Mindre leverandører der vi tar direkte kontakt for å sikre at DPA-er er på plass.

Alle DPA-er arkiveres sentralt når de er verifisert.

### Konsekvensanalyse (DPIA)

Vi gjennomfører en formell personvernkonsekvensanalyse (GDPR art. 35) for plattformen. Kombinasjonen av personnummer, AI-behandling, stemmedata og tidsregistrering gjør dette nødvendig. DPIA-en dekker:

- AI-behandling av arbeidsplasskontekst
- Stemmedata via Ultravox
- Personnummer i e-signaturflyten
- Tidsregistrering og eventuell GPS-funksjonalitet

---

## Det vi gjør snart

### Samtykke for stemme-AI

Vi implementerer en tydelig informasjons- og samtykkeflyt før AI-stemmeøkter starter. Brukere skal vite at stemmedata behandles i sanntid av en USA-basert leverandør, og chat tilbys alltid som alternativ. Stemmedata lagres ikke — den strømmes i sanntid og forkastes umiddelbart etter prosessering.

### PII-filtrering i analyse- og feilverktøy

Vi gjennomgår konfigurasjonene for PostHog (produktanalyse) og Sentry (feilovervåking) for å sikre at personopplysninger ikke fanges utilsiktet:

- PostHog: Verifisere autocapture-konfigurasjon og sikre at sensitive skjemafelt er unntatt fra automatisk logging
- Sentry: Implementere filtrering som fjerner PII fra feilrapporter, og blokkere logging av request body for sensitive endepunkter

Begge verktøyene er allerede konfigurert med fornuftige standardinnstillinger (PostHog bruker EU-kluster og pseudonymiserte profiler), men vi strammer inn ytterligere.

### Profilbilder

Vi vurderer tilgangsnivået for profilbilder. I dag er avatars-bucketen offentlig tilgjengelig. Vi tar en bevisst beslutning om dette er akseptabelt (profilbilder er generelt lav risiko) eller om vi bør bytte til private URLer med signert tilgang.

### LiveKit metadata

Vi gjennomgår hvilke personopplysninger som inkluderes i LiveKit-tokens for sanntidskommunikasjon. I dag sendes visningsnavn og profilbilde som metadata. Vi vurderer om dette kan minimeres uten å påvirke brukeropplevelsen.

---

## Det vi planlegger

### Personvernerklæring

Vi utarbeider oppdaterte personvernerklæringer — én for ansatte (registrerte) og én for kunder (behandlingsansvarlige). Disse skal reflektere faktisk databehandling, inkludert AI-funksjonalitet, stemmedata og underleverandørkjede. Erklæringene publiseres i plattformen og på smartout.ai.

### Behandlingsprotokoll (GDPR art. 30)

Vi oppretter en formell protokoll over alle kategorier av behandlingsaktiviteter. Mye av grunnlaget er allerede dokumentert i Databehandlingsavtalen — oppgaven er å formalisere det i riktig format.

### Automatisert oppbevaringsrutiner

Vi bygger ut automatisert kjøring av oppbevaringsregler:
- Automatisk anonymisering av utløpte kontrakter etter 3 år
- Automatisk sletting av meldinger og media etter konfigurerte oppbevaringstider
- Logging av all automatisk sletting i revisjonsloggen

Anonymiseringsfunksjonene finnes allerede — vi ferdigstiller automatisert kjøring og verifiserer at de fungerer korrekt.

### Dataeksport (dataportabilitet)

Vi bygger en admin-funksjon for fullstendig dataeksport i maskinlesbart format (JSON/CSV), slik at virksomheter kan hente ut sine data ved forespørsel eller ved avslutning av kundeforholdet.

### Cyberforsikring

Vi vurderer hensiktsmessig cyberforsikring som dekker personvernbrudd og datainnbrudd. Dette er under avklaring.

---

## Tidslinje

```
April 2026
  Leverandørgjennomgang: verifisere standard-DPA-er (Supabase, Stripe, Vercel, PostHog m.fl.)
  Oppstart DPIA

Mai 2026
  DocuSeal: TIA og vurdering av personnummer i signeringsflyten
  OpenRouter: formell DPA og no-training-verifisering
  Samtykkeflyt for stemme-AI
  PostHog/Sentry: PII-filtrering

Juni 2026
  DPIA ferdigstilt
  Profilbilder og LiveKit metadata: beslutning og eventuell endring
  Personvernerklæring (utkast)

Q3 2026
  Personvernerklæring publisert
  Art. 30-protokoll ferdig
  Automatisert oppbevaringsrutiner
  Dataeksport-funksjon
  Cyberforsikring avklart
```

---

*Denne planen gjennomgås månedlig og oppdateres etter hvert som arbeidet skrider frem.*
