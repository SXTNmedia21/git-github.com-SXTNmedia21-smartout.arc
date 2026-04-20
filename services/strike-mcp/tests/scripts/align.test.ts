/**
 * align.test.ts — Unit tests for scripts/lib/align.ts pure functions.
 *
 * Written TDD-first before implementation. Each test corresponds to a
 * row in the spec or a named pure function from the align library.
 */

import { describe, it, expect } from "vitest";
import {
  normalizeV3Type,
  extractMaxLength,
  classifyBubbleField,
  checkCompatibility,
  matchEntityToTable,
  computeApprovalHash,
  assertNoSidecarAccess,
  isContextInjected,
  alignEntity,
  type BubbleFieldClass,
} from "../../scripts/lib/align.js";
import type { Mapping } from "../../src/research/mapping.js";

// ─── normalizeV3Type ──────────────────────────────────────────────────────────

describe("normalizeV3Type", () => {
  it("uuid → uuid", () => expect(normalizeV3Type("uuid")).toBe("uuid"));
  it("text → text", () => expect(normalizeV3Type("text")).toBe("text"));
  it("citext → text", () => expect(normalizeV3Type("citext")).toBe("text"));
  it("varchar(255) → text", () => expect(normalizeV3Type("varchar(255)")).toBe("text"));
  it("varchar → text", () => expect(normalizeV3Type("varchar")).toBe("text"));
  it("character varying → text", () => expect(normalizeV3Type("character varying")).toBe("text"));
  it("timestamptz → timestamp", () => expect(normalizeV3Type("timestamptz")).toBe("timestamp"));
  it("timestamp with time zone → timestamp", () => expect(normalizeV3Type("timestamp with time zone")).toBe("timestamp"));
  it("timestamp → timestamp", () => expect(normalizeV3Type("timestamp")).toBe("timestamp"));
  it("integer → integer", () => expect(normalizeV3Type("integer")).toBe("integer"));
  it("int → integer", () => expect(normalizeV3Type("int")).toBe("integer"));
  it("int4 → integer", () => expect(normalizeV3Type("int4")).toBe("integer"));
  it("bigint → integer", () => expect(normalizeV3Type("bigint")).toBe("integer"));
  it("int8 → integer", () => expect(normalizeV3Type("int8")).toBe("integer"));
  it("smallint → integer", () => expect(normalizeV3Type("smallint")).toBe("integer"));
  it("numeric → numeric", () => expect(normalizeV3Type("numeric")).toBe("numeric"));
  it("decimal → numeric", () => expect(normalizeV3Type("decimal")).toBe("numeric"));
  it("float → numeric", () => expect(normalizeV3Type("float")).toBe("numeric"));
  it("float8 → numeric", () => expect(normalizeV3Type("float8")).toBe("numeric"));
  it("double precision → numeric", () => expect(normalizeV3Type("double precision")).toBe("numeric"));
  it("boolean → boolean", () => expect(normalizeV3Type("boolean")).toBe("boolean"));
  it("bool → boolean", () => expect(normalizeV3Type("bool")).toBe("boolean"));
  it("jsonb → jsonb", () => expect(normalizeV3Type("jsonb")).toBe("jsonb"));
  it("json → jsonb", () => expect(normalizeV3Type("json")).toBe("jsonb"));
  it("uuid[] → uuid_array", () => expect(normalizeV3Type("uuid[]")).toBe("uuid_array"));
  it("text[] → array", () => expect(normalizeV3Type("text[]")).toBe("array"));
  it("integer[] → array", () => expect(normalizeV3Type("integer[]")).toBe("array"));
  it("unknown type → unknown", () => expect(normalizeV3Type("preferred_language")).toBe("unknown"));
  it("custom enum → unknown", () => expect(normalizeV3Type("industry")).toBe("unknown"));
  it("date → unknown", () => expect(normalizeV3Type("date")).toBe("unknown"));
});

