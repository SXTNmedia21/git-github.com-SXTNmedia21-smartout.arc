/**
 * packages/ai/src/capabilities/shift_marketplace/tools.ts
 *
 * Open-shift marketplace capability tools — ADR-0306.
 *
 * Five tools:
 *   list_open_offers — read-only, no gate (workspace member RLS)
 *   post_open        — manager posts an open shift (web Compose, manager+)
 *   claim            — employee claims an open shift (mobile Approve, employee+)
 *   approve_claim    — manager approves a pending claim (mobile Approve, manager+)
 *   cancel_offer     — poster or manager cancels an offer (any channel, poster/manager)
 *
 * Authority gate: ALL write tools call mutateWithGate (ADR-0287 mandatory).
 * Channel guard: claim + approve_claim are chat-only V1 (ADR-0288 — irreversible
 *   C4 acts; voice channel is not safe for such actions).
 *   post_open is also chat-only (opens a C4-consequential workflow).
 *   cancel_offer permits both channels (cancel doesn't assign anyone).
 *
 * Eligibility check: caller pre-loads context; eligibilityFor() is pure TS, no DB.
 *
 * Transactional approve: UPDATE schedule_shift.employee_id AND
 *   schedule_shift_offer.status='approved' in SINGLE mutateWithGate exec callback
 *   (one gate evaluation per ADR-0099).
 *
 * NEVER auto-approve V1: engine_authority_config.shift_marketplace.auto_approve_claim
 *   is a V2 feature. V1 always requires manager approval.
 *
 * References:
 *   ADR-0099 (gate_action contract)
 *   ADR-0133 (web composes, mobile executes — claim = Approve verb)
 *   ADR-0134 (emit on every mutation)
 *   ADR-0151 (server-derived identity — ctx.profileId, never param)
 *   ADR-0288 (chat-only for C4 irreversible acts)
 *   ADR-0287 (mutateWithGate mandatory on mutation tools)
 *   ADR-0306 (open-shift marketplace sidecar offer table)
 *   L-0177 (fail-fast on empty IDs; no silent fallback)
 */

import { z } from "zod";
import { emit } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";
import {
  mutateWithGate,
  MutateWithGateDenied,
  MutateWithGateError,
} from "../_shared/mutate-with-gate.js";
import {
  eligibilityFor,
  type EligibilityProfile,
  type EligibilityShift,
  type EligibilityContext,
  type ExistingShift,
  type Absence,
  type FrameworkRule,
  type EmploymentContract,
  type BlockerCode,
} from "../../scheduler/eligibility.js";

// ── Capability + action literals (ADR-0195 dotted form) ─────────────────────
const CAP = "shift_marketplace";
const ACTION_POST = "shift_marketplace.post_open";
const ACTION_CLAIM = "shift_marketplace.claim";
const ACTION_APPROVE = "shift_marketplace.approve_claim";
const ACTION_CANCEL = "shift_marketplace.cancel_offer";

// ── Blocker code → Norwegian human-readable message ─────────────────────────
const BLOCKER_MESSAGES: Record<BlockerCode, string> = {
  not_competent_for_role: "Du har ikke nødvendig kompetanse for rollen på denne vakten.",
  aml_hour_floor_exceeded: "Du har allerede nådd daglig makstid (AML §10) på denne dagen.",
  aml_weekly_cap_exceeded: "Du har allerede nådd ukentlig makstid (AML §10) denne uken.",
  tariff_rest_period_violation:
    "Du vil ikke ha tilstrekkelig hviletid mellom vakter (Riksavtalen).",
  absence_overlap: "Du har registrert fravær som overlapper med denne vakten.",
  existing_shift_overlap: "Du har allerede en annen vakt som overlapper med denne vakten.",
  no_active_contract: "Du har ingen aktiv arbeidskontrakt på tidspunktet for denne vakten.",
};

function formatBlockers(blockers: BlockerCode[]): string {
  return blockers.map((c) => BLOCKER_MESSAGES[c] ?? c).join(" | ");
}

// ── Read-Only Tools ──────────────────────────────────────────────────────────

/**
 * list_open_offers — read-only. Lists open shift offers for the workspace.
 * Both employee (sees offers they can claim) and manager (sees all open offers).
 * No gate needed — read-only, workspace-scoped, dual-auth RLS.
 */
