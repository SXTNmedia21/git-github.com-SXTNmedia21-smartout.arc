/**
 * authority.ts — AuthorityEnforcer implementation.
 *
 * Applies ADR-0078 (voice no PII), ADR-0244 (passive no financial mutation),
 * and ADR-0151 (workspace_id derived server-side) to a ToolBundle.
 *
 * Returns a NEW filtered bundle (never mutates in place). Every stripped tool
 * is recorded in `authority.blockedTools` with the rule name for audit.
 *
 * ADR-0133 (mobile verbs only) is NOT enforced here — mobile is not a current
 * Channel value. Sketch only; enforcement deferred to a future sortie.
 */

import type {
  AuthorityEnforcer,
  AuthorityRuleName,
  BlockedToolEntry,
  Channel,
  ClientToolDefinition,
  ClientToolImplementation,
  ToolBundle,
  UserContext,
} from "./types.js";

/* ━━━ PII deny-list — ADR-0078 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/**
 * Exact tool names that are always stripped from the voice channel.
 * These tools expose raw PII (personnummer, bank account, address)
 * and must never traverse a third-party Realtime LLM transcript.
 */
const VOICE_PII_DENY_LIST: ReadonlySet<string> = new Set([
  "revealPersonnummer",
  "revealAddress",
  "revealEmployeePersonnummer",
  "getEmployeePiiSummary",
  "revealContractPii",
]);

/**
 * Pattern-based PII check for tool names not covered by the exact deny-list.
 * Catches future tools that follow naming conventions for PII operations.
 */
const VOICE_PII_PATTERN = /personnummer|reveal.*pii|.*Pii$|fnr|ssn/i;

/** True when a tool name is PII-tier for the voice channel. */
function isVoicePiiTool(toolName: string): boolean {
  return VOICE_PII_DENY_LIST.has(toolName) || VOICE_PII_PATTERN.test(toolName);
}

/* ━━━ Financial-mutation deny pattern — ADR-0244 ━━━━━━━━━━━━━━━━━━━━━━━━━ */

/**
 * Pattern that matches financial-mutation tool names.
 * These tools may trigger irreversible monetary operations and are
 * forbidden on passive/non-interactive channels.
 */
const FINANCIAL_MUTATION_PATTERN =
  /markPaid|payInvoice|signContract|approveCharge|chargeCard|capturePayment|createInvoice/i;

/** True when a tool name is a financial mutation. */
function isFinancialMutationTool(toolName: string): boolean {
  return FINANCIAL_MUTATION_PATTERN.test(toolName);
}

/* ━━━ Channel checks ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/**
 * Channels where PII tool access is forbidden (ADR-0078).
 * Only "voice" for MVP; future non-interactive surfaces may be added.
 */
function isPiiRestrictedChannel(channel: Channel): boolean {
  return channel === "voice";
}

/**
 * Channels where financial mutations are forbidden (ADR-0244).
 * Covers voice and, when the Channel union is extended, "passive".
 */
function isFinancialMutationRestrictedChannel(channel: Channel): boolean {
  return channel === "voice";
  // When "passive" is added to the Channel union, extend to:
  // return channel === "voice" || channel === "passive";
}

/* ━━━ Tool name extraction ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function getToolName(definition: ClientToolDefinition): string {
  return definition.temporaryTool.modelToolName;
}

/* ━━━ AuthorityEnforcer ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

class AuthorityEnforcerImpl implements AuthorityEnforcer {
  apply(bundle: ToolBundle, userContext: UserContext, channel: Channel): ToolBundle {
    const blockedTools: BlockedToolEntry[] = [];

    // ADR-0151: workspace_id MUST come from authenticated session.
    // Log if a pre-existing (potentially body-derived) value differs.
    const preExistingWorkspaceId = bundle.authority.workspace_id;
    const workspaceIdOverwritten =
      preExistingWorkspaceId !== "" && preExistingWorkspaceId !== userContext.workspace_id;

    if (workspaceIdOverwritten) {
      // Record the drift as an audit observation. The rule fires even when no
      // tool is stripped — workspace_id derivation is always enforced.
      blockedTools.push({
        name: `__workspace_id_overwrite__ (was: ${preExistingWorkspaceId})`,
        rule: "ADR-0151-workspace-id-derived-server-side" as AuthorityRuleName,
      });
    }

    // Determine which tools to strip.
    const blockedNames = new Map<string, AuthorityRuleName>();

    for (const def of bundle.definitions) {
      const name = getToolName(def);

      // ADR-0078: strip PII tools from voice channel.
      if (isPiiRestrictedChannel(channel) && isVoicePiiTool(name)) {
        blockedNames.set(name, "ADR-0078-voice-no-pii");
        continue;
      }

      // ADR-0244: strip financial-mutation tools from restricted channels.
      if (isFinancialMutationRestrictedChannel(channel) && isFinancialMutationTool(name)) {
        blockedNames.set(name, "ADR-0244-passive-no-financial-mutation");
      }
    }

    // Build new definitions + implementations, recording blocked entries.
    const filteredDefinitions: ClientToolDefinition[] = [];
    const filteredImplementations: Record<string, ClientToolImplementation> = {};

    for (const def of bundle.definitions) {
      const name = getToolName(def);
      const rule = blockedNames.get(name);

      if (rule !== undefined) {
        blockedTools.push({ name, rule });
      } else {
        filteredDefinitions.push(def);
        const impl = bundle.implementations[name];
        if (impl !== undefined) {
          filteredImplementations[name] = impl;
        }
      }
    }

    return {
      // systemPromptSlices are not channel-restricted — passed through unchanged.
      systemPromptSlices: bundle.systemPromptSlices,
      definitions: filteredDefinitions,
      implementations: filteredImplementations,
      authority: {
        workspace_id: userContext.workspace_id,
        channel,
        role: userContext.role,
        blockedTools,
        // gateActionMisses: CapabilitiesSource doesn't expose these yet (Phase 3).
        gateActionMisses: [],
      },
    };
  }
}

/**
 * Returns an {@link AuthorityEnforcer} that applies ADR-0078/0151/0244 to a
 * ToolBundle. The returned enforcer is stateless and safe to reuse across
 * requests.
 */
export function createAuthorityEnforcer(): AuthorityEnforcer {
  return new AuthorityEnforcerImpl();
}

/** Named class export for consumers that prefer `new AuthorityEnforcer()`. */
export { AuthorityEnforcerImpl as AuthorityEnforcer };
