import { NextResponse, type NextRequest } from "next/server";
import { requireGodmode, logPlatformAction } from "@/lib/platform-admin";
import { invalidateServiceConfig } from "@smartout/supabase/service-config";

type RouteContext = { params: Promise<{ slug: string }> };

// TODO: Remove once service_config migration is applied and types regenerated
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const svcTable = (client: any) => client.from("service_config") as any;

/** GET /api/platform-admin/services/config/[slug] — Get single service */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const auth = await requireGodmode();
  if (auth.error) return auth.error;

  const { slug } = await params;

  const { data, error } = await svcTable(auth.admin).select("*").eq("slug", slug).single();

  if (error || !data) return NextResponse.json({ error: "Service not found" }, { status: 404 });

  return NextResponse.json({ data });
}

/** PATCH /api/platform-admin/services/config/[slug] — Update service config */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await requireGodmode();
  if (auth.error) return auth.error;

  const { slug } = await params;
  const body = await request.json();

  // Verify service exists
  const { data: existing } = await svcTable(auth.admin)
    .select("service_id")
    .eq("slug", slug)
    .single();

  if (!existing) return NextResponse.json({ error: "Service not found" }, { status: 404 });

  // Don't allow changing slug or service_id
  delete body.service_id;
  delete body.slug;
  delete body.created_at;

  const { data, error } = await svcTable(auth.admin)
    .update(body)
    .eq("slug", slug)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logPlatformAction(auth.adminId, "update_service", "service_config", existing.service_id, {
    slug,
    fields: Object.keys(body),
  });

  await invalidateServiceConfig(slug);
  return NextResponse.json({ data });
}

/** DELETE /api/platform-admin/services/config/[slug] — Remove service */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const auth = await requireGodmode();
  if (auth.error) return auth.error;

  const { slug } = await params;

  const { data: existing } = await svcTable(auth.admin)
    .select("service_id")
    .eq("slug", slug)
    .single();

  if (!existing) return NextResponse.json({ error: "Service not found" }, { status: 404 });

  const { error } = await svcTable(auth.admin).delete().eq("slug", slug);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logPlatformAction(auth.adminId, "delete_service", "service_config", existing.service_id, {
    slug,
  });

  await invalidateServiceConfig(slug);
  return NextResponse.json({ success: true });
}
