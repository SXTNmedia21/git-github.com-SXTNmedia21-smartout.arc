---
title: "Debugging"
module: 9
prerequisites: [01-typescript-runtime, 03-nextjs-fullstack, 04-supabase, 05-database-design]
covers: [stack-traces, rls-debugging, agent-sql, devtools, middleware-debugging, cookie-debugging]
smartout_files:
  - apps/web/src/middleware.ts
  - apps/web/src/lib/security.ts
  - docs/learnings/
smartout_learnings: [0001, 0002, 0003, 0004, 0006, 0008, 0016]
updated: 2026-03-21
---

# Debugging

> Debugging er ferdigheten som sparer mest tid. Agenter skriver kode. Du finner ut hvorfor den ikke virker.

## Konsepter

### Feil har adresser — lær å lese dem

En stack trace er en feilmelding med veibeskrivelse. Den forteller deg: hva som gikk galt, i hvilken fil, på hvilken linje, og hvilken kjede av funksjonskall som førte dit. De fleste ignorerer alt unntatt den første linjen — men de midterste linjene viser _hvorfor_ feilen oppstod, ikke bare _hvor_.

Første steg alltid: **er dette en server-feil eller en klient-feil?** I Next.js kjører kode i to ulike miljøer — Node.js (server) og browseren (klient). Stack traces fra serveren dukker opp i terminalen. Stack traces fra klienten dukker opp i browser-konsollen. Behandler du en server-feil som en klient-feil (eller omvendt) leter du på feil sted.

Server-stack traces har filstier (`apps/web/src/app/api/...`). Klient-stack traces har bundlede filnavn med chunk-referanser. Hvis du ser `webpack-internal://` — det er klienten. Hvis du ser full filsti — det er serveren.

### RLS-debugging: det usynlige filteret

Row-Level Security er den vanligste kilden til "det funker ikke og det er ingen feilmelding." RLS blokkerer ikke med en error — den returnerer bare tomme resultater. Du spør etter data, får ingenting tilbake, og alt _ser_ riktig ut.

Debug-mønsteret er alltid det samme:

**Steg 1:** Verifiser at dataen finnes. Bruk `service_role`-klienten (som omgår RLS) for å kjøre samme query. Får du data? Da er det en RLS-policy som blokkerer. Får du ingenting? Da er dataen ikke der.

**Steg 2:** Sjekk hva RLS-policyen forventer. De fleste policies i Smartout sjekker `workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))`. Spørsmål å stille: Returnerer `auth.uid()` riktig bruker-ID? Returnerer `get_workspace_ids_for_user()` de riktige workspace-ID-ene? Har raden riktig `workspace_id`?

**Steg 3:** Test policyen isolert. Kjør `SELECT get_workspace_ids_for_user('user-uuid-her')` manuelt og sjekk resultatet.

### Middleware-debugging: rekkefølgen er alt

`apps/web/src/middleware.ts` er 277 linjer med auth, subdomain-routing, godmode-cache, og sikkerhetssjekker. Feil her manifesterer seg som: uventede redirects, brukere som logges ut, 400-feil på alle requests, eller sider som laster med feil data.

Middleware kjører sekvensielt fra topp til bunn. En sjekk tidlig i flyten kan stoppe eller endre requesten før den når koden din. Alltid les middleware fra linje 1 — hopp aldri til midten.

Det farligste: middleware kan endre response-objektet (cookies, headers, redirects) og disse endringene er stille. Ingen feilmelding, ingen logg — bare en cookie som forsvinner eller en redirect som snapper inn.

### Agent-SQL: stol på, men verifiser

Agenter genererer SQL for migrasjoner og queries. Det kompilerer nesten alltid. Det er logisk korrekt — _nesten alltid._ De farlige feilene er semantiske: queryen returnerer data, men feil data. Migrasjonen kjører, men lager feil constraint.

Regelen: **kjør alltid agent-SQL manuelt først.** For queries: kjør i Supabase SQL Editor og sjekk resultatet. For migrasjoner: kjør `supabase db reset` lokalt og verifiser tabellstrukturen. `EXPLAIN ANALYZE` viser deg utførelsesplanen — nyttig for å sjekke at indekser brukes.

### Browser DevTools: fire faner som teller

**Network-tab:** Viser alle requests fra browseren. Filtrer på XHR/Fetch for API-kall. Sjekk statuskoder (200 OK, 401 Unauthorized, 400 Bad Request, 500 Internal Server Error). Klikk på en request for å se headers, request body, og response body. Hvis en Route Handler returnerer feil — svaret er her.

**Console-tab:** Viser JavaScript-feil, advarsler, og `console.log`-output. Klient-side stack traces dukker opp her. React-feil (hydration mismatch, invalid hook calls) vises her.

**Application-tab:** Viser cookies, localStorage, og sessionStorage. For Supabase Auth: sjekk at `sb-*`-cookies finnes og har gyldige verdier. Hvis cookies mangler etter en redirect — se copySessionCookies-mønsteret.

