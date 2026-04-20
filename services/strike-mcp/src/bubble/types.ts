/**
 * A raw record from the Bubble Data API. Fields are sparse — two records of the
 * same type will have DIFFERENT key sets depending on which fields are populated
 * on each individual record. See bubble-salary-mcp skill, Iron Rule 1.
 *
 * Keys are DISPLAY NAMES (from the Bubble UI), not schema field IDs. They may
 * contain spaces, dots, emojis, and 🟢 markers. See Iron Rule 2.
 */
export type BubbleRecord = Record<string, unknown> & { _id: string };

/**
 * Response shape from `GET /api/1.1/obj/<type>`.
 */
export interface BubbleListResponse {
  response: {
    results: BubbleRecord[];
    cursor: number;
    count: number;
    remaining: number;
  };
}

/**
 * Response shape from `GET /api/1.1/meta`.
 * The meta endpoint returns schema for every type in the app.
 */
export interface BubbleMetaResponse {
  get: Record<string, BubbleTypeMeta>;
  post: Record<string, BubbleTypeMeta>;
}

export interface BubbleTypeMeta {
  fields: Record<string, BubbleFieldMeta>;
}

export interface BubbleFieldMeta {
  display: string;
  type: string;
}

/**
 * A constraint for the Bubble Data API `constraints` query parameter.
 * NOTE: Server-side filtering is unreliable on Bubble. Always verify results
 * client-side. See bubble-salary-mcp skill.
 */
export interface BubbleConstraint {
  key: string;
  constraint_type:
    | "equals"
    | "not equal"
    | "is_empty"
    | "is_not_empty"
    | "text contains"
    | "greater than"
    | "less than";
  value?: string | number | boolean | null;
}
