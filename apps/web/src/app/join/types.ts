/**
 * JoinState — unified state shape for the Join wizard.
 *
 * Each step has its own substate (account, business, about, hours, menu,
 * createAccount, team). Scrape/intelligence data lives alongside but is
 * managed by JoinScrapingProvider, not WizardShell.
 */

import type {
  Step1Data,
  Step2Data,
  Step3Data,
  Step4Data,
  Step5Data,
  Step6Data,
} from "./_lib/validation";

// ── Step substates (partial during wizard, validated on step exit) ──

export interface JoinState extends Record<string, unknown> {
  /** Step 1 — Account: email, company name, industry, city, website */
  account: Partial<Step1Data>;

  /** Step 2 — Business: contact person, address, org number */
  business: Partial<Step2Data>;

  /** Step 3 — About: company description, history, concept */
  about: Partial<Step3Data>;

  /** Step 4 — Hours: opening hours, phone, social links */
  hours: Partial<Step4Data>;

  /** Step 5 — Menu: restaurant type, cuisine, price category */
  menu: Partial<Step5Data>;

  /** Step 6 — Create Account: password + auth signup */
  createAccount: Partial<Step6Data>;

  /** Step 7 — Team: employee count, invites (optional post-signup) */
  team: Partial<Step6Data>;

  /** Scrape job ID for tracking async website scraping */
  scrapeJobId: string | null;

  /** Intelligence data extracted from scraping + BRREG enrichment */
  intelligence: Record<string, unknown> | null;
}

export const defaultJoinState: JoinState = {
  account: {},
  business: {},
  about: {},
  hours: {},
  menu: {},
  createAccount: {},
  team: {},
  scrapeJobId: null,
  intelligence: null,
};

/** localStorage key — matches the existing wizard key for migration continuity */
export const JOIN_STORAGE_KEY = "smartout_signup_wizard";

/** Maximum age of a persisted wizard envelope before it is considered stale and purged. */
export const JOIN_STORAGE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Envelope schema version. Increment when the StorageEnvelope shape changes to
 * force a clean purge of incompatible legacy entries.
 */
export const JOIN_STORAGE_SCHEMA_VERSION = 1;
