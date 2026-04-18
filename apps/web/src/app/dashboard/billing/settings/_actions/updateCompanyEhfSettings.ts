"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";

// Fase 3B B6 — workspace-admin toggler EHF for selskapet sitt.
//
// EHF er en company-level innstilling (ikke per-workspace) fordi
// peppol_participant_id følger org.nr. Workspace-admin / owner kan
// endre den for sin egen company. Platform-admin har egen redigering
// via /platform-admin.
//
// CHECK(ehf_enabled=false OR peppol_participant_id NOT NULL) håndheves
// i DB — vi speiler invariant her for bedre feilmelding + UI-guard.

const UpdateInputSchema = z
  .object({
    ehf_enabled: z.boolean(),
    peppol_participant_id: z
      .string()
      .trim()
      .regex(/^\d{4}:\S.+$/, "Format: '0192:<orgnr>' (f.eks. '0192:923609016')")
      .nullable()
      .or(z.literal("").transform(() => null)),
  })
  .refine(
    (v) => v.ehf_enabled === false || v.peppol_participant_id !== null,
    "peppol_participant_id må settes før EHF kan slås på",
  );

export type UpdateCompanyEhfSettingsResult =
  | { ok: true }
  | { ok: false; error: string; code?: "unauthorized" | "invalid_input" | "db_error" };

export async function updateCompanyEhfSettings(
  raw: unknown,
): Promise<UpdateCompanyEhfSettingsResult> {
  const parsed = UpdateInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "invalid_input",
      code: "invalid_input",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized", code: "unauthorized" };

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("company_member")
    .select("company_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .in("role", ["admin", "owner"])
    .limit(1)
    .maybeSingle();
  if (!member) return { ok: false, error: "unauthorized", code: "unauthorized" };

  const { error } = await admin
    .from("company")
    .update({
      ehf_enabled: parsed.data.ehf_enabled,
      peppol_participant_id: parsed.data.peppol_participant_id,
    })
    .eq("company_id", member.company_id);

  if (error) {
    return { ok: false, error: error.message, code: "db_error" };
  }

  revalidatePath("/dashboard/billing/settings");
  return { ok: true };
}
