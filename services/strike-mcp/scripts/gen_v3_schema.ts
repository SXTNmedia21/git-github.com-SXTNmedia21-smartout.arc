import { join } from "node:path";
import { readAndWriteV3Schema } from "../src/research/v3_schema.js";

// Monorepo layout: services/strike-mcp/scripts/gen_v3_schema.ts
// → ../../../supabase/migrations is the v3 schema source.
const MIGRATIONS_DIR = join(import.meta.dirname, "..", "..", "..", "supabase", "migrations");
const OUTPUT_PATH = join(import.meta.dirname, "..", "v3_schema.json");

async function main() {
  const schema = await readAndWriteV3Schema(MIGRATIONS_DIR, OUTPUT_PATH);
  console.log(`v3_schema.json written`);
  console.log(`tables: ${Object.keys(schema.tables).length}`);
  console.log(`schema_hash: ${schema.schema_hash.slice(0, 16)}...`);
  console.log(`source_files: ${schema.source_file_count}`);
  console.log(`Key tables:`);
  for (const key of ["public.workspace", "public.profile", "public.invitation", "public.location", "public.department", "public.team"]) {
    const t = schema.tables[key];
    if (t) console.log(`  ${key}: ${Object.keys(t.columns).length} columns`);
    else console.log(`  ${key}: NOT FOUND`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
