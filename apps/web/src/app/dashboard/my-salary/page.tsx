import { Suspense } from "react";
import { MySalaryPageClient } from "./_components/my-salary-page-client";
import MySalaryLoading from "./loading";

/**
 * /dashboard/my-salary — Server Component shell.
 * Single Suspense boundary wrapping a single client boundary per ADR-0115.
 * Data is fetched client-side via `useMySalary` (auth.getUser() scoped).
 */
export default function MySalaryPage() {
  return (
    <Suspense fallback={<MySalaryLoading />}>
      <MySalaryPageClient />
    </Suspense>
  );
}
