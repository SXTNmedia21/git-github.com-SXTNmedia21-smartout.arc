/**
 * drift-utils — Phase 4 drift observability helpers.
 *
 * Drift is computed lazily at render time against the already-fetched K1a
 * template list (no cron, no background job per council 2026-04-22 Q7).
 * A workspace template "drifts" when its `source_template_version` is older
 * than the current system (K1a) template's `version`.
 *
 * Version-compare algorithm:
 *  - `contract_template.version` is `number | null` (Postgres integer).
 *  - `contract_template.source_template_version` is `string | null`
 *    (the stringified integer recorded at fork time).
 *  - Phase 4 uses numeric comparison — parse the string to integer and compare
 *    against the current number. If either side fails to parse we treat it as
 *    "no drift" to avoid false positives (source-of-truth is the number).
 *  - A semver-style comparator belongs to Phase 5 when K1a templates start
 *    minor/patch versioning (`2.1.3` etc.); today K1a bumps are whole numbers.
 */

export type DriftTemplate = {
  template_id: string;
  workspace_id?: string | null;
  source_template_id?: string | null;
  source_template_version?: string | null;
  version?: number | null;
};

/**
 * Find the current K1a version for a given source template id.
 *
 * The K1a system templates live in the same fetched list with
 * `workspace_id IS NULL`. Returns `null` when the source is unknown (either
 * because the source template was hard-deleted or was never a K1a template).
 */
export function getCurrentK1aVersion(
  templates: readonly DriftTemplate[],
  sourceTemplateId: string | null | undefined,
): number | null {
  if (!sourceTemplateId) return null;
  const source = templates.find(
    (t) =>
      t.template_id === sourceTemplateId &&
      (t.workspace_id === null || t.workspace_id === undefined),
  );
  if (!source) return null;
  return typeof source.version === "number" ? source.version : null;
}

/**
 * Integer version comparator for Phase 4.
 *
 * Returns -1 if `a < b`, 0 if equal, 1 if `a > b`. Returns 0 when either side
 * fails to parse (conservative: "no drift" beats "false drift warning").
 */
export function versionCompare(a: string | null | undefined, b: number | null | undefined): number {
  if (a == null || b == null) return 0;
  const parsed = Number.parseInt(a, 10);
  if (!Number.isFinite(parsed)) return 0;
  if (parsed < b) return -1;
  if (parsed > b) return 1;
  return 0;
}

/**
 * Returns `true` when the given workspace template has drifted below the
 * current K1a version.
 *
 * Drift only applies to templates that were actually forked from a K1a source
 * (i.e. `source_template_id != null` AND `source_template_version != null`).
 * A wholly custom template (`Egendefinert`) has no K1a origin to drift from.
 */
export function hasDrift(template: DriftTemplate, templates: readonly DriftTemplate[]): boolean {
  if (!template.source_template_id || template.source_template_version == null) return false;
  const current = getCurrentK1aVersion(templates, template.source_template_id);
  if (current == null) return false;
  return versionCompare(template.source_template_version, current) < 0;
}
