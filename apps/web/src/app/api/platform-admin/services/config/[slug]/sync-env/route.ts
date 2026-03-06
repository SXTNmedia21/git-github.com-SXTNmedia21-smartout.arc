import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireGodmode, logPlatformAction } from "@/lib/platform-admin";

const VERCEL_API = "https://api.vercel.com";

const SyncEnvSchema = z.object({
  env_vars: z.record(z.string()),
  target: z.enum(["production", "preview", "development"]).default("production"),
  redeploy: z.boolean().default(false),
});

type RouteContext = { params: Promise<{ slug: string }> };

/** POST /api/platform-admin/services/config/[slug]/sync-env — Sync env vars to Vercel */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireGodmode();
  if (auth.error) return auth.error;

  const { slug } = await params;

  const vercelToken = process.env.VERCEL_API_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;

  if (!vercelToken) {
    return NextResponse.json(
      { error: "VERCEL_API_TOKEN not configured" },
      { status: 503 },
    );
  }

  const { data: service } = await auth.admin
    .from("service_config")
    .select("service_id, name, vercel_project_id")
    .eq("slug", slug)
    .single();

  if (!service?.vercel_project_id) {
    return NextResponse.json(
      { error: "No Vercel project linked to this service" },
      { status: 400 },
    );
  }

  const body = SyncEnvSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json(
      { error: body.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const d = body.data;
  const headers = {
    Authorization: `Bearer ${vercelToken}`,
    "Content-Type": "application/json",
  };

  const projectId = service.vercel_project_id;
  const teamQuery = teamId ? `?teamId=${teamId}` : "";

  // Get existing env vars
  const existingRes = await fetch(
    `${VERCEL_API}/v10/projects/${projectId}/env${teamQuery}`,
    { headers },
  );

  if (!existingRes.ok) {
    return NextResponse.json(
      { error: "Failed to fetch Vercel env vars" },
      { status: 502 },
    );
  }

  const existing = (await existingRes.json()) as {
    envs?: Array<{ key: string; id: string }>;
  };
  const existingMap = new Map(
    (existing.envs ?? []).map((e) => [e.key, e.id]),
  );

  const results: Array<{ key: string; action: string; success: boolean }> = [];

  for (const [key, value] of Object.entries(d.env_vars)) {
    const envId = existingMap.get(key);

    if (envId) {
      const res = await fetch(
        `${VERCEL_API}/v10/projects/${projectId}/env/${envId}${teamQuery}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ value, target: [d.target] }),
        },
      );
      results.push({ key, action: "updated", success: res.ok });
    } else {
      const res = await fetch(
        `${VERCEL_API}/v10/projects/${projectId}/env${teamQuery}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            key,
            value,
            type: "encrypted",
            target: [d.target],
          }),
        },
      );
      results.push({ key, action: "created", success: res.ok });
    }
  }

  // Optional: trigger redeploy
  if (d.redeploy) {
    await fetch(`${VERCEL_API}/v13/deployments${teamQuery}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: service.name,
        project: projectId,
        target: d.target,
      }),
    });
  }

  await logPlatformAction(
    auth.adminId,
    "sync_env",
    "service_config",
    service.service_id,
    { slug, target: d.target, keys: Object.keys(d.env_vars), redeploy: d.redeploy },
  );

  return NextResponse.json({ results });
}
