import type { Mapping, FieldObservation, DiffResult } from "./mapping.js";

/**
 * Pure diff between a stored mapping and a fresh field observation.
 *
 * - newFields: fields present in `obs` but not in `mapping.field_map`
 * - disappearedFields: fields present in `mapping.field_map` but not in `obs`
 * - typeChanges: fields present in both, where the set of value types differs
 */
export function diff(mapping: Mapping, obs: FieldObservation): DiffResult {
  const mappingKeys = Object.keys(mapping.field_map);
  const obsKeys = Object.keys(obs.fields);

  const mappingKeySet = new Set(mappingKeys);
  const obsKeySet = new Set(obsKeys);

  const newFields: string[] = [];
  for (const key of obsKeys) {
    if (!mappingKeySet.has(key)) newFields.push(key);
  }
  newFields.sort();

  const disappearedFields: string[] = [];
  for (const key of mappingKeys) {
    if (!obsKeySet.has(key)) disappearedFields.push(key);
  }
  disappearedFields.sort();

  const typeChanges: DiffResult["typeChanges"] = [];
  for (const key of mappingKeys) {
    if (!obsKeySet.has(key)) continue;
    const before = [...mapping.field_map[key].source_value_types].sort();
    const after = [...obs.fields[key].valueTypes].sort();
    if (!sameStringArray(before, after)) {
      typeChanges.push({ field: key, before, after });
    }
  }
  typeChanges.sort((a, b) => a.field.localeCompare(b.field));

  return { newFields, disappearedFields, typeChanges };
}

function sameStringArray(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
