import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { z } from "zod";

const DispatchSchema = z.object({
  event_type: z.string().min(1),
  workspace_id: z.string().uuid(),
  payload: z.record(z.unknown()),
  idempotency_key: z.string().optional(),
});

let _serviceClient: ReturnType<typeof createServiceClient> | null = null;

function getServiceClient() {
  if (_serviceClient) return _serviceClient;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  _serviceClient = createServiceClient(url, key);
  return _serviceClient;
}

export async function POST(req: NextRequest) {
  try {
    // Verify caller has a valid session
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = DispatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }

    // Relay to engine-dispatch Edge Function with service role
    const service = getServiceClient();
    const { error } = await service.functions.invoke("engine-dispatch", {
      body: parsed.data,
    });

    if (error) {
      console.error("[api/engine-dispatch] Edge Function error:", error);
      return NextResponse.json({ error: "Dispatch failed" }, { status: 502 });
    }

    return NextResponse.json({ ok: true }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
