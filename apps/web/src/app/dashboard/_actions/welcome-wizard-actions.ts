"use server";

/**
 * welcome-wizard-actions.ts
 *
 * Server Actions for the first-login welcome wizard (WelcomeWizard component).
 *
 * WHY per-step actions: each step has a different target table and/or PII class.
 * - saveContact   → user_identity (name, phone)
 * - saveAddress   → user_identity (date_of_birth) + profile (address, postal, city)
 * - savePersonalNumber → profile (personal_number) — isolated PII step
 * - saveOptional  → profile (bank_account, family_situation) + user_identity (emergency_contact_*)
 * - completeWelcome → profile (is_welcome_complete = true, welcome_completed_at)
 *
 * Auth: all actors resolved server-side from JWT per ADR-0151.
 * Never trust user_id / profile_id from the request body.
 */

import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import { resolveCurrentProfile } from "./_shared";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

function badInput(issues: z.ZodIssue[]): ActionResult {
  return { ok: false, error: issues[0]?.message ?? "Ugyldig input." };
}

/** Resolve authenticated user_id for user_identity mutations. */
async function resolveUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ─── Step 2: Navn + kontakt ───────────────────────────────────────────────────

const ContactSchema = z.object({
  firstName: z.string().min(1, "Fornavn er påkrevd."),
  lastName: z.string().min(1, "Etternavn er påkrevd."),
  phone: z
    .string()
    .min(8, "Telefonnummer må være minst 8 siffer.")
    .regex(/^[+\d\s\-()]{8,}$/, "Ugyldig telefonnummer."),
});

export type SaveContactInput = z.infer<typeof ContactSchema>;

export async function saveContact(input: SaveContactInput): Promise<ActionResult> {
  const parsed = ContactSchema.safeParse(input);
  if (!parsed.success) return badInput(parsed.error.issues);

  const userId = await resolveUserId();
  if (!userId) return { ok: false, error: "Ikke autentisert." };

  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "Profil ikke funnet." };

  const admin = createAdminClient();

  const { error } = await admin
    .from("user_identity")
    .update({
      first_name: parsed.data.firstName.trim(),
      last_name: parsed.data.lastName.trim(),
      phone: parsed.data.phone.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };

  await emit({
    event: "profile welcome_wizard_step_completed",
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      entity: { entity_type: "profile", entity_id: profile.profileId },
      data: { step: 2, step_name: "contact" },
    },
  });

  return { ok: true };
}

// ─── Step 3: Fødselsdato + adresse ────────────────────────────────────────────

const AddressSchema = z.object({
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ugyldig dato."),
  addressLine1: z.string().min(1, "Adresse er påkrevd."),
  postalCode: z
    .string()
    .length(4, "Postnummer må være 4 siffer.")
    .regex(/^\d{4}$/, "Postnummer må være 4 siffer."),
  city: z.string().min(1, "By er påkrevd."),
});

export type SaveAddressInput = z.infer<typeof AddressSchema>;

export async function saveAddress(input: SaveAddressInput): Promise<ActionResult> {
  const parsed = AddressSchema.safeParse(input);
  if (!parsed.success) return badInput(parsed.error.issues);

  const userId = await resolveUserId();
  if (!userId) return { ok: false, error: "Ikke autentisert." };

  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "Profil ikke funnet." };

  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Update user_identity: date_of_birth
  const { error: identityError } = await admin
    .from("user_identity")
    .update({ date_of_birth: parsed.data.dateOfBirth, updated_at: now })
    .eq("user_id", userId);

  if (identityError) return { ok: false, error: identityError.message };

  // Update profile: address, postal_code, city
  const { error: profileError } = await admin
    .from("profile")
    .update({
      address_line_1: parsed.data.addressLine1.trim(),
      postal_code: parsed.data.postalCode,
      city: parsed.data.city.trim(),
      updated_at: now,
    })
    .eq("profile_id", profile.profileId);

  if (profileError) return { ok: false, error: profileError.message };

  await emit({
    event: "profile welcome_wizard_step_completed",
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      entity: { entity_type: "profile", entity_id: profile.profileId },
      data: { step: 3, step_name: "address" },
    },
  });

  return { ok: true };
}

// ─── Step 4: Personnummer (PII) ────────────────────────────────────────────────

