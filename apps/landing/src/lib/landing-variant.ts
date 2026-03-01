export type LandingVariant = "B" | "E";

const DEFAULT_VARIANT: LandingVariant = "B";
const STORAGE_KEY = "landing_variant";

function isValidVariant(v: string | null | undefined): v is LandingVariant {
  return v === "B" || v === "E";
}

/** Returns the env-var-based variant (safe for SSR). */
export function getEnvVariant(): LandingVariant {
  const envVal = process.env.NEXT_PUBLIC_LANDING_VARIANT;
  return isValidVariant(envVal) ? envVal : DEFAULT_VARIANT;
}

/**
 * Returns the dev override variant from query param or localStorage.
 * Client-only. Returns null in production or on server.
 */
export function getDevOverride(): LandingVariant | null {
  if (typeof window === "undefined") return null;
  if (process.env.NODE_ENV !== "development") return null;

  const params = new URLSearchParams(window.location.search);
  const qp = params.get("variant");
  if (isValidVariant(qp)) {
    localStorage.setItem(STORAGE_KEY, qp);
    return qp;
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  if (isValidVariant(stored)) return stored;

  return null;
}
