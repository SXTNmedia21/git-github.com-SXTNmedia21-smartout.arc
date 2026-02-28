import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes, createHash } from "node:crypto";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId, logPlatformAction } from "@/lib/platform-admin";

// Types are now available in database.types.ts after migration 20260228230000

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const CreateKeySchema = z.object({
  name: z.string().min(1).max(100),
  key_type: z.enum(["workspace", "service"]),
  workspace_id: z.string().uuid().optional(),
  environment: z.enum(["live", "test"]).default("live"),
  description: z.string().max(500).optional(),
  rate_limit_per_minute: z.number().int().min(1).max(10000).default(60),
  scopes: z.array(z.string()).default([]),
  expires_at: z.string().datetime().optional(),
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

// fromUntyped wrapper removed — types are now generated from migration

// ---------------------------------------------------------------------------
// GET — List API keys
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const searchParams = request.nextUrl.searchParams;
  const typeFilter = searchParams.get("type");
  const envFilter = searchParams.get("env");
  const statusFilter = searchParams.get("status");

  let query = admin
    .from("platform_api_key")
    .select(
      "id, workspace_id, name, description, key_type, environment, key_prefix, version, rotation_number, scopes, rate_limit_per_minute, last_used_at, grace_period_ends_at, revoked_at, expires_at, created_at, updated_at",
    )
    .order("created_at", { ascending: false });

  if (typeFilter === "workspace" || typeFilter === "service") {
    query = query.eq("key_type", typeFilter);
  }

  if (envFilter === "live" || envFilter === "test") {
    query = query.eq("environment", envFilter);
  }

  if (statusFilter === "current" || statusFilter === "previous" || statusFilter === "revoked") {
    query = query.eq("version", statusFilter);
  }

  const { data: keys, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const keyList = keys ?? [];

  // Join workspace names for display
  const workspaceIds = [
    ...new Set(keyList.map((k) => k.workspace_id).filter((id): id is string => id !== null)),
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

  const enriched = keyList.map((key) => ({
    ...key,
    workspace_name: key.workspace_id ? (workspaceMap[key.workspace_id] ?? null) : null,
  }));

  return NextResponse.json({ data: enriched });
}

// ---------------------------------------------------------------------------
// POST — Create a new API key
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = CreateKeySchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten().fieldErrors }, { status: 400 });
  }

  const d = body.data;

  // Validate: workspace keys require a workspace_id
  if (d.key_type === "workspace" && !d.workspace_id) {
    return NextResponse.json(
      { error: "workspace_id is required for workspace keys" },
      { status: 400 },
    );
  }

  // Validate: service keys must NOT have a workspace_id
  if (d.key_type === "service" && d.workspace_id) {
    return NextResponse.json(
      { error: "workspace_id must not be set for service keys" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Resolve company_id from workspace if applicable
  let companyId: string | null = null;
  if (d.workspace_id) {
    const { data: workspace } = await admin
      .from("workspace")
      .select("company_id")
      .eq("workspace_id", d.workspace_id)
      .single();

    companyId = workspace?.company_id ?? null;
  }

  // Generate API key
  const keyType = d.key_type === "workspace" ? "sk" : "svc";
  const { plaintextKey, keyHash, keyPrefix } = generateApiKey(keyType, d.environment);

  const { data: newKey, error: insertError } = await admin
    .from("platform_api_key")
    .insert({
      name: d.name,
      description: d.description ?? null,
      key_type: d.key_type,
      environment: d.environment,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      workspace_id: d.workspace_id ?? null,
      company_id: companyId,
      created_by: adminId,
      scopes: d.scopes,
      rate_limit_per_minute: d.rate_limit_per_minute,
      expires_at: d.expires_at ?? null,
      version: "current",
      rotation_number: 1,
    })
    .select("id, name, key_type, environment, key_prefix, version, created_at")
    .single();

  if (insertError || !newKey) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create API key" },
      { status: 500 },
    );
  }

  await logPlatformAction(adminId, "create_api_key", "platform_api_key", newKey.id, {
    key_type: d.key_type,
    environment: d.environment,
    workspace_id: d.workspace_id ?? null,
    key_prefix: keyPrefix,
  });

  return NextResponse.json(
    {
      data: {
        ...newKey,
        plaintext_key: plaintextKey,
      },
      warning: "Store this key securely. It will not be shown again.",
    },
    { status: 201 },
  );
}