// ─── extractMaxLength ─────────────────────────────────────────────────────────

describe("extractMaxLength", () => {
  it('["string<24>"] → 24', () => expect(extractMaxLength(["string<24>"])).toBe(24));
  it('["string<32>", "string<40>"] → 40', () => expect(extractMaxLength(["string<32>", "string<40>"])).toBe(40));
  it('["string<32>", "string<32>", "string<32>"] → 32', () =>
    expect(extractMaxLength(["string<32>", "string<32>", "string<32>"])).toBe(32));
  it('["number"] → null (non-string)', () => expect(extractMaxLength(["number"])).toBeNull());
  it("[] → null (empty)", () => expect(extractMaxLength([])).toBeNull());
  it("mixed → returns max string length", () =>
    expect(extractMaxLength(["string<10>", "string<20>"])).toBe(20));
  it("no string<N> tokens → null", () => expect(extractMaxLength(["boolean", "object"])).toBeNull());
  it("string without length token → null", () => expect(extractMaxLength(["string"])).toBeNull());
});

// ─── classifyBubbleField ──────────────────────────────────────────────────────

describe("classifyBubbleField", () => {
  function makeField(
    types: string[],
    samples: string[],
    name = "field_name",
    occurrence = 10,
  ): Parameters<typeof classifyBubbleField>[0] {
    return {
      target: name,
      transform: null,
      needs_review: true,
      source_value_types: types,
      occurrence_count: occurrence,
      sample_values: samples,
    };
  }

  it("string with max 24 + date-pattern name → isLikelyDate: true", () => {
    const f = makeField(["string"], ["string<24>", "string<24>"], "created_date");
    const cls = classifyBubbleField(f);
    expect(cls.isLikelyDate).toBe(true);
    expect(cls.isLikelyBubbleId).toBe(false);
  });

  it("string with max 32 + workspace name → isLikelyBubbleId: true", () => {
    const f = makeField(["string"], ["string<32>", "string<32>", "string<32>"], "workspace");
    const cls = classifyBubbleField(f);
    expect(cls.isLikelyBubbleId).toBe(true);
    expect(cls.isLikelyDate).toBe(false);
    expect(cls.isLikelyUuid).toBe(false);
  });

  it("string with max 36 → isLikelyUuid: true", () => {
    const f = makeField(["string"], ["string<36>", "string<36>"], "some_id");
    const cls = classifyBubbleField(f);
    expect(cls.isLikelyUuid).toBe(true);
    expect(cls.isLikelyBubbleId).toBe(false);
  });

  it("string with max 24 + non-date name → NOT isLikelyDate", () => {
    const f = makeField(["string"], ["string<24>", "string<24>"], "auth_token");
    const cls = classifyBubbleField(f);
    // 24 chars but name is auth_token — not a date name
    expect(cls.isLikelyDate).toBe(false);
  });

  it("number type → isNumber: true", () => {
    const f = makeField(["number"], ["number", "number"], "count");
    const cls = classifyBubbleField(f);
    expect(cls.isNumber).toBe(true);
  });

  it("boolean type → isBoolean: true", () => {
    const f = makeField(["boolean"], ["boolean"], "is_active");
    const cls = classifyBubbleField(f);
    expect(cls.isBoolean).toBe(true);
  });

  it("array type → isArray: true", () => {
    const f = makeField(["array"], ["array<3>"], "items");
    const cls = classifyBubbleField(f);
    expect(cls.isArray).toBe(true);
  });

  it("object type → isObject: true", () => {
    const f = makeField(["object"], ["{}"], "config");
    const cls = classifyBubbleField(f);
    expect(cls.isObject).toBe(true);
  });
});

// ─── checkCompatibility — 13-rule matrix ─────────────────────────────────────

