import { strikeUuid } from "./uuid.js";
import { slugify } from "./staging.js";

const NULLISH = (v: unknown): boolean =>
  v === null || v === undefined || v === "";

export function applyTransform(name: string | null, value: unknown): unknown {
  if (name === null || name === undefined) return value;

  // FK transforms have parameterized names
  if (name.startsWith("fk_uuid:")) {
    const entity = name.slice("fk_uuid:".length);
    if (NULLISH(value)) return null;
    if (typeof value !== "string") {
      throw new Error(`fk_uuid:${entity} expected string Bubble ID, got ${typeof value}`);
    }
    return strikeUuid(entity, value);
  }

  if (name.startsWith("fk_uuid_array:")) {
    const entity = name.slice("fk_uuid_array:".length);
    if (NULLISH(value)) return null;
    if (!Array.isArray(value)) {
      throw new Error(`fk_uuid_array:${entity} expected array, got ${typeof value}`);
    }
    if (value.length === 0) return null;
    return value.map((item) => {
      if (typeof item !== "string") {
        throw new Error(`fk_uuid_array:${entity} expected array of strings, got ${typeof item} at element`);
      }
      return strikeUuid(entity, item);
    });
  }

  switch (name) {
    case "trim":
      return typeof value === "string" ? value.trim() : value;
    case "lowercase":
      return typeof value === "string" ? value.toLowerCase() : value;
    case "uppercase":
      return typeof value === "string" ? value.toUpperCase() : value;
    case "bubble_date_to_tstz":
      // Bubble already returns ISO 8601 strings; passthrough is correct.
      // null/undefined → null
      return NULLISH(value) ? null : value;
    case "nullable":
      return NULLISH(value) ? null : value;
    case "slugify":
      // Used by derived_columns to produce v3 slug from a name/title source.
      // Implementation lives in staging.ts (already used by legacy migrate_*
      // tools) — keeping a single source of truth.
      if (NULLISH(value)) return null;
      if (typeof value !== "string") {
        throw new Error(`slugify expected string, got ${typeof value}`);
      }
      return slugify(value);
    case "iso_to_date":
      // Datetime or date string → YYYY-MM-DD (DATE column).
      // Accepts two formats from Bubble:
      //   - ISO 8601 datetime: "2024-06-12T17:00:00.000Z" → "2024-06-12"
      //   - Dot-separated date: "2024.06.12" → "2024-06-12"
      // The dot format appears on salary_transaction "4. Date" in live Bubble API.
      if (NULLISH(value)) return null;
      if (typeof value !== "string") {
        throw new Error(`iso_to_date expected string, got ${typeof value}`);
      }
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
      if (/^\d{4}\.\d{2}\.\d{2}$/.test(value)) return value.replace(/\./g, "-");
      throw new Error(`iso_to_date got unrecognized format: "${value.slice(0, 30)}"`);
    case "iso_to_time":
      // ISO 8601 datetime string → HH:MM:SS (TIME column).
      // Same use case as iso_to_date but extracts the time component.
      // Strips fractional seconds + timezone (TIME WITHOUT TIME ZONE in v3).
      if (NULLISH(value)) return null;
      if (typeof value !== "string") {
        throw new Error(`iso_to_time expected ISO string, got ${typeof value}`);
      }
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
        throw new Error(`iso_to_time got non-ISO string: "${value.slice(0, 30)}"`);
      }
      // chars 11..18 = HH:MM:SS
      return value.slice(11, 19);
    case "seconds_to_hours":
      // Numeric seconds → hours rounded to 2 decimals (NUMERIC(4,2)).
      // For schedule_shift.work_hours where Bubble stores durationsSeconds.
      if (NULLISH(value)) return null;
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`seconds_to_hours expected finite number, got ${typeof value}`);
      }
      return Math.round((value / 3600) * 100) / 100;
    case "profile_code_from_id":
      // Q3 verdict (2026-04-16): profile_code = "EMP-" + first 8 chars of
      // the deterministic uuidv5("profile", bubble_id). Readable, sortable,
      // collision-resistant (16^8 = 4.3B possible suffixes for ~135 profiles).
      // Used by derived_columns: profile_code from _id.
      if (NULLISH(value)) return null;
      if (typeof value !== "string") {
        throw new Error(`profile_code_from_id expected string Bubble ID, got ${typeof value}`);
      }
      return `EMP-${strikeUuid("profile", value).slice(0, 8)}`;
    case "email_from_auth":
      // Bubble's User type stores the email at authentication.email.email
      // (the outer "email" identifies the auth method, the inner "email"
      // holds the address). ADR-0006.
      // Returns null for any missing-key case so user_identity rows without
      // an email trigger the auth-bridge failure path explicitly.
      if (NULLISH(value)) return null;
      if (typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`email_from_auth expected object, got ${typeof value}`);
      }
      {
        const auth = value as Record<string, unknown>;
        const emailObj = auth.email;
        if (NULLISH(emailObj) || typeof emailObj !== "object" || Array.isArray(emailObj)) return null;
        const inner = (emailObj as Record<string, unknown>).email;
        return typeof inner === "string" && inner.length > 0 ? inner : null;
      }
    default:
      throw new Error(`Unknown transform: ${name}`);
  }
}
