import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  AgentToolContext,
  AuthorityLevel,
  CapabilityDefinition,
  CapabilityName,
} from "../../capabilities/types.js";
import type { SmartoutTool } from "../../types.js";

/**
 * Unit tests for `selectTools`.
 *
 * `selectTools` is a pure router: given an `IntentResult` and an
 * `AuthorityConfig`, it returns the tools the agent is allowed to call
 * for that intent. No LLM, no I/O, no async — so it gets unit tests, not
 * an eval suite. We mock the capability registry so the test owns its
 * fixtures and is not coupled to whichever capabilities happen to be
 * registered today.
 *
 * Coverage targets the full decision matrix:
 *
 *  1. High confidence (≥0.7) + non-general capability → tools for that
 *     capability filtered by authority level.
 *  2. Low confidence (<0.7) → fallback: tools from EVERY registered
 *     capability filtered by their respective authority levels.
 *  3. capability === "general" → fallback (same as low confidence).
 *  4. Authority levels:
 *       - "disabled"  → empty
 *       - "read_only" → readOnlyTools only
 *       - "suggest"   → readOnlyTools + suggestTools
 *       - "confirm"   → tools (full set)
 *       - "autonomous"→ tools (full set)
 *  5. No authority entry for capability → defaults to "read_only".
 *  6. Unknown capability (not in registry) → empty.
 */

// --- Synthetic tool factory ---------------------------------------------

const makeTool = (name: string): SmartoutTool<AgentToolContext> => ({
  // Cast through unknown — we only need identity for assertions, not a
  // working tool implementation.
  ...({ name } as unknown as SmartoutTool<AgentToolContext>),
});

// --- Synthetic capabilities ---------------------------------------------

const scheduleRead = makeTool("schedule.read");
const scheduleSuggest = makeTool("schedule.suggest");
const scheduleWrite = makeTool("schedule.write");

const trainingRead = makeTool("training.read");
const trainingWrite = makeTool("training.write");

const scheduleCapability: CapabilityDefinition = {
  name: "schedule",
  description: "test schedule",
  readOnlyTools: [scheduleRead],
  suggestTools: [scheduleSuggest],
  tools: [scheduleRead, scheduleSuggest, scheduleWrite],
};

const trainingCapability: CapabilityDefinition = {
  name: "training",
  description: "test training",
  readOnlyTools: [trainingRead],
  // Intentionally no suggestTools — exercise the optional path.
  tools: [trainingRead, trainingWrite],
};

const fakeRegistry: Record<CapabilityName, CapabilityDefinition> = {
  schedule: scheduleCapability,
  training: trainingCapability,
} as Record<CapabilityName, CapabilityDefinition>;

// --- Mock the capability registry --------------------------------------

vi.mock("../../capabilities/registry.js", () => ({
  getCapability: (name: CapabilityName) => fakeRegistry[name],
  getAllCapabilities: () => Object.values(fakeRegistry),
}));

// Import AFTER vi.mock so the mock is in place.
import { selectTools, type AuthorityConfig } from "../tool-selector.js";
import type { IntentResult } from "../intent-classifier.js";

// --- Helpers ------------------------------------------------------------

const intent = (capability: IntentResult["capability"], confidence: number): IntentResult => ({
  intent: `${capability}:test`,
  capability,
  confidence,
  reasoning: "test",
});

const names = (tools: ReadonlyArray<SmartoutTool<AgentToolContext>>) =>
  tools.map((t) => (t as unknown as { name: string }).name).sort();

// --- Tests --------------------------------------------------------------

describe("selectTools — confident path", () => {
  let auth: AuthorityConfig;

  beforeEach(() => {
    auth = {};
  });

  it("returns capability tools at the configured authority level", () => {
    auth.schedule = "autonomous";
    const tools = selectTools(intent("schedule", 0.9), auth);
    expect(names(tools)).toEqual(["schedule.read", "schedule.suggest", "schedule.write"]);
  });

  it("read_only authority returns only readOnlyTools", () => {
    auth.schedule = "read_only";
    expect(names(selectTools(intent("schedule", 0.9), auth))).toEqual(["schedule.read"]);
  });

  it("suggest authority returns readOnlyTools + suggestTools", () => {
    auth.schedule = "suggest";
    expect(names(selectTools(intent("schedule", 0.9), auth))).toEqual([
      "schedule.read",
      "schedule.suggest",
    ]);
  });

  it("confirm authority returns the full tool set", () => {
    auth.schedule = "confirm";
    expect(names(selectTools(intent("schedule", 0.9), auth))).toEqual([
      "schedule.read",
      "schedule.suggest",
      "schedule.write",
    ]);
  });

  it("disabled authority returns no tools", () => {
    auth.schedule = "disabled";
    expect(selectTools(intent("schedule", 0.9), auth)).toEqual([]);
  });

  it("missing authority entry defaults to read_only", () => {
    // No `schedule` key in auth.
    expect(names(selectTools(intent("schedule", 0.9), auth))).toEqual(["schedule.read"]);
  });

  it("training capability has no suggestTools — suggest level returns just readOnly", () => {
    auth.training = "suggest";
    expect(names(selectTools(intent("training", 0.9), auth))).toEqual(["training.read"]);
  });

  it("unknown capability returns empty array", () => {
    auth.payroll = "autonomous" as AuthorityLevel;
    // `payroll` is in the IntentResult enum but not in our fake registry.
    expect(selectTools(intent("payroll", 0.9), auth)).toEqual([]);
  });
});

