import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId, logPlatformAction } from "@/lib/platform-admin";

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const BulkSecretEntry = z.object({
  key: z.string().min(1),
  provider: z.string().min(1).max(100),
  vault_secret_name: z.string().min(1).max(200),
  secret_value: z.string().min(1),
  environment: z.enum(["live", "test"]).default("live"),
  description: z.string().max(500).optional(),
});

const ImportSchema = z.object({
  action: z.literal("import"),
  secrets: z.array(BulkSecretEntry).min(1).max(50),
});

const DeleteSchema = z.object({
  action: z.literal("delete"),
  keys: z.array(z.string().min(1)).min(1).max(50),
});

const BulkRequestSchema = z.discriminatedUnion("action", [ImportSchema, DeleteSchema]);

// ---------------------------------------------------------------------------
// POST — Bulk import or delete secrets via Supabase Vault
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = BulkRequestSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten().fieldErrors }, { status: 400 });
  }

  const admin = createAdminClient();

  if (body.data.action === "import") {
    const results: { key: string; ok: boolean; error?: string }[] = [];

    for (const entry of body.data.secrets) {
      const vaultDescription = `provider:${entry.provider} env:${entry.environment}`;

      // Upsert into Vault
      const { error: vaultError } = await admin.rpc("upsert_secret", {
        p_name: entry.vault_secret_name,
        p_secret: entry.secret_value,
        p_description: vaultDescription,
      });

      if (vaultError) {
        results.push({ key: entry.key, ok: false, error: vaultError.message });
        continue;
      }

      // Upsert metadata row (insert or update if vault_secret_name already exists)
      const now = new Date().toISOString();
      const { data: existing } = await admin
        .from("platform_external_secret")
        .select("id")
        .eq("vault_secret_name", entry.vault_secret_name)
        .maybeSingle();

      if (existing) {
        await admin
          .from("platform_external_secret")
          .update({
            provider: entry.provider,
            environment: entry.environment,
            description: entry.description ?? null,
            last_rotated_at: now,
            last_rotated_by: adminId,
            is_active: true,
          })
          .eq("id", existing.id);
      } else {
        await admin.from("platform_external_secret").insert({
          provider: entry.provider,
          environment: entry.environment,
          vault_secret_name: entry.vault_secret_name,
          description: entry.description ?? null,
          rotation_reminder_days: 90,
          last_rotated_at: now,
          last_rotated_by: adminId,
          is_active: true,
        });
      }

      results.push({ key: entry.key, ok: true });
    }

    const imported = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);

    await logPlatformAction(adminId, "bulk_import_secrets", "platform_external_secret", null, {
      total: body.data.secrets.length,
      imported,
      failed: failed.length,
    });

    return NextResponse.json({
      data: { imported, failed: failed.length, results },
    });
  }

  // action === "delete"
  const deleted: string[] = [];
  const errors: { key: string; error: string }[] = [];

  for (const key of body.data.keys) {
    // Delete from Vault
    const { error: vaultError } = await admin.rpc("delete_vault_secret", {
      secret_name: key,
    });

    if (vaultError) {
      errors.push({ key, error: vaultError.message });
      continue;
    }

    // Delete metadata row
    await admin.from("platform_external_secret").delete().eq("vault_secret_name", key);

    deleted.push(key);
  }

  await logPlatformAction(adminId, "bulk_delete_secrets", "platform_external_secret", null, {
    deleted: deleted.length,
    failed: errors.length,
    keys: deleted,
  });

  return NextResponse.json({
    data: { deleted: deleted.length, errors },
  });
}