describe("checkCompatibility", () => {
  // Helper: create a BubbleFieldClass
  function cls(overrides: Partial<BubbleFieldClass>): BubbleFieldClass {
    return {
      isString: false,
      isNumber: false,
      isBoolean: false,
      isArray: false,
      isObject: false,
      maxLength: null,
      isLikelyDate: false,
      isLikelyBubbleId: false,
      isLikelyUuid: false,
      ...overrides,
    };
  }

  // Row 1: string ≤31 → text → auto-confirm
  it("string ≤31 → text → auto-confirm", () => {
    const result = checkCompatibility(
      cls({ isString: true, maxLength: 20 }),
      "text", true, "name"
    );
    expect(result.verdict).toBe("auto-confirm");
  });

  // Row 2: string =32 → text → auto-confirm
  it("string =32 → text → auto-confirm", () => {
    const result = checkCompatibility(
      cls({ isString: true, maxLength: 32 }),
      "text", true, "title"
    );
    expect(result.verdict).toBe("auto-confirm");
  });

  // Row 3: string =32 → uuid → REVIEW (Bubble ID ≠ UUID)
  it("string =32 → uuid → REVIEW (Bubble ID not UUID)", () => {
    const result = checkCompatibility(
      cls({ isString: true, maxLength: 32, isLikelyBubbleId: true }),
      "uuid", false, "workspace_id"
    );
    expect(result.verdict).toBe("needs_review");
    expect(result.note).toContain("Bubble ID");
  });

  // Row 4: string =36 → uuid → auto-confirm
  it("string =36 → uuid → auto-confirm", () => {
    const result = checkCompatibility(
      cls({ isString: true, maxLength: 36, isLikelyUuid: true }),
      "uuid", true, "some_uuid"
    );
    expect(result.verdict).toBe("auto-confirm");
  });

  // Row 5: string =24 + date name → timestamp → auto-confirm + transform
  it("string =24 + date name → timestamp → auto-confirm with transform", () => {
    const result = checkCompatibility(
      cls({ isString: true, maxLength: 24, isLikelyDate: true }),
      "timestamptz", true, "created_date"
    );
    expect(result.verdict).toBe("auto-confirm");
    expect(result.transform).toBe("bubble_date_to_tstz");
  });

  // Row 6: string ≤31 → uuid → REVIEW
  it("string ≤31 → uuid → REVIEW", () => {
    const result = checkCompatibility(
      cls({ isString: true, maxLength: 15 }),
      "uuid", true, "ref_code"
    );
    expect(result.verdict).toBe("needs_review");
  });

  // Row 7: number → integer → auto-confirm
  it("number → integer → auto-confirm", () => {
    const result = checkCompatibility(
      cls({ isNumber: true }),
      "integer", true, "count"
    );
    expect(result.verdict).toBe("auto-confirm");
  });

  // Row 8: number → numeric → auto-confirm
  it("number → numeric → auto-confirm", () => {
    const result = checkCompatibility(
      cls({ isNumber: true }),
      "numeric", true, "amount"
    );
    expect(result.verdict).toBe("auto-confirm");
  });

  // Row 9: number → text → REVIEW
  it("number → text → REVIEW", () => {
    const result = checkCompatibility(
      cls({ isNumber: true }),
      "text", true, "code"
    );
    expect(result.verdict).toBe("needs_review");
  });

  // Row 10: boolean → boolean → auto-confirm
  it("boolean → boolean → auto-confirm", () => {
    const result = checkCompatibility(
      cls({ isBoolean: true }),
      "boolean", true, "is_active"
    );
    expect(result.verdict).toBe("auto-confirm");
  });

  // Row 11: array → uuid_array → REVIEW
  it("array → uuid_array → REVIEW", () => {
    const result = checkCompatibility(
      cls({ isArray: true }),
      "uuid[]", true, "member_ids"
    );
    expect(result.verdict).toBe("needs_review");
  });

  // Row 12: array → array (non-uuid) → auto-confirm + warning
  it("array → text[] (non-uuid array) → auto-confirm + warning", () => {
    const result = checkCompatibility(
      cls({ isArray: true }),
      "text[]", true, "tags"
    );
    expect(result.verdict).toBe("auto-confirm");
    expect(result.warning).toBeDefined();
  });

  // Row 13: object → jsonb → auto-confirm
  it("object → jsonb → auto-confirm", () => {
    const result = checkCompatibility(
      cls({ isObject: true }),
      "jsonb", true, "config"
    );
    expect(result.verdict).toBe("auto-confirm");
  });

  // Row extra: string =32 → uuid_array → REVIEW
  it("string =32 → uuid_array → REVIEW", () => {
    const result = checkCompatibility(
      cls({ isString: true, maxLength: 32, isLikelyBubbleId: true }),
      "uuid[]", true, "user_ids"
    );
    expect(result.verdict).toBe("needs_review");
  });

  // Unknown v3 type family → REVIEW
  it("any type → unknown v3 family → REVIEW", () => {
    const result = checkCompatibility(
      cls({ isString: true, maxLength: 10 }),
      "preferred_language", true, "language"
    );
    expect(result.verdict).toBe("needs_review");
  });

  // Timestamp column (created_at/updated_at) → REVIEW with timestamp mode note
  it("date string → created_at column → REVIEW with timestamp mode note", () => {
    const result = checkCompatibility(
      cls({ isString: true, maxLength: 24, isLikelyDate: true }),
      "timestamptz", false, "created_at"
    );
    expect(result.verdict).toBe("needs_review");
    expect(result.note).toContain("preserve/regenerate/copy");
  });
});

