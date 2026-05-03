// Suspense fallback intentionally null. The dashboard is a client-rendered
// route ("use client" page) that branches on `isAdminMode` after hydration —
// admin → WebDayControl, employee → EmployeeDashboard. A shared route-level
// skeleton can only match one branch and would flash the wrong shape for the
// other (~1s mismatched skeleton then snap to real content).
//
// Each view owns its own loading state internally so the skeleton always
// matches the layout that follows. See WebDayControl `LoadingState`.
export default function DashboardLoading() {
  return null;
}