**Sources-tab:** Breakpoints. Sett et breakpoint i en klient-komponent for å pause kjøringen og inspisere state. Mindre brukt enn de andre tre, men uvurderlig for kompleks klientlogikk.

### Webhook-debugging: out-of-order er normalen

Eksterne tjenester (DocuSeal, Stripe, Twilio) sender webhooks. De kommer ikke alltid i riktig rekkefølge. To webhooks fra samme event kan ankomme millisekunder fra hverandre. Retry-mekanismer kan sende samme webhook flere ganger.

Forsvar: idempotency keys (ignorer duplikater), status-vekter (kun forward-transitions), og `activity_trail`-logging som gjør det mulig å rekonstruere hendelsesforløpet.

## I Smartout

**copySessionCookies()-fellen (Learning-0002).** Middleware kaller `updateSession()` som refresher Supabase auth-cookies. Deretter redirecter den brukere som mangler tilgang. Men `NextResponse.redirect()` lager en ny response med tomt cookie-jar — de refreshede cookiene ble stille tapt. Symptom: brukere logget ut tilfeldig etter redirect. Ingen feilmelding, ingen stack trace. Fix i `apps/web/src/middleware.ts` linje 25-32: `copySessionCookies(source, target)` kopierer alle cookies fra den opprinnelige responsen til redirect-responsen. Må brukes ved ALLE redirect-punkter etter `updateSession()`.

**x-forwarded-host 400-fellen (Learning-0001 + 0008).** Etter deploy til Vercel returnerte 100% av requests 400 Bad Request. Build OK, env vars OK, migrasjoner OK. `detectSuspiciousRequest()` i `apps/web/src/lib/security.ts` flagget `x-forwarded-host` som host header injection. Men Vercel setter dette headeret på _alle_ requests — standard reverse proxy-oppførsel. Funket lokalt (dev-skip), brakk i prod. Debug-metode: Network-tab → alle requests fikk 400 → grep i middleware → fant security-sjekken → logget headers i prod → oppdaget at Vercel setter `x-forwarded-host`. Fix: fjernet `x-forwarded-host` fra `SUSPICIOUS_HEADERS`.

**Webhook status regression (Learning-0004).** DocuSeal-webhooks ankom i feil rekkefølge — `viewed`-event overskrev `signed`-status. Debug: `activity_trail`-logg viste at contract-status gikk bakover. Fix: `statusWeight`-map med numeriske vekter — bare forward-transitions tillatt. `if (newWeight <= currentWeight) return { skipped: "status_not_advanced" }`.

**Optimistic locking (Learning-0003).** To samtidige publish-requests leste samme versjon → begge skrev → dupliserte versjonsnummer. Debug: code review fant at `Promise.all()` ble brukt for avhengige skriveoperasjoner. Fix: `.eq("version", expectedVersion)` returnerer 409 Conflict ved kollisjon. Sekvensielt, ikke parallelt, for avhengige skrivinger.

**DocuSeal webhook-verifisering (Learning-0006).** Code review flagget at webhook-verifisering brukte `===` i stedet for HMAC. Så ut som en sikkerhetsbug. Realitet: DocuSeal bruker plain shared secret — ikke HMAC. Det er by design. "Fikse" det til HMAC hadde knekt integrasjonen. **Lærdom: sjekk alltid leverandørdokumentasjon før du "fikser" det en agent flaggar som usikkert.**

## Fallgropar

**"Det returnerer bare tom array."** Nesten alltid RLS. Bruk `service_role` for å verifisere at data eksisterer, deretter sjekk at `get_workspace_ids_for_user()` returnerer riktige workspace-IDer for den innloggede brukeren.

**"Det funker lokalt men ikke i prod."** Sjekk tre ting: (1) Environment variables — mangler noe i Vercel som finnes i `.env.local`? (2) Middleware-oppførsel — security-sjekker som har dev-skip? (3) Headers — reverse proxy-headers som ikke finnes lokalt (`x-forwarded-host`, `x-vercel-ip-*`).

**Agent-kode som "fikser" noe som ikke er feil.** Learning-0006 (DocuSeal HMAC) er prototypen. Agenter pattern-matcher mot generisk sikkerhetspraksis uten å sjekke leverandørspesifikk oppførsel. Alltid verifiser mot offisiell dokumentasjon før du godtar en agent-"fix."

**`as unknown as Json` mangler.** 38 forekomster i 21 filer. Når en Supabase-insert feiler med type-feil på et JSONB-felt — det er nesten alltid manglende `as unknown as Json` cast. Agenter glemmer denne bridge konsekvent.

---

## Referanse

### Debug-beslutningstre

