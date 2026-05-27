---
title: "Department Vocabulary — FoH/BoH/Admin Defaults + Terminology Glossar"
id: ADR_0429
status: accepted
layer: decision
created: 2026-05-27
updated: 2026-05-27
---

# ADR-0429: Department Vocabulary — FoH/BoH/Admin Defaults + Terminology Glossar

## Context and Problem Statement

Smartout's I1 hospitality seed currently creates four departments per new workspace: `Operations / Kitchen / Service / Bar`. Two issues surface from a restaurant-manager perspective:

1. **"Operations" is a catch-all** — no hospitality professional uses this term. Industry-canonical groupings are Front-of-House (FoH), Back-of-House (BoH), and Administration. The current seed mixes axes (BoH-style "Kitchen" alongside FoH-style "Service" and "Bar" at the same hierarchy level).
2. **Terminology drift across UI + AI + docs** — Norwegian strings inconsistently map `position` to "stilling" vs "rolle", and `profile.role` to "tilgangsnivå" vs "rolle". The same word ("rolle") covers two unrelated concepts. Botsson tool descriptions, dashboard labels, and onboarding wizard copy diverge.

This ADR fixes both: (a) a clean three-department default that scales beyond hospitality, and (b) a canonical vocabulary that every surface (UI, AI, docs, seed) shares.

This ADR builds on ADR-0367 v1.1 (Day Line Area-Anchored Runtime) and ADR-0387 (Role-Mandatory Compliance — Hospitality Intelligence). It supersedes implicit naming choices in `packages/ai/src/industry/packages/hospitality.ts` for **new** workspaces only — existing workspace data is untouched (workspace-defined autonomy).

## Decision Drivers

- **Restaurant-manager mental model.** A department in hospitality means *a group of staff working with similar tasks, profession, and regulations.* FoH staff handle alcohol service, guest interaction, and floor restrictions. BoH staff handle food production, fire/temperature, and cleanliness regulations. Admin coordinates. Three is the natural shape.
- **Scaling cross-industry.** The front-facing + back-facing + admin archetype repeats across retail, healthcare, office, and construction. I1 industry packages (currently only hospitality.ts) get their own canonical defaults using the same pattern.
- **Workspace-defined autonomy.** Admin can rename, add, or remove departments in `/setup` and `/onboarding` wizard. Defaults are recommendations, not enforced shapes.
- **Crystal-clear naming.** Using `FoH / BoH / Admin` directly (not Norwegian translations like "Servering / Kjøkken / Administrasjon") avoids ambiguity. Hospitality professionals globally recognize the English abbreviations. Norwegian onboarding copy explains the abbreviations once, then uses them as-is everywhere.
- **Terminology consistency.** Five surfaces share the glossar: seed data, database content, AI tool descriptions, Botsson system prompt, dashboard UI strings, docs. One canonical map.
- **Size-conditional Bar.** Small workspaces fold bar service into FoH (bartender as position under FoH). Large or bar-led workspaces add Bar as a fourth department. Wizard offers this choice.

## Considered Options

1. **Status quo** — Keep `Operations / Kitchen / Service / Bar`. Rejected: "Operations" is non-canonical; mixed-axis seed confuses restaurant managers.
2. **Norwegian-canonical names** — Default to `Servering / Kjøkken / Administrasjon`. Rejected: locks the abstraction to Norwegian; doesn't scale to multilingual deployments; loses the international industry-standard signal.
3. **`FoH / BoH / Admin` + workspace-defined override** — Default three departments using the industry-canonical English abbreviations. Wizard explains and lets admin customize. **Chosen.**
4. **Schema-level `dept_group` enum** {foh, boh, mgmt, events} on `department` table — Add a grouping column alongside the existing name. Rejected: redundant when the department *name* IS the grouping. Adds complexity without payoff. Could be added later via separate ADR if cross-dept queries become a pattern.

## Decision Outcome

