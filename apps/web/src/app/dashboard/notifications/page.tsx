import { redirect } from "next/navigation";

/**
 * /dashboard/notifications — Redirects to canonical Varsler tab (SM-5).
 *
 * The notification feed moved to /dashboard/komm/varsler to live inside
 * the Kommunikasjon umbrella per canonical spec §3 + §5.2. This redirect
 * preserves any saved bookmarks, push-notification action_url values, and
 * bell-overlay "Se alle →" links that pre-date SM-5.
 *
 * The full notification feed component is now at:
 *   apps/web/src/app/dashboard/komm/varsler/_components/VarslerClient.tsx
 *
 * 307 Temporary: signals routing alias. A future cleanup sortie can
 * permanently delete this file once all notification action_url rows in DB
 * have been migrated to the new path (separate sortie, separate migration).
 */
export default function NotificationsRedirect() {
  redirect("/dashboard/komm/varsler");
}
