---
title: "Fag, Posisjon, Rolle & Access — Profession System Design"
status: draft
updated: 2026-03-28
created: 2026-03-28
module: industry-intelligence
tags: [profession, position, authority, legal-function, access, onboarding, I1, K1a, cascade]
---

# Fag, Posisjon, Rolle & Access — Profession System Design

## Problem

Smartout mangler et konsept for **Fag** (kompetansedomene). Posisjoner (Kokk, Servitør) eksisterer som løse strenger uten kobling til kompetansedomene, ansvarsnivå, lovkrav eller systemtilgang. Uten Fag som kjerne-entitet kan vi ikke:

- Knytte opplæringskrav til et kompetansedomene
- Skille mellom operasjonelt ansvarsnivå (Leder, Nestleder, Ansvarsvakt)
- Håndtere lovpålagte funksjoner (Verneombud, Brannvernleder)
- Drive systemtilgang fra posisjon og funksjon

## Fire konsepter

```
STATISK (K1a plattform — lovdefinert, endres ikke av workspace)
├── Fag: Kjøkken, Servering, Bartending, Ledelse, Renhold, Resepsjon
├── Lovpålagte funksjoner: Verneombud, Brannvernleder, Mattrygghetsansvarlig, Skjenkeansvarlig
│   └── Krav følger med (40t HMS, HACCP-kurs, etc.)
├── Fag → Opplæring: vektet kobling (Allergenhåndtering er kritisk for Kjøkken)

WORKSPACE-KONFIGURERBART
├── Posisjoner: Kokk, Servitør, Sommelier, Bartender, ...
│   └── Kobles til fag (profession_id)
│   └── Kobles til avdeling (department_id — finnes allerede)

PERSON (profile)
├── Ansvarsnivå (authority_level): duty / deputy / leader — én per person, stabilt
├── Posisjoner: m2m via profile_position — kan ha flere (servitør + bartender)
├── Lovfunksjoner: m2m via profile_legal_function — tildelt av admin
├── Access: finkornet systemtilgang
│   └── Utledes fra authority_level + lovfunksjon + manuelt
```

### Konseptseparasjon

| Konsept         | Hva det er             | Hører til                        | Styrer                  |
| --------------- | ---------------------- | -------------------------------- | ----------------------- |
| **Fag**         | Kompetansedomene       | Plattform (K1a)                  | Opplæringskrav (vektet) |
| **Posisjon**    | Hva du gjør på jobb    | Workspace → avdeling             | Bemanning, lønn         |
| **Ansvarsnivå** | Operasjonell autoritet | Enum på profil (én per person)   | Hva du KAN gjøre        |
| **Lovfunksjon** | Lovpålagt ansvar       | Plattform (K1a), tildeles person | Hva du MÅ kunne         |
| **Access**      | Systemtilgang          | Profil                           | Hva du ser i appen      |

### Nøkkelregler

- **Fag ≠ Avdeling.** Avdeling er organisatorisk (Sal). Fag er kompetansedomene (Servering). En Sommelier kan jobbe på Sal og Bar, men faget er Servering.
- **Posisjon ≠ Ansvarsnivå.** Posisjon er hva du gjør (Kokk). Ansvarsnivå er din autoritet (Leder). Kombinasjonen gir tittel: Kokk + Leder = Kjøkkensjef.
- **Ansvarsnivå er stabilt per person.** Du er leder eller ikke — det endres ikke dag til dag. Men du kan ha flere posisjoner (servitør + bartender).
- **Lovfunksjon ≠ Ansvarsnivå.** Verneombud er ikke "over" eller "under" noen — det er en lovpålagt funksjon enhver ansatt kan ha.
- **Access utledes fra authority_level + lovfunksjon**, men kan justeres manuelt per person.

### Eksempler

