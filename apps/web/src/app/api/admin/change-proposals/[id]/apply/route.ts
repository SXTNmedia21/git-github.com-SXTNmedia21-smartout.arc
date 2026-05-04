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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const service = getServiceClient();
    const { data, error } = await service.functions.invoke("apply-change-proposal", {
      body: { proposalId: id, ...body },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      console.error("[api/admin/change-proposals/apply] Edge error:", error);
      return NextResponse.json({ error: "Apply failed" }, { status: 502 });
    }

    return NextResponse.json(data ?? { ok: true });
  } catch (err) {
    console.error("[api/admin/change-proposals/apply] Exception:", err);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
