// packages/ai/src/capabilities/journey/index.ts
//
// Journey capability — authoring + runtime surface (ADR-0173).
//
// Four tools — all mutations (emit journey run_started):
//   - run_dev          (suggest   default, admin min_role) → dev Playwright
//   - publish_mission  (suggest   default, admin min_role) → engine_missions
//   - publish_guide    (suggest   default, admin min_role) → USER-GUIDE page
//   - run_guided       (autonomous default, employee min_role) → Fjernkontroll
//
// Authority rows seeded in migration 20260516000400_journey_authority_seed.sql
// (S1.3). tool-selector.ts maps authority level → which tools the agent sees:
//   - read_only  → readOnlyTools                       (empty here — no reads)
//   - suggest    → readOnlyTools + suggestTools        (run_dev/publish_mission/publish_guide)
//   - confirm    → all tools                           (all 4)
//   - autonomous → all tools                           (all 4 — run_guided fires direct)
//
// run_guided is DELIBERATELY excluded from suggestTools. Its seeded authority
// is `autonomous`, so it only reaches the agent via the `tools` array at
// autonomous level. A workspace that downgrades run_guided to `suggest` would
// see it disappear entirely — which is the intended safety posture: guided
// end-user runs should not be proposed to the agent unless the admin has
// explicitly enabled autonomous execution.
//
// Binding ADRs: 0078 (chat-only), 0134 (actor_id non-null), 0173 (capability model)

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import {
  runDevTool,
  publishMissionTool,
  publishGuideTool,
  runGuidedTool,
  allTools,
} from "./tools.js";

// Explicit empty array (Gate A A-1): all 4 journey tools are mutations; none
// are safe to run at read_only authority. Keeping this explicit (not elided)
// documents the deliberate choice at code-review time.
const readOnlyTools = [] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

// 3 of 4 tools — run_guided excluded on purpose (see header). At `suggest`
// authority level the agent proposes run_dev / publish_mission / publish_guide
// through the UI-confirm flow; run_guided requires autonomous.
const suggestTools = [runDevTool, publishMissionTool, publishGuideTool] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

const tools = allTools as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

export const journeyCapability: CapabilityDefinition = {
  name: "journey",
  description:
    "Journey authoring + runtime execution — run dev, publish mission/guide, and run guided journeys.",
  // ADR-0078 — journey mutations are chat-only. Voice is forbidden surface
  // for every write capability that touches actor-attributed state.
  allowedChannels: ["chat"],
  toolAuthPattern: "direct_admin",
  emitPrefix: "journey",
  defaultAuthority: "read_only",
  tools,
  readOnlyTools,
  suggestTools,
};

export { runDevTool, publishMissionTool, publishGuideTool, runGuidedTool, allTools };