const PersonalNumberSchema = z.object({
  personalNumber: z
    .string()
    .length(11, "Personnummer må være 11 siffer.")
    .regex(/^\d{11}$/, "Personnummer kan kun inneholde siffer."),
});

export type SavePersonalNumberInput = z.infer<typeof PersonalNumberSchema>;

export async function savePersonalNumber(input: SavePersonalNumberInput): Promise<ActionResult> {
  const parsed = PersonalNumberSchema.safeParse(input);
  if (!parsed.success) return badInput(parsed.error.issues);

  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "Ikke autentisert." };

  const admin = createAdminClient();

  const { error } = await admin
    .from("profile")
    .update({
      personal_number: parsed.data.personalNumber,
      updated_at: new Date().toISOString(),
    })
    .eq("profile_id", profile.profileId);

  if (error) return { ok: false, error: error.message };

  await emit({
    event: "profile welcome_wizard_step_completed",
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      entity: { entity_type: "profile", entity_id: profile.profileId },
      data: { step: 4, step_name: "personal_number" },
    },
  });

  return { ok: true };
}

// ─── Step 5: Valgfri info ─────────────────────────────────────────────────────

const OptionalSchema = z.object({
  bankAccount: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{11}$/.test(v.replace(/\s/g, "")), {
      message: "Kontonummer må være 11 siffer.",
    }),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelation: z.string().optional(),
  familySituation: z.enum(["enslig", "samboer", "gift", "barn"]).optional(),
});

export type SaveOptionalInput = z.infer<typeof OptionalSchema>;

export async function saveOptional(input: SaveOptionalInput): Promise<ActionResult> {
  const parsed = OptionalSchema.safeParse(input);
  if (!parsed.success) return badInput(parsed.error.issues);

  const userId = await resolveUserId();
  if (!userId) return { ok: false, error: "Ikke autentisert." };

  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "Ikke autentisert." };

  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Update profile: bank_account, family_situation
  const profileUpdates: Record<string, unknown> = { updated_at: now };
  if (parsed.data.bankAccount !== undefined) {
    profileUpdates.bank_account = parsed.data.bankAccount
      ? parsed.data.bankAccount.replace(/\s/g, "")
      : null;
  }
  if (parsed.data.familySituation !== undefined) {
    profileUpdates.family_situation = parsed.data.familySituation ?? null;
  }

  if (Object.keys(profileUpdates).length > 1) {
    const { error: profileError } = await admin
      .from("profile")
      .update(profileUpdates)
      .eq("profile_id", profile.profileId);
    if (profileError) return { ok: false, error: profileError.message };
  }

  // Update user_identity: emergency_contact_*
  const identityUpdates: Record<string, unknown> = { updated_at: now };
  if (parsed.data.emergencyContactName !== undefined) {
    identityUpdates.emergency_contact_name = parsed.data.emergencyContactName || null;
  }
  if (parsed.data.emergencyContactPhone !== undefined) {
    identityUpdates.emergency_contact_phone = parsed.data.emergencyContactPhone || null;
  }
  if (parsed.data.emergencyContactRelation !== undefined) {
    identityUpdates.emergency_contact_relation = parsed.data.emergencyContactRelation || null;
  }

  if (Object.keys(identityUpdates).length > 1) {
    const { error: identityError } = await admin
      .from("user_identity")
      .update(identityUpdates)
      .eq("user_id", userId);
    if (identityError) return { ok: false, error: identityError.message };
  }

  await emit({
    event: "profile welcome_wizard_step_completed",
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      entity: { entity_type: "profile", entity_id: profile.profileId },
      data: { step: 5, step_name: "optional" },
    },
  });

  return { ok: true };
}

// ─── Step 5 skip ─────────────────────────────────────────────────────────────

export async function skipOptional(): Promise<ActionResult> {
  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "Ikke autentisert." };

  await emit({
    event: "profile welcome_wizard_skipped_optional",
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      entity: { entity_type: "profile", entity_id: profile.profileId },
      data: { step: 5 },
    },
  });

  return { ok: true };
}

// ─── Step 5b: Availability ────────────────────────────────────────────────────

const WeekdayCode = z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]);
export type WeekdayCode = z.infer<typeof WeekdayCode>;

