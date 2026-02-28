/**
 * Resolves external URLs pointing to the web app (dashboard).
 * Falls back to the production web app URL when NEXT_PUBLIC_WEB_APP_URL is not set.
 * Never returns a relative path — always an absolute URL.
 */

const PRODUCTION_WEB_APP_URL = "https://app.smartout.ai";

function getWebAppOrigin(): string {
  const envUrl = process.env.NEXT_PUBLIC_WEB_APP_URL;
  if (envUrl) return envUrl.replace(/\/+$/, ""); // trim trailing slashes
  return PRODUCTION_WEB_APP_URL;
}

export function webAppUrl(path: string): string {
  const origin = getWebAppOrigin();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${normalizedPath}`;
}

// Pre-built common destinations
export const WEB_APP_LINKS = {
  onboarding: webAppUrl("/onboarding"),
  login: webAppUrl("/login"),
  dashboard: webAppUrl("/dashboard"),
} as const;
