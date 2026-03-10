# Extraction Eval Suite Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 3-level pytest eval suite for the document extraction AI prompt, then redesign the prompt with measurable improvement.

**Architecture:** Pydantic models define the extraction schema. Fixture markdown files simulate scrapling output. Tests validate schema, category mapping, and edge cases — all without calling AI (except `pytest -m slow`). The prompt is updated in the edge function after baseline is measured.

**Tech Stack:** Python 3.12, pytest, Pydantic v2, fixture markdown files, OpenRouter API (slow tests only)

---

## File Structure

```
services/scrapling/
├── extractors/
│   ├── validation.py              # NEW — Pydantic models for AI extraction response
│   └── handbook_mapping.py        # NEW — Deterministic handbookSections mapping
├── tests/
│   ├── conftest.py                # MODIFY — add sys.path for extractors imports
│   ├── test_extraction_eval.py    # NEW — 3-level eval suite
│   └── fixtures/
│       ├── hms_plan.md            # NEW — HMS policy document
│       ├── daily_routines.md      # NEW — Opening/closing routines
│       ├── menu_restaurant.md     # NEW — Restaurant menu
│       ├── tariff_agreement.md    # NEW — Tariff + payroll
│       ├── mixed_document.md      # NEW — Multi-category document
│       ├── handbook_hospitality.md # NEW — Large handbook (all categories)
│       └── expected/
│           ├── hms_plan.json      # NEW — Expected extraction per fixture
│           ├── daily_routines.json
│           ├── menu_restaurant.json
│           ├── tariff_agreement.json
│           ├── mixed_document.json
│           └── handbook_hospitality.json
├── pytest.ini                     # MODIFY — add slow marker
└── requirements.txt               # NO CHANGE — pydantic already available
```

```
supabase/functions/analyze-setup-documents/
└── index.ts                       # MODIFY (Phase 2) — new prompt, types, PD filter
```

---

## Chunk 1: Pydantic Models + Pytest Config

### Task 1: Add `slow` marker to pytest.ini

**Files:**

- Modify: `services/scrapling/pytest.ini`

- [ ] **Step 1: Update pytest.ini with slow marker**

```ini
[pytest]
markers =
    live: marks tests that hit real external URLs (deselect with '-m "not live"')
    slow: marks tests that call OpenRouter API (deselect with '-m "not slow"')
```

- [ ] **Step 2: Verify pytest collects markers**

Run: `cd services/scrapling && python -m pytest --markers 2>&1 | grep -E "live|slow"`
Expected: Both markers listed

- [ ] **Step 3: Add sys.path setup to conftest.py**

The existing `conftest.py` has fixtures for JSON-LD/OG tests. Add a `sys.path` insert at the top so `from extractors.validation import ...` resolves correctly:

Add this to the TOP of `services/scrapling/tests/conftest.py` (before existing imports):

```python
import sys
from pathlib import Path

# Add scrapling root to path so `from extractors import ...` works in tests
sys.path.insert(0, str(Path(__file__).parent.parent))
```

- [ ] **Step 4: Commit**

```bash
git add services/scrapling/pytest.ini services/scrapling/tests/conftest.py
git commit -m "chore(scrapling): add slow pytest marker + fix test imports"
```

### Task 2: Create Pydantic validation models

**Files:**

- Create: `services/scrapling/extractors/validation.py`

- [ ] **Step 1: Write the test for validation models**

Create `services/scrapling/tests/test_validation_models.py`:

```python
"""Tests for extraction validation models."""

import pytest
from extractors.validation import (
    AIExtractionResponse,
    PolicyItem,
    RoutineItem,
    InstructionItem,
    OpeningHoursItem,
    DepartmentItem,
    MenuSection,
    HolidayItem,
    PayrollInfo,
    EmploymentTermsInfo,
)


class TestPolicyItem:
    def test_valid(self):
        p = PolicyItem(name="HMS", content="Bruk hansker", source="doc.pdf")
        assert p.name == "HMS"

    def test_missing_name_raises(self):
        with pytest.raises(Exception):
            PolicyItem(content="Bruk hansker", source="doc.pdf")


class TestRoutineItem:
    def test_valid_with_steps(self):
        r = RoutineItem(
            name="Åpningsrutine",
            steps=["Slå på ovner", "Klargjør salat"],
            source="rutiner.pdf",
        )
        assert len(r.steps) == 2

    def test_optional_trigger(self):
        r = RoutineItem(
            name="Test", steps=["a"], source="x.pdf", trigger="07:00"
        )
        assert r.trigger == "07:00"

    def test_trigger_defaults_none(self):
        r = RoutineItem(name="Test", steps=["a"], source="x.pdf")
        assert r.trigger is None


class TestAIExtractionResponse:
    def test_empty_is_valid(self):
        r = AIExtractionResponse()
        assert r.policies is None

    def test_unknown_fields_ignored(self):
        r = AIExtractionResponse.model_validate({"unknown_field": "value"})
        assert not hasattr(r, "unknown_field")

    def test_employees_field_ignored(self):
        r = AIExtractionResponse.model_validate(
            {"employees": [{"firstName": "Ola"}]}
        )
        assert not hasattr(r, "employees")

    def test_full_valid_response(self):
        data = {
            "policies": [{"name": "HMS", "content": "Regler", "source": "f.pdf"}],
            "routines": [{"name": "Åpning", "steps": ["Steg 1"], "source": "f.pdf"}],
            "departments": [{"name": "Kjøkken", "roles": ["Kokk"], "source": "f.pdf"}],
            "payroll": {"tariff": "HRF", "supplements": {"kveld": "30kr"}, "source": "f.pdf"},
        }
        r = AIExtractionResponse.model_validate(data)
        assert len(r.policies) == 1
        assert r.payroll.tariff == "HRF"

    def test_strip_empty_categories(self):
        data = {"policies": [], "routines": None, "menus": []}
        r = AIExtractionResponse.model_validate(data)
        stripped = r.strip_empty()
        assert stripped.policies is None
        assert stripped.routines is None
        assert stripped.menus is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/scrapling && python -m pytest tests/test_validation_models.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'extractors.validation'`

- [ ] **Step 3: Write the validation models**

Create `services/scrapling/extractors/validation.py`:

```python
"""Pydantic models for AI extraction response validation.

These models define the schema for what the OpenRouter AI prompt should return.
Used by: eval test suite, edge function validation.

Categories (9):
  policies, routines, instructions, openingHours, departments,
  menus, holidays, payroll, employmentTerms

NOT included: employees (personal data — never extracted)
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class PolicyItem(BaseModel):
    name: str
    content: str
    source: str


class RoutineItem(BaseModel):
    name: str
    steps: list[str]
    trigger: str | None = None
    source: str


class InstructionItem(BaseModel):
    name: str
    content: str
    source: str


class OpeningHoursItem(BaseModel):
    schedule: dict[str, str] | None = None
    seasonal: str | None = None
    source: str


class DepartmentItem(BaseModel):
    name: str
    roles: list[str]
    source: str


class MenuItem(BaseModel):
    name: str
    price: str | None = None


class MenuSection(BaseModel):
    category: str
    items: list[MenuItem]
    source: str


class HolidayItem(BaseModel):
    name: str
    date: str | None = None
    rule: str | None = None
    source: str


class PayrollInfo(BaseModel):
    tariff: str | None = None
    supplements: dict[str, str] | None = None
    source: str


class EmploymentTermsInfo(BaseModel):
    noticePeriod: str | None = None
    probation: str | None = None
    source: str


class AIExtractionResponse(BaseModel):
    """Validated AI extraction response. Unknown fields are silently ignored."""

    model_config = ConfigDict(extra="ignore")

    policies: list[PolicyItem] | None = None
    routines: list[RoutineItem] | None = None
    instructions: list[InstructionItem] | None = None
    openingHours: OpeningHoursItem | None = None
    departments: list[DepartmentItem] | None = None
    menus: list[MenuSection] | None = None
    holidays: list[HolidayItem] | None = None
    payroll: PayrollInfo | None = None
    employmentTerms: EmploymentTermsInfo | None = None

    def strip_empty(self) -> AIExtractionResponse:
        """Return a copy with empty lists/None values set to None."""
        data = {}
        for field_name in self.model_fields:
            value = getattr(self, field_name)
            if isinstance(value, list) and len(value) == 0:
                data[field_name] = None
            else:
                data[field_name] = value
        return AIExtractionResponse.model_validate(data)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd services/scrapling && python -m pytest tests/test_validation_models.py -v`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add services/scrapling/extractors/validation.py services/scrapling/tests/test_validation_models.py
