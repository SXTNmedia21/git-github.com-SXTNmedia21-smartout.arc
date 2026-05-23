// 2B step 1: mobile sends a storage_path; we mint a service-role signed URL and
// forward it to the stage-engine vision route. Identity from JWT (ADR-0151).
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { resolveMobileActor } from "../../_shared/actor";
import { createAdminClient } from "@smartout/supabase/admin";

const STAGE_ENGINE_URL = process.env.STAGE_ENGINE_URL ?? "http://localhost:5010";
const STAGE_ENGINE_API_KEY = process.env.STAGE_ENGINE_API_KEY;
const BodySchema = z.object({ storage_path: z.string().min(1) }).strict();

export async function POST(request: NextRequest | Request): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const actor = await resolveMobileActor(token);
  if (!actor || !actor.workspaceId || !actor.profileId) {
    return NextResponse.json({ ok: false, error: "Ugyldig aktørkontekst" }, { status: 403 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: "Ugyldig forespørsel" }, { status: 422 });
  }

  if (!body.storage_path.startsWith(`${actor.workspaceId}/`)) {
    return NextResponse.json({ ok: false, error: "path_wrong_workspace" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: signed, error: signErr } = await admin.storage
    .from("routine-source")
    .createSignedUrl(body.storage_path, 300);
  if (signErr || !signed?.signedUrl) {
    return NextResponse.json({ ok: false, error: "signed_url_failed" }, { status: 500 });
  }

  // Server-to-server call: authenticate to the stage-engine with the platform
  // API key (its auth middleware requires x-api-key or a user JWT). This is a
  // stateless transform — identity is already enforced above (ADR-0151).
  const engineHeaders: Record<string, string> = { "content-type": "application/json" };
  if (STAGE_ENGINE_API_KEY) engineHeaders["x-api-key"] = STAGE_ENGINE_API_KEY;

  const res = await fetch(`${STAGE_ENGINE_URL}/routine/extract`, {
    method: "POST",
    headers: engineHeaders,
    body: JSON.stringify({ image_url: signed.signedUrl }),
  });
  const payload = (await res.json().catch(() => ({
    ok: false,
    error: "bad_engine_response",
  }))) as {
    ok?: boolean;
    draft?: unknown;
    error?: string;
  };
  if (!res.ok || payload.ok === false) {
    return NextResponse.json(
      { ok: false, error: payload.error ?? "extract_failed" },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, draft: payload.draft }, { status: 200 });
}
