import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: channelId } = await params;
  const body = await req.json();

  const { data, error } = await supabase.functions.invoke("livekit-token", {
    body: { channelId, ...body },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }

  return NextResponse.json(data);
}