git commit -m "feat(scrapling): add Pydantic validation models for AI extraction"
```

---

## Chunk 2: Fixture Documents

### Task 3: Create fixture markdown files

These simulate what scrapling extractors return (markdown text). Each represents a realistic Norwegian business document.

**Files:**

- Create: `services/scrapling/tests/fixtures/hms_plan.md`
- Create: `services/scrapling/tests/fixtures/daily_routines.md`
- Create: `services/scrapling/tests/fixtures/menu_restaurant.md`
- Create: `services/scrapling/tests/fixtures/tariff_agreement.md`
- Create: `services/scrapling/tests/fixtures/mixed_document.md`
- Create: `services/scrapling/tests/fixtures/handbook_hospitality.md`

- [ ] **Step 1: Create hms_plan.md**

```markdown
# HMS-plan for Sjøbris Restaurant

## 1. Mattrygghet og hygiene

Alle ansatte skal følge disse retningslinjene:

- Håndvask minimum hvert 30. minutt og alltid etter toalettbesøk
- Bruk engangshansker ved håndtering av ferdig mat
- Alle matvarer skal merkes med produksjonsdato og holdbarhetsdato
- Kjøleskap skal holdes under 4°C — temperaturlogg føres to ganger daglig
- Allergener skal merkes tydelig på alle retter, inkludert spesialmenyene

## 2. Brannsikkerhet

- Brannslukkere kontrolleres månedlig av vaktleder
- Evakueringsplan henger ved hovedinngang og ved kjøkkeninngang
- Brannøvelse gjennomføres to ganger per år (mars og september)
- Frityrkokere skal aldri forlates uten tilsyn
- Nødutganger skal aldri blokkeres av varemottak eller avfall

## 3. Arbeidsmiljø

- Sklisikre sko er påbudt for alt kjøkkenpersonale
- Løfteteknikk: bøy i knærne, ikke i ryggen — maks 25 kg per person
- Støynivå skal holdes under 85 dB i kjøkkenområdet
- Pauser: 30 min lunsj ved 6+ timers vakt, 15 min tilleggspause ved 8+ timer

## 4. Førstehjelpsutstyr

Førstehjelpskoffert finnes:

- Bak baren (hovedetasje)
- På kjøkkenet (ved håndvasken)
- I garderobene (personalrom)

Alle ledere skal ha gyldig førstehjelpskurs. Fornyes årlig.
```

- [ ] **Step 2: Create daily_routines.md**

```markdown
# Daglige rutiner — Sjøbris Restaurant

## Åpningsrutine (kl. 09:00)

1. Deaktiver alarmen (kode på personalrommet)
2. Slå på ventilasjonsanlegget
3. Tenn ovnene og sett på vannbad
4. Sjekk kjøleskapstemperatur — loggfør i temperaturskjema
5. Ta ut dagens leveranser fra kjølerommet
6. Dekk bordene i restauranten (duker, glass, bestikk)
7. Fyll opp bardisken med is og mineralvann
8. Skru på kassesystemet og sjekk at kort-terminal fungerer
9. Brief med teamet kl. 10:30 — dagens meny, reservasjoner, spesielle behov

## Stengerutine (etter siste gjest)

1. Tøm og rengjør kaffemaskinen
2. Rengjør alle arbeidsflater på kjøkkenet med desinfeksjon
3. Sett alle matvarer i kjølerom — merk med dato
4. Tøm søppel og retur — sorter glass, plast, restavfall
5. Vask gulvene i restaurant og kjøkken
6. Tell opp kassen — legg dagsoppgjør i safe
7. Sjekk at alle vinduer er lukket og dører låst
8. Sett på alarmen

## Varemottak (daglig kl. 07:00-09:00)

1. Sjekk følgeseddel mot bestilling
2. Kontroller temperatur på kjølevarer (maks 4°C ved mottak)
3. Avvis varer som ikke oppfyller kvalitetskrav
4. Merk alle varer med mottaksdato
5. Plasser i riktig kjølerom/lager etter FIFO-prinsippet
```

- [ ] **Step 3: Create menu_restaurant.md**

```markdown
# Meny — Sjøbris Restaurant

## Forrett

| Rett                                     | Pris   |
| ---------------------------------------- | ------ |
| Fiskesuppe med aioli og brød             | 149 kr |
| Kamskjell med blomkålpuré og trøffel     | 189 kr |
| Carpaccio av okse med parmesan og rucola | 169 kr |
| Dagens taretar                           | 179 kr |

## Hovedrett

| Rett                                           | Pris   |
| ---------------------------------------------- | ------ |
| Ovnsbakt torsk med rotgrønnsaker               | 289 kr |
| Grillet entrecôte med bearnaise (200g)         | 349 kr |
| Pasta med blåskjell og hvitvin                 | 259 kr |
| Vegetarburger med trøffelmayo og søtpotetfries | 239 kr |
| Dagens fangst — spør servitøren                | MP     |

## Dessert

| Rett                           | Pris   |
| ------------------------------ | ------ |
| Sjokoladefondant med vaniljeis | 129 kr |
| Pannacotta med bringebærcoulis | 109 kr |
| Ostetallerken (3 norske oster) | 149 kr |

## Drikke

| Drikke                 | Pris   |
| ---------------------- | ------ |
| Husets hvitvin (glass) | 119 kr |
| Husets rødvin (glass)  | 129 kr |
| Fatøl 0,4l             | 89 kr  |
| Brus / Mineralvann     | 49 kr  |
| Kaffe / Te             | 39 kr  |

## Barnemeny

| Rett                    | Pris   |
| ----------------------- | ------ |
| Fiskeburger med fries   | 129 kr |
| Pasta med tomatsaus     | 109 kr |
| Pannekaker med syltetøy | 89 kr  |
```

- [ ] **Step 4: Create tariff_agreement.md**

```markdown
# Tariffavtale 2026 — Riksavtalen for serveringssteder

## Lønnssatser

Grunnlønn fra 1. april 2026:

| Stilling     | 0-2 år      | 2-4 år      | 4+ år       |
| ------------ | ----------- | ----------- | ----------- |
| Servitør     | 195,00 kr/t | 205,00 kr/t | 215,00 kr/t |
| Kokk         | 210,00 kr/t | 220,00 kr/t | 235,00 kr/t |
| Hovmester    | 230,00 kr/t | 240,00 kr/t | 255,00 kr/t |
| Bartender    | 200,00 kr/t | 210,00 kr/t | 220,00 kr/t |
| Oppvaskhjelp | 185,00 kr/t | 192,00 kr/t | 200,00 kr/t |

## Tillegg

| Type                | Sats        | Gyldighet                       |
| ------------------- | ----------- | ------------------------------- |
| Kveldstillegg       | 30,00 kr/t  | 17:00–21:00                     |
| Nattillegg          | 55,00 kr/t  | 21:00–06:00                     |
| Helgetillegg lørdag | 45,00 kr/t  | Hele dagen                      |
| Helgetillegg søndag | 90,00 kr/t  | Hele dagen                      |
| Helligdagstillegg   | 133%        | Hele dagen                      |
| Overtid (50%)       | 50% påslag  | Etter 9t/dag eller 37,5t/uke    |
| Overtid (100%)      | 100% påslag | Etter kl. 21:00 eller 13+ timer |

## Ansettelsesvilkår

- Oppsigelsestid: 1 måned i prøvetiden, 3 måneder etter
- Prøvetid: 6 måneder
- Ferie: 5 uker (25 virkedager)
- Pensjon: OTP 2% fra 1G
- Sykepenger: Full lønn fra dag 1 (arbeidsgiverperioden 16 dager)

## Helligdager med tillegg

Nyttårsdag, Skjærtorsdag, Langfredag, 1. påskedag, 2. påskedag, 1. mai, 17. mai, Kristi himmelfartsdag, 1. pinsedag, 2. pinsedag, Julaften (fra kl. 15), 1. juledag, 2. juledag, Nyttårsaften (fra kl. 15)
```

- [ ] **Step 5: Create mixed_document.md**

```markdown
# Personalhåndbok — Kafé Solsiden (utdrag)

## Om oss

Kafé Solsiden er en familiedrevet kafé i Trondheim sentrum. Vi har holdt på siden 2018 og er kjent for hjemmelaget bakst og god kaffe.

## Avdelinger

Vi har tre avdelinger:

- **Kjøkken** — baking, matproduksjon, oppvask
- **Disk/Service** — kundebehandling, kasse, servering
- **Lager** — varemottak, renhold, vedlikehold

## Åpningstider

| Dag           | Tid         |
| ------------- | ----------- |
| Mandag–Fredag | 08:00–18:00 |
| Lørdag        | 09:00–17:00 |
| Søndag        | 10:00–16:00 |

Julaften og nyttårsaften: 08:00–14:00
Stengt: 1. juledag, 1. nyttårsdag, 1. påskedag

