/**
 * Prefix-based search mode parser for the global CmdK palette.
 *
 * Prefixes:
 *   ?  → knowledge (handbook, policies, protocols)
 *   @  → people (profiles, teams)
 *   >  → commands (navigation, actions)
 *   (none) → all modes
 */

export type SearchMode = "all" | "knowledge" | "people" | "commands";

export type ParsedQuery = {
  mode: SearchMode;
  query: string;
};

const PREFIX_MAP: Record<string, SearchMode> = {
  "?": "knowledge",
  "@": "people",
  ">": "commands",
};

export function parseSearchPrefix(raw: string): ParsedQuery {
  const trimmed = raw.trimStart();
  const firstChar = trimmed.charAt(0);
  const mode = PREFIX_MAP[firstChar];

  if (mode) {
    return { mode, query: trimmed.slice(1).trim() };
  }

  return { mode: "all", query: trimmed };
}
