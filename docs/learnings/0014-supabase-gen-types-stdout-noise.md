---
title: "Supabase gen types prints debug line to stdout"
id: "0014"
status: done
created: 2026-03-01
updated: 2026-03-01
tags: [supabase, types, cli, gotcha]
---

# Learning: Supabase gen types prints debug line to stdout

## Discovery

When running `npx supabase gen types typescript --local > file.ts`, the CLI sometimes prints `Connecting to db 5432` to stdout before the actual TypeScript output. This corrupts the generated file — the first line becomes an invalid statement, causing lint/parse errors.

## Impact

The generated `database.types.ts` file fails ESLint with `Parsing error: Unexpected keyword or identifier` on line 1.

## Fix

After generating types, check line 1 of the output file. If it starts with `Connecting to`, remove that line before committing. Can also use:

```bash
npx supabase gen types typescript --local 2>/dev/null | tail -n +2 > packages/supabase/src/database.types.ts
```

Or simply edit the file to remove the first line if it's not valid TypeScript.