## Morgenrutine (kl. 07:00)

1. Åpne bakdør og deaktiver alarm
2. Slå på ovnene — forvarming 30 min
3. Start kaffemaskinen og fyll vannkokeren
4. Sjekk bestillinger for dagen (catering, spesialordre)

## Hygieneregler

- Hår skal alltid være oppsatt eller dekket med hette i kjøkkenet
- Smykker og klokker tas av før matproduksjon
- Arbeidsflater desinfiseres minimum hver time under produksjon
```

- [ ] **Step 6: Create handbook_hospitality.md**

```markdown
# Komplett Personalhandbok — Havbris Restaurant & Bar

## Kapittel 1: Hvem vi er

Havbris Restaurant & Bar ble grunnlagt i 2015 av kokk og gründer Lars Vik. Vi ligger ved sjøkanten i Stavanger og serverer moderne norsk sjømat med internasjonal vri. Vår visjon er å være Stavangers mest gjestfrie sjømatrestaurant.

Verdier: Gjestfrihet, kvalitet, bærekraft, lagånd.

## Kapittel 2: Organisasjon

### Avdelinger

- **Kjøkken** — Kjøkkensjef, souschef, kokker, lærling, oppvask
- **Service** — Hovmester, servitører, bartendere, sommelier
- **Bar** — Barleder, bartendere
- **Administrasjon** — Daglig leder, økonomi, HR

### Roller og ansvar

Kjøkkensjef: Ansvar for meny, innkjøp, mattrygghet, opplæring av kjøkkenpersonale
Hovmester: Ansvar for gjesteopplevelse, bordplan, service-teamet, klagebehandling
Barleder: Ansvar for drikkemeny, barteamet, varelager drikke

## Kapittel 3: Daglig drift

### Åpningstider

| Dag             | Restaurant  | Bar         |
| --------------- | ----------- | ----------- |
| Mandag          | Stengt      | Stengt      |
| Tirsdag–Torsdag | 16:00–22:00 | 15:00–00:00 |
| Fredag          | 16:00–23:00 | 15:00–01:00 |
| Lørdag          | 13:00–23:00 | 12:00–01:00 |
| Søndag          | 13:00–20:00 | 12:00–22:00 |

### Vaktmønstre

| Vakt               | Tid         | Avdeling |
| ------------------ | ----------- | -------- |
| Morgenvakt kjøkken | 10:00–18:00 | Kjøkken  |
| Kveldsvakt kjøkken | 15:00–23:00 | Kjøkken  |
| Dagvakt service    | 11:00–19:00 | Service  |
| Kveldsvakt service | 16:00–00:00 | Service  |
| Barvakt            | 15:00–01:00 | Bar      |

### Åpningsrutine restaurant (kl. 15:00)

1. Sjekk reservasjoner i BookingSystem — print ut bordoversikt
2. Brief med servitørene: dagens meny, allergener, 86-liste, VIP-gjester
3. Dekk bordene — sjekk duker, glass, bestikk, lys
4. Sjekk at toaletter er rene og utstyrt
5. Åpne dørene kl. 16:00

### Stengerutine restaurant

1. Siste bestilling 30 min før stenging
2. Rydd alle bord — oppvask startes
3. Tell opp kassen — dagsrapport i kassesystemet
4. Rengjør alle overflater
5. Tøm søppel, vask gulv
6. Sjekk at alle varmekilder er slått av
7. Lås og alarm

## Kapittel 4: Mattrygghet og HMS

### Allergenhåndtering

Alle retter skal ha allergenmerking i kassesystemet. Servitører MÅ spørre om allergier ved bestilling. Ved usikkerhet — spør kjøkkensjefen.

Hovedallergener: gluten, melk, egg, nøtter, skalldyr, soya, selleri, sennep

### HACCP-kontrollpunkter

| Kontrollpunkt            | Frekvens      | Grenseverdi                  | Loggføring        |
| ------------------------ | ------------- | ---------------------------- | ----------------- |
| Kjøleskapstemperatur     | 2x daglig     | < 4°C                        | Temperaturskjema  |
| Fryserskapstemperatur    | 1x daglig     | < -18°C                      | Temperaturskjema  |
| Kjernetemperatur varmmat | Ved servering | > 75°C                       | Digital probe     |
| Varemottak temperatur    | Ved mottak    | < 4°C (kjøl), < -18°C (frys) | Mottaksskjema     |
| Rengjøring kjøkken       | Daglig        | Visuell kontroll             | Rengjøringsskjema |

### Brannvern

- Brannøvelse: 2 ganger per år
- Brannslukkere: sjekkes månedlig av hovmester
- Evakueringsplan: ved alle utganger
- Møteplass: parkeringsplassen ved sjøkanten

## Kapittel 5: Kommunikasjon

Internkommunikasjon via Smartout-appen. Alle beskjeder om vakter, endringer og nyheter legges der. E-post brukes kun for formelle henvendelser.

Ukentlig møte: mandager kl. 14:00 (alle ledere). Referat legges i Smartout.

## Kapittel 6: Opplæring

Nye ansatte gjennomfører 2 uker opplæring:

- Uke 1: Følge en fadder, lese personalhandbok, gjennomføre HMS-quiz
- Uke 2: Jobbe selvstendig med fadder tilgjengelig, evaluering fredag

Fadderordning: Alle nyansatte får en erfaren kollega som fadder de første 4 ukene.

## Kapittel 7: Meny

### Lunsjmeny (lørdag–søndag)

| Rett                   | Pris   |
| ---------------------- | ------ |
| Fiskesuppe             | 159 kr |
| Fish & Chips           | 199 kr |
| Cæsarsalat med kylling | 179 kr |

### Kveldsmeny

| Rett                                | Pris   |
| ----------------------------------- | ------ |
| Skrei med rødbeter og pepperrotkrem | 329 kr |
| Grillet havabbor med fennikel       | 299 kr |
| Entrecôte (250g) med bearnaise      | 389 kr |
| Pasta frutti di mare                | 279 kr |

### Drikke

| Drikke          | Pris   |
| --------------- | ------ |
| Pilsner 0,4l    | 89 kr  |
| Husets hvitvin  | 129 kr |
| Husets rødvin   | 139 kr |
| Alkoholfritt øl | 79 kr  |
| Brus            | 49 kr  |

## Kapittel 8: Lønn og tillegg

Tariff: Riksavtalen for serveringssteder 2026

| Tillegg               | Sats    |
| --------------------- | ------- |
| Kveldstillegg (17-21) | 30 kr/t |
| Nattillegg (21-06)    | 55 kr/t |
| Lørdagstillegg        | 45 kr/t |
| Søndagstillegg        | 90 kr/t |
| Helligdagstillegg     | 133%    |

## Kapittel 9: Helligdager og stengedager

Stengt: 1. juledag, 1. nyttårsdag
Reduserte tider: julaften 12-16, nyttårsaften 16-01
Alle helligdager med tillegg iht. tariffavtalen.

## Kapittel 10: Ansettelsesvilkår

- Prøvetid: 6 måneder
- Oppsigelsestid: 1 måned (prøvetid), 3 måneder (fast)
- Ferie: 5 uker
- Pensjon: OTP 2%
```

- [ ] **Step 7: Commit fixtures**

```bash
git add services/scrapling/tests/fixtures/
git commit -m "feat(scrapling): add eval fixture documents for extraction testing"
```

### Task 4: Create expected results JSON files

**Files:**

- Create: `services/scrapling/tests/fixtures/expected/hms_plan.json`
- Create: `services/scrapling/tests/fixtures/expected/daily_routines.json`
- Create: `services/scrapling/tests/fixtures/expected/menu_restaurant.json`
- Create: `services/scrapling/tests/fixtures/expected/tariff_agreement.json`
- Create: `services/scrapling/tests/fixtures/expected/mixed_document.json`
- Create: `services/scrapling/tests/fixtures/expected/handbook_hospitality.json`

- [ ] **Step 1: Create expected results**

`hms_plan.json`:

```json
{
  "expect_categories": ["policies"],
  "reject_categories": ["routines", "menus", "payroll"],
  "policies_min_count": 3,
  "policies_must_contain": ["mattrygghet", "brann", "arbeidsmiljø"]
}
```

`daily_routines.json`:

```json
{
  "expect_categories": ["routines"],
  "reject_categories": ["policies", "menus"],
  "routines_min_count": 2,
  "routines_must_contain": ["åpning", "steng"]
}
```

`menu_restaurant.json`:

```json
{
  "expect_categories": ["menus"],
  "reject_categories": ["policies", "routines", "payroll"],
  "menus_min_count": 3,
  "menus_must_contain": ["forrett", "hovedrett", "drikke"]
}
```

`tariff_agreement.json`:

```json
{
  "expect_categories": ["payroll", "employmentTerms", "holidays"],
  "reject_categories": ["menus", "routines"],
  "payroll_must_have_supplements": true,
  "employment_must_have": ["noticePeriod", "probation"]
}
```

`mixed_document.json`:

```json
{
  "expect_categories": ["departments", "openingHours", "routines", "policies"],
  "reject_categories": ["payroll"],
  "departments_min_count": 2
}
```

`handbook_hospitality.json`:

```json
{
  "expect_categories": [
    "policies",
    "routines",
    "departments",
    "openingHours",
    "menus",
    "payroll",
    "holidays",
    "employmentTerms"
  ],
  "policies_min_count": 2,
  "routines_min_count": 2,
  "departments_min_count": 3,
  "menus_min_count": 2,
  "payroll_must_have_supplements": true
}
```

- [ ] **Step 2: Commit expected results**

```bash
git add services/scrapling/tests/fixtures/expected/
git commit -m "feat(scrapling): add expected results for eval fixtures"
```

---

## Chunk 3: Eval Test Suite (3 Levels)

### Task 5: Level 1 — Schema Validation Tests

**Files:**

- Create: `services/scrapling/tests/test_extraction_eval.py`

- [ ] **Step 1: Write Level 1 tests**

```python
"""Extraction eval suite — 3 levels of validation.

Level 1: Schema validation (AI response matches Pydantic models)
Level 2: Category mapping (content lands in correct category)
Level 3: Edge cases (empty, unicode, PD leak, duplicates)

Run fast tests:  pytest tests/test_extraction_eval.py
Run slow tests:  pytest tests/test_extraction_eval.py -m slow
"""

