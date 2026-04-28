// packages/ai/src/router/intent-classifier.ts
import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { getRegisteredCapabilities } from "../capabilities/registry.js";
import type { ProfileRole, SessionChannel } from "../capabilities/types.js";
import type { NonEmptyString } from "@smartout/telemetry/server";

let _openrouter: ReturnType<typeof createOpenRouter> | null = null;
let _cachedKey: string | undefined;

/**
 * Gets or creates the OpenRouter client.
 * Recreates the client if the API key has changed (supports runtime key rotation).
 */
function getOpenRouter(apiKey?: string) {
  const key = apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OpenRouter API key required: pass apiKey or set OPENROUTER_API_KEY");

  if (!_openrouter || key !== _cachedKey) {
    _openrouter = createOpenRouter({ apiKey: key });
    _cachedKey = key;
  }
  return _openrouter;
}

// NOTE (2026-04-07): This schema was simplified after eval-harness found
// production was broken. OpenRouter's structured-output bridge to Anthropic
// rejects two Zod constructs:
//   - field `.describe()` calls          → "Provider returned error"
//   - `.min()/.max()` on numbers         → "Provider returned error"
// Both produce JSON-schema constraints that Anthropic's tool-input format
// does not accept. The system prompt and `intentSchemaConstraints` below
// document the same intent without breaking the wire format.
// See ADR-0073 addendum.
export const intentSchema = z.object({
  intent: z.string(),
  capability: z.enum([
    "knowledge",
    "kb_query",
    "schedule",
    "training",
    "operations",
    "operations_intelligence",
    "profile",
    "communication",
    "memory",
    "payroll",
    "ui",
    "guardian",
    "contract",
    "contract_intake",
    "shift_swap",
    "shift_lifecycle",
    "governance",
    "billing_query",
    "helpdesk_query",
    "journey",
    "season",
    "availability",
    "general",
  ] as const),
  // Confidence in [0, 1]. Range constraint omitted from the schema; the
  // model is instructed in the system prompt to stay within bounds and
  // returned values are clamped at the call site if needed.
  confidence: z.number(),
  reasoning: z.string(),
});

export type IntentResult = z.infer<typeof intentSchema>;

/**
 * Structured context for the intent classifier.
 *
 * ADR-0112 (Intent Classifier Coverage) + Phase A5 (Botsson harness) require
 * the classifier to disambiguate e.g. "når jobber jeg?" (employee read) vs
 * manager/admin shift queries. The classifier weighs role + department +
 * channel against the incoming message — so these signals must arrive as
 * explicit typed fields, not as an opaque string that might silently be
 * empty.
 *
 * All fields are `T | null` (not `T | undefined` with an empty-string
 * fallback). A `null` means "unknown at this call site" — the classifier
 * then falls back to message-only reasoning for that field. We never
 * substitute `""` because ADR-0193 (telemetry parity) banned that pattern
 * repo-wide.
 *
 * `hint` is an escape hatch for callers (evals, legacy fixtures) that have
 * richer free-form context than the structured fields can capture. Real
 * production call sites should prefer populating the typed fields.
 */
export type ClassifierContext = {
  /** Profile role of the speaker. `null` = role not resolved at call time. */
  role: ProfileRole | null;
  /** Speaker's department display name. `null` = no department, unresolved, or not applicable. */
  departmentName: string | null;
  /** Workspace scope — included for completeness; classifier does not key on it today. */
  workspaceId: NonEmptyString | null;
  /** Session channel. Used for e.g. voice-vs-chat disambiguation in future classifier rules. */
  channel: SessionChannel | null;
  /** Free-form additional context (eval fixtures, legacy call sites). Empty string allowed
   *  here because the field is explicitly "extra text" — not a telemetry-keyed signal. */
  hint?: string;
};

/**
 * Serializes a `ClassifierContext` into the Norwegian-language prompt hint the
 * classifier consumes. Only non-null structured fields appear in the output.
 * If the object is empty, a neutral marker is returned so the prompt text is
 * never literally empty (empty-string fallback = L-0094 phantom contract).
 */
export function serializeClassifierContext(ctx: ClassifierContext): string {
  const parts: string[] = [];
  if (ctx.role !== null) parts.push(`Rolle: ${ctx.role}.`);
  if (ctx.departmentName !== null) parts.push(`Avdeling: ${ctx.departmentName}.`);
  if (ctx.channel !== null) parts.push(`Kanal: ${ctx.channel}.`);
  if (ctx.hint && ctx.hint.length > 0) parts.push(ctx.hint);
  if (parts.length === 0) return "(ingen kontekst tilgjengelig)";
  return parts.join(" ");
}

