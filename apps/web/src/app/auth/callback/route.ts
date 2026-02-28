import { createClient } from "@smartout/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    } else {
      console.error("Auth callback error:", error);
      // Fallback redirect with error query param could go here
    }
  }

  // Redirect to error or login if no code or error processing
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