export const listOpenOffers = defineTool({
  name: "list_open_offers",
  description:
    "List all open shift offers in the workspace. Employees see offers they can potentially claim. Managers see all open offers with claimer info.",
  capability: CAP,
  schema: z.object({
    status_filter: z
      .enum(["open", "claimed", "all"])
      .optional()
      .default("open")
      .describe("Filter by offer status. Default: open."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .default(20)
      .describe("Max offers to return. Max 50."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    const statusValues =
      params.status_filter === "all" ? ["open", "claimed"] : [params.status_filter];

    const { data, error } = await supabase
      .from("schedule_shift_offer")
      .select(
        "schedule_shift_offer_id, shift_id, status, posted_at, expires_at, posted_by_profile_id, claimed_by_profile_id, claimed_at",
      )
      .eq("workspace_id", ctx.workspaceId)
      .in("status", statusValues)
      .order("posted_at", { ascending: false })
      .limit(params.limit);

    if (error) return `Feil ved henting av tilbud: ${error.message}`;
    if (!data || data.length === 0) return "Ingen åpne vakt-tilbud funnet.";
    return JSON.stringify(data);
  },
});

// ── Suggest Tools (require authority gate) ───────────────────────────────────

/**
 * post_open — manager posts a shift as open (available for claims).
 * Web Compose verb per ADR-0133. Chat-only per ADR-0288 (opens C4-consequential workflow).
 */
export const postOpen = defineTool({
  name: "post_open",
  description:
    "Post an open shift to the marketplace. Employees will see and can claim it. Manager+ only. Chat-only.",
  capability: CAP,
  schema: z.object({
    shift_id: z
      .string()
      .uuid()
      .describe("The schedule_shift_id to post as open (must be unassigned or re-openable)."),
    expires_at: z
      .string()
      .datetime({ offset: true })
      .optional()
      .describe(
        "Optional expiry timestamp (ISO 8601 with offset). After this the offer auto-expires.",
      ),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    // ADR-0288: chat-only — opening a marketplace offer is a Compose-class act.
    if (ctx.channel === "voice") {
      return "Å legge ut en vakt på markedsplassen må gjøres via chat, ikke stemme.";
    }

    const supabase = ctx.supabaseAdmin;

    // Verify shift belongs to this workspace (L-0177: fail-fast, no silent cross-workspace).
    const { data: shift, error: shiftErr } = await supabase
      .from("schedule_shift")
      .select("schedule_shift_id, workspace_id")
      .eq("schedule_shift_id", params.shift_id)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    if (shiftErr || !shift) {
      return "Vakten ble ikke funnet i dette arbeidsområdet.";
    }

    try {
      const { result: offerId } = await mutateWithGate(supabase, {
        workspaceId: ctx.workspaceId,
        profileId: ctx.profileId,
        capability: CAP,
        actionType: ACTION_POST,
        channel: ctx.channel ?? "chat",
        targetId: params.shift_id,
        exec: async (db) => {
          const { data: offer, error } = await db
            .from("schedule_shift_offer")
            .insert({
              workspace_id: ctx.workspaceId,
              shift_id: params.shift_id,
              posted_by_profile_id: ctx.profileId,
              posted_at: new Date().toISOString(),
              expires_at: params.expires_at ?? null,
              status: "open",
            })
            .select("schedule_shift_offer_id")
            .single();

          if (error) throw new Error(error.message);
          return offer.schedule_shift_offer_id as string;
        },
      });

      // ADR-0134: emit AFTER successful mutation. Shape per ShiftOfferPosted interface.
      await emit({
        event: "shift_offer.posted",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: {
          entity: {
            entity_type: "schedule_shift_offer",
            entity_id: offerId,
          },
          data: {
            schedule_shift_offer_id: offerId,
            shift_id: params.shift_id,
            posted_by_profile_id: ctx.profileId,
            expires_at: params.expires_at ?? null,
          },
        },
      });

      return JSON.stringify({
        ok: true,
        offer_id: offerId,
        message: "Vakten er nå lagt ut på markedsplassen.",
      });
    } catch (err) {
      if (err instanceof MutateWithGateDenied) {
        return JSON.stringify({ ok: false, error: "authority_denied", reason: err.message });
      }
      if (err instanceof MutateWithGateError) {
        return JSON.stringify({ ok: false, error: err.code, reason: err.message });
      }
      return `Feil ved utlegging av vakt: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});

/**
 * claim — employee claims an open shift offer.
 * Mobile Approve verb per ADR-0133. Chat-only V1 per ADR-0288.
 * BFF pre-loads eligibility context; pure eligibilityFor() checks run here.
 * NO auto-approve V1 — always sets status='claimed' for manager review.
 */
export const claim = defineTool({
  name: "claim",
  description:
    "Claim an open shift from the marketplace. Eligibility is checked against your contract, absences, and work-hour rules. Chat-only V1.",
  capability: CAP,
  schema: z.object({
    offer_id: z.string().uuid().describe("The schedule_shift_offer_id to claim."),
    eligibility_context: z
      .object({
        existing_shifts: z.array(
          z.object({
            shift_id: z.string(),
            start_at: z.string(),
            end_at: z.string(),
            duration_hours: z.number(),
          }),
        ),
        absences: z.array(
          z.object({
            absence_id: z.string(),
            start_at: z.string(),
            end_at: z.string(),
          }),
        ),
        framework_rules: z.array(
          z.object({
            rule_type: z.enum([
              "aml_daily_max_hours",
              "aml_weekly_max_hours",
              "aml_weekly_min_hours_floor",
              "tariff_min_rest_hours",
            ]),
            value_hours: z.number(),
          }),
        ),
        active_contract: z
          .object({
            contract_id: z.string(),
            start_date: z.string(),
            end_date: z.string().nullable(),
            status: z.string(),
          })
          .nullable(),
        profile: z.object({
          profile_id: z.string(),
          competent_roles: z.array(z.string()),
          workspace_id: z.string(),
          employment_status: z.string(),
        }),
      })
      .describe(
        "Pre-loaded eligibility context (BFF loads from DB, tool receives as param). Required.",
      ),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    // ADR-0288: chat-only — claiming a shift is an irreversible C4 act in V1.
    if (ctx.channel === "voice") {
      return "Å krev en vakt må gjøres via chat, ikke stemme. Bytt til chat for å fortsette.";
    }

    const supabase = ctx.supabaseAdmin;

    // Load the offer + associated shift (workspace-scoped per Law 1).
    const { data: offer, error: offerErr } = await supabase
      .from("schedule_shift_offer")
      .select("schedule_shift_offer_id, status, shift_id, workspace_id")
      .eq("schedule_shift_offer_id", params.offer_id)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    if (offerErr || !offer) {
      return "Tilbudet ble ikke funnet i dette arbeidsområdet.";
    }

    if (offer.status !== "open") {
      return `Tilbudet kan ikke kreves — nåværende status er '${offer.status}'.`;
    }

    // Load shift details for eligibility check.
    const { data: shift, error: shiftErr } = await supabase
      .from("schedule_shift")
      .select("schedule_shift_id, role, shift_date, start_time, end_time, work_hours")
      .eq("schedule_shift_id", offer.shift_id)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    if (shiftErr || !shift) {
      return "Vakten tilknyttet tilbudet ble ikke funnet.";
    }

    // Build eligibility input — pure function call, no DB inside.
    const eligibilityShift: EligibilityShift = {
      shift_id: shift.schedule_shift_id as string,
      workspace_id: ctx.workspaceId,
      role: (shift.role as string) ?? "",
      start_at: `${shift.shift_date as string}T${shift.start_time as string}`,
      end_at: `${shift.shift_date as string}T${shift.end_time as string}`,
      duration_hours: (shift.work_hours as number) ?? 0,
    };

    const ctxProfile = params.eligibility_context.profile;
    const eligibilityProfile: EligibilityProfile = {
      profile_id: ctxProfile.profile_id,
      competent_roles: ctxProfile.competent_roles,
      workspace_id: ctxProfile.workspace_id,
      employment_status: ctxProfile.employment_status,
    };

    const eligibilityCtx: EligibilityContext = {
      existing_shifts: params.eligibility_context.existing_shifts as ExistingShift[],
      absences: params.eligibility_context.absences as Absence[],
      framework_rules: params.eligibility_context.framework_rules as FrameworkRule[],
      active_contract: params.eligibility_context.active_contract as EmploymentContract | null,
    };

    let eligibilityResult;
    try {
      eligibilityResult = eligibilityFor(eligibilityProfile, eligibilityShift, eligibilityCtx);
    } catch (err) {
      return `Feil ved egnetsjekk: ${err instanceof Error ? err.message : String(err)}`;
    }

    if (!eligibilityResult.eligible) {
      return JSON.stringify({
        ok: false,
        error: "eligibility_blocked",
        blockers: eligibilityResult.blockers,
        message: formatBlockers(eligibilityResult.blockers),
      });
    }

    // Eligibility passed — gate + write.
    try {
      const { result: claimedOfferId } = await mutateWithGate(supabase, {
        workspaceId: ctx.workspaceId,
        profileId: ctx.profileId,
        capability: CAP,
        actionType: ACTION_CLAIM,
        channel: ctx.channel ?? "chat",
        targetId: params.offer_id,
        exec: async (db) => {
          // Atomic filter: only UPDATE if status is still 'open' (prevents race).
          const { error } = await db
            .from("schedule_shift_offer")
            .update({
              status: "claimed",
              claimed_by_profile_id: ctx.profileId,
              claimed_at: new Date().toISOString(),
            })
            .eq("schedule_shift_offer_id", params.offer_id)
            .eq("workspace_id", ctx.workspaceId)
            .eq("status", "open"); // atomic guard against concurrent claim

          if (error) throw new Error(error.message);
          return params.offer_id;
        },
      });

      // ADR-0134: emit AFTER successful mutation. Shape per ShiftOfferClaimed interface.
      await emit({
        event: "shift_offer.claimed",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: {
          entity: {
            entity_type: "schedule_shift_offer",
            entity_id: claimedOfferId,
          },
          data: {
            schedule_shift_offer_id: claimedOfferId,
            shift_id: offer.shift_id as string,
            claimed_by_profile_id: ctx.profileId,
            auto_approved: false, // V1: always requires manager approval
          },
        },
      });

      return JSON.stringify({
        ok: true,
        offer_id: claimedOfferId,
        message: "Vakten er krevd. En leder vil godkjenne eller avvise krevet ditt snart.",
      });
    } catch (err) {
      if (err instanceof MutateWithGateDenied) {
        return JSON.stringify({ ok: false, error: "authority_denied", reason: err.message });
      }
      if (err instanceof MutateWithGateError) {
        return JSON.stringify({ ok: false, error: err.code, reason: err.message });
      }
      return `Feil ved krav av vakt: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});

/**
 * approve_claim — manager approves a claimed offer.
 * Single transactional mutateWithGate exec:
 *   UPDATE schedule_shift.employee_id = offer.claimed_by_profile_id
 *   UPDATE schedule_shift_offer.status = 'approved'
 * Chat-only V1 per ADR-0288. One gate evaluation per ADR-0099.
 */
export const approveClaim = defineTool({
  name: "approve_claim",
  description:
    "Approve a claimed shift offer. Updates the shift assignee and marks the offer approved. Manager+ only. Chat-only. Single atomic transaction.",
  capability: CAP,
  schema: z.object({
    offer_id: z.string().uuid().describe("The schedule_shift_offer_id to approve."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    // ADR-0288: chat-only — approving a claim is an irreversible C4 act.
    if (ctx.channel === "voice") {
      return "Godkjenning av vakt-krav må gjøres via chat, ikke stemme. Bytt til chat for å fortsette.";
    }

    const supabase = ctx.supabaseAdmin;

    // Load offer (workspace-scoped, Law 1).
    const { data: offer, error: offerErr } = await supabase
      .from("schedule_shift_offer")
      .select("schedule_shift_offer_id, status, shift_id, workspace_id, claimed_by_profile_id")
      .eq("schedule_shift_offer_id", params.offer_id)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    if (offerErr || !offer) {
      return "Tilbudet ble ikke funnet i dette arbeidsområdet.";
    }

    if (offer.status !== "claimed") {
      return `Tilbudet kan ikke godkjennes — nåværende status er '${offer.status}'. Kun tilbud med status 'claimed' kan godkjennes.`;
    }

    if (!offer.claimed_by_profile_id) {
      return "Tilbudet har ingen aktiv krevende ansatt — kan ikke godkjenne.";
    }

    const claimedBy = offer.claimed_by_profile_id as string;
    const shiftId = offer.shift_id as string;

    try {
      // ADR-0306: transactional — both writes in one exec callback, one gate eval.
      await mutateWithGate(supabase, {
        workspaceId: ctx.workspaceId,
        profileId: ctx.profileId,
        capability: CAP,
        actionType: ACTION_APPROVE,
        channel: ctx.channel ?? "chat",
        targetId: params.offer_id,
        exec: async (db) => {
          // UPDATE schedule_shift.employee_id = claimedBy (assign the shift).
          const { error: shiftErr } = await db
            .from("schedule_shift")
            .update({ employee_id: claimedBy })
            .eq("schedule_shift_id", shiftId)
            .eq("workspace_id", ctx.workspaceId);

          if (shiftErr) throw new Error(`Kunne ikke oppdatere vakt: ${shiftErr.message}`);

          // UPDATE schedule_shift_offer.status = 'approved' (close the offer).
          const { error: offerUpdateErr } = await db
            .from("schedule_shift_offer")
            .update({
              status: "approved",
              approved_by_profile_id: ctx.profileId,
              approved_at: new Date().toISOString(),
            })
            .eq("schedule_shift_offer_id", params.offer_id)
            .eq("workspace_id", ctx.workspaceId)
            .eq("status", "claimed"); // guard: only approve if still 'claimed'

          if (offerUpdateErr)
            throw new Error(`Kunne ikke oppdatere tilbud: ${offerUpdateErr.message}`);
        },
      });

      // ADR-0134: emit ONCE after both writes succeeded. Shape per ShiftOfferApproved interface.
      await emit({
        event: "shift_offer.approved",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: {
          entity: {
            entity_type: "schedule_shift_offer",
            entity_id: params.offer_id,
          },
          data: {
            schedule_shift_offer_id: params.offer_id,
            shift_id: shiftId,
            approved_by_profile_id: ctx.profileId,
            claimed_by_profile_id: claimedBy,
            gate_evaluation_id: null,
          },
        },
      });

      return JSON.stringify({
        ok: true,
        offer_id: params.offer_id,
        shift_id: shiftId,
        assigned_to: claimedBy,
        message: "Krav godkjent. Vakten er nå tildelt den ansatte.",
      });
    } catch (err) {
      if (err instanceof MutateWithGateDenied) {
        return JSON.stringify({ ok: false, error: "authority_denied", reason: err.message });
      }
      if (err instanceof MutateWithGateError) {
        return JSON.stringify({ ok: false, error: err.code, reason: err.message });
      }
      return `Feil ved godkjenning av krav: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});

/**
 * cancel_offer — poster or manager cancels an offer.
 * Both chat and voice channels permitted (cancel is non-C4-escalating; no assignment change).
 */
export const cancelOffer = defineTool({
  name: "cancel_offer",
  description:
    "Cancel an open or claimed shift offer. Only the poster or a manager can cancel. Provide a reason.",
  capability: CAP,
  schema: z.object({
    offer_id: z.string().uuid().describe("The schedule_shift_offer_id to cancel."),
    reason: z.string().min(5).describe("Required reason for cancellation (min 5 characters)."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    // Load offer (workspace-scoped, Law 1).
    const { data: offer, error: offerErr } = await supabase
      .from("schedule_shift_offer")
      .select("schedule_shift_offer_id, status, workspace_id, posted_by_profile_id, shift_id")
      .eq("schedule_shift_offer_id", params.offer_id)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    if (offerErr || !offer) {
      return "Tilbudet ble ikke funnet i dette arbeidsområdet.";
    }

    if (offer.status === "approved" || offer.status === "expired") {
      return `Tilbudet kan ikke kanselleres — nåværende status er '${offer.status as string}'.`;
    }

    try {
      await mutateWithGate(supabase, {
        workspaceId: ctx.workspaceId,
        profileId: ctx.profileId,
        capability: CAP,
        actionType: ACTION_CANCEL,
        channel: ctx.channel ?? "chat",
        targetId: params.offer_id,
        exec: async (db) => {
          const { error } = await db
            .from("schedule_shift_offer")
            .update({
              status: "cancelled",
              cancel_reason: params.reason,
            })
            .eq("schedule_shift_offer_id", params.offer_id)
            .eq("workspace_id", ctx.workspaceId)
            .in("status", ["open", "claimed"]); // guard against double-cancel

          if (error) throw new Error(error.message);
        },
      });

      // ADR-0134: emit AFTER successful mutation. Shape per ShiftOfferCancelled interface.
      await emit({
        event: "shift_offer.cancelled",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: {
          entity: {
            entity_type: "schedule_shift_offer",
            entity_id: params.offer_id,
          },
          data: {
            schedule_shift_offer_id: params.offer_id,
            shift_id: offer.shift_id as string,
            cancelled_by_profile_id: ctx.profileId,
            cancel_reason: params.reason,
            gate_evaluation_id: null,
          },
        },
      });

      return JSON.stringify({
        ok: true,
        offer_id: params.offer_id,
        message: "Tilbudet er kansellert.",
      });
    } catch (err) {
      if (err instanceof MutateWithGateDenied) {
        return JSON.stringify({ ok: false, error: "authority_denied", reason: err.message });
      }
      if (err instanceof MutateWithGateError) {
        return JSON.stringify({ ok: false, error: err.code, reason: err.message });
      }
      return `Feil ved kansellering av tilbud: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});
