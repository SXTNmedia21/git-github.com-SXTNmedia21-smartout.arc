---
title: "xlsx Library Adoption (SheetJS) — License, Bundle Size, Zip-Bomb Mitigation"
id: ADR_0402
status: proposed
layer: decision
created: 2026-05-23
updated: 2026-05-23
---

# ADR-0402: xlsx Library Adoption (SheetJS) — License, Bundle Size, Zip-Bomb Mitigation

## Context and Problem Statement

Sortie A of the `bulk_import` capability (ADR-0401) ships CSV-only parsing via papaparse — a
deliberate scope limit. Sortie B must add xlsx parsing because real customer files (vaktliste and
kjøreplan) are typically exported from Excel or Visma, not Google Sheets, and arrive as `.xlsx`
containers.

Before Sortie B installs any npm package, three constraints must be locked so the Sortie B
developer is not deciding under pressure at install-time:

1. **License** — the chosen edition must be compatible with Smartout's commercial SaaS model and
   carry no CDN-dependency or per-seat cost.
2. **Bundle budget** — xlsx is a large library; parse_spreadsheet runs server-side (Edge Function)
   AND may be invoked from a client-side upload surface, so both weight vectors matter.
3. **Security surface** — xlsx is a zip container; a 1 KB zip-bomb can decompress to multiple
   gigabytes. Mitigations must be specified before install so they are enforced from day one, not
   retrofitted.