export async function classifyIntent(
  message: string,
  context: ClassifierContext,
  options?: { apiKey?: string },
): Promise<IntentResult> {
  const registered = getRegisteredCapabilities();
  const contextString = serializeClassifierContext(context);

  const { object } = await generateObject({
    // Was `anthropic/claude-sonnet-4` until 2026-04-07. That model returns
    // unparseable structured output via OpenRouter ("could not parse the
    // response"). Verified by eval-harness repro: sonnet-4 fails on every
    // schema; sonnet-4.6 succeeds. See ADR-0073 addendum.
    model: getOpenRouter(options?.apiKey)("anthropic/claude-sonnet-4.6"),
    schema: intentSchema,
    system: `You are an intent classifier for a Norwegian employee assistant called Mr. Botsson.
Classify the user's message into one of these capabilities: ${registered.join(", ")}, general.

Capabilities:
- knowledge: General questions about company policies, procedures, rules, FAQs (tool-less; answered from system prompt context)
- kb_query: Explicit handbook / document search where the user asks for source citations or full-text retrieval over workspace_doc_chunk. Examples: "finn dokumentet om sykefravær", "vis kilden i håndboka". Use kb_query when the user wants a document/source; use knowledge for general policy questions. (ADR-0221)
- schedule: Shift queries, schedule changes, availability, swap requests
- training: Protocol assignments, readiness status, knowledge tests, learning
- operations: Department sessions, checklists, routines, daily ops
- profile: Employee info, team membership, contract status
- communication: Sending messages, notifications
- memory: Asking the agent to REMEMBER a fact, preference, or summary across sessions (e.g. "husk at jeg foretrekker kveldsvakter"). Retrieval of past memories does NOT route here — it is handled automatically in the system prompt.
- payroll: Salary, overtime, deductions, pay period
- ui: Screen navigation, form filling, UI element highlighting, panel display, toast notifications
- guardian: Workspace health monitoring, readiness alerts, maturity signals, system status
- contract: Creating, sending, tracking, and managing employment contracts and agreements for employees in the workspace
- contract_intake: Collecting personal information (bank details, address, tax card) needed to finalize an employment contract
- shift_swap: Requesting, approving, or managing shift swaps between employees
- shift_lifecycle: Publishing, approving, interpreting, or settling a shift (write-side lifecycle actions on the employee's own shift). Examples: "godkjenn vakten min" (approve), "publiser vakten" (publish), "avslutte oppgjøret" / "gjør opp vakten" (settle), "tolk timene på nytt" (interpret). Use shift_lifecycle for mutating actions on a shift; use schedule for read-only queries like "når jobber jeg?"
- operations_intelligence: Manager/system-scoped operational intelligence queries (occupancy, demand, readiness trends across teams)
- governance: Authority, approval gates, change proposals, policy-level decisions
- billing_query: Read-only billing questions — invoice status, pricing terms, payment history. (ADR-0118)
- helpdesk_query: Opening, listing, viewing, or resolving a help-desk ticket routed to a responsible representative. Examples: "jeg har et spørsmål til HR" (open ticket), "vis meg åpne henvendelser" (list queue), "marker som løst" (resolve). Use helpdesk_query for anything routed to a desk; use communication for general channel messaging.
- journey: Running a journey in dev, publishing a journey as a mission or USER-GUIDE, or starting a guided journey run. Examples: "run dev journey" / "kjør journey på dev" (run_dev), "publish this mission" / "publiser som mission" (publish_mission), "publish user guide" / "publiser brukerguide" (publish_guide), "start guided journey" / "start veiledet journey" (run_guided). (ADR-0173)
- season: Planning-cycle operations — creating seasons, setting revenue targets, reading workforce readiness percentages, comparing day/hour demand factors, saving season playbooks. Time horizon: weeks to months. Subject: budget/NOK targets, factor adjustments, readiness %, playbook notes. Examples: "lag en sommersesong" (create), "sett omsetning til 2 millioner" (set_revenue), "hva er beredskapen?" (get_readiness), "sammenlign faktorer med forrige sesong" (learn_factors), "lagre spilleboken" (save_playbook). Use season for budget/planning vocabulary; schedule for shift-level vocabulary. When temporal scope is ambiguous (e.g. "plan for oktober"), prefer schedule if shift vocabulary present; season if budget/NOK/factor vocabulary present. Ambiguous: confidence < 0.7, pick schedule as safer read-only fallback. (ADR-0201)
- availability: Employee's own availability windows — registering when you can/cannot work, clearing your own availability, querying others' availability (manager-scope). Examples: "jeg kan jobbe lørdag" (set_own), "fjern tilgjengeligheten min på fredag" (clear_own), "hvem er ledig på torsdag?" (query_others). Voice-OK for own actions; chat-only for query_others (PII per ADR-0202). D2 source-data per ADR-0200.
- general: Greetings, small talk, unclear intent, meta-questions

The user writes in Norwegian or English. Classify based on intent, not language.

Write vs read disambiguation for shift queries:
- "når jobber jeg?" / "når starter vakten?" / "hvem jobber i dag?" → schedule (read)
- "godkjenn vakten", "publiser vakten", "gjør opp vakten", "tolk timene" → shift_lifecycle (write)
- "vakten min" alone is ambiguous — set confidence < 0.7 and pick schedule as the safer fallback (read-only).

Set confidence 0.0-1.0: high (>0.7) when intent is clear, low (<0.7) when ambiguous.`,
    prompt: `Employee context: ${contextString}\n\nMessage: "${message}"`,
  });

  return object;
}