import json
import pytest
from pathlib import Path
from extractors.validation import AIExtractionResponse

FIXTURES_DIR = Path(__file__).parent / "fixtures"
EXPECTED_DIR = FIXTURES_DIR / "expected"


# ═══════════════════════════════════════════════════════════
# Level 1: Schema Validation
# ═══════════════════════════════════════════════════════════


class TestSchemaValidation:
    """Validates that AI responses conform to the expected JSON schema."""

    def test_valid_full_response(self):
        """A complete response with all 9 categories validates correctly."""
        data = {
            "policies": [{"name": "HMS", "content": "Bruk hansker", "source": "doc.pdf"}],
            "routines": [{"name": "Åpning", "steps": ["Steg 1", "Steg 2"], "source": "doc.pdf"}],
            "instructions": [{"name": "Oppskrift", "content": "Bland mel og vann", "source": "doc.pdf"}],
            "openingHours": {"schedule": {"mandag-fredag": "11:00-23:00"}, "source": "doc.pdf"},
            "departments": [{"name": "Kjøkken", "roles": ["Kokk", "Lærling"], "source": "doc.pdf"}],
            "menus": [{"category": "Forrett", "items": [{"name": "Suppe", "price": "149kr"}], "source": "doc.pdf"}],
            "holidays": [{"name": "Julaften", "date": "24.12", "rule": "Stengt fra 15:00", "source": "doc.pdf"}],
            "payroll": {"tariff": "Riksavtalen", "supplements": {"kveld": "30kr/t"}, "source": "doc.pdf"},
            "employmentTerms": {"noticePeriod": "3 måneder", "probation": "6 måneder", "source": "doc.pdf"},
        }
        result = AIExtractionResponse.model_validate(data)
        assert result.policies is not None
        assert len(result.policies) == 1
        assert result.payroll.tariff == "Riksavtalen"

    def test_valid_empty_response(self):
        """An empty response (no categories found) is valid."""
        result = AIExtractionResponse.model_validate({})
        assert result.policies is None
        assert result.menus is None

    def test_valid_partial_response(self):
        """A response with only some categories is valid."""
        data = {
            "policies": [{"name": "HMS", "content": "Regler", "source": "f.pdf"}],
        }
        result = AIExtractionResponse.model_validate(data)
        assert result.policies is not None
        assert result.routines is None

    def test_unknown_fields_ignored(self):
        """Unknown fields from AI are silently dropped."""
        data = {
            "policies": [{"name": "X", "content": "Y", "source": "f.pdf"}],
            "completely_unknown": "should be ignored",
            "also_unknown": [1, 2, 3],
        }
        result = AIExtractionResponse.model_validate(data)
        assert result.policies is not None
        assert not hasattr(result, "completely_unknown")

    def test_employees_field_ignored(self):
        """The employees field is silently dropped (personal data filter)."""
        data = {
            "employees": [{"firstName": "Ola", "lastName": "Nordmann", "email": "ola@test.no"}],
            "policies": [{"name": "HMS", "content": "Regler", "source": "f.pdf"}],
        }
        result = AIExtractionResponse.model_validate(data)
        assert not hasattr(result, "employees")
        assert result.policies is not None

    def test_invalid_policy_missing_name(self):
        """A policy without a name field fails validation."""
        data = {"policies": [{"content": "Regler", "source": "f.pdf"}]}
        with pytest.raises(Exception):
            AIExtractionResponse.model_validate(data)

    def test_invalid_routine_missing_steps(self):
        """A routine without steps field fails validation."""
        data = {"routines": [{"name": "Åpning", "source": "f.pdf"}]}
        with pytest.raises(Exception):
            AIExtractionResponse.model_validate(data)

    def test_invalid_payroll_missing_source(self):
        """Payroll without source field fails validation."""
        data = {"payroll": {"tariff": "HRF"}}
        with pytest.raises(Exception):
            AIExtractionResponse.model_validate(data)

    def test_strip_empty_removes_empty_lists(self):
        """strip_empty() converts empty lists to None."""
        data = {"policies": [], "routines": [], "menus": None}
        result = AIExtractionResponse.model_validate(data).strip_empty()
        assert result.policies is None
        assert result.routines is None
        assert result.menus is None

    def test_strip_empty_preserves_data(self):
        """strip_empty() keeps non-empty data intact."""
        data = {
            "policies": [{"name": "HMS", "content": "X", "source": "f.pdf"}],
            "routines": [],
        }
        result = AIExtractionResponse.model_validate(data).strip_empty()
        assert result.policies is not None
        assert len(result.policies) == 1
        assert result.routines is None
```

- [ ] **Step 2: Run Level 1 tests**

Run: `cd services/scrapling && python -m pytest tests/test_extraction_eval.py::TestSchemaValidation -v`
Expected: All 10 tests PASS

- [ ] **Step 3: Commit**

```bash
git add services/scrapling/tests/test_extraction_eval.py
git commit -m "feat(scrapling): add Level 1 schema validation eval tests"
```

### Task 6: Level 2 — Category Mapping Tests

**Files:**

- Modify: `services/scrapling/tests/test_extraction_eval.py`

- [ ] **Step 1: Add Level 2 tests**

Append to `test_extraction_eval.py`:

```python
# ═══════════════════════════════════════════════════════════
# Level 2: Category Mapping
# ═══════════════════════════════════════════════════════════


def load_fixture(name: str) -> str:
    """Load a fixture markdown file."""
    path = FIXTURES_DIR / f"{name}.md"
    return path.read_text(encoding="utf-8")


def load_expected(name: str) -> dict:
    """Load expected results for a fixture."""
    path = EXPECTED_DIR / f"{name}.json"
    return json.loads(path.read_text(encoding="utf-8"))


def validate_extraction_against_expected(
    result: AIExtractionResponse,
    expected: dict,
) -> list[str]:
    """Validate an extraction result against expected categories.

    Returns list of failure messages (empty = pass).
    """
    failures = []

    # Check expected categories are present
    for cat in expected.get("expect_categories", []):
        value = getattr(result, cat, None)
        if value is None:
            failures.append(f"Expected category '{cat}' is missing")

    # Check rejected categories are absent
    for cat in expected.get("reject_categories", []):
        value = getattr(result, cat, None)
        if value is not None and (not isinstance(value, list) or len(value) > 0):
            failures.append(f"Category '{cat}' should not be present but has data")

    # Check minimum counts
    for key, min_count in expected.items():
        if key.endswith("_min_count"):
            cat = key.replace("_min_count", "")
            value = getattr(result, cat, None)
            if value is None:
                failures.append(f"'{cat}' is None but expected min {min_count} items")
            elif isinstance(value, list) and len(value) < min_count:
                failures.append(f"'{cat}' has {len(value)} items, expected >= {min_count}")

    # Check must-contain keywords (case-insensitive in names/content)
    for key, keywords in expected.items():
        if key.endswith("_must_contain") and isinstance(keywords, list):
            cat = key.replace("_must_contain", "")
            value = getattr(result, cat, None)
            if value is None:
                failures.append(f"'{cat}' is None but expected keywords {keywords}")
                continue
            if isinstance(value, list):
                all_text = " ".join(
                    getattr(item, "name", "") + " " + getattr(item, "content", "") + " " + getattr(item, "category", "")
                    for item in value
                ).lower()
                for kw in keywords:
                    if kw.lower() not in all_text:
                        failures.append(f"'{cat}' missing keyword '{kw}'")

    # Check payroll supplements
    if expected.get("payroll_must_have_supplements"):
        if result.payroll is None:
            failures.append("payroll is None but expected supplements")
        elif not result.payroll.supplements:
            failures.append("payroll.supplements is empty but expected data")

    # Check employment fields
    for field in expected.get("employment_must_have", []):
        if result.employmentTerms is None:
            failures.append(f"employmentTerms is None but expected '{field}'")
        elif not getattr(result.employmentTerms, field, None):
            failures.append(f"employmentTerms.{field} is empty")

    return failures


