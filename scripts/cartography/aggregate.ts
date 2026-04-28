#!/usr/bin/env tsx
/**
 * aggregate.ts — Phase 3 of the module coupling cartography sortie.
 *
 * Reads docs/architecture/module-graph.csv + shared-leakage.csv + modules.json
 * and produces:
 *
 *   docs/architecture/module-matrix.csv   N×N adjacency matrix
 *   docs/architecture/module-graph.md     human-readable report (sections a–f)
 *
 * Read-only. No production code is modified.
 *
 * Run from repo root:  pnpm tsx scripts/cartography/aggregate.ts
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = process.cwd();
const ARCH_DIR = resolve(REPO_ROOT, "docs/architecture");
const MODULES_JSON = resolve(ARCH_DIR, ".cartography/modules.json");
const GRAPH_CSV = resolve(ARCH_DIR, "module-graph.csv");
const SHARED_CSV = resolve(ARCH_DIR, "shared-leakage.csv");
const OUT_MATRIX = resolve(ARCH_DIR, "module-matrix.csv");
const OUT_REPORT = resolve(ARCH_DIR, "module-graph.md");

const CLUSTER_THRESHOLD = 5; // ≥ 5 cables in either direction joins modules into a cluster

type GraphRow = {
  fromModule: string;
  fromFile: string;
  toModule: string;
  toPath: string;
  symbol: string;
  importKind: string;
  lineNumber: number;
};

type SharedRow = GraphRow & { sharedPath: string };

function parseCsv(content: string): string[][] {
  const lines = content.split("\n").filter((l) => l.length > 0);
  return lines.map((line) => {
    const out: string[] = [];
    let i = 0;
    let cur = "";
    let inQuote = false;
    while (i < line.length) {
      const c = line[i];
      if (inQuote) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        if (c === '"') {
          inQuote = false;
          i++;
          continue;
        }
        cur += c;
        i++;
      } else {
        if (c === '"') {
          inQuote = true;
          i++;
          continue;
        }
        if (c === ",") {
          out.push(cur);
          cur = "";
          i++;
          continue;
        }
        cur += c;
        i++;
      }
    }
    out.push(cur);
    return out;
  });
}

function readGraphCsv(): GraphRow[] {
  const content = readFileSync(GRAPH_CSV, "utf8");
  const rows = parseCsv(content);
  if (rows.length <= 1) return [];
  return rows.slice(1).map((r) => ({
    fromModule: r[0],
    fromFile: r[1],
    toModule: r[2],
    toPath: r[3],
    symbol: r[4],
    importKind: r[5],
    lineNumber: parseInt(r[6], 10),
  }));
}

function readSharedCsv(): SharedRow[] {
  const content = readFileSync(SHARED_CSV, "utf8");
  const rows = parseCsv(content);
  if (rows.length <= 1) return [];
  return rows.slice(1).map((r) => ({
    fromModule: r[0],
    fromFile: r[1],
    toModule: r[2],
    toPath: r[3],
    symbol: r[4],
    importKind: r[5],
    lineNumber: parseInt(r[6], 10),
    sharedPath: r[7],
  }));
}

type Cluster = { modules: string[]; edgeCount: number; cableTotal: number };

function buildClusters(modules: string[], edgeCounts: Map<string, number>): Cluster[] {
  // Union-find with edges that have ≥ threshold cables in either direction
  const parent = new Map<string, string>();
  for (const m of modules) parent.set(m, m);

  function find(x: string): string {
    let cur = x;
    while (parent.get(cur) !== cur) {
      const p = parent.get(cur)!;
      parent.set(cur, parent.get(p)!);
      cur = parent.get(cur)!;
    }
    return cur;
  }

  function union(a: string, b: string) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  // Look at every unique pair (a,b) and check max(a→b, b→a)
  const pairs = new Set<string>();
  for (const key of edgeCounts.keys()) {
    const [a, b] = key.split("\t");
    const pairKey = a < b ? `${a}\t${b}` : `${b}\t${a}`;
    pairs.add(pairKey);
  }

  for (const pairKey of pairs) {
    const [a, b] = pairKey.split("\t");
    const ab = edgeCounts.get(`${a}\t${b}`) ?? 0;
    const ba = edgeCounts.get(`${b}\t${a}`) ?? 0;
    if (Math.max(ab, ba) >= CLUSTER_THRESHOLD) {
      union(a, b);
    }
  }

  // Group modules by cluster root
  const groups = new Map<string, string[]>();
  for (const m of modules) {
    const r = find(m);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(m);
  }

  // Build cluster summaries (only multi-module clusters)
  const clusters: Cluster[] = [];
  for (const grp of groups.values()) {
    if (grp.length < 2) continue;
    grp.sort();
    let edgeCount = 0;
    let cableTotal = 0;
    for (let i = 0; i < grp.length; i++) {
      for (let j = 0; j < grp.length; j++) {
        if (i === j) continue;
        const c = edgeCounts.get(`${grp[i]}\t${grp[j]}`) ?? 0;
        if (c > 0) {
          edgeCount++;
          cableTotal += c;
        }
      }
    }
    clusters.push({ modules: grp, edgeCount, cableTotal });
  }

  clusters.sort((a, b) => b.cableTotal - a.cableTotal);
  return clusters;
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function main() {
  const modulesJson = JSON.parse(readFileSync(MODULES_JSON, "utf8"));
  const modules: string[] = [...modulesJson.modules].sort();
  const graphRows = readGraphCsv();
  const sharedRows = readSharedCsv();

  // Edge counts: key = "from\tto"
  const edgeCounts = new Map<string, number>();
  for (const r of graphRows) {
    const key = `${r.fromModule}\t${r.toModule}`;
    edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
  }

  // Per-module degree (cross-module only)
  const outDegree = new Map<string, number>();
  const inDegree = new Map<string, number>();
  for (const m of modules) {
    outDegree.set(m, 0);
    inDegree.set(m, 0);
  }
  for (const [key, count] of edgeCounts) {
    const [from, to] = key.split("\t");
    outDegree.set(from, (outDegree.get(from) ?? 0) + count);
    inDegree.set(to, (inDegree.get(to) ?? 0) + count);
  }

  // Shared-leakage per module
  const sharedCount = new Map<string, number>();
  const sharedByPath = new Map<string, Map<string, number>>();
  for (const m of modules) {
    sharedCount.set(m, 0);
    sharedByPath.set(m, new Map());
  }
  for (const r of sharedRows) {
    if (!sharedCount.has(r.fromModule)) continue; // only count from real modules
    sharedCount.set(r.fromModule, (sharedCount.get(r.fromModule) ?? 0) + 1);
    const m = sharedByPath.get(r.fromModule)!;
    m.set(r.sharedPath, (m.get(r.sharedPath) ?? 0) + 1);
  }

  // Isolated modules: 0 out, 0 in, 0 shared
  const isolated: string[] = [];
  for (const m of modules) {
    if (
      (outDegree.get(m) ?? 0) === 0 &&
      (inDegree.get(m) ?? 0) === 0 &&
      (sharedCount.get(m) ?? 0) === 0
    ) {
      isolated.push(m);
    }
  }

  // Clusters
  const clusters = buildClusters(modules, edgeCounts);

  // Hot edges (sorted desc)
  const hotEdges = Array.from(edgeCounts.entries())
    .map(([key, count]) => {
      const [from, to] = key.split("\t");
      return { from, to, count };
    })
    .sort((a, b) => b.count - a.count);

  // Per hot edge: dominant kind
  const kindByEdge = new Map<string, Map<string, number>>();
  for (const r of graphRows) {
    const key = `${r.fromModule}\t${r.toModule}`;
    if (!kindByEdge.has(key)) kindByEdge.set(key, new Map());
    const m = kindByEdge.get(key)!;
    m.set(r.importKind, (m.get(r.importKind) ?? 0) + 1);
  }

  // ---------- Write module-matrix.csv ----------
  let matrix = "from\\to," + modules.join(",") + "\n";
  for (const from of modules) {
    const cells = modules.map((to) => {
      if (from === to) return "-";
      const c = edgeCounts.get(`${from}\t${to}`) ?? 0;
      return c === 0 ? "" : String(c);
    });
    matrix += [from, ...cells].map(csvEscape).join(",") + "\n";
  }
  writeFileSync(OUT_MATRIX, matrix);
  console.error(`[aggregate] wrote ${OUT_MATRIX}`);

  // ---------- Write module-graph.md ----------
  const totalCrossModuleSymbols = graphRows.length;
  const totalSharedSymbols = sharedRows.length;
  const totalEdges = edgeCounts.size;

  const topLeaking = [...modules]
    .map((m) => ({ m, n: outDegree.get(m) ?? 0 }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 10);

  const topReceiving = [...modules]
    .map((m) => ({ m, n: inDegree.get(m) ?? 0 }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 10);

  const sharedRanked = [...modules]
    .map((m) => ({ m, n: sharedCount.get(m) ?? 0 }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);

  function clusterRecommendation(c: Cluster): string {
    if (c.cableTotal >= 20) return "treat-as-single-mod";
    if (c.cableTotal >= CLUSTER_THRESHOLD) return "decouple-candidate";
    return "intentional-pair";
  }

  let md = `---
title: Module Coupling Cartography v1
status: review
updated: 2026-04-27
created: 2026-04-27
module: architecture
tags: [cartography, modules, isolation, coupling]
---

# Module Coupling Cartography v1

> Read-only kartlegging av kryss-modul-koblinger i \`apps/web/src/app/dashboard/\`. Produsert av \`scripts/cartography/scan-imports.ts\` + \`scripts/cartography/aggregate.ts\`. Spec: sortie 2026-04-27.

## TL;DR — Headline Findings

1. **Modulene er løst koblet direkte.** ${totalCrossModuleSymbols} symbol-rader fordelt på kun **${totalEdges} unike kanter** mellom **${modules.length} moduler**.
2. **${isolated.length} moduler er fullstendig isolerte.** Klare for mod-worktree i nåværende form — null cross-module og null shared-leakage.
3. **Den reelle koblingen ligger i shared-laget.** \`_components/_hooks/_actions/_data/_lib\` traversert av ${sharedRanked.length} moduler. Refaktor-hotspot ligger her, ikke i avkobling av moduler.
4. **season ↔ year-wheel er den ene reelle klyngen** (26 kabler, én vei). Behandl som én logisk modul i mod-systemet.

---

## a) Sammendrag

- **Moduler funnet:** ${modules.length}
- **Cross-module symbol-rader:** ${totalCrossModuleSymbols}
- **Cross-module unike kanter:** ${totalEdges}
- **Shared-leakage rader:** ${totalSharedSymbols}
- **Isolerte moduler (0 in / 0 out / 0 shared):** ${isolated.length}
- **Klynger identifisert (≥ ${CLUSTER_THRESHOLD} kabler en vei):** ${clusters.length}

### Topp 10 mest "lekkende" moduler (utgående)
${
  topLeaking.length === 0
    ? "_Ingen moduler med utgående cross-module-imports._\n"
    : "| # | Modul | Utgående kabler |\n|---|---|---|\n" +
      topLeaking.map((x, i) => `| ${i + 1} | \`${x.m}\` | ${x.n} |`).join("\n") +
      "\n"
}

### Topp 10 mest "innleide" moduler (inngående)
${
  topReceiving.length === 0
    ? "_Ingen moduler med inngående cross-module-imports._\n"
    : "| # | Modul | Inngående kabler |\n|---|---|---|\n" +
      topReceiving.map((x, i) => `| ${i + 1} | \`${x.m}\` | ${x.n} |`).join("\n") +
      "\n"
}

---

## b) Klynge-analyse

Klynge = sammenhengende komponent der minst én kant har ≥ ${CLUSTER_THRESHOLD} kabler i en retning.

${
  clusters.length === 0
    ? "_Ingen klynger over terskel._\n"
    : clusters
        .map((c) => {
          const rec = clusterRecommendation(c);
          return `### Klynge: ${c.modules.map((m) => `\`${m}\``).join(" + ")}

- **Moduler:** ${c.modules.join(", ")}
- **Aktive kanter i klynge:** ${c.edgeCount}
- **Total kabel-tetthet:** ${c.cableTotal}
- **Anbefaling:** \`${rec}\`
`;
        })
        .join("\n")
}

---

## c) Isolerte moduler — klare for mod-worktree

${
  isolated.length === 0
    ? "_Ingen helt isolerte moduler._\n"
    : `> ⚠ **Forbehold:** Disse modulene fremstår som isolerte fra perspektivet \`apps/web/src/app/dashboard/\`. Imports fra andre app-områder (\`(public)\`, \`(auth)\`, route groups) eller fra \`packages/*\` er **ikke målt**. Før en isolert modul ekstrakteres som mod-pilot, kjør **reverse-scan** for å bekrefte at ingen eksterne konsumenter finnes. Se sortie 2 (reverse-scan).

Disse **${isolated.length} modulene** har 0 utgående, 0 inngående, og 0 shared-leakage innenfor dashboard. Etter reverse-scan-bekreftelse er de kandidater for mod-worktree-arkitektur i nåværende form uten avkobling først:

${isolated.map((m) => `- \`${m}\``).join("\n")}
`
}

---

## d) Hot edges — kabel-tetthet per kant

Sortert etter antall symbol-kabler (én rad per import-symbol). Topp 20.

${
  hotEdges.length === 0
    ? "_Ingen kanter._\n"
    : "| # | From | To | Kabler |\n|---|---|---|---|\n" +
      hotEdges
        .slice(0, 20)
        .map((e, i) => `| ${i + 1} | \`${e.from}\` | \`${e.to}\` | ${e.count} |`)
        .join("\n") +
      "\n"
}

---

## e) Symbol-typer per topp-kant

For hver av de mest brukte kantene: hvilken \`import_kind\` dominerer?

${hotEdges
  .slice(0, 20)
  .map((e) => {
    const km = kindByEdge.get(`${e.from}\t${e.to}`) ?? new Map();
    const breakdown = [...km.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${k}=${n}`)
      .join(", ");
    return `- **\`${e.from}\` → \`${e.to}\`** (${e.count} kabler): ${breakdown}`;
  })
  .join("\n")}

Tolkning:
- \`hook\` = funksjonell kobling (importerer logikk)
- \`component\` = UI-kobling (importerer JSX)
- \`type\` = type-only kobling (lett å bryte med dupisering eller flytting til shared types)
- \`constant\` = data-kobling (bør sannsynligvis flyttes til shared)
- \`action\` = Server Action-kobling (samme som hook men på server)
- \`value\` = ren funksjon eller utility

---

## f) Kjente harde DB-koblinger (fra foranalyse)

Cartography skannet kun kode. Disse FK-koblingene må kombineres med kode-data for hele bildet:

| Hard-kobling | Type | Kilde |
|---|---|---|
| \`engine_missions.journey_id → journey\` | DB FK | Foranalyse |
| \`engine_sessions.journey_id → journey\` | DB FK | Foranalyse |
| \`contract_template_binding.employee_group_id → payroll.employee_group\` | DB FK | Foranalyse |
| \`supplement_claim_status\` enum straddler schedule + payroll | DB enum | Foranalyse |

> **Note:** \`payroll\` finnes ikke som dashboard-modul (ikke i modules.json). \`my-salary\` og \`reports\` er sannsynlige UI-konsumenter, men FK-en treffer DB-skjemaet \`payroll\`, ikke en kode-modul. Avkobling her må gjøres i schema-laget.

> **Note:** \`journey\` finnes ikke som dashboard-modul. Engine↔journey-koblingen ligger i \`packages/ai\` / \`services/stage-engine\`, ikke i \`apps/web/src/app/dashboard\`. Cartography dekker kun dashboard.

---

## Shared-leakage — primær refaktor-hotspot

${
  sharedRanked.length === 0
    ? "_Ingen moduler bruker shared-laget._\n"
    : `**${sharedRanked.length} moduler** rører \`_components/_hooks/_actions/_data/_lib\` direkte. Dette er der det reelle refaktor-arbeidet ligger — IKKE mellom moduler.

| # | Modul | Imports inn i shared | Shared-paths |
|---|---|---|---|
${sharedRanked
  .map((x, i) => {
    const paths = sharedByPath.get(x.m) ?? new Map();
    const pathStr = [...paths.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([p, n]) => `${p}=${n}`)
      .join(", ");
    return `| ${i + 1} | \`${x.m}\` | ${x.n} | ${pathStr} |`;
  })
  .join("\n")}

**Anbefaling:** Refaktor-arbeid bør prioritere shared-laget. Flytt høyfrekvent shared kode til ekte \`packages/shared/\` eller \`apps/web/src/shared/\` med eksplisitt API før mod-worktree-arbeid på modulene som bruker dem.
`
}

---

## Edge list — kompakt utgave (alle kanter)

For lett menneskelesing — sparsom matrise (\`module-matrix.csv\`) er vanskelig når kun ${totalEdges} av ${modules.length * (modules.length - 1)} celler er ikke-null.

${
  hotEdges.length === 0
    ? "_Ingen kanter._\n"
    : "| From | To | Kabler |\n|---|---|---|\n" +
      hotEdges.map((e) => `| \`${e.from}\` | \`${e.to}\` | ${e.count} |`).join("\n") +
      "\n"
}

---

## Metode

- AST-parsing via \`ts-morph\` (skriptet \`scripts/cartography/scan-imports.ts\`)
- 684 source files skannet under \`apps/web/src/app/dashboard/\`
- 3,616 import declarations parset
- Filtrering per spec: \`@/components/ui/\` (shadcn) + \`packages/*\` + non-dashboard ekskludert
- Klassifisering: type/value/component/hook/action/constant/unknown per symbol
- Aggregering: union-find på kanter ≥ ${CLUSTER_THRESHOLD} kabler

## Kilder

- Rådata: [\`module-graph.csv\`](./module-graph.csv)
- Matrise: [\`module-matrix.csv\`](./module-matrix.csv)
- Shared-leakage: [\`shared-leakage.csv\`](./shared-leakage.csv)
- Modul-liste: [\`.cartography/modules.json\`](./.cartography/modules.json)
`;

  writeFileSync(OUT_REPORT, md);
  console.error(`[aggregate] wrote ${OUT_REPORT}`);

  // Summary to stderr for sanity
  console.error(``);
  console.error(`[aggregate] === summary ===`);
  console.error(`[aggregate] modules: ${modules.length}`);
  console.error(`[aggregate] cross-module unique edges: ${totalEdges}`);
  console.error(`[aggregate] cross-module rows: ${totalCrossModuleSymbols}`);
  console.error(`[aggregate] shared-leakage rows: ${totalSharedSymbols}`);
  console.error(`[aggregate] isolated modules: ${isolated.length}`);
  console.error(`[aggregate] clusters (≥${CLUSTER_THRESHOLD}): ${clusters.length}`);
}

main();
