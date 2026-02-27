---
id: 0003
title: Optimistic locking pattern for Supabase concurrent writes
date: 2026-02-28
tags: [supabase, concurrency, database, api]
---

# Learning-0003: Optimistic locking pattern for Supabase concurrent writes

## Context

The platform-admin content publish API originally used `Promise.all()` to update the config row and insert a version snapshot in parallel. A code review identified that two concurrent publish requests could both read the same version, then both attempt to write — producing duplicate version numbers or corrupted state.

## Discovery

Supabase PostgREST supports optimistic locking by chaining `.eq("version", expectedVersion)` on update queries. If another request changes the version between our read and write, the update matches zero rows and returns an error.

Pattern:

```typescript
// 1. Read current version
const { data: config } = await admin
  .from("landing_config")
  .select("config_id, config_json, version")
  .eq("slug", slug)
  .single();

// 2. Update with version guard (optimistic lock)
const { data: updated, error } = await admin
  .from("landing_config")
  .update({ version: config.version + 1 /* ... */ })
  .eq("slug", slug)
  .eq("version", config.version) // lock: must match what we read
  .select("config_id")
  .single();

// 3. If no match → 409 Conflict
if (error || !updated) {
  return NextResponse.json(
    { error: "Conflict — config was modified by another request" },
    { status: 409 },
  );
}

// 4. Only THEN insert the version snapshot (sequential, not parallel)
await admin.from("landing_config_version").insert({
  /* ... */
});
```

Key insight: the version snapshot insert must be sequential (after the update succeeds), NOT parallel with `Promise.all()`.

## Impact

- Use optimistic locking for any multi-step write where concurrent access is possible
- Never use `Promise.all()` for dependent writes — the second write depends on the first succeeding
- Return HTTP 409 Conflict when the lock check fails — the client should retry

## References

- File: `apps/web/src/app/api/platform-admin/content/configs/[slug]/publish/route.ts`
- PR: #6 (Platform Admin Backoffice)
- Code review finding, fixed before merge
