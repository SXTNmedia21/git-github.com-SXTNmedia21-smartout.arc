/**
 * page.tsx — / (root)
 *
 * Redirect to /workspaces. Middleware already gates auth;
 * this page is just a fast server-side bounce.
 */
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/workspaces");
}