| Symptom                         | Første steg                                    | Andre steg                                        | Tredje steg                            |
| ------------------------------- | ---------------------------------------------- | ------------------------------------------------- | -------------------------------------- |
| Tom array / ingen data          | Kjør query med `service_role`                  | Sjekk RLS-policy + `get_workspace_ids_for_user()` | Verifiser `workspace_id` på raden      |
| 400 Bad Request (alle requests) | Network-tab: sjekk response body               | Sjekk middleware security-sjekker                 | Logger Vercel-headers                  |
| 401 Unauthorized                | Application-tab: finnes `sb-*`-cookies?        | Sjekk token expiry                                | Verifiser middleware `updateSession()` |
| 500 Internal Server Error       | Terminal: les server stack trace               | Identifiser filen og linjen                       | Sjekk input-data og edge cases         |
| Brukere logges ut tilfeldig     | Sjekk redirect-punkter i middleware            | Verifiser `copySessionCookies()`                  | Sjekk cookie-expiry timing             |
| Data "forsvinner" etter save    | Sjekk at INSERT/UPDATE returnerer data         | Verifiser RLS INSERT/UPDATE-policies              | Sjekk for race conditions              |
| Webhook oppfører seg rart       | Sjekk `activity_trail` for hendelsesrekkefølge | Verifiser idempotency-håndtering                  | Sjekk status-weight logikk             |
| Type-feil på JSONB-insert       | Legg til `as unknown as Json`                  | Regenerer `database.types.ts`                     | Sjekk at Zod-schema matcher DB-schema  |

### RLS debug-steg (copy-paste-vennlig)

```
-- Steg 1: Finnes dataen? (omgår RLS)
-- Bruk service_role-klienten eller Supabase SQL Editor
SELECT * FROM target_table WHERE id = 'xxx';

-- Steg 2: Hva returnerer brukerens workspace-liste?
SELECT get_workspace_ids_for_user('user-uuid');

-- Steg 3: Har raden riktig workspace_id?
SELECT workspace_id FROM target_table WHERE id = 'xxx';

-- Steg 4: Sjekk policyen direkte
SELECT * FROM pg_policies WHERE tablename = 'target_table';
```

### Middleware debug-rekkefølge

`apps/web/src/middleware.ts` kjøres i denne rekkefølgen — feil i et tidlig steg påvirker alt nedstrøms:

| Steg | Hva                                       | Feilmodus                                |
| ---- | ----------------------------------------- | ---------------------------------------- |
| 1    | Security-sjekker (headers, suspekt input) | 400 på alle requests                     |
| 2    | `updateSession()` — refresh auth cookies  | Utlogget etter cookie-expiry             |
| 3    | Auth-sjekk — er brukeren logget inn?      | Redirect til login                       |
| 4    | Subdomain-routing                         | Feil workspace-kontekst                  |
| 5    | Godmode-cache                             | Stale data for admin-brukere             |
| 6    | Redirect-logikk                           | Cookies tapt uten `copySessionCookies()` |

### Statuskoder å kjenne igjen

| Kode | Betyr                 | Vanlig årsak i Smartout                                          |
| ---- | --------------------- | ---------------------------------------------------------------- |
| 200  | OK                    | Alt bra                                                          |
| 201  | Created               | Vellykket INSERT                                                 |
| 400  | Bad Request           | Zod-validering feilet, eller security-sjekk blokkerer            |
| 401  | Unauthorized          | Manglende eller expired auth-token                               |
| 403  | Forbidden             | RLS-policy blokkerer (sjeldent eksplisitt — oftest tom response) |
| 404  | Not Found             | Feil URL/route, eller rad finnes ikke                            |
| 409  | Conflict              | Optimistic locking — versjon mismatch                            |
| 500  | Internal Server Error | Uventet feil i server-kode — les stack trace                     |

### DevTools hurtigreferanse

| Behov           | Fane                  | Hva du ser etter                           |
| --------------- | --------------------- | ------------------------------------------ |
| API-kall feiler | Network → XHR/Fetch   | Statuskode, response body, request headers |
| JavaScript-feil | Console               | Røde feilmeldinger, stack trace            |
| Cookies mangler | Application → Cookies | `sb-*`-cookies, expiry-tid                 |
| Komponent-state | React DevTools        | Props, state, context-verdier              |
| Ytelse          | Network → Timing      | TTFB, content download, total tid          |

### Webhook-forsvarsmønster

| Trussel            | Forsvar              | Smartout-implementering                                |
| ------------------ | -------------------- | ------------------------------------------------------ |
| Duplikat-webhook   | Idempotency key      | Sjekk `idempotency_key` før prosessering               |
| Feil rekkefølge    | Status-vekter        | `statusWeight`-map, kun forward-transitions            |
| Replay-angrep      | Timestamp-validering | Avvis webhooks eldre enn X minutter                    |
| Forfalsket webhook | Secret-verifisering  | Sjekk mot shared secret (DocuSeal) eller HMAC (Stripe) |
