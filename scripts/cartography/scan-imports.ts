#!/usr/bin/env tsx
/**
 * scan-imports.ts — Phase 2 of the module coupling cartography sortie.
 *
 * Walks every .ts/.tsx/.js/.jsx under apps/web/src/app/dashboard/, parses imports
 * with ts-morph, classifies each cross-module import by kind, and writes:
 *
 *   docs/architecture/module-graph.csv     cross-module imports (one row per symbol)
 *   docs/architecture/shared-leakage.csv   imports from _components/_hooks/_actions
 *
 * Read-only. No production code is modified.
 *
 * Run from repo root:  pnpm tsx scripts/cartography/scan-imports.ts
 */

import { Project } from "ts-morph";
import { readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, relative, dirname, join, sep } from "node:path";

const REPO_ROOT = process.cwd();
const APPS_WEB_SRC = resolve(REPO_ROOT, "apps/web/src");
const DASHBOARD_ROOT = resolve(APPS_WEB_SRC, "app/dashboard");
const OUT_DIR = resolve(REPO_ROOT, "docs/architecture");
const OUT_GRAPH = resolve(OUT_DIR, "module-graph.csv");
const OUT_SHARED = resolve(OUT_DIR, "shared-leakage.csv");

if (!existsSync(DASHBOARD_ROOT)) {
  console.error(`[scan] FATAL: dashboard root not found: ${DASHBOARD_ROOT}`);
  console.error(`[scan] Run from repo root.`);
  process.exit(1);
}

type ImportKind = "type" | "value" | "component" | "hook" | "action" | "constant" | "unknown";

type GraphRow = {
  fromModule: string;
  fromFile: string;
  toModule: string;
  toPath: string;
  symbol: string;
  importKind: ImportKind;
  lineNumber: number;
};

type SharedRow = GraphRow & { sharedPath: string };

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      yield* walk(full);
    } else if (/\.(tsx|ts|jsx|js)$/.test(entry)) {
      yield full;
    }
  }
}

function getFromModule(filePath: string): string | null {
  const rel = relative(DASHBOARD_ROOT, filePath);
  if (rel.startsWith("..")) return null;
  const parts = rel.split(sep);
  if (parts.length < 2) return "_root";
  return parts[0];
}

function resolveSpecifier(specifier: string, fromFile: string): string | null {
  if (specifier.startsWith("@/")) {
    return resolve(APPS_WEB_SRC, specifier.slice(2));
  }
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    return resolve(dirname(fromFile), specifier);
  }
  return null;
}

function getToModule(resolvedPath: string): { module: string; sharedPath?: string } | null {
  const rel = relative(DASHBOARD_ROOT, resolvedPath);
  if (rel.startsWith("..")) return null;
  const parts = rel.split(sep);
  const first = parts[0];
  if (!first) return null;
  if (first.startsWith("_")) {
    return { module: "_shared", sharedPath: first };
  }
  return { module: first };
}