```
Person: Kari
  Authority: leader
  Posisjoner: [Kokk (primær), Konditor]
  Lovfunksjon: Mattrygghetsansvarlig
  Access: [kitchen.*, approve.timesheets, reports.read, haccp.*]
  → Tittel: "Kjøkkensjef" (utledet: primær posisjon Kokk + leader)

Person: Erik
  Authority: leader
  Posisjoner: [Servitør (primær)]
  Lovfunksjon: Skjenkeansvarlig
  Access: [service.*, approve.timesheets, reports.read]
  → Tittel: "Hovmester" (utledet: Servitør + leader)

Person: Ola
  Authority: deputy
  Posisjoner: [Kokk (primær)]
  Access: [kitchen.*, approve.timesheets]
  → Tittel: "Souchef" (utledet: Kokk + deputy)

Person: Lisa
  Authority: (ingen)
  Posisjoner: [Servitør (primær), Bartender]
  Access: [service.read, bar.read]
  → Tittel: "Servitør" — jobber begge posisjoner, ingen ekstra ansvar

Person: Magnus
  Authority: (ingen)
  Posisjoner: [Renholder (primær)]
  Lovfunksjon: Verneombud
  Access: [cleaning.*, hms.*]
  → Har HMS-tilgang pga lovfunksjon, ikke pga authority
```

## Cascade-plassering

Fag kutter gjennom hele cascade-modellen:

| Dimensjon                | Fag sin rolle                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| K1a (Industry Knowledge) | `profession` + `legal_function` definisjoner, plattform-eid                                |
| D2 (Resource)            | Profil → Posisjoner (m2m) → Fag = kompetanse. Authority på profil. Lovfunksjoner på profil |
| D3 (Rules & Constraints) | Opplæringskrav per fag (vektet). Lovkrav per lovfunksjon                                   |
| D4 (Demand)              | Bemanningsbehov uttrykt i posisjoner, ikke bare hoder                                      |
| D6 (Production)          | Skift krever spesifikke posisjoner                                                         |
| C1 (Calibration)         | Readiness = % fullført av fagets vektede opplæringskrav                                    |
| C4 (Governance)          | Access flyter fra authority_level + lovfunksjon → systemtilgang                            |

### Koblingskart

```
                         ┌──────────┐
                         │ BRANSJE  │ (NACE)
                         └────┬─────┘
                              │ relevante fag
                              ▼
                    ┌─────────────────┐
               ┌────│      FAG       │────┐
               │    │   (K1a)        │    │
               │    └───┬────────┬───┘    │
               │        │        │        │
         vektet│   direkt│   direkt│       │
               │        │        │        │
               ▼        ▼        ▼        ▼
         ┌──────────┐ ┌────────┐ ┌──────┐ ┌─────────────┐
         │OPPLÆRING │ │POSISJON│ │TARIFF│ │LOVFUNKSJON  │
         │(vekt per │ │(jobb-  │ │(sats │ │(statisk,    │
         │ fag)     │ │ slot)  │ │ /fag)│ │ lovdefinert)│
         └──────────┘ └───┬────┘ └──────┘ └──────┬──────┘
               ▲           │m2m                   │m2m
               │arver      │                      │tildeles
               │krav       ▼                      ▼
               │     ┌──────────────────────────────┐
               └─────│         PROFIL               │
                     │ authority_level (én per person)│
                     │ positions[] (m2m, flere)      │
                     │ legal_functions[] (m2m)       │
                     └──────────┬───────────────────┘
                                │utledes
                                ▼
                          ┌──────────┐
                          │  ACCESS  │
                          │(authority│
                          │+lovfunk  │
                          │+manuelt) │
                          └──────────┘
```

### Koblingstyper

| Fra                              | Til           | Type                             | Eksempel                                     |
| -------------------------------- | ------------- | -------------------------------- | -------------------------------------------- |
| Posisjon → Fag                   | tilhørighet   | direkt FK                        | Kokk tilhører Kjøkken                        |
| Fag → Opplæring                  | krav          | vektet m2m                       | Allergenhåndtering kritisk (1.0) for Kjøkken |
| Profil → Posisjoner              | kompetanse    | **m2m** (profile_position)       | Lisa er Servitør + Bartender                 |
| Profil → Ansvarsnivå             | autoritet     | **enum på profil** (én)          | Kari er leader → Kjøkkensjef                 |
| Profil → Lovfunksjoner           | tildeling     | **m2m** (profile_legal_function) | Magnus er Verneombud                         |
| Lovfunksjon → Opplæring          | krav          | direkt                           | Verneombud krever 40t HMS                    |
| Authority + Lovfunksjon → Access | systemtilgang | utledet + manuell                | leader → approve.timesheets                  |

## Schema

