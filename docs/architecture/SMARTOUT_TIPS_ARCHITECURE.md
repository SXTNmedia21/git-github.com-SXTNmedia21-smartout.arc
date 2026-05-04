# ARCHITECTURE.md — Tips Module (Smartout v3)

> **Status:** Spesifikasjon for implementering
> **Stack:** Next.js App Router + Supabase (Postgres + RLS) + TanStack Query + TypeScript strict
> **Mål:** Plug-in modul i eksisterende Smartout v3 monorepo. Skal kobles direkte til eksisterende lønnsmotor.

---

## 1. System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                      Smartout v3 Web App                         │
│                                                                  │
│   ┌────────────────┐   ┌────────────────┐   ┌───────────────┐   │
│   │ Tips Recording │   │  Distribution  │   │  Employee     │   │
│   │  (close-out)   │──▶│   Review UI    │──▶│  View         │   │
│   └────────────────┘   └────────────────┘   └───────────────┘   │
│           │                    │                                │
│           ▼                    ▼                                │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │              Route Handlers (/api/tips/*)                │  │
│   └──────────────────────────────────────────────────────────┘  │
└──────────┬────────────────────────┬─────────────────────────────┘
           │                        │
           ▼                        ▼
   ┌────────────────┐      ┌──────────────────┐
   │ Distribution   │      │  Supabase DB     │
   │ Engine         │◀────▶│  (Postgres+RLS)  │
   │ (pure func)    │      └──────────────────┘
   └────────────────┘               │
                                    │
                                    ▼
                          ┌──────────────────┐
                          │ Existing Payroll │
                          │ Engine           │
                          │ (lønnsmotor)     │
                          └──────────────────┘
```

**Prinsipp:** Tips-modulen er et tynt lag oppå eksisterende bemanning + lønn. Den eier kun tre ting: hvor mye tips kom inn, hvilken policy som gjelder, og hvordan det ble fordelt. Alt annet (timer, ansatte, lønnskjøring) konsumeres fra eksisterende systemer.

---

## 2. Data Flows

### Flow 1: Registrer tips ved dagens slutt

1. Leder åpner «Avstemming» for avdeling X, dato Y
2. Eksisterende avstemmingsskjerm viser nytt felt: «Tips inn i dag»
3. Leder fyller inn beløp (kr) → `POST /api/tips/pools`
4. Server oppretter `tip_pools`-rad med status `recorded`
5. Server henter aktive vakter for (avdeling, dato) fra `shifts`-tabellen
6. Distribution Engine kjører: `calculate(pool, shifts, active_policy) → distributions[]`
7. Server skriver `tip_distributions`-rader med status `calculated`
8. UI redirecter til Distribution Review

### Flow 2: Godkjenn fordeling

1. Leder ser fordelingstabell med navn, timer, vekt, beløp
2. Leder kan justere enkeltbeløp (krever kommentar)
3. Hver justering → `PATCH /api/tips/distributions/[id]` med `adjusted_amount` + `adjustment_reason`
4. Sum vises live; må fortsatt matche pool-beløpet (rest fordeles eller avvises)
5. Leder klikker «Godkjenn» → `POST /api/tips/pools/[id]/approve`
6. Pool status: `recorded` → `approved`
7. Distributions låses (ingen flere endringer uten å åpne pool igjen)

### Flow 3: Eksport til lønn

1. Lønnsansvarlig starter lønnskjøring for periode (eksisterende flyt)
2. Lønnsmotoren kaller `GET /api/tips/payouts?period_id=X` for hver ansatt
3. Tips returneres som lønnslinje med type `tips_taxable`
4. Lønnsmotoren legger linjen på lønnsslippen
5. Når lønn er kjørt: `POST /api/tips/payouts/mark-paid` med `payroll_period_id`
6. Distributions oppdateres: status → `paid`, kobling til `payroll_period_id`

### Flow 4: Ansatt ser sine tips

1. Ansatt åpner «Min lønn»-fanen
2. `GET /api/tips/me?from=...&to=...`
3. Returnerer liste over godkjente distributions med dato, avdeling, beløp, status (godkjent / utbetalt)

---

## 3. Database Schema

### 3.1 Nye tabeller

```sql
-- Policy per avdeling. Versjonert (active_from/to) for å bevare historikk.
CREATE TABLE tip_policies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id   uuid NOT NULL REFERENCES departments(id),
  name            text NOT NULL,                  -- f.eks. "Standard 2026"
  method          text NOT NULL CHECK (method IN ('flat', 'hours', 'weighted_hours')),
  active_from     date NOT NULL,
  active_to       date,                           -- null = aktiv
  created_at      timestamptz DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id)
);

-- Rolle-vekter per policy. Kun relevant når method = 'weighted_hours'.
CREATE TABLE tip_role_weights (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id       uuid NOT NULL REFERENCES tip_policies(id) ON DELETE CASCADE,
  role            text NOT NULL,                  -- 'servitør', 'bartender', 'kjøkken' osv.
  weight          numeric(4,2) NOT NULL CHECK (weight >= 0),
  UNIQUE (policy_id, role)
);

-- En tips-pool = ett beløp registrert for én avdeling, én dato.
CREATE TABLE tip_pools (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id   uuid NOT NULL REFERENCES departments(id),
  pool_date       date NOT NULL,
  amount_nok      numeric(10,2) NOT NULL CHECK (amount_nok >= 0),
  policy_id       uuid NOT NULL REFERENCES tip_policies(id),
  status          text NOT NULL DEFAULT 'recorded'
                  CHECK (status IN ('recorded', 'approved', 'paid', 'voided')),
  recorded_by     uuid NOT NULL REFERENCES auth.users(id),
  recorded_at     timestamptz DEFAULT now(),
  approved_by     uuid REFERENCES auth.users(id),
  approved_at     timestamptz,
  notes           text,
  UNIQUE (department_id, pool_date)               -- én pool per avdeling/dag
);

-- Hver ansatts andel av en pool.
CREATE TABLE tip_distributions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id             uuid NOT NULL REFERENCES tip_pools(id) ON DELETE CASCADE,
  employee_id         uuid NOT NULL REFERENCES employees(id),
  shift_id            uuid REFERENCES shifts(id),     -- referanse, ikke FK-låst
  role                text NOT NULL,
  hours_worked        numeric(5,2) NOT NULL,
  weight_applied      numeric(4,2) NOT NULL,
  calculated_amount   numeric(10,2) NOT NULL,         -- original kalkulering
  adjusted_amount     numeric(10,2),                  -- null = uendret
  adjustment_reason   text,                           -- påkrevd hvis adjusted_amount satt
  payroll_period_id   uuid REFERENCES payroll_periods(id),
  status              text NOT NULL DEFAULT 'calculated'
                      CHECK (status IN ('calculated', 'approved', 'paid')),
  UNIQUE (pool_id, employee_id)
);

-- Audit log for justeringer. Kritisk for tillit og compliance.
CREATE TABLE tip_adjustment_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id     uuid NOT NULL REFERENCES tip_distributions(id) ON DELETE CASCADE,
  changed_by          uuid NOT NULL REFERENCES auth.users(id),
  changed_at          timestamptz DEFAULT now(),
  old_amount          numeric(10,2),
  new_amount          numeric(10,2),
  reason              text NOT NULL
);
```

### 3.2 Indekser

```sql
CREATE INDEX idx_tip_pools_dept_date ON tip_pools (department_id, pool_date DESC);
CREATE INDEX idx_tip_pools_status    ON tip_pools (status) WHERE status != 'paid';
CREATE INDEX idx_tip_dist_employee   ON tip_distributions (employee_id, status);
CREATE INDEX idx_tip_dist_payroll    ON tip_distributions (payroll_period_id) WHERE payroll_period_id IS NOT NULL;
CREATE INDEX idx_tip_policies_dept   ON tip_policies (department_id, active_from DESC) WHERE active_to IS NULL;
```

### 3.3 RLS Policies

```sql
ALTER TABLE tip_pools          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tip_distributions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tip_policies       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tip_role_weights   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tip_adjustment_log ENABLE ROW LEVEL SECURITY;

-- Ansatt: kan kun se egne distributions
CREATE POLICY emp_read_own_dist ON tip_distributions
  FOR SELECT USING (employee_id = current_employee_id());

-- Leder: full tilgang innenfor sine avdelinger
CREATE POLICY mgr_full_pools ON tip_pools
  FOR ALL USING (department_id = ANY (current_user_departments()));

CREATE POLICY mgr_full_dist ON tip_distributions
  FOR ALL USING (
    pool_id IN (SELECT id FROM tip_pools WHERE department_id = ANY (current_user_departments()))
  );

-- Tilsvarende for policies, role_weights, adjustment_log
```

> Funksjonene `current_employee_id()` og `current_user_departments()` er allerede definert i Smartout v3.

---

## 4. API Design

Alle endepunkter er Next.js Route Handlers under `/api/tips/`. Auth via eksisterende Supabase session.

### 4.1 Endepunkter

| Method | Path                                   | Rolle    | Action                                      |
|--------|----------------------------------------|----------|---------------------------------------------|
| GET    | `/api/tips/policies?department_id=X`   | Leder    | Hent policies (aktiv + historikk)           |
| POST   | `/api/tips/policies`                   | Leder    | Opprett ny policy (deaktiverer gjeldende)   |
| GET    | `/api/tips/pools?department_id=X&from=&to=` | Leder | List pools                              |
| POST   | `/api/tips/pools`                      | Leder    | Registrer tips-beløp + trigge kalkulering  |
| GET    | `/api/tips/pools/[id]`                 | Leder    | Hent pool + distributions                   |
| POST   | `/api/tips/pools/[id]/approve`         | Leder    | Godkjenn pool                               |
| POST   | `/api/tips/pools/[id]/recalculate`     | Leder    | Kjør kalkulering på nytt (kun før godkjenning) |
| PATCH  | `/api/tips/distributions/[id]`         | Leder    | Justere beløp + årsak                       |
| GET    | `/api/tips/payouts?period_id=X`        | Lønn     | Hent tips per ansatt for lønnskjøring       |
| POST   | `/api/tips/payouts/mark-paid`          | Lønn     | Marker som utbetalt                         |
| GET    | `/api/tips/me?from=&to=`               | Ansatt   | Egne tips                                   |

### 4.2 Request/Response-eksempler

**`POST /api/tips/pools`**
```json
// Request
{
  "department_id": "uuid",
  "pool_date": "2026-04-28",
  "amount_nok": 5000.00,
  "notes": "Travel kveld, mye Vipps"
}

// Response 201
{
  "pool": { "id": "uuid", "status": "recorded", "...": "..." },
  "distributions": [
    { "employee_id": "uuid", "name": "Anna", "hours": 8, "weight": 1.0, "amount": 2469.14 },
    { "employee_id": "uuid", "name": "Per",  "hours": 6, "weight": 0.7, "amount": 1296.30 }
  ]
}
```

**`PATCH /api/tips/distributions/[id]`**
```json
// Request
{ "adjusted_amount": 2700.00, "adjustment_reason": "Stengte alene" }

// Response 200
{ "id": "uuid", "calculated_amount": 2469.14, "adjusted_amount": 2700.00, "...": "..." }
```

**`GET /api/tips/payouts?period_id=X`**
```json
// Response 200 — per ansatt for lønnskjøring
[
  {
    "employee_id": "uuid",
    "total_amount": 12450.00,
    "distribution_ids": ["uuid", "uuid", "..."],
    "line_type": "tips_taxable"
  }
]
```

### 4.3 Feilformat

Følger eksisterende Smartout-konvensjon:
```json
{ "error": { "code": "TIPS_POOL_LOCKED", "message": "Pool er allerede godkjent" } }
```

---

## 5. Distribution Engine

Ren funksjon. Lever i `apps/web/lib/tips/calculate.ts`. Lett å enhetsteste.

```typescript
type Shift = { employee_id: string; role: string; hours: number };
type Policy =
  | { method: 'flat' }
  | { method: 'hours' }
  | { method: 'weighted_hours'; weights: Record<string, number> };

function calculate(
  amountNok: number,
  shifts: Shift[],
  policy: Policy
): Distribution[] {
  if (shifts.length === 0) return [];

  const weighted = shifts.map(s => {
    const weight =
      policy.method === 'flat'           ? 1 :
      policy.method === 'hours'          ? 1 :
      /* weighted_hours */                 (policy.weights[s.role] ?? 1.0);
    const points =
      policy.method === 'flat'           ? 1 :
      /* hours / weighted_hours */         s.hours * weight;
    return { ...s, weight, points };
  });

  const totalPoints = weighted.reduce((sum, w) => sum + w.points, 0);
  if (totalPoints === 0) return [];

  // Round to 2 decimals, allocate remainder to highest-points employee
  const raw = weighted.map(w => ({
    ...w,
    amount: Math.round((amountNok * w.points / totalPoints) * 100) / 100,
  }));
  const allocated = raw.reduce((s, r) => s + r.amount, 0);
  const remainder = Math.round((amountNok - allocated) * 100) / 100;
  if (remainder !== 0) {
    const top = raw.reduce((a, b) => (b.points > a.points ? b : a));
    top.amount = Math.round((top.amount + remainder) * 100) / 100;
  }
  return raw;
}
```

**Tre policies, én funksjon.** Nye policies legges til ved å utvide `Policy`-typen og `weight`/`points`-grenene. Ingen andre deler av systemet trenger endring.

---

## 6. File Structure

```
apps/web/
├── app/
│   ├── (app)/tips/
│   │   ├── pools/[poolId]/page.tsx        # Distribution Review skjerm
│   │   ├── policies/page.tsx              # Policy admin
│   │   └── me/page.tsx                    # Min tips (ansatt)
│   └── api/tips/
│       ├── pools/
│       │   ├── route.ts                   # GET, POST
│       │   └── [id]/
│       │       ├── route.ts               # GET
│       │       ├── approve/route.ts       # POST
│       │       └── recalculate/route.ts   # POST
│       ├── distributions/[id]/route.ts    # PATCH
│       ├── policies/route.ts              # GET, POST
│       ├── payouts/
│       │   ├── route.ts                   # GET
│       │   └── mark-paid/route.ts         # POST
│       └── me/route.ts                    # GET
├── lib/tips/
│   ├── calculate.ts                       # Pure distribution engine
│   ├── calculate.test.ts                  # Unit tests
│   ├── queries.ts                         # TanStack Query hooks
│   └── types.ts                           # Zod schemas + TS types
└── components/tips/
    └── (se Component Register)