const SaveAvailabilitySchema = z.object({
  unavailableDays: z.array(WeekdayCode),
});
export type SaveAvailabilityInput = z.infer<typeof SaveAvailabilitySchema>;

/**
 * Wizard step 5b. Writes one row per unavailable weekday into
 * `employee_availability` (preference_type='unavailable', RRULE weekly).
 * Idempotent: deletes prior 'onboarding-wizard'-provenance rows for this
 * profile before inserting the current selection.
 * Auth: server-derived per ADR-0151. Fail-fast on missing profile per L-0177.
 */
export async function saveAvailability(input: SaveAvailabilityInput): Promise<ActionResult> {
  const parsed = SaveAvailabilitySchema.safeParse(input);
  if (!parsed.success) return badInput(parsed.error.issues);

  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "Ikke autentisert." };

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // Idempotent: clear prior wizard-provenance rows.
  const { error: delErr } = await supabase
    .from("employee_availability")
    .delete()
    .eq("workspace_id", profile.workspaceId)
    .eq("profile_id", profile.profileId)
    .eq("reason", "onboarding-wizard");
  if (delErr) return { ok: false, error: delErr.message };

  if (parsed.data.unavailableDays.length === 0) {
    return { ok: true };
  }

  const rows = parsed.data.unavailableDays.map((day) => ({
    workspace_id: profile.workspaceId,
    profile_id: profile.profileId,
    valid_from: today,
    valid_to: null as string | null,
    rrule: `FREQ=WEEKLY;BYDAY=${day}`,
    preference_type: "unavailable" as const,
    reason: "onboarding-wizard",
    created_by: profile.profileId,
  }));

  const { error: insErr } = await supabase.from("employee_availability").insert(rows);
  if (insErr) return { ok: false, error: insErr.message };

  await emit({
    event: "profile welcome_wizard_step_completed",
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      entity: { entity_type: "profile", entity_id: profile.profileId },
      // step 6 = availability (5=optional, 6=availability per wizard step numbering).
      // unavailable_count omitted — registry schema only allows { step, step_name }.
      data: { step: 6, step_name: "availability" },
    },
  });

  return { ok: true };
}

// ─── Step 7: Consent ─────────────────────────────────────────────────────────

// Document version constants live in ./welcome-wizard-constants — a
// non-"use server" sibling. Re-exporting values from this module would
// fail bundle ("Only async functions are allowed to be exported in a
// 'use server' file"). Test + future consumers import from constants file.
import {
  HANDBOOK_DOCUMENT_VERSION,
  GDPR_DOCUMENT_VERSION,
  TARIFF_DOCUMENT_VERSION,
} from "./welcome-wizard-constants";

const SaveConsentInput = z.object({
  handbook: z.literal(true),
  gdpr: z.literal(true),
  tariff: z.boolean().optional(),
});
export type SaveConsentInput = z.infer<typeof SaveConsentInput>;

/**
 * Wizard step 7. Inserts one consent_acceptance row per accepted
 * consent_type. All-or-nothing: if tariff checkbox is required by
 * payroll.workspace_settings.is_tariff_bound and missing, returns an error.
 *
 * INSERT requires service-role (no JWT INSERT policy on consent_acceptance —
 * audit-trail immutability enforced at RLS level). Uses createAdminClient()
 * per pattern established in other wizard steps (saveContact, saveAddress, etc).
 *
 * Auth: server-derived per ADR-0151. Fail-fast on missing profile per L-0177.
 */
