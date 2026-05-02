/**
 * route.ts — POST /auth/logout
 *
 * Signs the accountant out and redirects to /auth/login.
 * POST-only to prevent accidental GET-triggered signouts (CSRF mitigation).
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const { origin } = new URL(request.url);
  return NextResponse.redirect(new URL("/auth/login", origin));
}