**Library landscape:** SheetJS (npm package `xlsx`, https://sheetjs.com/) is the de-facto
JavaScript xlsx library. Two editions exist:

- **Community Edition** — published to npm as `xlsx@<version>`, Apache-2.0 license, full source
  available at https://github.com/SheetJS/sheetjs.
- **Pro Edition** — CDN-only distribution (`cdn.sheetjs.com`), commercial license (per-site fee),
  not installable via npm. CDN dependency = fragile; license = ongoing cost; supply-chain risk
  from third-party CDN.

No other xlsx-capable library in the JS ecosystem is production-grade for arbitrary Excel files
with merged cells, multi-sheet workbooks, and mixed date/number/string columns. Alternatives
(exceljs, read-excel-file) were considered but all either lack XLSB support, have larger bundles,
or are less actively maintained.

## Decision (status: proposed)

### 1. License

Adopt **SheetJS Community Edition only** (`xlsx@^0.18.5` from npm, Apache-2.0). The
Apache-2.0 license is compatible with Smartout's SaaS model — no copyleft, no CDN requirement,
no per-seat fee.

**REJECT** Pro Edition: CDN-only dependency introduces a supply-chain risk (build fails if CDN
is unreachable), requires an ongoing commercial license, and prevents offline builds in local
Supabase dev (ADR: always develop against local, never Cloud).

### 2. Bundle budget

Maximum **≤120 KB gzip** in the eventual production bundle (Edge Function + web client combined
worst-case).

If the bundle exceeds 120 KB gzip after install, Sortie B **MUST** apply dynamic import at the
`parse_spreadsheet` call-site:

```typescript
// Only pay the bundle cost when an xlsx upload actually happens
const { read, utils } = await import('xlsx');
```

This ensures the weight is lazy-loaded and not included in the initial Edge Function cold-start
payload or web JS bundle for users who never upload a spreadsheet.

Sortie B verifies the actual bundle size before merge (e.g. `pnpm build --analyze` or
`BUNDLE_ANALYZE=true pnpm build`). If dynamic import is applied, Sortie B documents the measured
size in a comment at the call-site.

### 3. Zip-bomb mitigation

`.xlsx` files are ZIP containers. A malicious file can be tiny on disk but decompress to multiple
gigabytes, causing OOM or DoS in the parsing environment (Edge Function or API route).

Mitigations are layered — all three are required before Sortie B ships:

**Layer 1 — Upload cap (Sortie 0, already enforced):**
The storage bucket `file_size_limit = 10 MB` (seeded in Task 5 auth seed). A 10 MB compressed
archive is the first defense line. Malicious files exceeding 10 MB are rejected before any parsing
code runs.

**Layer 2 — SheetJS read options:**
Read calls MUST pass `dense: true` and `sheetRows` (binding names match the §2 dynamic-import
destructure — `read` + `utils` — so snippets compose without rewrites):

```typescript
const workbook = read(buf, {
  dense: true,      // materializes only cells, not formula AST
  sheetRows: 10000, // hard cap on rows materialized per sheet
});
```

`dense: true` avoids building a sparse object tree that can balloon memory for worksheets with
many empty cells. `sheetRows: 10000` prevents materializing more than 10 000 rows per sheet
regardless of what the zip contains.

**Layer 3 — Cell-count guard (defense in depth):**
After parsing, reject files where the parsed cell count across all sheets exceeds `row_cap ×
col_cap`:

```typescript
const ROW_CAP = 10_000;
const COL_CAP = 256; // XLS max columns; xlsx supports more but we cap here

for (const sheetName of workbook.SheetNames) {
  const sheet = workbook.Sheets[sheetName];
  const range = utils.decode_range(sheet['!ref'] ?? 'A1:A1');
  const rows = range.e.r - range.s.r + 1;
  const cols = range.e.c - range.s.c + 1;
  if (rows * cols > ROW_CAP * COL_CAP) {
    throw new BulkImportError('FILE_TOO_LARGE', `Sheet "${sheetName}" exceeds cell cap`);
  }
}
```

This catch fires even if Layer 2's `sheetRows` cap was somehow circumvented by a crafted file.

### 4. Security surface

SheetJS Community Edition **does NOT execute formulas, embedded macros, VBA scripts, or external
links**. Specifically:

- **No eval / Function-from-string:** formula strings are stored as-is in cell metadata (`f`
  field); they are never evaluated. No JavaScript is derived from worksheet content.
- **No external HTTP requests:** SheetJS makes no network calls. External references (e.g.
  `[Workbook.xlsx]Sheet1!A1`) are preserved as strings, not resolved.
- **No embedded objects:** OLE/ActiveX/embedded image payloads are ignored by the Community
  Edition parser. They do not surface in the `Workbook` object.
- **No `dangerouslySetInnerHTML`-equivalent:** cell content is returned as typed JavaScript
  primitives (string/number/boolean/date). Downstream code must sanitize before HTML rendering
  (standard XSS hygiene — not xlsx-specific).

Document in `packages/ai/src/capabilities/bulk_import/tools/parse_spreadsheet.ts`: a comment
block `// SECURITY: xlsx CE does not eval formulas or execute macros. See ADR-0402 §4.`

### 5. Versioning

Pin the **major version** in `package.json`:

```json
"xlsx": "^0.18.5"
```

(Pinned at `0.18.x` — Sortie B records the exact installed patch version after install.)

**Renovate auto-bump EXCLUDED** until a future ADR explicitly re-enables it. Rationale: xlsx
parses potentially hostile binary inputs. A silent minor-version upgrade that changes the parser's
behavior for malformed files could introduce a new attack surface without the team noticing. Every
upgrade must be a deliberate review. Add to `renovate.json`:

```json
{ "matchPackageNames": ["xlsx"], "enabled": false }
```

### 6. Adoption phase

Sortie B. `parse_spreadsheet`'s MIME-type dispatch branch gains xlsx parsing **only after this
ADR moves from `proposed` to `accepted`**. Sortie A ships CSV-only via papaparse. The xlsx import
statement MUST NOT appear in any Sortie A commit.

## Consequences

### Positive

- Real-world file format (Excel/Visma exports) unblocked for the bulk_import workflow.
- License cost: zero (Apache-2.0).
- Security model is fully auditable — no eval, no CDN, no external calls.
- Three-layer zip-bomb defense provides defense in depth without complex streaming parsers.

### Negative

- Bundle bloat risk: SheetJS is ~400 KB unminified. Mitigated by the 120 KB gzip budget +
  dynamic import requirement if exceeded.
- Pinned version requires **manual human review** before any upgrade — no Renovate automation
  until next ADR unlocks it.
- `sheetRows: 10000` hard cap may truncate legitimate large files. Sortie B must document the cap
  clearly in the UI ("Files over 10 000 rows per sheet are not supported in V1").

### Forbidden

- **SheetJS Pro Edition** — CDN, commercial license, non-installable via npm.
- **Renovate auto-upgrade** — explicitly excluded in `renovate.json` until ADR re-enables.
- **xlsx in Sortie A code paths** — CSV-only until this ADR flips to `accepted`.
- **Evaluating cell formula strings** — cell `.f` fields are display-only metadata; never pass to
  `eval()`, `new Function()`, or any interpreter.

## Open Questions

Because status is `proposed`, these questions are resolved by Pontus + Council before the ADR
flips to `accepted` at the start of Sortie B:

**Q1 — Actual bundle size:** Will `xlsx@^0.18.5` stay within 120 KB gzip after install and
build? Sortie B measures this. If over budget, dynamic import is mandatory (§2 above). Outcome
updates §2 of this ADR.

**Q2 — Read vs. read+write:** Does Sortie B or any subsequent sortie need xlsx WRITE capability
(exporting a filled template back to Excel)? Community Edition supports write. If confirmed
read-only in V1, document it here and in `parse_spreadsheet.ts` to prevent accidental use of
`xlsx.write()` before the decision is explicit.

**Q3 — Row/col cap calibration:** The 10 000-row × 256-col cap is a first estimate. After Sortie
B sees real customer vaktliste and kjøreplan files, §3 Layer 3 caps may need adjustment. Revise
this ADR and the guard constants in `parse_spreadsheet.ts` accordingly; do not silently increase
caps without updating this ADR.

## References

- [ADR-0401](0401-bulk-import-capability-import-run-cascade-delegation.md) — `bulk_import`
  capability that this ADR scopes the xlsx library for. `parse_spreadsheet` is the tool that will
  use the library.
- [ADR-0287](0287-gate-action-mandatory-on-mutation-capability-tools.md) — `gate_action`
  mandatory on mutation tools. `parse_spreadsheet` is read-only (no gate needed), but
  `commit_batch` (Sortie C) writes through cascade delegation and must satisfy ADR-0287.
- L-0042 — Migration timestamp ordering (no migration in this ADR, but sortie-chain hygiene
  reminder: any future migration from Sortie B must timestamp > Sortie A tip).
- L-0083 — Registered telemetry event without producer is phantom contract. Any xlsx-related
  telemetry events registered in `packages/telemetry/src/registry.ts` during Sortie B must have
  matching `emit()` call-sites in `parse_spreadsheet.ts` before merge.
- L-0316 — Cross-branch ADR slot collision rule. Slot 0402 verified free across all branches and
  worktrees before drafting (6th + 7th occurrences of L-0316 occurred during this sortie's
  renumber sequence from 0400–0403 → 0401–0404; reservation protocol followed).
- SheetJS Community Edition: https://github.com/SheetJS/sheetjs (Apache-2.0 license)
- Spec: `docs/superpowers/specs/2026-05-23-bulk-import-design.md`
- Plan: `docs/superpowers/plans/2026-05-23-bulk-import-sortie-a.md`
