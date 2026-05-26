// scripts/live-invoke/<DOMAIN>.mjs
// Live-invoke smoke for the <DOMAIN> domain — see scripts/live-invoke/README.md.
//
// Catches: column drift, RPC signature drift, missing functions, SelectQueryError
//          (the L-0348 family that mocks miss).
// Does NOT cover: business logic, permissions, performance — see Playwright + audit.
//
// Usage:
//   op run --env-file=.env.template -- node scripts/live-invoke/<DOMAIN>.mjs

import { client, header, assertOk, assertShape, result } from "./_lib.mjs";

const DOMAIN = "<DOMAIN>"; // TODO replace
const sb = client("service");

header(DOMAIN);

// ── Read smoke #1: <RPC or table read used by this capability> ───────────────
// TODO: replace with the actual RPC/select the capability's read path calls.
// Example RPC:
//   const r1 = await sb.rpc("fn_my_capability_read", { p_param: "value" });
// Example table:
//   const r1 = await sb.from("my_table").select("id, name, created_at").limit(1);
//
// const r1 = await sb.rpc("TODO_rpc_name");
// assertOk("rpc TODO_rpc_name", r1);
// assertShape("rpc TODO_rpc_name shape", r1.data, ["TODO_required_column_1", "TODO_required_column_2"]);

// ── Read smoke #2: <secondary read, optional> ────────────────────────────────
// Repeat the pattern. Aim for 2–4 critical reads per domain — enough to catch
// drift, not so many that the script becomes slow.

// ── Write smoke (optional, only if capability writes) ────────────────────────
// Insert a probe row with a synthetic marker, verify it appears, clean up.
//
//   const marker = `probe_${Date.now()}`;
//   const ins = await sb.from("my_table").insert({ name: marker, workspace_id: TEST_WS }).select().single();
//   assertOk("insert probe", ins);
//   try {
//     const read = await sb.from("my_table").select("id, name").eq("name", marker);
//     assertOk("read probe back", read);
//   } finally {
//     await sb.from("my_table").delete().eq("name", marker);
//   }

result();
