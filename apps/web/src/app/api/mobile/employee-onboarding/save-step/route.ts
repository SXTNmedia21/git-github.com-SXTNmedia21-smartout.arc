/**
 * POST /api/mobile/employee-onboarding/save-step
 *
 * Mobile BFF wrapper: per-step saves that mirror the web Server Actions
 * (saveContact, saveAddress, savePersonalNumber, saveAvailability, saveConsent,
 * saveOptional) but resolve identity via Bearer JWT (ADR-0132/0151).
 *
 * WHY a separate route instead of delegating to Server Actions:
 *   Server Actions use resolveCurrentProfile() which requires a cookie session.
 *   Mobile callers send Bearer tokens; no cookie is available. Inlining the
 *   writes here keeps identity resolution consistent with resolveMobileActor
 *   and avoids shimming a cookie session for a stateless mobile request.
 *
 * Per-step target tables (mirrors welcome-wizard-actions.ts):
 *   contact         → user_identity (first_name, last_name, phone)
 *   address         → user_identity (date_of_birth) + profile (address_line_1, postal_code, city)
 *   personal_number → profile (personal_number)  — isolated PII step
 *   availability    → employee_availability (delete+insert per RRULE weekday)
 *   consent         → consent_acceptance (handbook + gdpr + optional tariff)
 *   optional        → profile (bank_account, family_situation) + user_identity (emergency_contact_*)
 *
 * Identity writes to user_identity use actor.userId (from JWT subject).
 * Workspace-scoped writes use actor.profileId + actor.workspaceId (ADR-0396 safe:
 * no ALTER profile ADD COLUMN — existing columns only).
 *
 * Auth (ADR-0151): Bearer token required. workspace_id and profile_id are NEVER
 * accepted from the request body; derived server-side via resolveMobileActor.
 *
 * Telemetry: emits "profile welcome_wizard_step_completed" after each successful
 * step save (4 destinations per ADR-0134).
 */
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveMobileActor } from "@/app/api/mobile/_shared/actor";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";

export const runtime = "nodejs";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract Bearer token from Authorization header. Returns null if absent/malformed. */
function extractBearer(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : null;
}

// ── Request schema ────────────────────────────────────────────────────────────

const Body = z.object({
  step: z.enum([
    "contact",
    "address",
    "personal_number",
    "availability",
    "consent",
    "optional",
    "complete",
  ]),
  values: z.record(z.unknown()),
});

// ── Per-step value schemas ────────────────────────────────────────────────────

const ContactValues = z.object({
  firstName: z.string().min(1, "Fornavn er påkrevd."),
  lastName: z.string().min(1, "Etternavn er påkrevd."),
  phone: z.string().min(8, "Telefonnummer må være minst 8 siffer."),
});

const AddressValues = z.object({
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ugyldig dato."),
  addressLine1: z.string().min(1, "Adresse er påkrevd."),
  postalCode: z
    .string()
    .length(4, "Postnummer må være 4 siffer.")
    .regex(/^\d{4}$/),
  city: z.string().min(1, "By er påkrevd."),
});

const PersonalNumberValues = z.object({
  personalNumber: z
    .string()
    .length(11, "Personnummer må være 11 siffer.")
    .regex(/^\d{11}$/, "Personnummer kan kun inneholde siffer."),
});

const WeekdayCode = z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]);
const AvailabilityValues = z.object({
  unavailableDays: z.array(WeekdayCode),
});

const ConsentValues = z.object({
  handbook: z.literal(true),
  gdpr: z.literal(true),
  tariff: z.boolean().optional(),
});