**Chosen: Option 3 — `FoH / BoH / Admin` defaults with workspace-defined override.**

### Three default departments

| Default name | Scope | Default positions (granular) |
|---|---|---|
| **FoH** (Front of House) | Guest-facing service | Servitør · Bartender · Hovmester · Sommelier · Hostess · Runner |
| **BoH** (Back of House) | Food production + cleanliness + receiving | Kjøkkensjef · Sous Chef · Kokk · Lærling · Oppvask · Stewarding |
| **Admin** | Coordinating + business operations | Daglig leder · Eier · Regnskap · HR · Innkjøp |

### Size-conditional fourth department

When workspace has bar-led operations or large bar staffing (≥4 dedicated bartenders or admin checks "vi har en dedikert bar-avdeling" in wizard), the wizard offers a **Bar** dept as a 4th department alongside FoH/BoH/Admin. Bartender positions move out of FoH and under Bar.

Optional 5th dept **Events** when admin checks "vi har dedikert event-håndtering" in wizard. Default: Events is a sub-activity inside FoH/BoH (no separate dept).

### Terminology glossar — single canonical mapping

| Norwegian UI term | Database concept | Used for |
|---|---|---|
| **Avdeling** | `department` | Functional grouping of staff with similar tasks, profession, and regulations |
| **Stilling** | `position` | Role *type* under a department (Bartender, Kjøkkensjef) — NOT a person |
| **Tilgangsnivå** | `profile.role` enum (`employee` / `manager` / `admin` / `owner`) | Permission/security level — NOT a job title |
| **Område** | `location` | Operational area inside the workspace (V1: area; property-layer deferred per ADR-0367) |
| **Sone** | `zone` | Sub-area shift-assignment unit inside an område (e.g. "Bar 1", "Dish station") |
| **Lag** | `team` | Concrete crew of people working together (e.g. "Helenes frokost-crew") |
| **Vakt** | `schedule_shift` | A planned work-assignment for a profile on a date |

The word **rolle** is intentionally NOT used as a Smartout term — it ambiguously covers both "stilling" and "tilgangsnivå" in colloquial Norwegian. UI copy explicitly avoids it.

### Cross-industry scaling pattern

The front-facing + back-facing + admin archetype is industry-portable. Each `packages/ai/src/industry/packages/<industry>.ts` seeds its own canonical defaults using the pattern:

| Industry | Front-facing dept | Back-facing dept | Admin dept | Optional 4th |
|---|---|---|---|---|
| Hospitality | FoH | BoH | Admin | Bar / Events |
| Retail | Salg | Lager | Admin | Kasse / Innkjøp |
| Healthcare | Pasientkontakt | Laboratorium | Admin | Renhold |
| Office | Kundeservice | Produksjon | Admin | Salg |
| Construction | Felt | Verksted | Admin | Prosjekt |

The pattern is a guideline for future I1 packages, not a schema constraint. New industry packages choose their own canonical names; the three-dept-plus-optional shape is the recommendation.

## Rules & Consequences

### Good
- **Aligned with restaurant-manager mental model.** FoH/BoH/Admin = how the industry thinks.
- **Cross-industry scalable.** Each I1 package gets its own canonical defaults under the same archetype.
- **Workspace-defined.** Admins are never trapped in a name they don't like.
- **Terminology drift closed.** One glossar; all surfaces follow it.
- **Tooltip-friendly.** "En avdeling er en gruppe ansatte med lignende oppgaver, fag, og regler" — short, scannable, lands on every avdeling-touchpoint in UI.
- **No schema change** beyond seed-data update. Zero migration risk for ADR-0429 itself.

