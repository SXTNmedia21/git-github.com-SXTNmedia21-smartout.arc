---
title: "Handoff — profession-system"
feature: profession-system
branch: feat/profession-system
closed: 2026-03-28
module: onboarding
---

# Handoff — profession-system

## Summary

Introduced **Fag** (profession/competence domain) as a core K1a dimension in Smartout. Six professions seeded for hospitality. Existing `position` table extended with `profession_id` FK. Authority level added to profile. Legal functions (Verneombud, Brannvernleder, etc.) as law-mandated K1a entities. Fine-grained `profile_access` system. Onboarding wizard gets step #3 for confirming positions grouped by profession. Location auto-generation bug fixed.

## What Was Done

- [x] 7 new database tables: profession, profession_industry, legal_function, profile_legal_function, profession_training, profile_access, profile_position
- [x] 1 new enum: authority_level (duty/deputy/leader)
- [x] Extended position with profession_id FK
- [x] Extended profile with authority_level enum
- [x] Full RLS with admin guards + API key policies
- [x] Seed data: 6 professions, 9 NACE mappings, 4 legal functions
- [x] ProfessionOption/PositionOption TypeScript types
- [x] DB-backed getProfessionsForIndustry() function
- [x] ConfirmProfessions onboarding wizard step (#3)
- [x] ConfirmSummary updated with profession display
- [x] Finalize RPC updated to create positions with profession_id
- [x] 7 telemetry events registered
- [x] DATABASE.md documentation
- [x] Location bug fix: auto-generates default location from business name
- [x] POSITION_MAP marked @deprecated (not removed — 5 consumers)

## Decisions Made

| Decision                                            | Reason                                                                 | Impact                                        |
| --------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------- |
| `public` schema (not `intelligence`)                | Follows existing K1a pattern (tariff_rate_table, regulatory_framework) | No cross-schema complexity                    |
| authority_level on profile, not position            | Authority is stable per person, not per job slot                       | Simpler model, avoids dual-concept            |
| profile_position m2m                                | A person can be Servitor + Bartender                                   | Supports multi-fag competence                 |
| Removed is_regulated from position                  | Redundant with legal_function table                                    | Single source of truth for legal requirements |
| Skjenkeansvarlig has NULL profession_id             | Applies across all professions with alcohol service                    | Not tied to bartending only                   |
| All manage policies require is_admin_in_workspace() | Prevents employees from self-assigning legal functions or access       | Security hardening                            |
| Keep POSITION_MAP @deprecated                       | TeamSetupStep, getDepartmentsForIndustry, tests still use it           | Remove in follow-up PR                        |
| UNIQUE NULLS NOT DISTINCT on profession             | Prevents duplicate platform-level slugs                                | PostgreSQL 15+ feature                        |

## Learnings

| Learning                                                   | Context                                                                                                                                       |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Fag is not Avdeling, Position is not Role                  | Clarified through 3 brainstorming rounds — Fag = competence domain (cross-industry), Position = job slot, Authority = responsibility level    |
| authority_level is a person attribute, not a job attribute | "Du kan ikke vaere leder en dag og nestleder andre" — Hovmester = Servitor + leader authority                                                 |
| Council reviews catch real blockers                        | Council #3 found finalize RPC would INSERT authority_level into position table (wrong — column is on profile). Would have crashed at runtime. |
| Migration audit finds schema gaps                          | Deep audit revealed: no profile→position link, missing ON DELETE clauses, no admin guards on manage policies                                  |
| Legal functions are static, law-defined                    | Not configurable per workspace — Verneombud is mandated by Arbeidsmiljoloven §6-1 regardless of business type                                 |

## Known Issues / Debt

- Hardcoded Norwegian strings in ConfirmProfessions (matches existing pattern in ConfirmDepartments — pre-existing i18n debt)
- No stagger animation on profession groups (UI polish)
- No explicit DB indexes on FK columns (relies on PK/unique indexes)
- emit() calls not wired yet — events registered but not emitted (follow-up)
- position_training table not created (position-specific training, e.g., Sommelier wine course — future)
- Access seeding logic not implemented (profile_access table exists but nothing populates it yet)
- Context collector does not include profession data for AI agent

## Next Steps

- Wire emit() calls for profession events in onboarding onComplete and future CRUD
- Build admin UI for managing professions, positions, legal functions, and access
- Implement access seeding: authority_level change → seed profile_access
- Add profession data to AI agent context collector
- Update get_readiness tool to use profession_training weights
- Create position_training table for position-specific training requirements
- Remove POSITION_MAP after migrating TeamSetupStep to DB-based data
- Write ADR for profession system in main decision log