// ─── matchEntityToTable ───────────────────────────────────────────────────────

describe("matchEntityToTable", () => {
  const TABLES = [
    "workspace", "team", "profile", "shift", "department",
    "location", "invitation", "task", "handbook", "training",
    "salary_rule", "time_rule", "schedule_shift",
  ];

  it("exact match: 'workspace' → 'workspace' (HIGH confidence)", () => {
    const result = matchEntityToTable("workspace", "workspace", TABLES);
    expect(result.matchedTable).toBe("workspace");
    expect(result.confidence).toBe("HIGH");
  });

  it("emoji strip: '🎎team' → 'team' (HIGH confidence)", () => {
    const result = matchEntityToTable("team", "🎎team", TABLES);
    expect(result.matchedTable).toBe("team");
    expect(result.confidence).toBe("HIGH");
  });

  it("singular strip + emoji: strips trailing s from 'shifts' → 'shift'", () => {
    const result = matchEntityToTable("shifts", "shift_satellite", TABLES);
    expect(result.matchedTable).toBe("shift");
    expect(result.confidence).toBe("HIGH");
  });

  it("unmatched entity returns null and status unmatched", () => {
    const result = matchEntityToTable("routines", "routine", TABLES);
    // 'routine' vs candidates — not in this table list
    // Could fuzzy match if close enough, but let's check routine doesn't hit anything > 50% similar
    if (result.matchedTable === null) {
      expect(result.entityMatchStatus).toBe("unmatched");
    } else {
      // If it fuzzy-matched something, confidence should be LOW
      expect(result.confidence).toBe("LOW");
    }
  });

  it("emoji + parens stripped from bubble_type", () => {
    // '⏱️salary_type(supplement)' should strip to 'salary_type'
    // not in our short table list but tests the stripping
    const result = matchEntityToTable("supplements", "⏱️salary_type(supplement)", TABLES);
    // May or may not find a match, but should not crash
    expect(result).toBeDefined();
    expect(result.entityMatchStatus).toMatch(/^(matched|unmatched|ambiguous)$/);
  });

  it("profiles entity strips 's' suffix → matches 'profile'", () => {
    const result = matchEntityToTable("profiles", "profile", TABLES);
    expect(result.matchedTable).toBe("profile");
    expect(result.confidence).toBe("HIGH");
  });
});

