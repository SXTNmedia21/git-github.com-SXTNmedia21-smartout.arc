/**
 * apps/web/src/app/dashboard/admin/pos-accounts/loading.tsx
 *
 * Streaming skeleton for /dashboard/admin/pos-accounts.
 * Shown by Next.js App Router while page.tsx's async data fetch resolves.
 *
 * Shape mirrors the real page: header + 3 account row pulses.
 */

export default function PosAccountsLoading() {
  return (
    <div
      className="flex-1 overflow-y-auto px-4 pt-8 pb-20 md:px-10"
      role="status"
      aria-live="polite"
      aria-label="Laster POS-tilkoblinger"
    >
      {/* Page header pulse */}
      <div className="bg-muted mb-6 h-8 w-64 animate-pulse rounded-lg" />

      {/* Account row pulses */}
      <div className="flex flex-col gap-3">
        <div className="bg-muted h-16 w-full animate-pulse rounded-lg" />
        <div className="bg-muted h-16 w-full animate-pulse rounded-lg" />
        <div className="bg-muted h-16 w-full animate-pulse rounded-lg" />
      </div>
    </div>
  );
}
