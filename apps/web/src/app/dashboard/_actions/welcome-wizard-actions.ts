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

// ─── Step 6: Complete ─────────────────────────────────────────────────────────

export async function completeWelcome(): Promise<ActionResult> {
  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "Ikke autentisert." };

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { error } = await admin
    .from("profile")
    .update({
      is_welcome_complete: true,
      welcome_completed_at: now,
      updated_at: now,
    })
    .eq("profile_id", profile.profileId);

  if (error) return { ok: false, error: error.message };

  await emit({
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
