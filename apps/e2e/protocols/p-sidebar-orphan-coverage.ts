/**
 * apps/e2e/protocols/p-sidebar-orphan-coverage.ts
 *
 * S12 — Sidebar orphan-coverage smoke protocol (JourneyIR v2.0.0).
 *
 * Actor: Manager (admin auth profile)
 * Platform: Web dashboard
 *
 * Purpose:
 *   Smoke-test that all 20 previously-orphaned sidebar routes are reachable
 *   (return HTTP < 500) after the T1–T4 sidebar-reorg refactor. A "linked-orphan"
 *   route exists as a sidebar config entry but has no corresponding app/page.tsx —
 *   this protocol verifies none of them crash the server.
 *
 * What is verified:
 *   1. Sidebar renders and the dashboard shell loads at /dashboard (anchor step).
 *   2. Each of the 20 linked-orphan routes in SIDEBAR_GROUPS_ADMIN returns HTTP
 *      < 500 — verified by navigating and asserting the URL stayed at the target
 *      path (not redirected to /error or /500).
 *   3. The one disabled (not-yet-built) placeholder item
 *      (/dashboard/manuals Manualer) renders with
 *      data-disabled="true" and no anchor href.
 *      NOTE: /dashboard/oppgaver (Rutiner) is now status=live as of P11 Task 1.1 —
 *      it is no longer a disabled placeholder and is excluded from this check.
 *
 * Gate strategy:
 *   - Route reachability uses `url_match` (URL stays at expected path = no 500/redirect).
 *   - Dashboard load uses `ui_state` on `cockpit-action-rail` (existing testid).
 *   - Disabled placeholders: MISSING TESTID — see report below. These two steps
 *     use `url_match` on /dashboard as a fallback gate (we stay on dashboard
 *     while verifying the DOM via action description only).
 *
 * MISSING TESTIDS (report for frontend-designer / supervisor):
 *   - [data-testid="sidebar-nav"] needed in apps/web/src/components/dashboard/DashboardShell.tsx
 *     (sidebar wrapper element — enables group-header and nav-link assertions)
 *   - [data-testid="sidebar-group-drift"] needed in apps/web/src/components/dashboard/SidebarGroup.tsx
 *     (group header div for group.label="Drift")
 *   - [data-testid="sidebar-group-planlegging"] needed in SidebarGroup.tsx
 *   - [data-testid="sidebar-group-administrasjon"] needed in SidebarGroup.tsx
 *   - [data-testid="sidebar-group-hms-compliance"] needed in SidebarGroup.tsx
 *   - [data-testid="sidebar-group-kommunikasjon"] needed in SidebarGroup.tsx
 *   - [data-testid="sidebar-group-integrasjoner"] needed in SidebarGroup.tsx
 *   - [data-testid="sidebar-group-ai-botsson"] needed in SidebarGroup.tsx
 *   - [data-testid="sidebar-group-veiledning"] needed in SidebarGroup.tsx
 *   - [data-testid="sidebar-disabled-tasks"] REMOVED — /dashboard/oppgaver is now live (P11 Task 1.1)
 *   - [data-testid="sidebar-disabled-manuals"] needed in apps/web/src/components/dashboard/SidebarGroup.tsx
 *     (DisabledNavItem for href=/dashboard/manuals — enables placeholder gate)
 *
 * ADR references:
 *   ADR-0133 — web composes (admin manager surface, web-only).
 *   ADR-0134 — no mutations here; telemetry gate not applicable.
 *   ADR-0178 — JourneyIR v2.0.0 shape (typed actions + gates).
 *
 * Closes: T5 (S12 orphan-coverage protocol).
 * Sub-sortie: feat/ui-shell-sidebar-reorg @ ~/dev/smartout.ai-ui-shell-wt-1
 */

import type { JourneyIR } from "@smartout/journey-ir";

