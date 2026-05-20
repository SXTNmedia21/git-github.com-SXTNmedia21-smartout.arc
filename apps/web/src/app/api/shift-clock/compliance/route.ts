import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

let _serviceClient: ReturnType<typeof createServiceClient> | null = null;
function getServiceClient() {
  if (_serviceClient) return _serviceClient;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  _serviceClient = createServiceClient(url, key);
  return _serviceClient;
}

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const service = getServiceClient();
    const { data, error } = await service.functions.invoke("shift-clock-compliance", { body });

    if (error) {
      console.error("[api/shift-clock/compliance] Edge error:", error);
      const detail =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error !== null && "message" in error
            ? String((error as { message: unknown }).message)
            : String(error);
      return NextResponse.json({ error: `Compliance check failed: ${detail}` }, { status: 502 });
    }
    return NextResponse.json(data ?? { ok: true });
  } catch (err) {
    console.error("[api/shift-clock/compliance] Route error:", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Route error: ${detail}` }, { status: 400 });
  }
}
