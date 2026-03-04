import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId, logPlatformAction } from "@/lib/platform-admin";

// Types are now available in database.types.ts after migration 20260228230000

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const CreateSecretSchema = z.object({
  provider: z.string().min(1).max(100),
  vault_secret_name: z.string().min(1).max(200),
  secret_value: z.string().min(1),
  workspace_id: z.string().uuid().optional(),
  environment: z.enum(["live", "test"]).default("live"),
  description: z.string().max(500).optional(),
  rotation_reminder_days: z.number().int().min(1).max(365).default(90),
});

// ---------------------------------------------------------------------------
// GET — List external secrets (metadata only, no decrypted values)
// ---------------------------------------------------------------------------

export async function GET(_request: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();

  const { data: secrets, error } = await admin
    .from("platform_external_secret")
    .select(
      "id, workspace_id, provider, environment, vault_secret_name, description, last_rotated_at, last_rotated_by, rotation_reminder_days, expires_at, is_active, last_verified_at, last_error_at, last_error_message, created_at, updated_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const secretList = (secrets ?? []) as NonNullable<typeof secrets>;

  // Join workspace names for display
  const workspaceIds = [
    ...new Set(secretList.map((s) => s.workspace_id).filter((id): id is string => id !== null)),
  ];

  let workspaceMap: Record<string, string> = {};
  if (workspaceIds.length > 0) {
    const { data: workspaces } = await admin
      .from("workspace")
      .select("workspace_id, name")
      .in("workspace_id", workspaceIds);

    workspaceMap = (workspaces ?? []).reduce(
      (acc, ws) => {
        acc[ws.workspace_id] = ws.name;
        return acc;
      },
      {} as Record<string, string>,
    );
  }

  const enriched = secretList.map((secret) => ({
    ...secret,
    workspace_name: secret.workspace_id ? (workspaceMap[secret.workspace_id] ?? null) : null,
  }));

  return NextResponse.json({ data: enriched });
}

// ---------------------------------------------------------------------------
// POST — Create an external secret (store in Vault + metadata row)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = CreateSecretSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten().fieldErrors }, { status: 400 });
  }

  const d = body.data;
  const admin = createAdminClient();

  // Check if vault_secret_name already exists (upsert pattern)
  const { data: existing } = await admin
    .from("platform_external_secret")
    .select("id")
    .eq("vault_secret_name", d.vault_secret_name)
    .maybeSingle();

  // Store secret in Vault via RPC wrapper (upsert handles both create and update)
  const vaultDescription = `provider:${d.provider} env:${d.environment}${d.workspace_id ? ` workspace:${d.workspace_id}` : ""}`;
  const { error: vaultError } = await admin.rpc("upsert_secret", {
    p_name: d.vault_secret_name,
    p_secret: d.secret_value,
    p_description: vaultDescription,
  });

  if (vaultError) {
    return NextResponse.json(
      { error: `Failed to store secret in Vault: ${vaultError.message}` },
      { status: 500 },
    );
  }

  const now = new Date().toISOString();

  if (existing) {
    // Update existing metadata row
    const { data: secretRow, error: updateError } = await admin
      .from("platform_external_secret")
      .update({
        provider: d.provider,
        environment: d.environment,
        description: d.description ?? null,
        rotation_reminder_days: d.rotation_reminder_days,
        last_rotated_at: now,
        last_rotated_by: adminId,
        is_active: true,
      })
      .eq("id", existing.id)
      .select("id, provider, vault_secret_name, environment, created_at")
      .single();

    if (updateError || !secretRow) {
      return NextResponse.json(
        { error: updateError?.message ?? "Failed to update secret metadata" },
        { status: 500 },
      );
    }

    await logPlatformAction(
      adminId,
      "rotate_external_secret",
      "platform_external_secret",
      secretRow.id,
      {
        provider: d.provider,
        vault_secret_name: d.vault_secret_name,
        environment: d.environment,
        workspace_id: d.workspace_id ?? null,
      },
    );

    return NextResponse.json({ data: secretRow });
  }

  // Create new metadata row
  const { data: secretRow, error: insertError } = await admin
    .from("platform_external_secret")
    .insert({
      workspace_id: d.workspace_id ?? null,
      provider: d.provider,
      environment: d.environment,
      vault_secret_name: d.vault_secret_name,
      description: d.description ?? null,
      rotation_reminder_days: d.rotation_reminder_days,
      last_rotated_at: now,
      last_rotated_by: adminId,
      is_active: true,
    })
    .select("id, provider, vault_secret_name, environment, created_at")
    .single();

  if (insertError || !secretRow) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create secret metadata" },
      { status: 500 },
    );
  }

  await logPlatformAction(
    adminId,
    "create_external_secret",
    "platform_external_secret",
    secretRow.id,
    {
      provider: d.provider,
      vault_secret_name: d.vault_secret_name,
      environment: d.environment,
      workspace_id: d.workspace_id ?? null,
    },
  );

  return NextResponse.json(
    {
      data: secretRow,
    },
    { status: 201 },
  );
}

// ---------------------------------------------------------------------------
// DELETE — Remove an external secret (Vault + metadata row)
// ---------------------------------------------------------------------------

const DeleteSecretSchema = z.object({
  id: z.string().uuid(),
});

export async function DELETE(request: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = DeleteSecretSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten().fieldErrors }, { status: 400 });
  }

  const admin = createAdminClient();

  // Fetch the metadata row to get the vault_secret_name
  const { data: secret, error: fetchError } = await admin
    .from("platform_external_secret")
    .select("id, vault_secret_name, provider")
    .eq("id", body.data.id)
    .single();

  if (fetchError || !secret) {
    return NextResponse.json({ error: "Secret not found" }, { status: 404 });
  }

  // Delete from Vault first
  const { error: vaultError } = await admin.rpc("delete_vault_secret", {
    secret_name: secret.vault_secret_name,
  });

  if (vaultError) {
    return NextResponse.json(
      { error: `Failed to delete from Vault: ${vaultError.message}` },
      { status: 500 },
    );
  }

  // Delete metadata row
  const { error: deleteError } = await admin
    .from("platform_external_secret")
    .delete()
    .eq("id", secret.id);

  if (deleteError) {
    return NextResponse.json(
      { error: `Failed to delete metadata: ${deleteError.message}` },
      { status: 500 },
    );
  }

  await logPlatformAction(
    adminId,
    "delete_external_secret",
    "platform_external_secret",
    secret.id,
    {
      provider: secret.provider,
      vault_secret_name: secret.vault_secret_name,
    },
  );

  return NextResponse.json({ success: true });
}