Plassering: **`public`** — følger eksisterende K1a-mønster (tariff_rate_table, regulatory_framework). Council-vedtak: ikke opprett `intelligence` schema, reorganiser all K1a senere som egen oppgave.

### Nye tabeller

```sql
-- Fag: kompetansedomene (K1a plattform + workspace override)
CREATE TABLE public.profession (
  profession_id    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id     UUID REFERENCES public.workspace(workspace_id),
  slug             TEXT NOT NULL,
  name             TEXT NOT NULL,
  description      TEXT,
  is_universal     BOOLEAN NOT NULL DEFAULT false,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (workspace_id, slug)
);
-- NULL workspace_id = plattform-default
-- is_universal = true → relevant for alle bransjer (f.eks. Ledelse)

-- NACE-kode → relevante fag (plattform-nivå mapping)
CREATE TABLE public.profession_industry (
  profession_id  UUID NOT NULL REFERENCES public.profession(profession_id),
  nace_code      TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at     TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (profession_id, nace_code)
);

-- Ansvarsnivå
CREATE TYPE authority_level AS ENUM ('duty', 'deputy', 'leader');

-- Lovpålagte funksjoner (K1a — statisk, lovdefinert)
CREATE TABLE public.legal_function (
  legal_function_id  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug               TEXT NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  description        TEXT,
  legal_basis        TEXT,
  training_hours     INTEGER,
  profession_id      UUID REFERENCES public.profession(profession_id),
  sort_order         INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at         TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- profession_id = NULL → gjelder alle fag (f.eks. Verneombud)
-- profession_id = satt → fagspesifikk (f.eks. Mattrygghetsansvarlig → Kjøkken)

-- Profil → Lovfunksjon (m2m tildeling)
CREATE TABLE public.profile_legal_function (
  profile_id         UUID NOT NULL REFERENCES public.profile(profile_id) ON DELETE CASCADE,
  legal_function_id  UUID NOT NULL REFERENCES public.legal_function(legal_function_id) ON DELETE CASCADE,
  assigned_at        TIMESTAMPTZ DEFAULT now() NOT NULL,
  assigned_by        UUID REFERENCES public.profile(profile_id),
  created_at         TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at         TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (profile_id, legal_function_id)
);

-- Profil → Posisjon (m2m — en person kan ha flere posisjoner)
CREATE TABLE public.profile_position (
  profile_id    UUID NOT NULL REFERENCES public.profile(profile_id) ON DELETE CASCADE,
  position_id   UUID NOT NULL REFERENCES public.position(position_id) ON DELETE CASCADE,
  is_primary    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (profile_id, position_id)
);
-- is_primary: hovedposisjon for tittel-utledning og lønnsberegning

-- Fag → Opplæring: vektet many-to-many
CREATE TABLE public.profession_training (
  profession_training_id  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profession_id           UUID NOT NULL REFERENCES public.profession(profession_id),
  protocol_id             UUID NOT NULL REFERENCES public.protocol(protocol_id),
  weight                  DECIMAL(3,2) NOT NULL DEFAULT 1.0
                            CHECK (weight >= 0 AND weight <= 1),
  is_required             BOOLEAN NOT NULL DEFAULT false,
  workspace_id            UUID REFERENCES public.workspace(workspace_id),
  created_at              TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE NULLS NOT DISTINCT (profession_id, protocol_id, workspace_id)
);
-- weight: 0.0 = nice-to-know, 1.0 = kritisk
-- is_required: hard krav (blokkerer readiness) vs anbefalt (vektet score)
-- workspace_id NULL = plattform-default, non-null = workspace-override

-- Systemtilgang per profil (finkornet)
CREATE TABLE public.profile_access (
  profile_id   UUID NOT NULL REFERENCES public.profile(profile_id) ON DELETE CASCADE,
  scope        TEXT NOT NULL
                 CHECK (scope ~ '^[a-z_]+\.[a-z_*]+$'),
  granted_by   TEXT NOT NULL DEFAULT 'manual'
                 CHECK (granted_by IN ('authority', 'legal_function', 'manual')),
  created_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (profile_id, scope)
);
-- scope: format 'domain.action' (kitchen.read, approve.timesheets, hms.*)
-- granted_by: hvorfor personen har denne tilgangen
-- 'authority' → utledet fra authority_level, trekkes tilbake ved endring
-- 'legal_function' → følger med lovpålagt funksjon
-- 'manual' → admin ga tilgangen direkte
```