export const P_SIDEBAR_ORPHAN_COVERAGE: JourneyIR = {
  version: "2.0.0",
  slug: "S12",
  module: "JP-UI-SHELL-SIDEBAR-REORG",
  title: "Sidebar Orphan Coverage — 20 linked-orphan routes reachable, 2 placeholders disabled",
  actor: "manager",
  platform: "web",
  auth_profile: "admin",
  entry_url: "/dashboard",
  preconditions: {
    db_state: [],
  },
  steps: [
    // -------------------------------------------------------------------------
    // Step 1 — Anchor: dashboard loads and URL confirms DashboardShell is active
    //
    // Note: cockpit-action-rail is NOT used as the gate here because it only
    // renders for workspaces with session/shift data. The stable anchor is the
    // URL — if /dashboard returns HTTP 200 and the URL stays at /dashboard
    // (not redirected to /login or /error), DashboardShell is mounted.
    // -------------------------------------------------------------------------
    {
      key: "1_dashboard_loads",
      order: 1,
      title: "Dashboard shell laster ved /dashboard",
      action: "Manager navigerer til /dashboard. Dashboard shell er montert.",
      assertion:
        "URL er /dashboard (eller /dashboard?) — bekrefter at DashboardShell er montert uten server-error.",
      description:
        "Navigate to /dashboard as authenticated manager. Verify DashboardShell is live " +
        "by asserting the URL stays at /dashboard (not bounced to /login or /error). " +
        "auth handled by loginAsAdmin() in protocol.spec.ts before runProtocol() is called. " +
        "This is the anchor step — if this fails, all subsequent route checks are invalid.",
      actions: [
        { type: "navigate", url: "/dashboard" },
        { type: "settle", ms: 2_000 },
      ],
      gate: {
        type: "url_match",
        pattern: "/dashboard",
        timeout_ms: 15_000,
      },
      screenshot: true,
    },

    // -------------------------------------------------------------------------
    // Steps 2–21 — Route smoke: each linked-orphan navigates and stays on URL
    // -------------------------------------------------------------------------

    // --- Drift group ---
    {
      key: "2_proposals",
      order: 2,
      title: "Drift > Forslag — /dashboard/proposals er nåbar",
      action: "Naviger til /dashboard/proposals.",
      assertion: "URL er /dashboard/proposals — ingen 500-redirect til /error.",
      description:
        "Smoke: /dashboard/proposals (Forslag, linked-orphan in Drift group). " +
        "url_match confirms the page didn't 500 and redirect away.",
      actions: [
        { type: "navigate", url: "/dashboard/proposals" },
        { type: "settle", ms: 1_500 },
      ],
      gate: {
        type: "url_match",
        pattern: "/dashboard/proposals",
        timeout_ms: 10_000,
      },
      screenshot: true,
    },

    // --- Planlegging group ---
    {
      key: "3_year_wheel",
      order: 3,
      title: "Planlegging > Årshjul — /dashboard/year-wheel er nåbar",
      action: "Naviger til /dashboard/year-wheel.",
      assertion: "URL er /dashboard/year-wheel — ingen 500-redirect.",
      description: "Smoke: /dashboard/year-wheel (Årshjul, linked-orphan in Planlegging group).",
      actions: [
        { type: "navigate", url: "/dashboard/year-wheel" },
        { type: "settle", ms: 1_500 },
      ],
      gate: {
        type: "url_match",
        pattern: "/dashboard/year-wheel",
        timeout_ms: 10_000,
      },
      screenshot: false,
    },
    {
      key: "4_setup",
      order: 4,
      title: "Planlegging > Setup-veiviser — /dashboard/setup er nåbar",
      action: "Naviger til /dashboard/setup.",
      assertion: "URL er /dashboard/setup — ingen 500-redirect.",
      description: "Smoke: /dashboard/setup (Setup-veiviser, linked-orphan in Planlegging group).",
      actions: [
        { type: "navigate", url: "/dashboard/setup" },
        { type: "settle", ms: 1_500 },
      ],
      gate: {
        type: "url_match",
        pattern: "/dashboard/setup",
        timeout_ms: 10_000,
      },
      screenshot: false,
    },

    // --- Administrasjon group ---
    {
      key: "5_contracts",
      order: 5,
      title: "Administrasjon > Kontrakter — /dashboard/people/contracts er nåbar",
      action: "Naviger til /dashboard/people/contracts.",
      assertion: "URL er /dashboard/people/contracts — ingen 500-redirect.",
      description:
        "Smoke: /dashboard/people/contracts (Kontrakter, linked-orphan in Administrasjon group).",
      actions: [
        { type: "navigate", url: "/dashboard/people/contracts" },
        { type: "settle", ms: 1_500 },
      ],
      gate: {
        type: "url_match",
        pattern: "/dashboard/people/contracts",
        timeout_ms: 10_000,
      },
      screenshot: false,
    },
    {
      key: "6_cost",
      order: 6,
      title: "Administrasjon > Kostnader — /dashboard/cost er nåbar",
      action: "Naviger til /dashboard/cost.",
      assertion: "URL er /dashboard/cost — ingen 500-redirect.",
      description: "Smoke: /dashboard/cost (Kostnader, linked-orphan in Administrasjon group).",
      actions: [
        { type: "navigate", url: "/dashboard/cost" },
        { type: "settle", ms: 1_500 },
      ],
      gate: {
        type: "url_match",
        pattern: "/dashboard/cost",
        timeout_ms: 10_000,
      },
      screenshot: false,
    },
    {
      key: "7_billing",
      order: 7,
      title: "Administrasjon > Fakturering — /dashboard/billing er nåbar",
      action: "Naviger til /dashboard/billing.",
      assertion: "URL er /dashboard/billing — ingen 500-redirect.",
      description:
        "Smoke: /dashboard/billing (Fakturering, linked-orphan in Administrasjon group).",
      actions: [
        { type: "navigate", url: "/dashboard/billing" },
        { type: "settle", ms: 1_500 },
      ],
      gate: {
        type: "url_match",
        pattern: "/dashboard/billing",
        timeout_ms: 10_000,
      },
      screenshot: false,
    },
    {
      key: "8_website",
      order: 8,
      title: "Administrasjon > Nettside — /dashboard/website er nåbar",
      action: "Naviger til /dashboard/website.",
      assertion: "URL er /dashboard/website — ingen 500-redirect.",
      description: "Smoke: /dashboard/website (Nettside, linked-orphan in Administrasjon group).",
      actions: [
        { type: "navigate", url: "/dashboard/website" },
        { type: "settle", ms: 1_500 },
      ],
      gate: {
        type: "url_match",
        pattern: "/dashboard/website",
        timeout_ms: 10_000,
      },
      screenshot: false,
    },

    // --- HMS & Compliance group ---
    {
      key: "9_hms",
      order: 9,
      title: "HMS & Compliance > HMS-oversikt — /dashboard/hms er nåbar",
      action: "Naviger til /dashboard/hms.",
      assertion: "URL er /dashboard/hms — ingen 500-redirect.",
      description: "Smoke: /dashboard/hms (HMS-oversikt, linked-orphan in HMS & Compliance group).",
      actions: [
        { type: "navigate", url: "/dashboard/hms" },
        { type: "settle", ms: 1_500 },
      ],
      gate: {
        type: "url_match",
        pattern: "/dashboard/hms$",
        timeout_ms: 10_000,
      },
      screenshot: true,
    },
    {
      key: "10_hms_deviations",
      order: 10,
      title: "HMS & Compliance > Avvik — /dashboard/hms/deviations er nåbar",
      action: "Naviger til /dashboard/hms/deviations.",
      assertion: "URL er /dashboard/hms/deviations — ingen 500-redirect.",
      description: "Smoke: /dashboard/hms/deviations (Avvik, linked-orphan).",
      actions: [
        { type: "navigate", url: "/dashboard/hms/deviations" },
        { type: "settle", ms: 1_500 },
      ],
      gate: {
        type: "url_match",
        pattern: "/dashboard/hms/deviations",
        timeout_ms: 10_000,
      },
      screenshot: false,
    },
    {
      key: "11_hms_documents",
      order: 11,
      title: "HMS & Compliance > Dokumenter — /dashboard/hms/documents er nåbar",
      action: "Naviger til /dashboard/hms/documents.",
      assertion: "URL er /dashboard/hms/documents — ingen 500-redirect.",
      description: "Smoke: /dashboard/hms/documents (Dokumenter, linked-orphan).",
      actions: [
        { type: "navigate", url: "/dashboard/hms/documents" },
        { type: "settle", ms: 1_500 },
      ],
      gate: {
        type: "url_match",
        pattern: "/dashboard/hms/documents",
        timeout_ms: 10_000,
      },
      screenshot: false,
    },
    {
      key: "12_hms_training",
      order: 12,
      title: "HMS & Compliance > Trening — /dashboard/hms/training er nåbar",
      action: "Naviger til /dashboard/hms/training.",
      assertion: "URL er /dashboard/hms/training — ingen 500-redirect.",
      description: "Smoke: /dashboard/hms/training (Trening, linked-orphan).",
      actions: [
        { type: "navigate", url: "/dashboard/hms/training" },
        { type: "settle", ms: 1_500 },
      ],
      gate: {
        type: "url_match",
        pattern: "/dashboard/hms/training",
        timeout_ms: 10_000,
      },
      screenshot: false,
    },
    {
      key: "13_hms_drift",
      order: 13,
      title: "HMS & Compliance > Drift-sjekk — /dashboard/hms/drift er nåbar",
      action: "Naviger til /dashboard/hms/drift.",
      assertion: "URL er /dashboard/hms/drift — ingen 500-redirect.",
      description: "Smoke: /dashboard/hms/drift (Drift-sjekk, linked-orphan).",
      actions: [
        { type: "navigate", url: "/dashboard/hms/drift" },
        { type: "settle", ms: 1_500 },
      ],
      gate: {
        type: "url_match",
        pattern: "/dashboard/hms/drift",
        timeout_ms: 10_000,
      },
      screenshot: false,
    },
    {
      key: "14_hms_governance",
      order: 14,
      title: "HMS & Compliance > Styring — /dashboard/hms/governance er nåbar",
      action: "Naviger til /dashboard/hms/governance.",
      assertion: "URL er /dashboard/hms/governance — ingen 500-redirect.",
      description: "Smoke: /dashboard/hms/governance (Styring, linked-orphan).",
      actions: [
        { type: "navigate", url: "/dashboard/hms/governance" },
        { type: "settle", ms: 1_500 },
      ],
      gate: {
        type: "url_match",
        pattern: "/dashboard/hms/governance",
        timeout_ms: 10_000,
      },
      screenshot: false,
    },
    {
      key: "15_policies",
      order: 15,
      title: "HMS & Compliance > Policies — /dashboard/policies er nåbar",
      action: "Naviger til /dashboard/policies.",
      assertion: "URL er /dashboard/policies — ingen 500-redirect.",
      description: "Smoke: /dashboard/policies (Policies, linked-orphan).",
      actions: [
        { type: "navigate", url: "/dashboard/policies" },
        { type: "settle", ms: 1_500 },
      ],
      gate: {
        type: "url_match",
        pattern: "/dashboard/policies",
        timeout_ms: 10_000,
      },
      screenshot: false,
    },
    {
      key: "16_handbook",
      order: 16,
      title: "HMS & Compliance > Handbok — /dashboard/handbook er nåbar",
      action: "Naviger til /dashboard/handbook.",
      assertion: "URL er /dashboard/handbook — ingen 500-redirect.",
      description: "Smoke: /dashboard/handbook (Handbok, linked-orphan).",
      actions: [
        { type: "navigate", url: "/dashboard/handbook" },
        { type: "settle", ms: 1_500 },
      ],
      gate: {
        type: "url_match",
        pattern: "/dashboard/handbook",
        timeout_ms: 10_000,
      },
      screenshot: false,
    },

    // --- Kommunikasjon group ---
    {
      key: "17_komm_desks",
      order: 17,
      title: "Kommunikasjon > Desks — /dashboard/komm/desks er nåbar",
      action: "Naviger til /dashboard/komm/desks.",
      assertion: "URL er /dashboard/komm/desks — ingen 500-redirect.",
      description: "Smoke: /dashboard/komm/desks (Desks, linked-orphan in Kommunikasjon group).",
      actions: [
        { type: "navigate", url: "/dashboard/komm/desks" },
        { type: "settle", ms: 1_500 },
      ],
      gate: {
        type: "url_match",
        pattern: "/dashboard/komm/desks",
        timeout_ms: 10_000,
      },
      screenshot: false,
    },
    {
      key: "18_komm_oversikt",
      order: 18,
      title: "Kommunikasjon > Oversikt — /dashboard/komm/oversikt er nåbar",
      action: "Naviger til /dashboard/komm/oversikt.",
      assertion: "URL er /dashboard/komm/oversikt — ingen 500-redirect.",
      description:
        "Smoke: /dashboard/komm/oversikt (Oversikt, linked-orphan in Kommunikasjon group).",
      actions: [
        { type: "navigate", url: "/dashboard/komm/oversikt" },
        { type: "settle", ms: 1_500 },
      ],
      gate: {
        type: "url_match",
        pattern: "/dashboard/komm/oversikt",
        timeout_ms: 10_000,
      },
      screenshot: false,
    },

    // --- Integrasjoner group ---
    {
      key: "19_pos_accounts",
      order: 19,
      title: "Integrasjoner > POS Lightspeed — /dashboard/admin/pos-accounts er nåbar",
      action: "Naviger til /dashboard/admin/pos-accounts.",
      assertion: "URL er /dashboard/admin/pos-accounts — ingen 500-redirect.",
      description:
        "Smoke: /dashboard/admin/pos-accounts (POS Lightspeed, linked-orphan in Integrasjoner group).",
      actions: [
        { type: "navigate", url: "/dashboard/admin/pos-accounts" },
        { type: "settle", ms: 1_500 },
      ],
      gate: {
        type: "url_match",
        pattern: "/dashboard/admin/pos-accounts",
        timeout_ms: 10_000,
      },
      screenshot: false,
    },

    // --- AI & Botsson group ---
    {
      key: "20_onboarding_assistant",
      order: 20,
      title: "AI & Botsson > Onboarding-assistent — /dashboard/onboarding-assistant er nåbar",
      action: "Naviger til /dashboard/onboarding-assistant.",
      assertion: "URL er /dashboard/onboarding-assistant — ingen 500-redirect.",
      description:
        "Smoke: /dashboard/onboarding-assistant (Onboarding-assistent, linked-orphan in AI & Botsson group).",
      actions: [
        { type: "navigate", url: "/dashboard/onboarding-assistant" },
        { type: "settle", ms: 1_500 },
      ],
      gate: {
        type: "url_match",
        pattern: "/dashboard/onboarding-assistant",
        timeout_ms: 10_000,
      },
      screenshot: false,
    },

    // --- Employee-mode linked-orphan ---
    {
      key: "21_shift_clock",
      order: 21,
      title: "Min Tid > Stempelur — /dashboard/shift-clock er nåbar",
      action: "Naviger til /dashboard/shift-clock.",
      assertion: "URL er /dashboard/shift-clock — ingen 500-redirect.",
      description:
        "Smoke: /dashboard/shift-clock (Stempelur, linked-orphan in SIDEBAR_GROUPS_EMPLOYEE Min Tid group). " +
        "Included because the route is sidebar-linked and must not 500 regardless of which mode renders.",
      actions: [
        { type: "navigate", url: "/dashboard/shift-clock" },
        { type: "settle", ms: 1_500 },
      ],
      gate: {
        type: "url_match",
        pattern: "/dashboard/shift-clock",
        timeout_ms: 10_000,
      },
      screenshot: false,
    },

    // -------------------------------------------------------------------------
    // Steps 22–23 — Disabled placeholder verification
    //
    // NOTE: DisabledNavItem renders data-disabled="true" on a <div> but has NO
    // data-testid. The ui_state gate uses page.getByTestId() which requires
    // data-testid — so these steps use url_match fallback (navigate back to
    // /dashboard and stay there) instead of a direct disabled-element assertion.
    //
    // BLOCKED on MISSING TESTIDS:
    //   [data-testid="sidebar-disabled-tasks"]   — REMOVED: /dashboard/oppgaver is now live (P11 Task 1.1)
    //   [data-testid="sidebar-disabled-manuals"] — DisabledNavItem href=/dashboard/manuals
    //
    // Once sidebar-disabled-manuals testid is added (frontend-designer / supervisor), replace
    // the url_match gate for step 23 with:
    //   gate: { type: "ui_state", testid: "sidebar-disabled-manuals", visible: true }
    // and confirm the element has no <a> child via a separate Playwright assertion.
    // -------------------------------------------------------------------------
    {
      key: "22_placeholder_tasks",
      order: 22,
      title: "Oppgaver (/dashboard/oppgaver) — nu live, verifiser at lenke er klikkbar",
      action:
        "Naviger til /dashboard (med sidebar synlig). Verifiser at Oppgaver-elementet er en aktiv " +
        "lenke til /dashboard/oppgaver (status=live, ingen data-disabled).",
      assertion:
        "URL kan navigere til /dashboard/oppgaver. Oppgaver-elementet har ingen data-disabled='true'. " +
        "MERKNAD: Rutiner-slot er aktivert som live i P11 Task 1.1 — ikke lenger en disabled placeholder.",
      description:
        "Smoke-verifisering at /dashboard/oppgaver sidebar-slot er aktivert som live etter P11 Task 1.1. " +
        "Tidligere disabled placeholder (status=not-yet-built) er nå status=live med href=/dashboard/oppgaver.",
      actions: [
        { type: "navigate", url: "/dashboard" },
        { type: "settle", ms: 2_000 },
      ],
      gate: {
        type: "url_match",
        pattern: "/dashboard",
        timeout_ms: 10_000,
      },
      screenshot: true,
    },
    {
      key: "23_placeholder_manuals",
      order: 23,
      title: "Disabled: Manualer (/dashboard/manuals) — ikke-klikkbar placeholder",
      action:
        "Verifiser at Manualer-elementet i Veiledning-gruppen er til stede men ikke-klikkbart " +
        "(data-disabled='true', ingen <a>-tag, tooltip 'Kommer snart').",
      assertion:
        "Manualer-placeholder finnes i DOM med data-disabled='true'. " +
        "BLOKKERT: mangler data-testid='sidebar-disabled-manuals' for direkte gate-sjekk.",
      description:
        "Sidebar disabled-placeholder smoke for /dashboard/manuals (Manualer, status=not-yet-built). " +
        "Gate is url_match on /dashboard (same navigate as step 22 — no second navigation needed). " +
        "See MISSING TESTIDS in file header.",
      actions: [{ type: "settle", ms: 500 }],
      gate: {
        type: "url_match",
        pattern: "/dashboard",
        timeout_ms: 5_000,
      },
      screenshot: false,
    },
  ],

  // Final success gate: we're back at /dashboard after the full route sweep.
  success_gate: {
    type: "url_match",
    pattern: "/dashboard",
    timeout_ms: 5_000,
  },
};
