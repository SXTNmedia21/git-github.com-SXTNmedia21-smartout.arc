import { NextResponse, type NextRequest } from "next/server";
import { requireGodmode, logPlatformAction } from "@/lib/platform-admin";
import { invalidateServiceConfig } from "@smartout/supabase/service-config";

type RouteContext = { params: Promise<{ slug: string }> };

// TODO: Remove once service_config migration is applied and types regenerated
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const svcTable = (client: any) => client.from("service_config") as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const svcLogTable = (client: any) => client.from("service_config_log") as any;

/** POST /api/platform-admin/services/config/[slug]/restart — Restart a Docker service */
export async function POST(_request: NextRequest, { params }: RouteContext) {
  const auth = await requireGodmode();
  if (auth.error) return auth.error;

  const { slug } = await params;

  const { data: service } = await svcTable(auth.admin)
    .select("service_id, type, docker_service_name")
    .eq("slug", slug)
    .single();

  if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 });

  if (service.type !== "docker" || !service.docker_service_name) {
    return NextResponse.json({ error: "Only Docker services can be restarted" }, { status: 400 });
  }

  const dockerHost = process.env.DOCKER_HOST;
  if (!dockerHost) {
    return NextResponse.json({ error: "DOCKER_HOST not configured" }, { status: 503 });
  }

  try {
    // Find container by name
    const listRes = await fetch(
      `${dockerHost}/containers/json?filters=${encodeURIComponent(
        JSON.stringify({ name: [service.docker_service_name] }),
      )}`,
    );

    if (!listRes.ok) {
      return NextResponse.json({ error: "Docker API unreachable" }, { status: 502 });
    }

    const containers = (await listRes.json()) as Array<{ Id: string }>;

    if (!containers.length) {
      return NextResponse.json({ error: "Container not found" }, { status: 404 });
    }

    const containerId = containers[0]!.Id;

    // Restart container
    const restartRes = await fetch(`${dockerHost}/containers/${containerId}/restart`, {
      method: "POST",
    });

    if (!restartRes.ok) {
      return NextResponse.json({ error: "Failed to restart container" }, { status: 502 });
    }

    // Log the restart
    await svcLogTable(auth.admin).insert({
      service_id: service.service_id,
      changed_by: auth.adminId,
      change_type: "restart" as const,
      field_name: "container",
      new_value: "restarted",
      applied: true,
      applied_at: new Date().toISOString(),
    });

    await logPlatformAction(auth.adminId, "restart_service", "service_config", service.service_id, {
      slug,
      containerId,
    });

    await invalidateServiceConfig(slug);

    return NextResponse.json({ success: true, containerId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Docker API error: ${msg}` }, { status: 502 });
  }
}
