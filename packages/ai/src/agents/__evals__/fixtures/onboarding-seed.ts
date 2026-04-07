import type { FixtureFile } from "./_schema.js";

/**
 * Seed fixtures for `extractOnboardingIntelligence`.
 *
 * Each fixture is a short conversation between Mr. Botsson and a
 * business owner during onboarding. We assert which fields the model
 * should recover and which should remain null/empty.
 *
 * Field assertions use three predicates (see `_schema.ts`):
 *  - `present` — non-null primitive or non-empty array
 *  - `absent`  — null or empty array
 *  - `equals`  — exact match (use sparingly — model output wobbles)
 *
 * Bias toward `present` / `absent` checks. Reserve `equals` for cases
 * where the user said the value verbatim and there is no reasonable
 * alternative phrasing.
 */
export const onboardingSeed: FixtureFile = {
  suite: "onboarding-extraction-seed",
  fixtures: [
    {
      id: "onboarding-bistro-basics",
      note: "Single-turn extraction — name + general manager + departments + location",
      conversation: [
        { role: "assistant", content: "Hei! Hva heter virksomheten din?" },
        {
          role: "user",
          content: "Vi heter Solsiden Bistro. Vi driver en restaurant i Stavanger.",
        },
        { role: "assistant", content: "Flott! Hvem er daglig leder?" },
        {
          role: "user",
          content: "Lars Hansen er daglig leder. Vi har et kjøkken og en serveringsavdeling.",
        },
      ],
      expected: {
        company_name: { kind: "present" },
        general_manager: { kind: "present" },
        departments: { kind: "present" },
        locations: { kind: "present" },
        // Things NOT mentioned in the conversation should remain absent.
        hr_manager: { kind: "absent" },
        fire_safety_manager: { kind: "absent" },
        current_season: { kind: "absent" },
        teams: { kind: "absent" },
        zones: { kind: "absent" },
        assets_with_haccp: { kind: "absent" },
      },
      tags: ["norwegian", "basics", "multi-field"],
    },
    {
      id: "onboarding-haccp-asset-mention",
      note: "User volunteers HACCP-relevant assets — should land in assets_with_haccp",
      conversation: [
        { role: "assistant", content: "Har dere noe utstyr som krever HACCP-kontroller?" },
        {
          role: "user",
          content:
            "Ja, vi har en walk-in fryser, et stekebord, og en pizzaovn. Alle har daglige temperaturkontroller.",
        },
      ],
      expected: {
        assets_with_haccp: { kind: "present" },
        company_name: { kind: "absent" },
        departments: { kind: "absent" },
      },
      tags: ["norwegian", "haccp", "single-topic"],
    },
    {
      id: "onboarding-leadership-roles",
      note: "Three leadership roles in one turn — all should land in distinct fields",
      conversation: [
        { role: "assistant", content: "Kan du fortelle meg om ledelsen?" },
        {
          role: "user",
          content:
            "Daglig leder er Anna Berg. Personalansvarlig er Per Olsen. Brannansvarlig er Kari Nilsen.",
        },
      ],
      expected: {
        general_manager: { kind: "present" },
        hr_manager: { kind: "present" },
        fire_safety_manager: { kind: "present" },
        company_name: { kind: "absent" },
      },
      tags: ["norwegian", "leadership", "role-disambiguation"],
    },
    {
      id: "onboarding-empty-conversation",
      note: "Greeting only — nothing extractable. All fields should be absent.",
      conversation: [
        { role: "assistant", content: "Hei! Hyggelig å møte deg." },
        { role: "user", content: "Hei." },
      ],
      expected: {
        company_name: { kind: "absent" },
        general_manager: { kind: "absent" },
        departments: { kind: "absent" },
        locations: { kind: "absent" },
        assets_with_haccp: { kind: "absent" },
      },
      tags: ["norwegian", "negative", "all-absent"],
    },
    {
      id: "onboarding-departments-multi-location",
      note: "Multiple departments AND multiple locations in one turn",
      conversation: [
        { role: "assistant", content: "Fortell meg om strukturen deres." },
        {
          role: "user",
          content:
            "Vi har tre lokasjoner: Karl Johan, Aker Brygge, og Grünerløkka. På hver har vi kjøkken, bar, og servering.",
        },
      ],
      expected: {
        locations: { kind: "present" },
        departments: { kind: "present" },
        company_name: { kind: "absent" },
        general_manager: { kind: "absent" },
      },
      tags: ["norwegian", "structure", "multi-location"],
    },
  ],
};