### Endringer i eksisterende tabeller

```sql
-- Position kobles til fag
ALTER TABLE public.position
  ADD COLUMN profession_id UUID REFERENCES public.profession(profession_id) ON DELETE SET NULL;

-- Profile får ansvarsnivå (én per person, stabilt)
ALTER TABLE public.profile
  ADD COLUMN authority_level authority_level;
-- NULL = vanlig ansatt, 'duty' = ansvarsvakt, 'deputy' = nestleder, 'leader' = leder

-- Tariff kobles til fag for lønnsbetingelser
ALTER TABLE public.tariff_rate_table
  ADD COLUMN profession_id UUID REFERENCES public.profession(profession_id) ON DELETE SET NULL;
```

### Readiness-beregning (kalkulert, ingen tabell)

```
readiness_score = SUM(completed_weight) / SUM(total_weight)

WHERE:
  total_weight     = profession_training.weight for required protocols in profil's fag
  completed_weight = weight for protocols where protocol_assignment is completed

Edge case: total_weight = 0 → readiness = 1.0 (fully ready if nothing required)
```

### RLS

```sql
-- profession: plattform-data readable by all, workspace-data isolated
ALTER TABLE public.profession ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_platform_professions" ON public.profession
  FOR SELECT USING (workspace_id IS NULL);
CREATE POLICY "read_workspace_professions" ON public.profession
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "manage_workspace_professions" ON public.profession
  FOR ALL USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND is_admin_in_workspace(auth.uid(), workspace_id)
  )
  WITH CHECK (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND is_admin_in_workspace(auth.uid(), workspace_id)
  );

-- profession_industry: platform-data readable by all
ALTER TABLE public.profession_industry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_profession_industry" ON public.profession_industry
  FOR SELECT USING (true);

-- legal_function: platform-data readable by all
ALTER TABLE public.legal_function ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_legal_functions" ON public.legal_function
  FOR SELECT USING (true);

-- profile_legal_function: workspace isolation via profile
ALTER TABLE public.profile_legal_function ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_profile_legal_functions" ON public.profile_legal_function
  FOR SELECT USING (profile_id IN (
    SELECT profile_id FROM profile
    WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  ));
CREATE POLICY "manage_profile_legal_functions" ON public.profile_legal_function
  FOR ALL USING (profile_id IN (
    SELECT profile_id FROM profile
    WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
      AND is_admin_in_workspace(auth.uid(), workspace_id)
  ));

-- profession_training: platform + workspace isolation
ALTER TABLE public.profession_training ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_platform_training" ON public.profession_training
  FOR SELECT USING (workspace_id IS NULL);
CREATE POLICY "read_workspace_training" ON public.profession_training
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "manage_workspace_training" ON public.profession_training
  FOR ALL USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())))
  WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- profile_access: workspace isolation via profile
ALTER TABLE public.profile_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_profile_access" ON public.profile_access
  FOR SELECT USING (profile_id IN (
    SELECT profile_id FROM profile
    WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  ));
CREATE POLICY "manage_profile_access" ON public.profile_access
  FOR ALL USING (profile_id IN (
    SELECT profile_id FROM profile
    WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
      AND is_admin_in_workspace(auth.uid(), workspace_id)
  ));

-- profile_position: workspace isolation via profile
ALTER TABLE public.profile_position ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_profile_positions" ON public.profile_position
  FOR SELECT USING (profile_id IN (
    SELECT profile_id FROM profile
    WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  ));
CREATE POLICY "manage_profile_positions" ON public.profile_position
  FOR ALL USING (profile_id IN (
    SELECT profile_id FROM profile
    WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
      AND is_admin_in_workspace(auth.uid(), workspace_id)
  ));

-- API key policies for workspace-scoped tables
CREATE POLICY "api_key_read_profile_legal_function" ON public.profile_legal_function
  FOR SELECT USING (profile_id IN (
    SELECT profile_id FROM profile
    WHERE workspace_id = get_api_workspace_id()
  ));
CREATE POLICY "api_key_read_profile_access" ON public.profile_access
  FOR SELECT USING (profile_id IN (
    SELECT profile_id FROM profile
    WHERE workspace_id = get_api_workspace_id()
  ));
```

### Triggers