export async function saveConsent(input: SaveConsentInput): Promise<ActionResult> {
  const parsed = SaveConsentInput.safeParse(input);
  if (!parsed.success) return badInput(parsed.error.issues);

  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "Ikke autentisert." };

  const admin = createAdminClient();

  // Workspace tariff binding gate — read from payroll.workspace_settings
  // (is_tariff_bound lives in payroll schema, not public.workspace).
  const { data: ws } = await admin
    .schema("payroll")
    .from("workspace_settings")
    .select("is_tariff_bound")
    .eq("workspace_id", profile.workspaceId)
    .maybeSingle();
  const tariffRequired = ws?.is_tariff_bound === true;
  if (tariffRequired && parsed.data.tariff !== true) {
    return { ok: false, error: "tariff_consent_required" };
  }

  const rows: Array<{
    workspace_id: string;
    profile_id: string;
    consent_type: "handbook" | "gdpr" | "tariff";
    document_version: string;
  }> = [
    {
      workspace_id: profile.workspaceId,
      profile_id: profile.profileId,
      consent_type: "handbook",
      document_version: HANDBOOK_DOCUMENT_VERSION,
    },
    {
      workspace_id: profile.workspaceId,
      profile_id: profile.profileId,
      consent_type: "gdpr",
      document_version: GDPR_DOCUMENT_VERSION,
    },
  ];
  if (parsed.data.tariff === true) {
    rows.push({
      workspace_id: profile.workspaceId,
      profile_id: profile.profileId,
      consent_type: "tariff",
      document_version: TARIFF_DOCUMENT_VERSION,
    });
  }

  const { error } = await admin.from("consent_acceptance").insert(rows);
  if (error) return { ok: false, error: error.message };

  void emit({
    event: "profile welcome_wizard_step_completed",
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      entity: { entity_type: "profile", entity_id: profile.profileId },
      data: { step: 7, step_name: "consent" },
    },
  });

  return { ok: true };
}

// ─── Step 8: Complete ─────────────────────────────────────────────────────────

export async function completeWelcome(): Promise<ActionResult> {
  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "Ikke autentisert." };

  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Flip profile flags (existing behavior — service-role required, no JWT UPDATE policy on profile).
  const { error } = await admin
    .from("profile")
    .update({
      is_welcome_complete: true,
      welcome_completed_at: now,
      updated_at: now,
    })
    .eq("profile_id", profile.profileId);

  if (error) return { ok: false, error: error.message };

  // Mirror completion into employee_onboarding_state (JWT policy sufficient — own row).
  // completed_at must be set when status='completed' per eos_completed_iff_ts constraint.
  const supabase = await createClient();
  const { error: stateErr } = await supabase.from("employee_onboarding_state").upsert(
    {
      profile_id: profile.profileId,
      workspace_id: profile.workspaceId,
      status: "completed",
      completed_at: now,
    },
    { onConflict: "profile_id" },
  );
  if (stateErr) return { ok: false, error: stateErr.message };

  void emit({
    event: "profile welcome_wizard_completed",
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      entity: { entity_type: "profile", entity_id: profile.profileId },
      data: { completed_at: now },
    },
  });

  return { ok: true };
}

// ─── Dismiss / Resume ─────────────────────────────────────────────────────────

/**
 * Sets wizard state to 'dismissed' when user closes via "Lukk og fortsett
 * senere". JWT policy on employee_onboarding_state is sufficient (own row).
 * dismissed_at must be set when status='dismissed' per eos_dismissed_iff_ts.
 * Callers MAY pass current step context for telemetry granularity.
 */
export async function dismissWelcomeWizard(
  stepIndex: number = 0,
  stepName: string = "wizard",
): Promise<ActionResult> {
  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "Ikke autentisert." };

  const supabase = await createClient();
  const { error } = await supabase.from("employee_onboarding_state").upsert(
    {
      profile_id: profile.profileId,
      workspace_id: profile.workspaceId,
      status: "dismissed",
      dismissed_at: new Date().toISOString(),
    },
    { onConflict: "profile_id" },
  );
  if (error) return { ok: false, error: error.message };

  void emit({
    event: "profile welcome_wizard_dismissed",
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      entity: { entity_type: "profile", entity_id: profile.profileId },
      data: { step: stepIndex, step_name: stepName },
    },
  });

  return { ok: true };
}

/**
 * Emits `welcome_wizard_resumed` when a previously-dismissed wizard is
 * re-opened. Called from the BFF GET handler when state row has dismissed_at
 * IS NOT NULL and the cold-start gate fires again.
 * Takes explicit IDs + step context because this may be called server-side
 * outside a Server Action (no resolveCurrentProfile() available).
 */
export async function recordWelcomeResume(
  profileId: string,
  workspaceId: string,
  stepIndex: number = 0,
  stepName: string = "wizard",
): Promise<void> {
  void emit({
    event: "profile welcome_wizard_resumed",
    workspace_id: nonEmpty(workspaceId, "workspace_id"),
    actor_id: nonEmpty(profileId, "actor_id"),
    properties: {
      entity: { entity_type: "profile", entity_id: profileId },
      data: { step: stepIndex, step_name: stepName },
    },
  });
}
