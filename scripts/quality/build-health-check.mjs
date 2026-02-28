#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const srcDirs = [
  path.join(rootDir, "apps", "web", "src"),
  path.join(rootDir, "apps", "landing", "src")
];

const errors = [];
const warnings = [];

const localhostPattern = /https?:\/\/localhost:(3050|3055)/g;

async function walk(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) return walk(fullPath);
      return [fullPath];
    })
  );
  return nested.flat();
}

function rel(filePath) {
  return path.relative(rootDir, filePath).replaceAll("\\", "/");
}

async function inspectFile(filePath) {
  if (!filePath.endsWith(".ts") && !filePath.endsWith(".tsx")) return;
  const content = await fs.readFile(filePath, "utf8");
  const relativePath = rel(filePath);

  if (localhostPattern.test(content)) {
    errors.push(`Disallowed localhost URL in ${relativePath}`);
  }

  if (relativePath.endsWith("/layout.tsx")) {
    const hasUseClient = content.startsWith('"use client"') || content.startsWith("'use client'");
    if (hasUseClient) {
      warnings.push(`Client layout detected: ${relativePath}`);
    }
  }

  if (relativePath.endsWith("/layout.tsx") && content.includes("from \"framer-motion\"")) {
    warnings.push(`framer-motion imported in layout: ${relativePath}`);
  }
}

async function main() {
  for (const srcDir of srcDirs) {
    const files = await walk(srcDir);
    for (const file of files) {
      // eslint-disable-next-line no-await-in-loop
      await inspectFile(file);
    }
  }

  const outputDir = path.join(rootDir, "artifacts", "quality");
  await fs.mkdir(outputDir, { recursive: true });
  const reportPath = path.join(outputDir, "build-health-report.json");
  await fs.writeFile(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        errors,
        warnings
      },
      null,
      2
    )
  );

  if (warnings.length > 0) {
    console.warn("Build health warnings:");
    for (const warning of warnings) console.warn(`- ${warning}`);
  }

  if (errors.length > 0) {
    console.error("Build health errors:");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(`Build health report saved: ${rel(reportPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

