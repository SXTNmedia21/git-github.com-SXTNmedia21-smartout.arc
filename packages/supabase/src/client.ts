import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

declare const window: { location: { hostname: string } } | undefined;

function getCookieDomain(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") return undefined;
  // Vercel preview deploys: cookies must be set without explicit domain so
  // the browser scopes them to the *.vercel.app host (mirrors middleware.ts).
  if (hostname.endsWith(".vercel.app")) return undefined;
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  return rootDomain && rootDomain !== "localhost" ? `.${rootDomain}` : undefined;
}

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        domain: getCookieDomain(),
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
    },
  );
}