class TestCategoryMapping:
    """Tests that content lands in the correct category.

    These tests use MOCKED AI responses — they validate the mapping logic,
    not the AI prompt itself. See @pytest.mark.slow tests for live AI testing.
    """

    @pytest.fixture
    def hms_extraction(self) -> AIExtractionResponse:
        """Simulated correct AI extraction from HMS plan."""
        return AIExtractionResponse.model_validate({
            "policies": [
                {"name": "Mattrygghet og hygiene", "content": "Håndvask minimum hvert 30. minutt, bruk engangshansker, allergener merkes tydelig", "source": "hms_plan.md"},
                {"name": "Brannsikkerhet", "content": "Brannslukkere kontrolleres månedlig, evakueringsplan ved innganger, brannøvelse 2x/år", "source": "hms_plan.md"},
                {"name": "Arbeidsmiljø", "content": "Sklisikre sko påbudt, løfteteknikk, støygrense 85 dB, pauseordning", "source": "hms_plan.md"},
            ],
        })

    @pytest.fixture
    def routines_extraction(self) -> AIExtractionResponse:
        """Simulated correct AI extraction from daily routines."""
        return AIExtractionResponse.model_validate({
            "routines": [
                {"name": "Åpningsrutine", "steps": ["Deaktiver alarm", "Slå på ventilasjon", "Tenn ovner"], "trigger": "09:00", "source": "daily_routines.md"},
                {"name": "Stengerutine", "steps": ["Tøm kaffemaskin", "Rengjør flater", "Tell opp kassen"], "source": "daily_routines.md"},
                {"name": "Varemottak", "steps": ["Sjekk følgeseddel", "Kontroller temperatur", "Merk med dato"], "trigger": "07:00-09:00", "source": "daily_routines.md"},
            ],
        })

    @pytest.fixture
    def menu_extraction(self) -> AIExtractionResponse:
        """Simulated correct AI extraction from restaurant menu."""
        return AIExtractionResponse.model_validate({
            "menus": [
                {"category": "Forrett", "items": [{"name": "Fiskesuppe", "price": "149 kr"}, {"name": "Kamskjell", "price": "189 kr"}], "source": "menu_restaurant.md"},
                {"category": "Hovedrett", "items": [{"name": "Ovnsbakt torsk", "price": "289 kr"}, {"name": "Entrecôte", "price": "349 kr"}], "source": "menu_restaurant.md"},
                {"category": "Dessert", "items": [{"name": "Sjokoladefondant", "price": "129 kr"}], "source": "menu_restaurant.md"},
                {"category": "Drikke", "items": [{"name": "Husets hvitvin", "price": "119 kr"}, {"name": "Fatøl", "price": "89 kr"}], "source": "menu_restaurant.md"},
                {"category": "Barnemeny", "items": [{"name": "Fiskeburger", "price": "129 kr"}], "source": "menu_restaurant.md"},
            ],
        })

    @pytest.fixture
    def tariff_extraction(self) -> AIExtractionResponse:
        """Simulated correct AI extraction from tariff agreement."""
        return AIExtractionResponse.model_validate({
            "payroll": {
                "tariff": "Riksavtalen for serveringssteder 2026",
                "supplements": {"kveld": "30 kr/t", "natt": "55 kr/t", "lørdag": "45 kr/t", "søndag": "90 kr/t", "helligdag": "133%"},
                "source": "tariff_agreement.md",
            },
            "employmentTerms": {
                "noticePeriod": "1 måned (prøvetid), 3 måneder (fast)",
                "probation": "6 måneder",
                "source": "tariff_agreement.md",
            },
            "holidays": [
                {"name": "Julaften", "date": "24.12", "rule": "Stengt fra 15:00", "source": "tariff_agreement.md"},
                {"name": "1. juledag", "date": "25.12", "source": "tariff_agreement.md"},
            ],
        })

    @pytest.fixture
    def mixed_extraction(self) -> AIExtractionResponse:
        """Simulated correct AI extraction from mixed document."""
        return AIExtractionResponse.model_validate({
            "departments": [
                {"name": "Kjøkken", "roles": ["baking", "matproduksjon", "oppvask"], "source": "mixed_document.md"},
                {"name": "Disk/Service", "roles": ["kundebehandling", "kasse", "servering"], "source": "mixed_document.md"},
                {"name": "Lager", "roles": ["varemottak", "renhold", "vedlikehold"], "source": "mixed_document.md"},
            ],
            "openingHours": {
                "schedule": {"mandag-fredag": "08:00-18:00", "lørdag": "09:00-17:00", "søndag": "10:00-16:00"},
                "seasonal": "Julaften og nyttårsaften: 08:00-14:00. Stengt: 1. juledag, 1. nyttårsdag, 1. påskedag",
                "source": "mixed_document.md",
            },
            "routines": [
                {"name": "Morgenrutine", "steps": ["Åpne bakdør", "Slå på ovnene", "Start kaffemaskin"], "trigger": "07:00", "source": "mixed_document.md"},
            ],
            "policies": [
                {"name": "Hygieneregler", "content": "Hår oppsatt eller hette, smykker av, flater desinfiseres hver time", "source": "mixed_document.md"},
            ],
        })

    def test_hms_plan_mapping(self, hms_extraction):
        expected = load_expected("hms_plan")
        failures = validate_extraction_against_expected(hms_extraction, expected)
        assert failures == [], f"HMS plan mapping failures: {failures}"

    def test_daily_routines_mapping(self, routines_extraction):
        expected = load_expected("daily_routines")
        failures = validate_extraction_against_expected(routines_extraction, expected)
        assert failures == [], f"Routines mapping failures: {failures}"

    def test_menu_mapping(self, menu_extraction):
        expected = load_expected("menu_restaurant")
        failures = validate_extraction_against_expected(menu_extraction, expected)
        assert failures == [], f"Menu mapping failures: {failures}"

    def test_tariff_mapping(self, tariff_extraction):
        expected = load_expected("tariff_agreement")
        failures = validate_extraction_against_expected(tariff_extraction, expected)
        assert failures == [], f"Tariff mapping failures: {failures}"

    def test_mixed_document_mapping(self, mixed_extraction):
        expected = load_expected("mixed_document")
        failures = validate_extraction_against_expected(mixed_extraction, expected)
        assert failures == [], f"Mixed document mapping failures: {failures}"