```sql
CREATE TRIGGER set_profession_updated_at
  BEFORE UPDATE ON public.profession
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_legal_function_updated_at
  BEFORE UPDATE ON public.legal_function
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_profession_training_updated_at
  BEFORE UPDATE ON public.profession_training
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_profile_legal_function_updated_at
  BEFORE UPDATE ON public.profile_legal_function
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_profile_access_updated_at
  BEFORE UPDATE ON public.profile_access
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_profile_position_updated_at
  BEFORE UPDATE ON public.profile_position
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_profession_industry_updated_at
  BEFORE UPDATE ON public.profession_industry
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

## Seed Data (I1 — plattform-defaults)

```sql
-- Fag (workspace_id = NULL = plattform)
INSERT INTO public.profession (slug, name, description, is_universal, sort_order) VALUES
  ('kjokken',    'Kjøkken',    'Matlaging, mise en place, hygiene',           false, 1),
  ('servering',  'Servering',  'Gjesteservice, bordservering, vin',           false, 2),
  ('bartending', 'Bartending', 'Drinkblanding, barservice, skjenking',        false, 3),
  ('ledelse',    'Ledelse',    'Drift, personal, økonomi',                    true,  4),
  ('renhold',    'Renhold',    'Rengjøring, hygienekontroll',                 false, 5),
  ('resepsjon',  'Resepsjon',  'Innsjekk, gjestekontakt, booking',           false, 6);

-- NACE-mappinger
INSERT INTO public.profession_industry (profession_id, nace_code) VALUES
  -- Restaurant (56.101)
  ((SELECT profession_id FROM profession WHERE slug = 'kjokken' AND workspace_id IS NULL),    '56.101'),
  ((SELECT profession_id FROM profession WHERE slug = 'servering' AND workspace_id IS NULL),  '56.101'),
  ((SELECT profession_id FROM profession WHERE slug = 'bartending' AND workspace_id IS NULL), '56.101'),
  -- Hotell (55.101)
  ((SELECT profession_id FROM profession WHERE slug = 'resepsjon' AND workspace_id IS NULL),  '55.101'),
  ((SELECT profession_id FROM profession WHERE slug = 'renhold' AND workspace_id IS NULL),    '55.101'),
  ((SELECT profession_id FROM profession WHERE slug = 'servering' AND workspace_id IS NULL),  '55.101'),
  -- Bar (56.301)
  ((SELECT profession_id FROM profession WHERE slug = 'bartending' AND workspace_id IS NULL), '56.301'),
  ((SELECT profession_id FROM profession WHERE slug = 'kjokken' AND workspace_id IS NULL),    '56.301');
-- Ledelse er is_universal=true, trenger ikke NACE-mapping

-- Lovpalagte funksjoner
INSERT INTO public.legal_function (slug, name, legal_basis, training_hours, profession_id, sort_order) VALUES
  ('verneombud',             'Verneombud',             'Arbeidsmiljøloven §6-1',    40,   NULL, 1),
  ('brannvernleder',         'Brannvernleder',         'Brannvernforskriften §4',   NULL, NULL, 2),
  ('mattrygghetsansvarlig',  'Mattrygghetsansvarlig',  'Matloven §4',              NULL,
    (SELECT profession_id FROM profession WHERE slug = 'kjokken' AND workspace_id IS NULL), 3),
  ('skjenkeansvarlig',       'Skjenkeansvarlig',       'Alkoholloven §1-7c',        NULL,
    (SELECT profession_id FROM profession WHERE slug = 'bartending' AND workspace_id IS NULL), 4);
```

## Access-modell

### Scope-konvensjoner

```
{domain}.{action}

Domener: kitchen, service, bar, cleaning, reception, hms, reports, schedule
Actions: read, write, approve

Eksempler:
  kitchen.read         — se kjokkendata
  kitchen.write        — endre oppskrifter, varelister
  approve.timesheets   — godkjenne timelister
  hms.read             — se HMS-rapporter
  hms.write            — rapportere HMS-avvik
  schedule.write       — lage/endre vaktlister
  reports.read         — se rapporter for sin avdeling
