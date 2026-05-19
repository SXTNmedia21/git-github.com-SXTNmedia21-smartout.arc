import { redirect } from "next/navigation";

/**
 * /dashboard/komm/skranke — Norwegian-name alias for /dashboard/komm/desks (SM-5).
 *
 * "Skranke" (reception desk / front desk) is the canonical Norwegian tab label per
 * spec §3 + SM-5 decision 2026-05-19. The /desks route is kept intact to preserve
 * all existing deep-links (notification action_url values, ticket thread back-
 * navigation, Botsson tool references in site-map.json). This redirect is a
 * zero-breakage alias.
 *
 * 307 Temporary: signals this is a routing alias, not a permanent canonical URL
 * move. A future sortie can rename the folder and flip to 301 once all references
 * to /desks have been migrated.
 */
export default function SkrankeAlias() {
  redirect("/dashboard/komm/desks");
}
