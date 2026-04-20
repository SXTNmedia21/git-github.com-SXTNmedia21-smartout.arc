import { Suspense } from "react";
import { CloseOutFlow } from "./_components/CloseOutFlow";
import CloseLoading from "./loading";

/**
 * /dashboard/close — Server Component shell.
 *
 * No server-side data fetch yet; the client island owns department
 * lookup + reconciliation state via TanStack Query against the
 * workspace resolved from DashboardContext. Suspense boundary keeps
 * the skeleton wired in consistently with the people/ reference
 * per ADR-0115.
 */
export default function CloseOutPage() {
  return (
    <Suspense fallback={<CloseLoading />}>
      <CloseOutFlow />
    </Suspense>
  );
}
