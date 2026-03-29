import type { ProtocolDefinition } from "./schema";

/**
 * P-001: Admin Onboarding
 *
 * Maps to: docs/Protokol/admin-onboarding-package/Journey.md
 * Actor: Owner (admin) creating a new workspace
 * Path: /login -> /onboarding -> (9 steps) -> /dashboard
 *
 * This protocol tests the MANUAL mode (not voice-assisted).
 * Each step has a control gate that must pass before advancing.
 *
 * NOTE: Many data-testid attributes referenced here do not yet exist
 * in the onboarding components. Running this protocol will identify
 * exactly which testids need to be added.
 */
export const P001_ADMIN_ONBOARDING: ProtocolDefinition = {
  id: "P-001",
  package_id: "JP-R001-ADMIN-ONBOARDING",
  name: "Admin Onboarding",
  actor: "owner",
  platform: "web",
  auth_profile: "admin",
  entry_url: "/login",
  preconditions: {
    db_state: [],
  },
  steps: [
    {
      id: "1_login",
      order: 1,
      title: "Innlogging",
      description: "Admin logger inn med e-post og passord. Systemet autentiserer brukeren.",
      actions: [
        { type: "navigate", url: "/login" },
        { type: "settle", ms: 1000 },
        { type: "fill", testid: "login-email", value: "{{auth.email}}" },
        { type: "fill", testid: "login-password", value: "{{auth.password}}" },
        { type: "click", testid: "login-submit" },
      ],
      gate: {
        type: "url_match",
        pattern: "/(dashboard|onboarding|setup|select-workspace)",
        timeout_ms: 15_000,
      },
      screenshot: true,
    },
    {
      id: "2_navigate_onboarding",
      order: 2,
      title: "Naviger til onboarding",
      description: "Systemet dirigerer til onboarding-flyten for nye workspaces.",
      actions: [
        { type: "navigate", url: "/onboarding" },
        { type: "settle", ms: 1500 },
      ],
      gate: {
        type: "url_match",
        pattern: "/onboarding",
        timeout_ms: 10_000,
      },
      screenshot: true,
    },
    {
      id: "3_hero_section",
      order: 3,
      title: "Velkomstskjerm",
      description:
        "Bruker ser velkomstskjermen med valg mellom assistert og manuelt oppsett. Velger manuelt.",
      actions: [
        { type: "wait_visible", testid: "onboarding-hero" },
        { type: "click", testid: "onboarding-manual-mode" },
      ],
      gate: {
        type: "ui_state",
        testid: "onboarding-step-business",
        visible: true,
        timeout_ms: 5_000,
      },
      screenshot: true,
    },
    {
      id: "4_business_info",
      order: 4,
      title: "Bedriftsinformasjon",
      description: "Admin fyller inn bedriftsnavn og by. Systemet soker i Bronnysund.",
      actions: [
        { type: "fill", testid: "input-company-name", value: "E2E Test Restaurant" },
        { type: "fill", testid: "input-company-city", value: "Oslo" },
        { type: "click", testid: "onboarding-search-company" },
        { type: "settle", ms: 3000 },
        { type: "click", testid: "onboarding-next-btn" },
      ],
      gate: {
        type: "ui_state",
        testid: "onboarding-step-season",
        visible: true,
        timeout_ms: 10_000,
      },
      screenshot: true,
    },
    {
      id: "5_season",
      order: 5,
      title: "Sesongoppsett",
      description: "System foreslaar sesong basert paa bransje. Admin bekrefter eller justerer.",
      actions: [
        { type: "wait_visible", testid: "onboarding-step-season" },
        { type: "click", testid: "onboarding-next-btn" },
      ],
      gate: {
        type: "ui_state",
        testid: "onboarding-step-departments",
        visible: true,
        timeout_ms: 5_000,
      },
      screenshot: true,
    },
    {
      id: "6_departments",
      order: 6,
      title: "Avdelinger",
      description: "System genererer bransjetilpassede avdelinger. Admin bekrefter.",
      actions: [
        { type: "wait_visible", testid: "onboarding-step-departments" },
        { type: "click", testid: "onboarding-next-btn" },
      ],
      gate: {
        type: "ui_state",
        testid: "onboarding-step-locations",
        visible: true,
        timeout_ms: 5_000,
      },
      screenshot: true,
    },
    {
      id: "7_locations",
      order: 7,
      title: "Lokasjoner og soner",
      description: "Admin bekrefter lokasjoner funnet via scraping eller legger til manuelt.",
      actions: [
        { type: "wait_visible", testid: "onboarding-step-locations" },
        { type: "click", testid: "onboarding-next-btn" },
      ],
      gate: {
        type: "ui_state",
        testid: "onboarding-step-procedures",
        visible: true,
        timeout_ms: 5_000,
      },
      screenshot: true,
    },
    {
      id: "8_procedures",
      order: 8,
      title: "Prosedyrer",
      description: "System foreslaar standard prosedyrer for bransjen. Admin bekrefter.",
      actions: [
        { type: "wait_visible", testid: "onboarding-step-procedures" },
        { type: "click", testid: "onboarding-next-btn" },
      ],
      gate: {
        type: "ui_state",
        testid: "onboarding-step-final",
        visible: true,
        timeout_ms: 5_000,
      },
      screenshot: true,
    },
    {
      id: "9_finalize",
      order: 9,
      title: "Ferdigstilling",
      description:
        "Admin aktiverer workspace. System oppretter alle entiteter og navigerer til dashboard.",
      actions: [
        { type: "wait_visible", testid: "onboarding-step-final" },
        { type: "click", testid: "onboarding-finalize-btn" },
        { type: "settle", ms: 3000 },
      ],
      gate: {
        type: "url_match",
        pattern: "/dashboard",
        timeout_ms: 30_000,
      },
      screenshot: true,
    },
  ],
  success_gate: {
    type: "url_match",
    pattern: "/dashboard",
    timeout_ms: 5_000,
  },
};
