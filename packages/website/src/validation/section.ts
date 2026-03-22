import type { SectionType } from "../constants";
import { SECTION_TYPES } from "../constants";
import { SECTION_SCHEMA_MAP } from "../sections/schemas";

/** Validates section content against the registered Zod schema for that type. */
export function validateSectionContent(
  type: string,
  content: unknown,
): { success: true; data: unknown } | { success: false; error: string } {
  if (!SECTION_TYPES.includes(type as SectionType)) {
    return { success: false, error: `Unknown section type: ${type}` };
  }

  const schema = SECTION_SCHEMA_MAP[type as SectionType];
  const result = schema.safeParse(content);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
  };
}