describe("selectTools — fallback path", () => {
  it("low confidence (<0.7) returns tools from ALL registered capabilities", () => {
    const auth: AuthorityConfig = { schedule: "autonomous", training: "read_only" };
    const tools = selectTools(intent("schedule", 0.5), auth);
    expect(names(tools)).toEqual([
      "schedule.read",
      "schedule.suggest",
      "schedule.write",
      "training.read",
    ]);
  });

  it('capability === "general" routes through the fallback regardless of confidence', () => {
    const auth: AuthorityConfig = { schedule: "read_only", training: "read_only" };
    const tools = selectTools(intent("general", 0.99), auth);
    expect(names(tools)).toEqual(["schedule.read", "training.read"]);
  });

  it("fallback respects per-capability authority — disabled capabilities contribute nothing", () => {
    const auth: AuthorityConfig = { schedule: "disabled", training: "autonomous" };
    expect(names(selectTools(intent("general", 0.99), auth))).toEqual([
      "training.read",
      "training.write",
    ]);
  });

  it("fallback uses default read_only when authority is missing entirely", () => {
    expect(names(selectTools(intent("general", 0.99), {}))).toEqual([
      "schedule.read",
      "training.read",
    ]);
  });

  it("confidence at exactly 0.7 takes the confident path", () => {
    const auth: AuthorityConfig = { schedule: "read_only" };
    expect(names(selectTools(intent("schedule", 0.7), auth))).toEqual(["schedule.read"]);
  });

  it("confidence just below 0.7 takes the fallback path", () => {
    const auth: AuthorityConfig = { schedule: "read_only", training: "read_only" };
    expect(names(selectTools(intent("schedule", 0.6999), auth))).toEqual([
      "schedule.read",
      "training.read",
    ]);
  });
});

describe("selectTools — channel filtering (ADR-0078)", () => {
  it("excludes capability when channel is not in allowedChannels", () => {
    const original = scheduleCapability.allowedChannels;
    (scheduleCapability as { allowedChannels?: string[] }).allowedChannels = ["chat"];

    const auth: AuthorityConfig = { schedule: "autonomous" };
    const tools = selectTools(intent("schedule", 0.9), auth, "voice");
    expect(tools).toEqual([]);

    (scheduleCapability as { allowedChannels?: string[] }).allowedChannels = original;
  });

  it("includes capability when channel matches allowedChannels", () => {
    const original = scheduleCapability.allowedChannels;
    (scheduleCapability as { allowedChannels?: string[] }).allowedChannels = ["chat"];

    const auth: AuthorityConfig = { schedule: "autonomous" };
    const tools = selectTools(intent("schedule", 0.9), auth, "chat");
    expect(names(tools)).toEqual(["schedule.read", "schedule.suggest", "schedule.write"]);

    (scheduleCapability as { allowedChannels?: string[] }).allowedChannels = original;
  });

  it("includes capability when no allowedChannels is defined (backwards compat)", () => {
    const auth: AuthorityConfig = { schedule: "autonomous" };
    const tools = selectTools(intent("schedule", 0.9), auth, "voice");
    expect(names(tools)).toEqual(["schedule.read", "schedule.suggest", "schedule.write"]);
  });

  it("includes capability when no channel is provided (backwards compat)", () => {
    const original = scheduleCapability.allowedChannels;
    (scheduleCapability as { allowedChannels?: string[] }).allowedChannels = ["chat"];

    const auth: AuthorityConfig = { schedule: "autonomous" };
    const tools = selectTools(intent("schedule", 0.9), auth);
    expect(names(tools)).toEqual(["schedule.read", "schedule.suggest", "schedule.write"]);

    (scheduleCapability as { allowedChannels?: string[] }).allowedChannels = original;
  });

  it("filters by channel in fallback path (low confidence)", () => {
    const original = scheduleCapability.allowedChannels;
    (scheduleCapability as { allowedChannels?: string[] }).allowedChannels = ["chat"];

    const auth: AuthorityConfig = { schedule: "autonomous", training: "autonomous" };
    const tools = selectTools(intent("general", 0.5), auth, "voice");
    expect(names(tools)).toEqual(["training.read", "training.write"]);

    (scheduleCapability as { allowedChannels?: string[] }).allowedChannels = original;
  });
});