supabase/migrations/
└── 20260428_tips_module.sql               # All schema fra §3
```

---

## 7. Integration Points

| Service          | Direction          | Mechanism                      | Trigger                           |
|------------------|--------------------|-----------------------------  -|-----------------------------------|
| Lønnsmotor       | Tips → Lønn        | Intern API-kall (`/api/tips/payouts`) | Lønnskjøring starter        |
| Lønnsmotor       | Lønn → Tips        | `POST /payouts/mark-paid`      | Lønnskjøring fullført             |
| Bemanning        | Bemanning → Tips   | DB read av `shifts`-tabellen   | Pool registreres                  |
| Avstemming       | Avstemming → Tips  | UI-kobling (samme skjerm)      | Leder fyller inn tips-felt        |
| anneMa (ansatt)  | Tips → App         | `GET /api/tips/me`             | Ansatt åpner lønnsfane            |

---

## 8. Security

| Lag              | Implementasjon                                                     |
|------------------|--------------------------------------------------------------------|
| Auth             | Eksisterende Supabase session (delt med resten av v3)              |
| Authorization    | RLS på alle 5 tabeller — leder ser sin avdeling, ansatt ser seg selv |
| Validering       | Zod på alle Route Handler-inputs                                   |
| Audit            | `tip_adjustment_log` skriver hver gang `adjusted_amount` endres    |
| Beløpsintegritet | DB-constraint: `amount_nok >= 0`, `weight >= 0`                    |
| Pool-låsing      | Status-maskin: `recorded → approved → paid`. Ingen sideveis.       |
| Skattetagging    | Payout-eksport flagger linje som `tips_taxable` — lønnsmotor håndterer trekk |

---

## 9. Environment

Ingen nye env-variabler. Modulen bruker eksisterende Supabase-klienter og auth-kontekst.

---

## 10. Out of Scope (for første implementering)

| Feature                              | Hvorfor utelatt                              |
|--------------------------------------|----------------------------------------------|
| Hybrid-policies (FoH/BoH-split)      | Dekkes via to separate pools eller manuell justering |
| Salgsbaserte policies                | Krever POS-linjenivå-integrasjon             |
| Ukespool / månedspool                | Dag-pool dekker 90% av norske restauranter   |
| Vipps/kort/kontant skille            | Registreres som ett beløp; kommentar hvis nødvendig |
| Tilbakeføring etter utbetaling       | Sjelden; håndteres manuelt via lønn          |
| Multi-currency                       | Smartout er Skandinavia-only                 |