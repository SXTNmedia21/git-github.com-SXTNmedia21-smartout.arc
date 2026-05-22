/**
 * deep-link — single source of truth mapping a web-shaped notification
 * action_url (e.g. "/dashboard/my-schedule") to a mobile Expo Router route.
 *
 * Used by:
 *  - NotificationScreen (in-app bell tap)
 *  - app/dashboard/[...rest].tsx (OneSignal web-push url landing, ADR-0389)
 *
 * Returns null for the generic "/dashboard" and any unknown path — callers
 * decide the fallback (no-op for the bell, home for the catch-all route).
 */
export function mobileRouteForActionUrl(actionUrl: string): string | null {
  if (!actionUrl) return null;
  const [pathname] = actionUrl.split("?");
  const segments = pathname.split("/").filter(Boolean); // ["dashboard","komm","<id>"]
  if (segments[0] !== "dashboard") return null;

  const section = segments[1];
  switch (section) {
    case "komm":
      return segments[2] ? `/(app)/(me)/channel-detail/${segments[2]}` : null;
    case "shift-clock":
      return "/(app)/(home)/punch-clock";
    case "my-schedule":
    case "schedule":
      return "/(app)/(shifts)";
    case "operations":
    case "reconciliation":
      return "/(app)/(home)/operations";
    case "my-training":
      return "/(app)/(home)/training";
    case "contracts":
      return "/(app)/(me)/contract";
    case "people":
      return "/(app)/(home)/team";
    default:
      return null; // generic /dashboard or unknown
  }
}
