import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@smartout/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("landing_config")
    .select("slug, name, locale, published_json, published_at, version")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (error || !data || !data.published_json) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    slug: data.slug,
    name: data.name,
    locale: data.locale,
    content: data.published_json,
    version: data.version,
    published_at: data.published_at,
  });
}
