import type { FixtureFile } from "../../../__evals__/fixtures/_schema.js";

/**
 * Tool-call seed fixtures for the schedule capability.
 *
 * Each fixture is unambiguous by design: there is one obvious right
 * answer. Ambiguous prompts (e.g. "what's on my schedule today" — could
 * be `get_my_shifts` or `get_today_schedule`) are deliberately not
 * included in the seed; we want to baseline clear cases first and add
 * harder ones once the easy cases are stable.
 *
 * Tools available in `scheduleCapability`:
 *  - get_my_shifts        — current employee, next N days
 *  - get_today_schedule   — full department schedule, today
 *  - get_shift_colleagues — who else works a specific shift
 *  - get_shift_detail     — full info for a specific shift
 */
export const scheduleSeed: FixtureFile = {
  suite: "schedule-tool-calls-seed",
  fixtures: [
    {
      id: "schedule-when-work-next-week",
      note: "Norwegian — direct shift query, default 7-day window",
      prompt: "Når jobber jeg neste uke?",
      context: "Rolle: employee. Avdeling: Kjøkken.",
      expected: { toolName: "get_my_shifts", args: { days: 7 } },
      tags: ["norwegian", "schedule-query", "default-args"],
    },
    {
      id: "schedule-explicit-14-days",
      note: "English — explicit day count should be reflected in args",
      prompt: "Show me all my upcoming shifts in the next 14 days.",
      context: "Role: employee. Department: Kitchen.",
      expected: { toolName: "get_my_shifts", args: { days: 14 } },
      tags: ["english", "explicit-days"],
    },
    {
      id: "schedule-explicit-3-days-norwegian",
      prompt: "Vis meg vaktene mine for de neste 3 dagene.",
      context: "Rolle: employee. Avdeling: Servering.",
      expected: { toolName: "get_my_shifts", args: { days: 3 } },
      tags: ["norwegian", "explicit-days"],
    },
    {
      id: "schedule-department-today",
      note: "Should select get_today_schedule because it asks for whole department",
      prompt: "Show me every shift in my department today.",
      context: "Role: manager. Department: Kitchen.",
      expected: { toolName: "get_today_schedule" },
      tags: ["english", "department-wide"],
    },
    {
      id: "schedule-shift-detail-by-id",
      note: "Tool-selection should follow the explicit ID — get_shift_detail",
      prompt: "Get full details for shift 11111111-1111-1111-1111-111111111111.",
      context: "Role: employee.",
      expected: {
        toolName: "get_shift_detail",
        args: { shift_id: "11111111-1111-1111-1111-111111111111" },
      },
      tags: ["english", "by-id", "uuid"],
    },
    {
      id: "schedule-colleagues-by-shift-id",
      note: "Asking who else works shift X — get_shift_colleagues",
      prompt: "Who else is working shift 22222222-2222-2222-2222-222222222222?",
      context: "Role: employee.",
      expected: {
        toolName: "get_shift_colleagues",
        args: { shift_id: "22222222-2222-2222-2222-222222222222" },
      },
      tags: ["english", "by-id", "uuid"],
    },
  ],
};