```

- [ ] **Step 2: Run Level 2 tests**

Run: `cd services/scrapling && python -m pytest tests/test_extraction_eval.py::TestCategoryMapping -v`
Expected: All 5 tests PASS

- [ ] **Step 3: Commit**

```bash
git add services/scrapling/tests/test_extraction_eval.py
git commit -m "feat(scrapling): add Level 2 category mapping eval tests"
```

### Task 7: Level 3 — Edge Case Tests

**Files:**

- Modify: `services/scrapling/tests/test_extraction_eval.py`

- [ ] **Step 1: Add Level 3 tests**

Append to `test_extraction_eval.py`:

````python
# ═══════════════════════════════════════════════════════════
# Level 3: Edge Cases
# ═══════════════════════════════════════════════════════════


class TestEdgeCases:
    """Tests edge cases: empty input, unicode, PD leaks, duplicates."""

    def test_empty_text_yields_empty_result(self):
        """Empty document text should produce no categories."""
        result = AIExtractionResponse.model_validate({})
        stripped = result.strip_empty()
        # All fields should be None
        for field_name in stripped.model_fields:
            assert getattr(stripped, field_name) is None, f"{field_name} should be None for empty input"

    def test_none_values_handled(self):
        """None values in all fields should not crash."""
        data = {k: None for k in AIExtractionResponse.model_fields}
        result = AIExtractionResponse.model_validate(data)
        assert result.policies is None

    def test_unicode_norwegian_characters(self):
        """Norwegian special characters (æøå) are preserved."""
        data = {
            "departments": [{"name": "Kjøkken", "roles": ["Lærling"], "source": "håndbok.pdf"}],
            "policies": [{"name": "Værforhold — uteservering", "content": "Parasollene tas inn ved vind > 15 m/s", "source": "håndbok.pdf"}],
        }
        result = AIExtractionResponse.model_validate(data)
        assert "ø" in result.departments[0].name
        assert "æ" in result.departments[0].roles[0]
        assert "å" in result.departments[0].source
        assert "—" in result.policies[0].name

    def test_mixed_language_extraction(self):
        """Content in both Norwegian and English validates correctly."""
        data = {
            "policies": [
                {"name": "Food Safety Guidelines", "content": "All employees must wash hands", "source": "safety.pdf"},
                {"name": "HMS-regler", "content": "Alle ansatte skal vaske hender", "source": "hms.pdf"},
            ],
        }
        result = AIExtractionResponse.model_validate(data)
        assert len(result.policies) == 2

    def test_personal_data_in_employees_field_ignored(self):
        """employees field is silently dropped by Pydantic (extra=ignore)."""
        data = {
            "employees": [
                {"firstName": "Ola", "lastName": "Nordmann", "email": "ola@test.no", "phone": "91234567"},
            ],
            "policies": [{"name": "HMS", "content": "Regler", "source": "f.pdf"}],
        }
        result = AIExtractionResponse.model_validate(data)
        assert not hasattr(result, "employees")
        # policies should still be extracted
        assert len(result.policies) == 1

    def test_very_long_content_accepted(self):
        """Very long content strings are accepted (truncation is caller's job)."""
        long_content = "Regel: " + "x" * 100_000
        data = {
            "policies": [{"name": "Lang policy", "content": long_content, "source": "big.pdf"}],
        }
        result = AIExtractionResponse.model_validate(data)
        assert len(result.policies[0].content) > 100_000

    def test_duplicate_policies_accepted(self):
        """Duplicate items are accepted by schema (dedup is caller's job)."""
        data = {
            "policies": [
                {"name": "HMS", "content": "Bruk hansker", "source": "f.pdf"},
                {"name": "HMS", "content": "Bruk hansker", "source": "f.pdf"},
            ],
        }
        result = AIExtractionResponse.model_validate(data)
        assert len(result.policies) == 2  # Schema allows dupes

    def test_empty_lists_stripped(self):
        """Empty lists are converted to None by strip_empty()."""
        data = {"policies": [], "menus": [], "departments": []}
        result = AIExtractionResponse.model_validate(data).strip_empty()
        assert result.policies is None
        assert result.menus is None
        assert result.departments is None

    def test_menu_without_prices(self):
        """Menu items without prices are valid (price is optional)."""
        data = {
            "menus": [
                {"category": "Lunsj", "items": [{"name": "Dagens suppe"}, {"name": "Brød"}], "source": "f.pdf"},
            ],
        }
        result = AIExtractionResponse.model_validate(data)
        assert result.menus[0].items[0].price is None
        assert result.menus[0].items[0].name == "Dagens suppe"

    def test_opening_hours_schedule_only(self):
        """Opening hours with only schedule (no seasonal) is valid."""
        data = {
            "openingHours": {"schedule": {"mandag-fredag": "08-18"}, "source": "f.pdf"},
        }
        result = AIExtractionResponse.model_validate(data)
        assert result.openingHours.seasonal is None
        assert "mandag-fredag" in result.openingHours.schedule

    def test_opening_hours_seasonal_only(self):
        """Opening hours with only seasonal info (no schedule) is valid."""
        data = {
            "openingHours": {"seasonal": "Sommertid: utvidet til 01:00", "source": "f.pdf"},
        }
        result = AIExtractionResponse.model_validate(data)
        assert result.openingHours.schedule is None

    def test_holidays_with_rules(self):
        """Holidays with rules (not just dates) are valid."""
        data = {
            "holidays": [
                {"name": "Julaften", "rule": "Stengt fra kl. 15:00", "source": "f.pdf"},
                {"name": "17. mai", "date": "17.05", "source": "f.pdf"},
            ],
        }
        result = AIExtractionResponse.model_validate(data)
        assert result.holidays[0].date is None
        assert result.holidays[1].rule is None

    def test_json_wrapped_in_markdown_codeblock(self):
        """AI sometimes wraps JSON in ```json ... ``` — test the parsing helper."""
        raw = '```json\n{"policies": [{"name": "HMS", "content": "X", "source": "f.pdf"}]}\n```'
        # Extract JSON from code block
        import re
        match = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
        assert match is not None
        data = json.loads(match.group(1).strip())
        result = AIExtractionResponse.model_validate(data)
        assert len(result.policies) == 1
````

- [ ] **Step 2: Run all 3 levels**

Run: `cd services/scrapling && python -m pytest tests/test_extraction_eval.py -v`
Expected: All tests PASS (Level 1 + Level 2 + Level 3)

- [ ] **Step 3: Commit**

```bash
git add services/scrapling/tests/test_extraction_eval.py
git commit -m "feat(scrapling): add Level 3 edge case eval tests"
```

### Task 8: Live OpenRouter Baseline Test (slow)

**Files:**

- Modify: `services/scrapling/tests/test_extraction_eval.py`

- [ ] **Step 1: Add slow live test**

Append to `test_extraction_eval.py`:

````python
# ═══════════════════════════════════════════════════════════
# Live Tests (require OPENROUTER_API_KEY)
# ═══════════════════════════════════════════════════════════

import os
import httpx

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")

CURRENT_PROMPT = """You are an expert at extracting structured workplace data from Norwegian business documents.

Analyze the provided document text and extract any of the following categories you can find:

1. **policies** — Company policies, rules, guidelines (name + content summary)
2. **routines** — Daily procedures, checklists, opening/closing routines (name + steps)
3. **instructions** — Recipes, task descriptions, training material (name + content)
4. **openingHours** — Opening hours per day, seasonal variations
5. **departments** — Department names and roles within each
6. **menus** — Food/drink menus with items and prices
7. **holidays** — Public holidays, closing days, special hour rules
8. **payroll** — Tariff agreement info, pay supplements (evening, weekend, holiday rates)
9. **employmentTerms** — Notice period, probation period, standard terms

IMPORTANT: Do NOT extract personal information (names, emails, phone numbers, addresses).

Return ONLY valid JSON matching this schema:
{
  "policies": [{"name": "string", "content": "string", "source": "FILENAME"}],
  "routines": [{"name": "string", "steps": ["string"], "trigger": "optional time", "source": "FILENAME"}],
  "instructions": [{"name": "string", "content": "string", "source": "FILENAME"}],
  "openingHours": {"schedule": {"day": "hours"}, "seasonal": "string", "source": "FILENAME"},
  "departments": [{"name": "string", "roles": ["string"], "source": "FILENAME"}],
  "menus": [{"category": "string", "items": [{"name": "string", "price": "string"}], "source": "FILENAME"}],
  "holidays": [{"name": "string", "date": "string", "rule": "string", "source": "FILENAME"}],
  "payroll": {"tariff": "string", "supplements": {"type": "rate"}, "source": "FILENAME"},
  "employmentTerms": {"noticePeriod": "string", "probation": "string", "source": "FILENAME"}
}

Only include categories where you found relevant data. Omit empty arrays/objects.
All text values should be in Norwegian where the source is Norwegian."""


def call_openrouter(text: str, filename: str) -> dict:
    """Call OpenRouter with the extraction prompt and return parsed JSON."""
    prompt = CURRENT_PROMPT.replace("FILENAME", filename)
    response = httpx.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        },
        json={
            "model": "anthropic/claude-sonnet-4",
            "max_tokens": 4096,
            "messages": [
                {"role": "user", "content": f"{prompt}\n\n--- DOCUMENT ---\n\n{text}"},
            ],
        },
        timeout=60,
    )
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]

    # Parse JSON from potential markdown code block
    import re
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", content)
    if match:
        return json.loads(match.group(1).strip())
    return json.loads(content)


FIXTURE_NAMES = [
    "hms_plan",
    "daily_routines",
    "menu_restaurant",
    "tariff_agreement",
    "mixed_document",
    "handbook_hospitality",
]


@pytest.mark.slow
@pytest.mark.skipif(not OPENROUTER_API_KEY, reason="OPENROUTER_API_KEY not set")
@pytest.mark.parametrize("fixture_name", FIXTURE_NAMES)
def test_live_extraction(fixture_name: str):
    """Live test: send fixture to OpenRouter, validate result against expected."""
    text = load_fixture(fixture_name)
    expected = load_expected(fixture_name)

    raw_result = call_openrouter(text, f"{fixture_name}.md")
    result = AIExtractionResponse.model_validate(raw_result).strip_empty()

    failures = validate_extraction_against_expected(result, expected)

    # Print detailed result for debugging
    print(f"\n{'='*60}")
    print(f"FIXTURE: {fixture_name}")
    print(f"Categories found: {[k for k in result.model_fields if getattr(result, k) is not None]}")
    if failures:
        print(f"FAILURES: {failures}")
    print(f"{'='*60}")

    assert failures == [], f"Live extraction for '{fixture_name}' failed: {failures}"
````

- [ ] **Step 2: Run live baseline (requires API key)**

Run: `cd services/scrapling && OPENROUTER_API_KEY=<key> python -m pytest tests/test_extraction_eval.py -m slow -v -s`
Expected: Results printed per fixture. Some may fail (baseline measurement).

- [ ] **Step 3: Commit**

```bash
git add services/scrapling/tests/test_extraction_eval.py
git commit -m "feat(scrapling): add live OpenRouter baseline eval tests"
```

---

## Chunk 4: Prompt Redesign (Phase 2 — after baseline)

### Task 9: Write the new prompt with few-shot examples

**Files:**

- Modify: `supabase/functions/analyze-setup-documents/index.ts`

The NEW prompt differs from the baseline (Task 8) by adding **few-shot examples** per category and **industry context**. The baseline prompt is intentionally minimal to measure what the model does without help.

- [ ] **Step 1: Replace `ExtractionResult` type with `AIExtractionResponse`**

In `supabase/functions/analyze-setup-documents/index.ts`, replace the `ExtractionResult` type (lines 15-36) with:

```typescript
type AIExtractionResponse = {
  policies?: Array<{ name: string; content: string; source: string }>;
  routines?: Array<{ name: string; steps: string[]; trigger?: string; source: string }>;
  instructions?: Array<{ name: string; content: string; source: string }>;
  openingHours?: { schedule?: Record<string, string>; seasonal?: string; source: string };
  departments?: Array<{ name: string; roles: string[]; source: string }>;
  menus?: Array<{
    category: string;
    items: Array<{ name: string; price?: string }>;
    source: string;
  }>;
  holidays?: Array<{ name: string; date?: string; rule?: string; source: string }>;
  payroll?: { tariff?: string; supplements?: Record<string, string>; source: string };
  employmentTerms?: { noticePeriod?: string; probation?: string; source: string };
};
```

- [ ] **Step 2: Replace EXTRACTION_PROMPT with few-shot version**

Replace `EXTRACTION_PROMPT` (lines 55-80) with:

```typescript
const EXTRACTION_PROMPT = `You are an expert at extracting structured operational data from Norwegian business documents.

IMPORTANT RULES:
- NEVER extract personal information: no names, emails, phone numbers, or addresses of individuals
- Only extract operational data useful for workplace setup and training
- All text values should be in Norwegian where the source is Norwegian
- Only include categories where you found relevant data

Extract into these 9 categories:

1. **policies** — Rules, guidelines, compliance requirements (HMS, hygiene, safety)
   Example: {"name": "Mattrygghet", "content": "Håndvask hvert 30. minutt, allergener merkes på alle retter", "source": "FILENAME"}

2. **routines** — Daily procedures with ordered steps (opening, closing, receiving goods)
   Example: {"name": "Åpningsrutine", "steps": ["Deaktiver alarm", "Slå på ventilasjon", "Sjekk kjøleskap"], "trigger": "07:00", "source": "FILENAME"}

3. **instructions** — Training material, recipes, task descriptions, how-to guides
   Example: {"name": "Tilberedning fiskesuppe", "content": "Kok fiskekraft i 20 min, tilsett fløte...", "source": "FILENAME"}

4. **openingHours** — Opening hours per day/section, seasonal variations
   Example: {"schedule": {"mandag-fredag": "11:00-23:00", "lørdag": "12:00-01:00"}, "seasonal": "Sommertid: utvidet til 01:00", "source": "FILENAME"}

5. **departments** — Department/section names with roles (not person names)
   Example: {"name": "Kjøkken", "roles": ["Kjøkkensjef", "Kokk", "Lærling", "Oppvask"], "source": "FILENAME"}

6. **menus** — Food/drink categories with items and prices
   Example: {"category": "Forrett", "items": [{"name": "Fiskesuppe med aioli", "price": "149 kr"}], "source": "FILENAME"}

7. **holidays** — Public holidays, closing days, special hour rules
   Example: {"name": "Julaften", "date": "24.12", "rule": "Stengt fra kl. 15:00", "source": "FILENAME"}

8. **payroll** — Tariff agreements, pay supplements, rates
   Example: {"tariff": "Riksavtalen 2026", "supplements": {"kveld 17-21": "30 kr/t", "helg lørdag": "45 kr/t"}, "source": "FILENAME"}

9. **employmentTerms** — Notice period, probation, standard employment conditions
   Example: {"noticePeriod": "1 måned (prøvetid), 3 måneder (fast)", "probation": "6 måneder", "source": "FILENAME"}

Return ONLY valid JSON. Omit categories with no data found.`;
```

- [ ] **Step 3: Add personal data filter (safety net)**

After parsing the AI response (around line 250), add a `stripPersonalData` function:

```typescript
function stripPersonalData(result: Record<string, unknown>): AIExtractionResponse {
  // Remove employees field entirely (never return personal data)
  delete result.employees;

  // Scrub Norwegian phone numbers and email addresses from text fields
  const emailRegex = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g;
  const phoneRegex = /(?:\+47\s?)?\d{2}\s?\d{2}\s?\d{2}\s?\d{2}/g;

  function scrubString(s: string): string {
    return s.replace(emailRegex, "[fjernet]").replace(phoneRegex, "[fjernet]");
  }

  function scrubDeep(obj: unknown): unknown {
    if (typeof obj === "string") return scrubString(obj);
    if (Array.isArray(obj)) return obj.map(scrubDeep);
    if (obj && typeof obj === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        // Skip source fields (filenames may contain numbers)
        out[k] = k === "source" ? v : scrubDeep(v);
      }
      return out;
    }
    return obj;
  }

  return scrubDeep(result) as AIExtractionResponse;
}
```

Call it after JSON parsing:

```typescript
result = stripPersonalData(result);
```

- [ ] **Step 4: Update the prompt variable in the eval test**

In `services/scrapling/tests/test_extraction_eval.py`, update the `CURRENT_PROMPT` string to match the new prompt from Step 2. The OLD prompt is preserved in git history for comparison.

- [ ] **Step 5: Run eval suite against new prompt**

Run: `cd services/scrapling && OPENROUTER_API_KEY=<key> python -m pytest tests/test_extraction_eval.py -m slow -v -s`
Expected: Equal or better results than baseline

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/analyze-setup-documents/index.ts services/scrapling/tests/test_extraction_eval.py
git commit -m "feat(edge): redesign extraction prompt — 9 categories, few-shot examples, PD scrub"
```

