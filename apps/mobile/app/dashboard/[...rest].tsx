/**
 * Catch-all for /dashboard/* — the landing target of OneSignal web-push deep
 * links (ADR-0389). The push `url` is web-shaped (e.g. /dashboard/my-schedule);
 * this route maps it to the real mobile screen and redirects. Unknown paths
 * fall back to home so a tap never dead-ends on +not-found.
 */
import { useEffect } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams, usePathname } from "expo-router";
import { mobileRouteForActionUrl } from "@/lib/deep-link";

export default function DashboardDeepLinkCatchAll() {
  const pathname = usePathname(); // e.g. "/dashboard/my-schedule"
  const params = useLocalSearchParams();

  const dateParam = typeof params.date === "string" ? params.date : null;

  useEffect(() => {
    const query = dateParam ? `?date=${dateParam}` : "";
    const target = mobileRouteForActionUrl(`${pathname}${query}`);
    router.replace((target ?? "/(app)/(home)") as never);
  }, [pathname, dateParam]);

  return <View />;
}
