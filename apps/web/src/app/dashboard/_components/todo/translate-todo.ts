/**
 * Translates cascade task i18n keys from the RPC format to the dashboard.json structure.
 *
 * The RPC returns keys like "dashboard.todo.dept_missing_hours" but the JSON
 * namespace is "dashboard" with nested objects like todo.dept_missing_hours.
 * Group labels use "dashboard.todo.group.X" → maps to "todo_group.X".
 * Descriptions use "dashboard.todo.desc.X" → maps to "todo.X_desc".
 *
 * Also handles {{var}} interpolation format used in the JSON translations.
 */

/**
 * Transforms an RPC i18n key to match the dashboard.json nesting structure.
 * Strips the "dashboard." namespace prefix and remaps desc/group segments.
 */
export function resolveKey(rawKey: string): string {
  const key = rawKey.startsWith("dashboard.") ? rawKey.slice(10) : rawKey;

  const descMatch = key.match(/^todo\.desc\.(.+)$/);
  if (descMatch) return `todo.${descMatch[1]}_desc`;

  const groupMatch = key.match(/^todo\.group\.(.+)$/);
  if (groupMatch) return `todo_group.${groupMatch[1]}`;

  return key;
}

/**
 * Interpolates both {{var}} and {var} parameter formats in a translated string.
 */
export function interpolateParams(str: string, params?: Record<string, string> | null): string {
  if (!params) return str;
  let result = str;
  for (const [k, v] of Object.entries(params)) {
    result = result.replaceAll(`{{${k}}}`, v);
    result = result.replaceAll(`{${k}}`, v);
  }
  return result;
}
