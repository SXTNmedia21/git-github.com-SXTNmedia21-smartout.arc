#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { performance } from "node:perf_hooks";

function toKb(bytes) {
  return Number((bytes / 1024).toFixed(2));
}

async function readJson(filePath) {
  const file = await fs.readFile(filePath, "utf8");
  return JSON.parse(file);
}

function resultLine(routePath, responseTimeMs, htmlSizeKb, routeBudget, pass) {
  const status = pass ? "PASS" : "FAIL";
  return `${status} ${routePath} | response=${responseTimeMs}ms (<=${routeBudget.maxResponseTimeMs}) | html=${htmlSizeKb}KB (<=${routeBudget.maxHtmlSizeKb})`;
}

async function run() {
  const budgetArg = process.argv[2];
  if (!budgetArg) {
    console.error("Usage: node scripts/perf/audit.mjs <budget-file>");
    process.exit(1);
  }

  const budgetPath = path.resolve(process.cwd(), budgetArg);
  const budget = await readJson(budgetPath);
  const enforcement = (process.env.PERF_ENFORCEMENT ?? "warn").toLowerCase();
  const outputDir = path.resolve(process.cwd(), "artifacts", "perf");
  await fs.mkdir(outputDir, { recursive: true });

  const routeResults = [];
  let hasFailures = false;

  for (const routeBudget of budget.routes) {
    const url = new URL(routeBudget.path, budget.baseUrl).toString();

    const start = performance.now();
    const response = await fetch(url, { method: "GET", redirect: "follow" });
    const html = await response.text();
    const end = performance.now();

    const responseTimeMs = Math.round(end - start);
    const htmlSizeKb = toKb(Buffer.byteLength(html, "utf8"));

    const pass =
      response.ok &&
      responseTimeMs <= routeBudget.maxResponseTimeMs &&
      htmlSizeKb <= routeBudget.maxHtmlSizeKb;

    if (!pass) hasFailures = true;

    routeResults.push({
      path: routeBudget.path,
      url,
      httpStatus: response.status,
      responseTimeMs,
      htmlSizeKb,
      maxResponseTimeMs: routeBudget.maxResponseTimeMs,
      maxHtmlSizeKb: routeBudget.maxHtmlSizeKb,
      pass
    });
  }

  const summary = {
    app: budget.app,
    baseUrl: budget.baseUrl,
    enforcement,
    hasFailures,
    generatedAt: new Date().toISOString(),
    routes: routeResults
  };

  const outputJsonPath = path.join(outputDir, `${budget.app}-perf-report.json`);
  await fs.writeFile(outputJsonPath, JSON.stringify(summary, null, 2));

  const outputMdPath = path.join(outputDir, `${budget.app}-perf-report.md`);
  const lines = [
    `# ${budget.app} performance report`,
    "",
    `Enforcement mode: \`${enforcement}\``,
    "",
    ...routeResults.map((r) =>
      resultLine(r.path, r.responseTimeMs, r.htmlSizeKb, r, r.pass)
    )
  ];
  await fs.writeFile(outputMdPath, `${lines.join("\n")}\n`);

  for (const route of routeResults) {
    console.log(
      resultLine(route.path, route.responseTimeMs, route.htmlSizeKb, route, route.pass)
    );
  }
  console.log(`Saved: ${path.relative(process.cwd(), outputJsonPath)}`);
  console.log(`Saved: ${path.relative(process.cwd(), outputMdPath)}`);

  if (hasFailures && enforcement === "fail") {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