```

### Default access per ansvarsniva

```sql
-- Regler (implementeres som funksjon, ikke tabell)
-- authority_level = 'leader':
--   → {fag-domain}.*, approve.timesheets, reports.read, schedule.write
-- authority_level = 'deputy':
--   → {fag-domain}.*, approve.timesheets
-- authority_level = 'duty':
--   → {fag-domain}.read, shift.close
-- authority_level = NULL:
--   → {fag-domain}.read
```

### Flyt

```
1. Admin setter authority_level = 'leader' på profil
   → System seeder access basert på profilens fag (via posisjoner):
     [kitchen.*, approve.timesheets, reports.read, schedule.write]
   → granted_by = 'authority'

2. Admin tildeler lovfunksjon (Verneombud)
   → System legger til: [hms.read, hms.write]
   → granted_by = 'legal_function'

3. Admin gir ekstra tilgang manuelt
   → Admin legger til: [bar.read]
   → granted_by = 'manual'

4. Authority endres (fra leader til ingen)
   → System fjerner access med granted_by = 'authority'
   → 'manual' og 'legal_function' access beholdes
```

### Viktig distinksjon: authority_level vs engine_authority_config

| Konsept                       | Tabell                    | Hva det styrer                                          |
| ----------------------------- | ------------------------- | ------------------------------------------------------- |
| **authority_level** (DB enum) | `profile.authority_level` | Operasjonell autoritet — hva PERSONEN kan gjøre i appen |
| **AuthorityLevel** (AI type)  | `engine_authority_config` | Agent-kapabilitet — hva AI-AGENTEN kan gjøre            |

Disse er separate systemer som IKKE skal blandes. `profile_access` (C4 app-nivå) og `engine_authority_config` (C4 agent-nivå) er to uavhengige autorisasjonsdimensjoner.

## Onboarding — Step #3: Fag & Posisjoner

### Wizard flow

```
1. Avdelinger (eksisterende)
2. Lokasjoner (eksisterende + bug-fix)
3. Fag & Posisjoner (NY) ← basert pa NACE-kode
4. Prosedyrer (eksisterende)
5. Oppsummering (eksisterende)
```

### Dataflyt

1. `loadState()` henter plattform-professions fra DB + I1 position defaults
2. State far ny property: `professions: ProfessionOption[]` med posisjoner under
3. `ConfirmProfessions` step viser fag som kompakte grupper med posisjoner som ghost cards
4. Posisjoner pre-selekteres (vanlige roller on by default — council anbefaling)
5. Ved finalisering: valgte posisjoner kopieres til workspace med profession_id FK

### State type

```typescript
interface ProfessionOption {
  id: string;
  slug: string;
  name: string;
  isUniversal: boolean;
  positions: PositionOption[];
}