### Task 10: Handbook sections mapping (post-AI, deterministic)

**Files:**

- Create: `services/scrapling/extractors/handbook_mapping.py`
- Create: `services/scrapling/tests/test_handbook_mapping.py`

This function maps raw AI extraction categories to handbook chapter keys. It runs AFTER the AI call — no AI involved, pure logic.

- [ ] **Step 1: Write the failing test**

Create `services/scrapling/tests/test_handbook_mapping.py`:

```python
"""Tests for deterministic handbook section mapping."""

import pytest
from extractors.handbook_mapping import map_to_handbook_sections
from extractors.validation import AIExtractionResponse


HOSPITALITY_CHAPTERS = [
    "identity-mission",
    "organization-model",
    "daily-operations",
    "safety-compliance",
    "communication",
    "onboarding-training",
    "scheduling",
    "quality-service",
    "incident-response",
    "kpi-review",
]


class TestHandbookMapping:
    def test_policies_map_to_safety_compliance(self):
        data = AIExtractionResponse.model_validate({
            "policies": [
                {"name": "HMS", "content": "Bruk hansker og verneutstyr", "source": "f.pdf"},
                {"name": "Brannvern", "content": "Brannslukkere sjekkes månedlig", "source": "f.pdf"},
            ],
        })
        sections = map_to_handbook_sections(data, HOSPITALITY_CHAPTERS)
        keys = [s["chapterKey"] for s in sections]
        assert "safety-compliance" in keys

    def test_routines_map_to_daily_operations(self):
        data = AIExtractionResponse.model_validate({
            "routines": [
                {"name": "Åpning", "steps": ["Slå på ovner"], "source": "f.pdf"},
            ],
        })
        sections = map_to_handbook_sections(data, HOSPITALITY_CHAPTERS)
        keys = [s["chapterKey"] for s in sections]
        assert "daily-operations" in keys

    def test_departments_map_to_organization_model(self):
        data = AIExtractionResponse.model_validate({
            "departments": [
                {"name": "Kjøkken", "roles": ["Kokk"], "source": "f.pdf"},
            ],
        })
        sections = map_to_handbook_sections(data, HOSPITALITY_CHAPTERS)
        keys = [s["chapterKey"] for s in sections]
        assert "organization-model" in keys

    def test_opening_hours_map_to_scheduling(self):
        data = AIExtractionResponse.model_validate({
            "openingHours": {"schedule": {"man-fre": "11-23"}, "source": "f.pdf"},
        })
        sections = map_to_handbook_sections(data, HOSPITALITY_CHAPTERS)
        keys = [s["chapterKey"] for s in sections]
        assert "scheduling" in keys

    def test_menus_map_to_quality_service(self):
        data = AIExtractionResponse.model_validate({
            "menus": [
                {"category": "Lunsj", "items": [{"name": "Suppe"}], "source": "f.pdf"},
            ],
        })
        sections = map_to_handbook_sections(data, HOSPITALITY_CHAPTERS)
        keys = [s["chapterKey"] for s in sections]
        assert "quality-service" in keys

    def test_instructions_map_to_onboarding_training(self):
        data = AIExtractionResponse.model_validate({
            "instructions": [
                {"name": "Opplæring nyansatte", "content": "2 uker fadder", "source": "f.pdf"},
            ],
        })
        sections = map_to_handbook_sections(data, HOSPITALITY_CHAPTERS)
        keys = [s["chapterKey"] for s in sections]
        assert "onboarding-training" in keys

    def test_empty_extraction_returns_no_sections(self):
        data = AIExtractionResponse.model_validate({})
        sections = map_to_handbook_sections(data, HOSPITALITY_CHAPTERS)
        assert sections == []

    def test_only_maps_to_provided_chapter_keys(self):
        """If industryPackage only has 3 chapters, only those are mapped."""
        data = AIExtractionResponse.model_validate({
            "policies": [{"name": "HMS", "content": "X", "source": "f.pdf"}],
            "routines": [{"name": "Åpning", "steps": ["A"], "source": "f.pdf"}],
            "menus": [{"category": "Mat", "items": [{"name": "X"}], "source": "f.pdf"}],
        })
        limited_chapters = ["safety-compliance", "daily-operations"]
        sections = map_to_handbook_sections(data, limited_chapters)
        keys = [s["chapterKey"] for s in sections]
        assert "safety-compliance" in keys
        assert "daily-operations" in keys
        assert "quality-service" not in keys  # not in provided chapters
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/scrapling && python -m pytest tests/test_handbook_mapping.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'extractors.handbook_mapping'`

