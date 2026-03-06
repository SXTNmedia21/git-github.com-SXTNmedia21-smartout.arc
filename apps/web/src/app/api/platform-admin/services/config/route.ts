import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireGodmode, logPlatformAction } from "@/lib/platform-admin";

const CreateServiceSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  type: z.enum(["docker", "vercel", "edge-function", "external"]),
  description: z.string().max(500).optional(),
  host_url: z.string().url().optional(),
  health_endpoint: z.string().max(100).default("/health"),
  docker_service_name: z.string().max(100).optional(),
  docker_image: z.string().max(200).optional(),
  vercel_project_id: z.string().max(100).optional(),
  config: z.record(z.unknown()).default({}),
  env_schema: z
    .array(
      z.object({
        key: z.string(),
        required: z.boolean(),
        change_type: z.enum(["runtime", "restart"]),
        description: z.string(),
      }),
    )
    .default([]),
  vault_secrets: z.array(z.string()).default([]),
  port: z.number().int().min(1).max(65535).optional(),
  tags: z.array(z.string()).default([]),
  is_critical: z.boolean().default(false),
});

/** GET /api/platform-admin/services/config — List all service configs */
export async function GET() {
  const auth = await requireGodmode();
  if (auth.error) return auth.error;

  const { data, error } = await auth.admin
    .from("service_config")
    .select("*")
    .order("name");

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

/** POST /api/platform-admin/services/config — Create a new service config */
export async function POST(request: NextRequest) {
  const auth = await requireGodmode();
  if (auth.error) return auth.error;

  const body = CreateServiceSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json(
      { error: body.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const d = body.data;

  const { data, error } = await auth.admin
    .from("service_config")
    .insert({
      name: d.name,
      slug: d.slug,
      type: d.type,
      description: d.description ?? null,
      host_url: d.host_url ?? null,
      health_endpoint: d.health_endpoint,
      docker_service_name: d.docker_service_name ?? null,
      docker_image: d.docker_image ?? null,
      vercel_project_id: d.vercel_project_id ?? null,
      config: d.config,
      env_schema: d.env_schema,
      vault_secrets: d.vault_secrets,
      port: d.port ?? null,
      tags: d.tags,
      is_critical: d.is_critical,
    })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  await logPlatformAction(auth.adminId, "create_service", "service_config", data.service_id, {
    slug: d.slug,
    type: d.type,
  });

  return NextResponse.json({ data }, { status: 201 });
}
