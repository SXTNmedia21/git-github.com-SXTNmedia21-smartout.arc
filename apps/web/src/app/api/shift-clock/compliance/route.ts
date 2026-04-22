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
      return NextResponse.json({ error: "Compliance check failed" }, { status: 502 });
    }
    return NextResponse.json(data ?? { ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