### Bad
- **Existing workspaces are inconsistent.** Workspaces created before this ADR keep their `Operations / Kitchen / Service / Bar` shape. Admins can manually rename but Smartout doesn't auto-migrate (workspace-defined autonomy).
- **English abbreviations need a learn-once explanation.** First-time onboarding shows a short tooltip per default name. After that, FoH/BoH/Admin are used as-is. Acceptable cost for canonical naming.
- **Tariff and payroll-rule binding becomes broader at dept level.** Riksavtalen tariff rates per FoH-dept apply across all FoH positions. Position-level overrides handle granular cases. Payroll domain must confirm no Riksavtalen rule needs per-position-only binding (verify against `packages/payroll-calculate/` + `tariff_rate_table`).
- **Slight English↔Norwegian asymmetry.** Department names are English (FoH/BoH/Admin), but position names and surrounding UI copy are Norwegian. Acceptable in V1 — multilingual i18n keys handle this cleanly when later languages added.

### Agent Impact

- **Botsson chat / voice (system prompt + tool descriptions):** All tool descriptions in `packages/ai/src/capabilities/*/tools.ts` use canonical terms — `avdeling`, `stilling`, `tilgangsnivå`, `område`, `sone`, `lag`, `vakt`. Botsson system prompt at `packages/ai/src/router/prompts.ts` teaches the glossar: "Smartouts modell: 1 workspace → flere avdelinger (FoH/BoH/Admin) → stillinger → ansatte."
- **Onboarding wizard:** The `OrgSetupStep` (in `apps/web/src/app/onboarding/`) renders the three default departments with the avdeling-tooltip + rename inputs + "Legg til Bar" + "Legg til Events" checkboxes. Position-list per department shown for admin awareness.
- **Dashboard UI:** All `apps/web/src/app/dashboard/**` and `apps/mobile/**` strings that say "rolle" for stilling/tilgangsnivå are renamed via i18n keys. New keys: `org.avdeling.*`, `org.stilling.*`, `org.tilgangsnivå.*`, `org.område.*`, `org.sone.*`, `org.lag.*`.
- **I1 seed update:** `packages/ai/src/industry/packages/hospitality.ts` replaces the four-dept seed with the three-dept FoH/BoH/Admin shape + granular position seeds per dept.
- **Domain docs:** `docs/domains/core-structure/OVERVIEW.md §Terminology` and `docs/domains/core-structure/USER-FLOWS.md` get the glossar. A new doc `docs/engines/industri-inteligence/cross-industry-pattern.md` documents the archetype pattern for future I1 packages.
- **No code reads `department.name === "Operations"` etc.** — verified by grep before merge.

## Implementation sequence

1. **Seed update** — `packages/ai/src/industry/packages/hospitality.ts` defaults change to three depts FoH/BoH/Admin with position-seeds per dept. Existing workspaces untouched.
2. **Wizard step** — `OrgSetupStep` renders three default cards + tooltips + rename/add affordances + size-conditional Bar/Events toggles.
3. **i18n keys** — new `org.*` namespace; map every UI string previously hardcoded to canonical glossar.
4. **Botsson prompt + tool descriptions** — single sweep across `packages/ai/src/capabilities/*/tools.ts` description fields + `router/prompts.ts` system-prompt.
5. **Docs** — `core-structure/OVERVIEW.md §Terminology` extended with glossar table + tooltip-copy reference. `cross-industry-pattern.md` new file.
6. **Grep gate before merge** — zero hits for "Operations" department name in seed code; zero hits for "rolle" in UI strings where Smartout means stilling or tilgangsnivå.

## Open follow-ups (out of scope for this ADR)

- **ADR-0430 — Core Structure Reform Phase 2 (Shift × Zone × Location M:N, Option Y).** Reserved slot for the lifted shift_zone reform. Tracks the cascade-invariant-preserving subordinate-junction model. To be drafted as a separate sortie.
- **Future cross-industry I1 packages** — retail, healthcare, office, construction. Each gets its own ADR documenting industry-canonical names.
- **Payroll dept-binding audit** — verify no Riksavtalen rule needs per-position-only binding that the broader dept-binding would mishandle. Out of scope here; tracked under payroll domain.

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