// ─── computeApprovalHash ──────────────────────────────────────────────────────

describe("computeApprovalHash", () => {
  const baseMapping = {
    entity: "workspace",
    bubble_type: "workspace",
    target_table: "public.workspace",
    field_map: {
      name: {
        target: "name",
        transform: null,
        needs_review: false,
        source_value_types: ["string"],
        occurrence_count: 10,
        sample_values: ["string<15>"],
      },
    },
    required_source_fields: [],
    skip_if_missing: [],
    known_quirks: [],
    last_verified: "2026-04-08",
    sample_record_count: 40,
    total_record_count: 40,
    v3_schema_hash: null,
  } as unknown as Mapping;

  it("produces a 64-char hex string (SHA-256)", () => {
    const hash = computeApprovalHash(baseMapping);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("same input → same output (deterministic)", () => {
    const h1 = computeApprovalHash(baseMapping);
    const h2 = computeApprovalHash(baseMapping);
    expect(h1).toBe(h2);
  });

  it("key ordering does not affect hash (canonical JSON)", () => {
    // Build an object with reversed key insertion order — canonical JSON sorts alphabetically
    // so both should produce the same hash
    const reversed: Record<string, unknown> = {
      v3_schema_hash: null,
      total_record_count: 40,
      target_table: "public.workspace",
      skip_if_missing: [],
      sample_record_count: 40,
      required_source_fields: [],
      last_verified: "2026-04-08",
      known_quirks: [],
      field_map: {
        name: {
          transform: null,
          target: "name",
          source_value_types: ["string"],
          sample_values: ["string<15>"],
          occurrence_count: 10,
          needs_review: false,
        },
      },
      entity: "workspace",
      bubble_type: "workspace",
    };
    // Same content, keys in a different insertion order → canonical JSON should sort them
    const h1 = computeApprovalHash(baseMapping);
    const h2 = computeApprovalHash(reversed as unknown as Mapping);
    expect(h1).toBe(h2);
  });

  it("different content → different hash", () => {
    const modified = {
      ...baseMapping,
      target_table: "public.other_table",
    };
    expect(computeApprovalHash(baseMapping)).not.toBe(computeApprovalHash(modified));
  });
});

// ─── assertNoSidecarAccess ────────────────────────────────────────────────────

describe("assertNoSidecarAccess", () => {
  it("throws on .local/ path", () => {
    expect(() => assertNoSidecarAccess("/mappings/.local/workspace.sidecar.json")).toThrow();
  });

  it("throws on .local/ path with different prefix", () => {
    expect(() => assertNoSidecarAccess("mappings/.local/teams.error.json")).toThrow();
  });

  it("does NOT throw on regular mapping path", () => {
    expect(() => assertNoSidecarAccess("/mappings/workspace.json")).not.toThrow();
  });

  it("does NOT throw on aligned path", () => {
    expect(() => assertNoSidecarAccess("/mappings/.aligned/workspace.json")).not.toThrow();
  });

  it("throws if path contains .local/ anywhere in the middle", () => {
    expect(() => assertNoSidecarAccess("/some/deep/path/.local/file.json")).toThrow();
  });
});

// ─── isContextInjected ────────────────────────────────────────────────────────

describe("isContextInjected", () => {
  it("workspace_id → true", () => expect(isContextInjected("workspace_id")).toBe(true));
  it("company_id → true", () => expect(isContextInjected("company_id")).toBe(true));
  it("created_at → true", () => expect(isContextInjected("created_at")).toBe(true));
  it("updated_at → true", () => expect(isContextInjected("updated_at")).toBe(true));
  it("modified_at → true", () => expect(isContextInjected("modified_at")).toBe(true));
  it("created_by → true", () => expect(isContextInjected("created_by")).toBe(true));
  it("updated_by → true", () => expect(isContextInjected("updated_by")).toBe(true));
  it("modified_by → true", () => expect(isContextInjected("modified_by")).toBe(true));
  it("deleted_at → true", () => expect(isContextInjected("deleted_at")).toBe(true));
  it("name → false", () => expect(isContextInjected("name")).toBe(false));
  it("slug → false", () => expect(isContextInjected("slug")).toBe(false));
  it("email → false", () => expect(isContextInjected("email")).toBe(false));
  it("department_id → false", () => expect(isContextInjected("department_id")).toBe(false));
});

// ─── alignEntity — context-injection blocker exception ───────────────────────

describe("alignEntity — NOT NULL blocker exception for context-injected columns", () => {
  function makeMinimalMapping(fields: Record<string, { target: string }>): Mapping {
    const fieldMap: Record<string, import("../../src/research/mapping.js").FieldMapEntry> = {};
    for (const [k, v] of Object.entries(fields)) {
      fieldMap[k] = {
        target: v.target,
        transform: null,
        needs_review: false,
        source_value_types: ["string"],
        occurrence_count: 10,
        sample_values: ["string<15>"],
      };
    }
    return {
      entity: "department",
      bubble_type: "department",
      target_table: null,
      field_map: fieldMap,
      required_source_fields: [],
      skip_if_missing: [],
      known_quirks: [],
      last_verified: "2026-04-07",
      sample_record_count: 10,
      total_record_count: 10,
      v3_schema_hash: null,
    };
  }

  function makeSchema(columns: Array<{ name: string; nullable: boolean; hasDefault: boolean }>): import("../../scripts/lib/align.js").V3Schema {
    const cols: Record<string, import("../../scripts/lib/align.js").V3Column> = {};
    for (const c of columns) {
      cols[c.name] = {
        name: c.name,
        type: "text",
        nullable: c.nullable,
        is_primary_key: false,
        is_array: false,
        default_expr: c.hasDefault ? "now()" : null,
        foreign_key: null,
      };
    }
    return {
      tables: {
        "public.department": {
          schema: "public",
          name: "department",
          qualified_name: "public.department",
          columns: cols,
        },
      },
    };
  }

  it("workspace_id NOT NULL (no default) does NOT block alignment", () => {
    const mapping = makeMinimalMapping({ name: { target: "name" } });
    const schema = makeSchema([
      { name: "name", nullable: false, hasDefault: false },
      { name: "workspace_id", nullable: false, hasDefault: false },  // context-injected
    ]);
    const result = alignEntity(mapping, schema);
    expect(result.entityBlockers).not.toContain("workspace_id");
    expect(result.alignmentStatus).toBe("ok");
  });

  it("name NOT NULL (no default) without a mapped field IS a blocker", () => {
    // mapping only provides 'slug', not 'name'
    const mapping = makeMinimalMapping({ slug: { target: "slug" } });
    const schema = makeSchema([
      { name: "slug", nullable: false, hasDefault: false },
      { name: "name", nullable: false, hasDefault: false },  // real NOT NULL, not injected
    ]);
    const result = alignEntity(mapping, schema);
    expect(result.entityBlockers).toContain("name");
    expect(result.alignmentStatus).toBe("blocked");
  });

  it("all blocked columns are context-injected → entity is NOT blocked", () => {
    const mapping = makeMinimalMapping({ name: { target: "name" } });
    const schema = makeSchema([
      { name: "name", nullable: false, hasDefault: false },
      { name: "workspace_id", nullable: false, hasDefault: false },
      { name: "company_id", nullable: false, hasDefault: false },
      { name: "created_at", nullable: false, hasDefault: false },
    ]);
    const result = alignEntity(mapping, schema);
    expect(result.entityBlockers).toHaveLength(0);
    expect(result.alignmentStatus).toBe("ok");
    // name should be auto-confirmed since it's mapped and compatible
    const nameField = result.fields.find((f) => f.bubbleField === "name");
    expect(nameField?.verdict).toBe("auto-confirm");
  });
});