interface PositionOption {
  id: string;
  name: string;
  slug: string;
  selected: boolean;
  authorityLevel: "duty" | "deputy" | "leader" | null;
}
```

### UI — ConfirmProfessions komponent (council-anbefalinger)

- Kompakt gruppert layout: fag-navn som `text-xs uppercase tracking-wider text-muted-foreground` label
- Posisjoner som ghost cards under hvert fag (samme monster som ConfirmDepartments)
- Pre-selekterte vanlige posisjoner (solid border, user deselects what they don't need)
- En "Legg til posisjon" knapp nederst (drawer for input med fag-valg)
- Stagger-animasjon per gruppe, ikke per kort (maks 800ms total)
- ARIA: `role="group"` med `aria-label` per fag, `aria-pressed` pa toggle-knapper
- Counter "X valgt av Y" pa step-niva, ikke per gruppe

## Lokasjon bug-fix

### Problem

Lokasjoner auto-genereres kun fra webscraping. Hvis scraperen ikke finner lokasjoner → tom liste.

### Losning

I `loadState()`: hvis `locations` er tom etter scraping, generer default lokasjon fra business-data:

```typescript
if (locations.length === 0 && merged.name) {
  locations.push({
    id: "loc-default-0",
    name: merged.name,
    type: "main",
    zones: [],
  });
}
```

## Telemetry

Nye events i `packages/telemetry/src/registry.ts`:

| Event                              | Trigger                             |
| ---------------------------------- | ----------------------------------- |
| `profession.workspace_copied`      | Finalize kopierer fag til workspace |
| `position.created`                 | Ny posisjon opprettet               |
| `position.authority_changed`       | Ansvarsniva endret                  |
| `profile.legal_function_assigned`  | Lovfunksjon tildelt person          |
| `profile.access_granted`           | Tilgang gitt                        |
| `profile.access_revoked`           | Tilgang fjernet                     |
| `onboarding.professions_confirmed` | Onboarding step #3 fullfort         |

## Filer som endres

### Nye filer

- `supabase/migrations/YYYYMMDDHHMMSS_add_profession_system.sql` — schema + seed + RLS
- `apps/web/src/app/onboarding/steps/ConfirmProfessions.tsx` — wizard step #3

### Endrede filer

- `apps/web/src/app/onboarding/types-v2.ts` — legg til `professions: ProfessionOption[]`
- `apps/web/src/app/onboarding/types.ts` — legg til ProfessionOption, PositionOption
- `apps/web/src/app/onboarding/wizard-definition.ts` — loadState, step #3, onComplete
- `apps/web/src/app/onboarding/steps/ConfirmSummary.tsx` — vis valgte fag/posisjoner
- `supabase/migrations/YYYYMMDDHHMMSS_update_finalize_rpc.sql` — profession+position i finalize
- `packages/supabase/src/database.types.ts` — regenerer etter migration
- `packages/telemetry/src/registry.ts` — nye events
- `packages/ai/src/industry/defaults.ts` — mark POSITION_MAP @deprecated (IKKE fjern)
- `docs/reference/DATABASE.md` — dokumenter nye tabeller

### IKKE endret i dette scope

- `packages/ai/src/industry/defaults.ts` — POSITION_MAP beholdes som @deprecated
- `apps/web/src/components/dashboard/wizard-steps/TeamSetupStep.tsx` — bruker fortsatt POSITION_MAP

## Ikke i scope

- Readiness-beregning med profession_training vekting — schema klar, logikk i fremtidig PR
- Access-enforcement i UI/API — profile_access tabell klar, middleware i fremtidig PR
- Tariff-kobling (tariff_rate_table.profession_id) — FK klar, brukes ikke enna
- Dashboard admin-UI for fag/posisjon/lovfunksjon-administrasjon
- Context collector oppdatering for agent (packages/ai/src/context/collector.ts)
- get_readiness tool oppdatering for vekting
- Mobil-UI
- position_training (posisjon-spesifikk opplaering, f.eks. Sommelier → vinkurs)
- Migrering av all K1a til eget schema (fremtidig arkitekturoppgave)

## Council-vedtak inkorporert

| #   | Vedtak                                                             | Kilde                                  |
| --- | ------------------------------------------------------------------ | -------------------------------------- |
| 1   | `public` schema, ikke `intelligence`                               | Steward (council #1)                   |
| 2   | Keep POSITION_MAP, mark `@deprecated`                              | Supervisor (council #1)                |
| 3   | `created_at`/`updated_at` pa alle tabeller                         | Supervisor (council #1)                |
| 4   | Surrogate PK pa profession_training + UNIQUE NULLS NOT DISTINCT    | Supervisor + Steward (council #1)      |
| 5   | `description` + `sort_order` pa profession                         | Supervisor (council #1)                |
| 6   | Telemetry emit() events (interface pattern, SmartoutEvent union)   | Steward + Supervisor (council #1 + #2) |
| 7   | API key RLS pa alle workspace-scoped tabeller                      | Steward (council #1 + #2)              |
| 8   | Readiness divide-by-zero → return 1.0                              | Steward (council #1)                   |
| 9   | Pre-selekter vanlige roller i UI                                   | Frontend (council #1)                  |
| 10  | Kompakt gruppert layout, en "Legg til" knapp                       | Frontend (council #1)                  |
| 11  | authority_level pa profile, ikke position (stabilt per person)     | Migration audit                        |
| 12  | profile_position m2m (en person kan ha flere posisjoner)           | Migration audit                        |
| 13  | Fjern is_regulated fra position (utledes fra legal_function)       | Migration audit                        |
| 14  | ON DELETE CASCADE pa junction-tabeller, SET NULL pa FKs            | Migration audit                        |
| 15  | Admin-guard (is_admin_in_workspace) pa alle manage-policies        | Migration audit                        |
| 16  | CHECK regex pa profile_access.scope                                | Migration audit                        |
| 17  | Dokumenter authority_level (DB) vs AuthorityLevel (AI) distinksjon | Agent Coord (council #2)               |
