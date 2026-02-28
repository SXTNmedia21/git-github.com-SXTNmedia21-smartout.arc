import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes, createHash } from "node:crypto";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId, logPlatformAction } from "@/lib/platform-admin";

// ---------------------------------------------------------------------------
// Zod Schema
// ---------------------------------------------------------------------------

const RotateKeySchema = z.object({
  grace_period: z.string().optional().default("48 hours"),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateApiKey(type: "sk" | "svc", env: "live" | "test") {
  const random = randomBytes(32).toString("base64url");
  const plaintextKey = `smo_${type}_${env}_${random}`;
  const keyHash = createHash("sha256").update(plaintextKey).digest("hex");
  const keyPrefix = plaintextKey.substring(0, 20);
  return { plaintextKey, keyHash, keyPrefix };
}

// ---------------------------------------------------------------------------
// POST — Rotate an API key
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const body = RotateKeySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten().fieldErrors }, { status: 400 });
  }

  const admin = createAdminClient();

  // Fetch the existing key to get its attributes
  const { data: existingKey, error: fetchError } = await admin
    .from("platform_api_key")
    .select("id, workspace_id, key_type, environment, version")
    .eq("id", id)
    .single();

  if (fetchError || !existingKey) {
    if (fetchError?.code === "PGRST116") {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: fetchError?.message ?? "Failed to fetch key" },
      { status: 500 },
    );
  }

  if (existingKey.version === "revoked") {
    return NextResponse.json({ error: "Cannot rotate a revoked key" }, { status: 400 });
  }

  // Generate new key
  const keyTypePrefix = existingKey.key_type === "workspace" ? "sk" : "svc";
  const env = existingKey.environment as "live" | "test";
  const { plaintextKey, keyHash, keyPrefix } = generateApiKey(keyTypePrefix, env);

  // Call the rotate_api_key database function
  const { data: newKeyId, error: rotateError } = await admin.rpc("rotate_api_key", {
    p_workspace_id: existingKey.workspace_id as string,
    p_key_type: existingKey.key_type,
    p_environment: existingKey.environment,
    p_new_key_hash: keyHash,
    p_new_key_prefix: keyPrefix,
    p_grace_period: body.data.grace_period,
  });

  if (rotateError) {
    return NextResponse.json(
      { error: rotateError.message ?? "Failed to rotate key" },
      { status: 500 },
    );
  }

  await logPlatformAction(adminId, "rotate_api_key", "platform_api_key", id, {
    new_key_id: newKeyId,
    grace_period: body.data.grace_period,
    key_prefix: keyPrefix,
  });

  return NextResponse.json({
    data: {
      new_key_id: newKeyId,
      key_prefix: keyPrefix,
      plaintext_key: plaintextKey,
      grace_period: body.data.grace_period,
    },
    warning: "Store this key securely. It will not be shown again.",
  });
}