- [ ] **Step 3: Implement the mapping function**

Create `services/scrapling/extractors/handbook_mapping.py`:

```python
"""Deterministic mapping from AI extraction categories to handbook chapter keys.

This runs AFTER the AI call — no AI involved. Maps raw extracted data
to handbook sections based on industry-specific chapter keys.
"""

from __future__ import annotations

from typing import Any

from .validation import AIExtractionResponse


# Category → chapter key mapping
# Each category maps to the most relevant handbook chapter
CATEGORY_TO_CHAPTER: dict[str, str] = {
    "policies": "safety-compliance",
    "routines": "daily-operations",
    "instructions": "onboarding-training",
    "openingHours": "scheduling",
    "departments": "organization-model",
    "menus": "quality-service",
    "holidays": "scheduling",  # secondary: also relevant to scheduling
    "payroll": "kpi-review",
    "employmentTerms": "onboarding-training",  # secondary: relevant to onboarding
}


def _summarize_category(category: str, data: Any) -> str | None:
    """Generate a text summary for a category's data."""
    if data is None:
        return None

    if category == "policies" and isinstance(data, list):
        return "\n\n".join(f"### {p.name}\n{p.content}" for p in data)

    if category == "routines" and isinstance(data, list):
        parts = []
        for r in data:
            trigger = f" (kl. {r.trigger})" if r.trigger else ""
            steps = "\n".join(f"{i+1}. {s}" for i, s in enumerate(r.steps))
            parts.append(f"### {r.name}{trigger}\n{steps}")
        return "\n\n".join(parts)

    if category == "instructions" and isinstance(data, list):
        return "\n\n".join(f"### {i.name}\n{i.content}" for i in data)

    if category == "openingHours":
        parts = []
        if data.schedule:
            parts.append("\n".join(f"- {day}: {hours}" for day, hours in data.schedule.items()))
        if data.seasonal:
            parts.append(f"Sesong: {data.seasonal}")
        return "\n".join(parts) if parts else None

    if category == "departments" and isinstance(data, list):
        return "\n".join(f"- **{d.name}**: {', '.join(d.roles)}" for d in data)

    if category == "menus" and isinstance(data, list):
        parts = []
        for section in data:
            items = ", ".join(
                f"{item.name} ({item.price})" if item.price else item.name
                for item in section.items
            )
            parts.append(f"**{section.category}:** {items}")
        return "\n".join(parts)

    if category == "holidays" and isinstance(data, list):
        return "\n".join(
            f"- {h.name}" + (f" ({h.date})" if h.date else "") + (f": {h.rule}" if h.rule else "")
            for h in data
        )

    return None


def map_to_handbook_sections(
    extraction: AIExtractionResponse,
    industry_chapter_keys: list[str],
) -> list[dict[str, str]]:
    """Map AI extraction result to handbook sections.

    Only maps to chapters that exist in the provided industry_chapter_keys list.
    Returns list of {chapterKey, content, source} dicts.
    """
    chapter_keys_set = set(industry_chapter_keys)
    # Collect content per chapter (multiple categories can map to same chapter)
    chapter_content: dict[str, list[str]] = {}

    for category, chapter_key in CATEGORY_TO_CHAPTER.items():
        if chapter_key not in chapter_keys_set:
            continue

        data = getattr(extraction, category, None)
        if data is None:
            continue
        if isinstance(data, list) and len(data) == 0:
            continue

        summary = _summarize_category(category, data)
        if summary:
            chapter_content.setdefault(chapter_key, []).append(summary)

    return [
        {
            "chapterKey": key,
            "content": "\n\n---\n\n".join(parts),
            "source": "auto-mapped",
        }
        for key, parts in chapter_content.items()
        if parts
    ]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd services/scrapling && python -m pytest tests/test_handbook_mapping.py -v`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add services/scrapling/extractors/handbook_mapping.py services/scrapling/tests/test_handbook_mapping.py
git commit -m "feat(scrapling): add deterministic handbook section mapping"
```

### Task 11: Update frontend types

**Files:**

- Modify: `apps/web/src/components/dashboard/wizard-steps/wizard-state.ts`

- [ ] **Step 1: Update DocumentExtractionResult**

Replace the type to match the new AI response schema:

- Remove: `employees`, `shiftPatterns`
- Add: `routines`, `instructions`, `openingHours`, `departments`, `menus`, `holidays`
- Keep: `policies`, `payroll`, `employmentTerms`, `handbookSections`
- Change: `payroll.supplements` from `Record<string, unknown>` to `Record<string, string>`

Note: `OnboardingGuide.tsx` also references `extractedData` and must be updated alongside `WorkspaceSetupWizard.tsx`.

- [ ] **Step 2: Run typecheck**

Run: `cd /home/sxtnl/dev/reset_wizzard && pnpm turbo typecheck`
Expected: Compilation errors in wizard step components that reference `employees` or `shiftPatterns`

- [ ] **Step 3: Fix wizard step components**

Update each wizard step to use new categories:

- `WorkspaceSetupWizard.tsx` — remove `extractedEmployees` and `extractedShiftPatterns`, add new category props
- `DocumentDropStep.tsx` — update `ExtractionSummary` sections (remove Ansatte/Vaktmønstre, add Rutiner/Åpningstider/Avdelinger/Meny/Helligdager)
- `GovernanceSetupStep.tsx` — accept `routines` + `instructions` in addition to `policies`
- `TeamSetupStep.tsx` — accept `departments` instead of `employees`
- `ShiftTemplateSetupStep.tsx` — accept `openingHours` instead of `shiftPatterns`
- `OnboardingGuide.tsx` — mirror all changes from WorkspaceSetupWizard

- [ ] **Step 4: Run typecheck again**

Run: `pnpm turbo typecheck`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/dashboard/wizard-steps/ apps/web/src/components/dashboard/WorkspaceSetupWizard.tsx apps/web/src/components/dashboard/OnboardingGuide.tsx
git commit -m "feat(wizard): update extraction types — 9 categories, no personal data"
```
