/**
 * Cascade dimension classification for database entities.
 *
 * Maps every mutable entity to its cascade dimension (D1–D6) and mutation type.
 * Used by telemetry, permission checks, and the cascade pipeline to determine
 * how a write propagates through the system.
 */

/** The six cascade execution dimensions, or null for non-cascade entities. */
export type CascadeDimension = "D1" | "D2" | "D3" | "D4" | "D5" | "D6" | null;

/**
 * How a mutation interacts with the cascade pipeline:
 * - leaf: no cascade effect — write is terminal
 * - cascade-input: write triggers downstream recalculation
 * - governance: C4-gated, requires authority check before write
 * - content: website/CMS content, outside the cascade model entirely
 */
export type MutationType = "leaf" | "cascade-input" | "governance" | "content";

export type EntityClassification = {
  dimension: CascadeDimension;
  mutationType: MutationType;
};

/**
 * Canonical classification of every mutable entity.
 *
 * When adding a new table, register it here so telemetry, permissions,
 * and the cascade pipeline know how to handle writes to it.
 */
export const ENTITY_CLASSIFICATION: Record<string, EntityClassification> = {
  // ── Leaf entities (no cascade effect) ─────────────────────────────
  chat_message: { dimension: null, mutationType: "leaf" },
  channel_message: { dimension: null, mutationType: "leaf" },
  deviation: { dimension: null, mutationType: "leaf" },
  haccp_log: { dimension: null, mutationType: "leaf" },
  session_note: { dimension: null, mutationType: "leaf" },
  shift_approval: { dimension: null, mutationType: "leaf" },
  notification_preference: { dimension: null, mutationType: "leaf" },
  position: { dimension: null, mutationType: "leaf" },
  zone: { dimension: null, mutationType: "leaf" },
  asset: { dimension: null, mutationType: "leaf" },
  time_entry: { dimension: null, mutationType: "leaf" },
  schedule_absence: { dimension: null, mutationType: "leaf" },

  // ── Cascade-input entities (trigger downstream recalculation) ─────
  department: { dimension: "D1", mutationType: "cascade-input" },
  department_operating_hours: { dimension: "D1", mutationType: "cascade-input" },
  location: { dimension: "D1", mutationType: "cascade-input" },
  team: { dimension: "D2", mutationType: "cascade-input" },
  schedule_shift: { dimension: "D6", mutationType: "cascade-input" },
  season_budget: { dimension: "D4", mutationType: "cascade-input" },
  day_factor: { dimension: "D4", mutationType: "cascade-input" },
  hour_factor: { dimension: "D4", mutationType: "cascade-input" },
  public_holiday: { dimension: "D3", mutationType: "cascade-input" },

  // ── Governance entities (C4-gated) ────────────────────────────────
  employment_contract: { dimension: "D2", mutationType: "governance" },
  regulatory_framework: { dimension: "D3", mutationType: "governance" },
  framework_rule: { dimension: "D3", mutationType: "governance" },
  tariff_rate_table: { dimension: "D3", mutationType: "governance" },
  protocol: { dimension: null, mutationType: "governance" },

  // ── Content entities (CMS / website) ──────────────────────────────
  website_page: { dimension: null, mutationType: "content" },
  website_section: { dimension: null, mutationType: "content" },
  website_asset: { dimension: null, mutationType: "content" },
  website_menu: { dimension: null, mutationType: "content" },
  website_menu_category: { dimension: null, mutationType: "content" },
  website_menu_item: { dimension: null, mutationType: "content" },
} as const;

/** Look up classification for a given entity name. Returns undefined if unknown. */
export function getEntityClassification(entity: string): EntityClassification | undefined {
  return ENTITY_CLASSIFICATION[entity];
}

/** True when a write to this entity triggers cascade recalculation. */
export function isCascadeInput(entity: string): boolean {
  return ENTITY_CLASSIFICATION[entity]?.mutationType === "cascade-input";
}

/** True when a write to this entity requires C4 authority/governance check. */
export function isGovernanceGated(entity: string): boolean {
  return ENTITY_CLASSIFICATION[entity]?.mutationType === "governance";
}

/** True when this entity is CMS/website content (outside cascade model). */
export function isContentEntity(entity: string): boolean {
  return ENTITY_CLASSIFICATION[entity]?.mutationType === "content";
}
