// ============================================
// reports/page.tsx
// AI-driven custom report builder page entrypoint.
// Workspace/auth are resolved by dashboard layout, so this page only mounts
// the client shell without additional server-side auth/profile roundtrips.
// Connected to: _components/ReportsPageShell.tsx (client shell)
// ============================================

"use client";

import { ReportsPageShell } from "./_components/ReportsPageShell";

/**
 * Client route page for reports.
 * Why: dashboard layout already guarantees authenticated workspace context.
 * Returns: reports shell component.
 */
export default function ReportsPage() {
  return <ReportsPageShell />;
}