const OptionalValues = z.object({
  bankAccount: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{11}$/.test(v.replace(/\s/g, "")), {
      message: "Kontonummer må være 11 siffer.",
    }),
  familySituation: z.enum(["enslig", "samboer", "gift", "barn"]).optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelation: z.string().optional(),
});

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const token = extractBearer(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actor = await resolveMobileActor(token);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 422 });
  }

  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request body" },
      { status: 422 },
    );
  }

  const admin = createAdminClient();
  const { step, values } = parsed.data;
  const now = new Date().toISOString();

  // Step → telemetry numbering mirrors welcome-wizard-actions.ts step numbering.
  // "complete" uses step 8 — emits welcome_wizard_completed (not step_completed).
  const STEP_MAP: Record<typeof step, { step: number; stepName: string }> = {
    contact: { step: 2, stepName: "contact" },
    address: { step: 3, stepName: "address" },
    personal_number: { step: 4, stepName: "personal_number" },
    optional: { step: 5, stepName: "optional" },
    availability: { step: 6, stepName: "availability" },
    consent: { step: 7, stepName: "consent" },
    complete: { step: 8, stepName: "complete" },
  };

  switch (step) {
    // ── contact: name + phone → user_identity ──────────────────────────────
    case "contact": {
      const v = ContactValues.safeParse(values);
      if (!v.success) {
        return NextResponse.json({ error: v.error.errors[0]?.message }, { status: 422 });
      }
      const { error } = await admin
        .from("user_identity")
        .update({
          first_name: v.data.firstName.trim(),
          last_name: v.data.lastName.trim(),
          phone: v.data.phone.trim(),
          updated_at: now,
        })
        .eq("user_id", actor.userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      break;
    }

    // ── address: date_of_birth → user_identity; address fields → profile ──
    case "address": {
      const v = AddressValues.safeParse(values);
      if (!v.success) {
        return NextResponse.json({ error: v.error.errors[0]?.message }, { status: 422 });
      }
      // user_identity: date_of_birth (PII — not workspace-scoped)
      const { error: idErr } = await admin
        .from("user_identity")
        .update({ date_of_birth: v.data.dateOfBirth, updated_at: now })
        .eq("user_id", actor.userId);
      if (idErr) return NextResponse.json({ error: idErr.message }, { status: 500 });

      // profile: address fields (workspace-scoped, not strict PII)
      const { error: profErr } = await admin
        .from("profile")
        .update({
          address_line_1: v.data.addressLine1.trim(),
          postal_code: v.data.postalCode,
          city: v.data.city.trim(),
          updated_at: now,
        })
        .eq("profile_id", actor.profileId);
      if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });
      break;
    }

    // ── personal_number: isolated PII → profile ───────────────────────────
    case "personal_number": {
      const v = PersonalNumberValues.safeParse(values);
      if (!v.success) {
        return NextResponse.json({ error: v.error.errors[0]?.message }, { status: 422 });
      }
      const { error } = await admin
        .from("profile")
        .update({ personal_number: v.data.personalNumber, updated_at: now })
        .eq("profile_id", actor.profileId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      break;
    }

    // ── availability: weekday RRULE rows → employee_availability ──────────
    case "availability": {
      const v = AvailabilityValues.safeParse(values);
      if (!v.success) {
        return NextResponse.json({ error: v.error.errors[0]?.message }, { status: 422 });
      }

      // Idempotent: clear prior wizard-provenance rows for this profile.
      const { error: delErr } = await admin
        .from("employee_availability")
        .delete()
        .eq("workspace_id", actor.workspaceId)
        .eq("profile_id", actor.profileId)
        .eq("reason", "onboarding-wizard");
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

      if (v.data.unavailableDays.length === 0) {
        // No unavailable days selected — deletion alone is the correct state.
        return NextResponse.json({ ok: true });
      }

      const today = now.slice(0, 10);
      const rows = v.data.unavailableDays.map((day) => ({
        workspace_id: actor.workspaceId,
        profile_id: actor.profileId,
        valid_from: today,
        valid_to: null as string | null,
        rrule: `FREQ=WEEKLY;BYDAY=${day}`,
        preference_type: "unavailable" as const,
        reason: "onboarding-wizard",
        created_by: actor.profileId,
      }));

      const { error: insErr } = await admin.from("employee_availability").insert(rows);
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
      break;
    }

    // ── consent: handbook + gdpr + optional tariff → consent_acceptance ───
    case "consent": {
      const v = ConsentValues.safeParse(values);
      if (!v.success) {
        return NextResponse.json({ error: v.error.errors[0]?.message }, { status: 422 });
      }

      // Check workspace tariff binding — mirrors saveConsent() in welcome-wizard-actions.ts.
      const { data: ws } = await admin
        .schema("payroll")
        .from("workspace_settings")
        .select("is_tariff_bound")
        .eq("workspace_id", actor.workspaceId)
        .maybeSingle();
      const tariffRequired = ws?.is_tariff_bound === true;
      if (tariffRequired && v.data.tariff !== true) {
        return NextResponse.json({ error: "tariff_consent_required" }, { status: 422 });
      }

      const consentRows: Array<{
        workspace_id: string;
        profile_id: string;
        consent_type: "handbook" | "gdpr" | "tariff";
        document_version: string;
      }> = [
        {
          workspace_id: actor.workspaceId,
          profile_id: actor.profileId,
          consent_type: "handbook",
          document_version: "handbook-v1",
        },
        {
          workspace_id: actor.workspaceId,
          profile_id: actor.profileId,
          consent_type: "gdpr",
          document_version: "gdpr-v1",
        },
      ];
      if (v.data.tariff === true) {
        consentRows.push({
          workspace_id: actor.workspaceId,
          profile_id: actor.profileId,
          consent_type: "tariff",
          document_version: "tariff-v1",
        });
      }

      const { error } = await admin.from("consent_acceptance").insert(consentRows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      break;
    }

    // ── optional: bank_account + family_situation → profile;
    //              emergency_contact_* → user_identity ────────────────────
    case "optional": {
      const v = OptionalValues.safeParse(values);
      if (!v.success) {
        return NextResponse.json({ error: v.error.errors[0]?.message }, { status: 422 });
      }

      // profile: bank_account + family_situation
      const profileUpdates: Record<string, unknown> = { updated_at: now };
      if (v.data.bankAccount !== undefined) {
        profileUpdates.bank_account = v.data.bankAccount
          ? v.data.bankAccount.replace(/\s/g, "")
          : null;
      }
      if (v.data.familySituation !== undefined) {
        profileUpdates.family_situation = v.data.familySituation ?? null;
      }
      if (Object.keys(profileUpdates).length > 1) {
        const { error: profErr } = await admin
          .from("profile")
          .update(profileUpdates)
          .eq("profile_id", actor.profileId);
        if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });
      }

      // user_identity: emergency_contact_* (ADR-0396 — existing columns, no ALTER)
      const identityUpdates: Record<string, unknown> = { updated_at: now };
      if (v.data.emergencyContactName !== undefined) {
        identityUpdates.emergency_contact_name = v.data.emergencyContactName || null;
      }
      if (v.data.emergencyContactPhone !== undefined) {
        identityUpdates.emergency_contact_phone = v.data.emergencyContactPhone || null;
      }
      if (v.data.emergencyContactRelation !== undefined) {
        identityUpdates.emergency_contact_relation = v.data.emergencyContactRelation || null;
      }
      if (Object.keys(identityUpdates).length > 1) {
        const { error: idErr } = await admin
          .from("user_identity")
          .update(identityUpdates)
          .eq("user_id", actor.userId);
        if (idErr) return NextResponse.json({ error: idErr.message }, { status: 500 });
      }
      break;
    }

    // ── complete: flip profile flag + mark onboarding_state done ─────────
    // Mirrors web completeWelcome() Server Action (T11, commit 247d4c6bc).
    // Uses admin client for profile update (no JWT UPDATE policy on profile).
    case "complete": {
      const { error: profErr } = await admin
        .from("profile")
        .update({
          is_welcome_complete: true,
          welcome_completed_at: now,
          updated_at: now,
        })
        .eq("profile_id", actor.profileId);
      if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });

      // employee_onboarding_state: idempotent upsert.
      // completed_at required when status='completed' per eos_completed_iff_ts constraint.
      const { error: stateErr } = await admin.from("employee_onboarding_state").upsert(
        {
          profile_id: actor.profileId,
          workspace_id: actor.workspaceId,
          status: "completed",
          completed_at: now,
        },
        { onConflict: "profile_id" },
      );
      if (stateErr) return NextResponse.json({ error: stateErr.message }, { status: 500 });

      // Emit wizard_completed (distinct event, not step_completed).
      void emit({
        event: "profile welcome_wizard_completed",
        workspace_id: nonEmpty(actor.workspaceId, "workspace_id"),
        actor_id: nonEmpty(actor.profileId, "actor_id"),
        properties: {
          entity: { entity_type: "profile", entity_id: actor.profileId },
          data: { completed_at: now },
        },
      });

      return NextResponse.json({ ok: true });
    }
  }

  // ── Telemetry: emit step completed (all steps except "complete") ──────────
  const stepMeta = STEP_MAP[step];
  void emit({
    event: "profile welcome_wizard_step_completed",
    workspace_id: nonEmpty(actor.workspaceId, "workspace_id"),
    actor_id: nonEmpty(actor.profileId, "actor_id"),
    properties: {
      entity: { entity_type: "profile", entity_id: actor.profileId },
      data: { step: stepMeta.step, step_name: stepMeta.stepName },
    },
  });

  return NextResponse.json({ ok: true });
}