function classifyImportKind(
  symbol: string,
  isTypeOnly: boolean,
  specifierPath: string,
): ImportKind {
  if (specifierPath.includes("_actions/")) return "action";
  if (isTypeOnly) return "type";
  if (symbol === "*") return "unknown";
  if (/^use[A-Z]/.test(symbol)) return "hook";
  // UPPER_SNAKE_CASE or all-caps multi-char
  if (
    /^[A-Z][A-Z0-9_]*$/.test(symbol) &&
    (symbol.includes("_") || (symbol.length > 1 && /^[A-Z0-9_]+$/.test(symbol)))
  ) {
    return "constant";
  }
  if (/^[A-Z]/.test(symbol)) return "component";
  return "value";
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function main() {
  console.error(`[scan] dashboard root: ${DASHBOARD_ROOT}`);

  const files: string[] = [];
  for (const f of walk(DASHBOARD_ROOT)) files.push(f);
  console.error(`[scan] found ${files.length} source files`);

  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    skipLoadingLibFiles: true,
  });

  const graphRows: GraphRow[] = [];
  const sharedRows: SharedRow[] = [];
  let importDeclCount = 0;
  let sameModuleSkipped = 0;
  let nonResolvableSkipped = 0;
  let shadcnSkipped = 0;
  let externalSkipped = 0;
  let privateFromSkipped = 0;

  for (const file of files) {
    const fromModule = getFromModule(file);
    if (!fromModule || fromModule === "_root") continue;
    // skip files inside dashboard-private folders (_actions/_components/_data/_hooks/_lib).
    // Those are shared infra; their imports into modules are a separate concern (reverse leakage).
    if (fromModule.startsWith("_")) {
      privateFromSkipped++;
      continue;
    }

    const fromFileRel = relative(REPO_ROOT, file);

    let sf;
    try {
      sf = project.addSourceFileAtPath(file);
    } catch (err) {
      console.error(`[scan] failed to load ${file}: ${(err as Error).message}`);
      continue;
    }

    for (const imp of sf.getImportDeclarations()) {
      importDeclCount++;
      const specifier = imp.getModuleSpecifierValue();

      if (specifier.startsWith("@/components/ui")) {
        shadcnSkipped++;
        continue;
      }

      const resolved = resolveSpecifier(specifier, file);
      if (!resolved) {
        externalSkipped++;
        continue;
      }

      const tm = getToModule(resolved);
      if (!tm) {
        nonResolvableSkipped++;
        continue;
      }

      const isShared = tm.module === "_shared";
      if (!isShared && tm.module === fromModule) {
        sameModuleSkipped++;
        continue;
      }

      const isDeclTypeOnly = imp.isTypeOnly();
      const lineNumber = imp.getStartLineNumber();
      const namedImports = imp.getNamedImports();
      const defaultImport = imp.getDefaultImport();
      const namespaceImport = imp.getNamespaceImport();

      const symbols: { name: string; isTypeOnly: boolean }[] = [];

      if (defaultImport) {
        symbols.push({ name: defaultImport.getText(), isTypeOnly: isDeclTypeOnly });
      }
      if (namespaceImport) {
        symbols.push({ name: "*", isTypeOnly: isDeclTypeOnly });
      }
      for (const ni of namedImports) {
        const name = ni.getNameNode().getText();
        symbols.push({ name, isTypeOnly: isDeclTypeOnly || ni.isTypeOnly() });
      }
      if (symbols.length === 0) {
        // side-effect import like `import "./style.css"`
        symbols.push({ name: "*", isTypeOnly: isDeclTypeOnly });
      }

      for (const s of symbols) {
        const kind = classifyImportKind(s.name, s.isTypeOnly, specifier);
        const row: GraphRow = {
          fromModule,
          fromFile: fromFileRel,
          toModule: tm.module,
          toPath: specifier,
          symbol: s.name,
          importKind: kind,
          lineNumber,
        };
        if (isShared) {
          sharedRows.push({ ...row, sharedPath: tm.sharedPath ?? "" });
        } else {
          graphRows.push(row);
        }
      }
    }

    project.removeSourceFile(sf);
  }

  console.error(``);
  console.error(`[scan] === totals ===`);
  console.error(`[scan] import declarations seen:    ${importDeclCount}`);
  console.error(`[scan] cross-module rows:           ${graphRows.length}`);
  console.error(`[scan] shared-leakage rows:         ${sharedRows.length}`);
  console.error(`[scan] same-module skipped:         ${sameModuleSkipped}`);
  console.error(`[scan] external (npm/etc) skipped:  ${externalSkipped}`);
  console.error(`[scan] shadcn ui skipped:           ${shadcnSkipped}`);
  console.error(`[scan] non-resolvable skipped:      ${nonResolvableSkipped}`);
  console.error(`[scan] private from-module skipped: ${privateFromSkipped} files`);

  mkdirSync(OUT_DIR, { recursive: true });

  const graphHeader = "from_module,from_file,to_module,to_path,symbol,import_kind,line_number\n";
  const graphBody = graphRows
    .map((r) =>
      [r.fromModule, r.fromFile, r.toModule, r.toPath, r.symbol, r.importKind, r.lineNumber]
        .map((v) => csvEscape(String(v)))
        .join(","),
    )
    .join("\n");
  writeFileSync(OUT_GRAPH, graphHeader + (graphBody ? graphBody + "\n" : ""));
  console.error(`[scan] wrote ${relative(REPO_ROOT, OUT_GRAPH)}`);

  const sharedHeader =
    "from_module,from_file,to_module,to_path,symbol,import_kind,line_number,shared_path\n";
  const sharedBody = sharedRows
    .map((r) =>
      [
        r.fromModule,
        r.fromFile,
        r.toModule,
        r.toPath,
        r.symbol,
        r.importKind,
        r.lineNumber,
        r.sharedPath,
      ]
        .map((v) => csvEscape(String(v)))
        .join(","),
    )
    .join("\n");
  writeFileSync(OUT_SHARED, sharedHeader + (sharedBody ? sharedBody + "\n" : ""));
  console.error(`[scan] wrote ${relative(REPO_ROOT, OUT_SHARED)}`);
}

main();
