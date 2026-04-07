import type { FixtureFile } from "../../../__evals__/fixtures/_schema.js";

/**
 * Tool-call seed fixtures for the operations capability.
 *
 * Operations is more interesting than schedule because it includes
 * WRITE operations (create_deviation, complete_task). Tool selection
 * for writes is more sensitive — the model has to be confident enough
 * to call a mutating action vs. asking for clarification.
 *
 * Tools available in `operationsCapability`:
 *  - get_my_tasks         — pending/in_progress/completed/overdue tasks
 *  - get_session_info     — today's department session state
 *  - get_department_status — staff count + pending task count
 *  - create_deviation     — WRITE: report a quality/safety/process issue
 *  - complete_task        — WRITE: mark a task as done
 */
export const operationsSeed: FixtureFile = {
  suite: "operations-tool-calls-seed",
  fixtures: [
    {
      id: "ops-pending-tasks-default",
      note: "Default status (pending) — model should accept the default or pass it explicitly",
      prompt: "What are my pending tasks?",
      context: "Role: employee. Department: Kitchen.",
      expected: { toolName: "get_my_tasks", args: { status: "pending" } },
      tags: ["english", "read", "default-args"],
    },
    {
      id: "ops-overdue-tasks-explicit",
      note: "Explicit non-default status — must be reflected in args",
      prompt: "Show me my overdue tasks.",
      context: "Role: employee. Department: Kitchen.",
      expected: { toolName: "get_my_tasks", args: { status: "overdue" } },
      tags: ["english", "read", "explicit-status"],
    },
    {
      id: "ops-pending-tasks-norwegian",
      prompt: "Vis meg oppgavene mine.",
      context: "Rolle: employee. Avdeling: Servering.",
      expected: { toolName: "get_my_tasks", args: { status: "pending" } },
      tags: ["norwegian", "read", "default-args"],
    },
    {
      id: "ops-department-status-explicit-metrics",
      note: "Asks for specific metrics (staff + tasks) — should pick get_department_status, not get_session_info",
      prompt:
        "How many staff are working right now and how many pending tasks does my department have?",
      context: "Role: manager. Department: Kitchen.",
      expected: { toolName: "get_department_status" },
      tags: ["english", "read", "metrics"],
    },
    {
      id: "ops-complete-task-by-id",
      note: "WRITE — model must call the mutating tool with the explicit ID",
      prompt: "Please mark task 11111111-1111-1111-1111-111111111111 as completed.",
      context: "Role: employee. Department: Kitchen.",
      expected: {
        toolName: "complete_task",
        args: { task_id: "11111111-1111-1111-1111-111111111111" },
      },
      tags: ["english", "write", "by-id", "uuid"],
    },
    {
      id: "ops-create-deviation-with-severity",
      note: "WRITE — should call create_deviation with the user's title and an inferred severity",
      prompt:
        'Report a deviation: "Walk-in fridge temperature is at 8°C, well above the 4°C limit." This is a critical food safety issue.',
      context: "Role: manager. Department: Kitchen.",
      expected: {
        toolName: "create_deviation",
        // Args check is empty: titles vary too much across runs and severity
        // could reasonably be "high" or "critical". We only assert tool selection
        // for this fixture; the value-check would be too brittle.
      },
      tags: ["english", "write", "deviation", "severity-inference"],
    },
  ],
};
