// Domain-parity prod test: browser believes it's on https://app.smartout.ai,
// resolved to the local prod build via host-resolver-rules + HTTPS proxy.
// Proves: (1) we hit local not prod, (2) cookies are .smartout.ai-scoped (prod
// identical), (3) verifier-nuke fix holds, (4) dual-domain orphan clearing.
import { chromium } from "playwright";

const BASE = "https://app.smartout.ai:8443";
const REF = "sb-yljaglomadbhyqpcigff-auth-token";
const VERIFIER = `${REF}-code-verifier`;
const sb = (cs) => cs.filter((c) => c.name.startsWith("sb-"));
const fmt = (cs) => sb(cs).map((c) => `${c.name} [len=${c.value.length} domain=${c.domain} secure=${c.secure}]`).join("\n    ") || "(none)";

const browser = await chromium.launch({
  headless: true,
  args: ["--host-resolver-rules=MAP app.smartout.ai 127.0.0.1"],
});

// ---- 1. local not prod? ----
const ctx0 = await browser.newContext({ ignoreHTTPSErrors: true });
const p0 = await ctx0.newPage();
const r0 = await p0.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
const vercel = r0?.headers()["x-vercel-id"];
console.log("1) GET /login status", r0?.status(), "| x-vercel-id:", vercel ?? "(absent — LOCAL ✓)");

// ---- 2 + 3. reset init sets .smartout.ai verifier, survives /dashboard ----
console.log("\n2+3) reset-password init -> verifier domain -> /dashboard survival");
const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await ctx.newPage();
await page.goto(`${BASE}/reset-password`, { waitUntil: "domcontentloaded" });
await page.locator('input[type="email"],input[name="email"]').first().fill("authprobe.delete@example.com").catch(() => {});
await page.locator('button[type="submit"]').first().click({ timeout: 8000 }).catch((e) => console.log("  submit:", e.message.split("\n")[0]));
await page.waitForTimeout(2500);
const vCookie = sb(await ctx.cookies()).find((c) => c.name === VERIFIER);
console.log("  verifier set:", vCookie ? `domain=${vCookie.domain} secure=${vCookie.secure} len=${vCookie.value.length}` : "NONE");
console.log("  PROD-PARITY domain check:", vCookie?.domain === ".smartout.ai" ? ".smartout.ai ✓" : `WRONG (${vCookie?.domain})`);
await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
const vAfter = sb(await ctx.cookies()).find((c) => c.name === VERIFIER);
console.log("  after /dashboard -> URL:", page.url());
console.log("  verifier survived:", vAfter && vAfter.value.length > 0 ? `YES (len=${vAfter.value.length}) ✓` : "NUKED ✗");

// ---- 4. dual-domain orphan: host-only + dotted session, both invalid + verifier ----
console.log("\n4) dual-domain orphan clearing (.smartout.ai + host-only app.smartout.ai)");
const ctx2 = await browser.newContext({ ignoreHTTPSErrors: true });
await ctx2.addCookies([
  { name: REF, value: "dotted-session-invalid", domain: ".smartout.ai", path: "/", secure: true, sameSite: "Lax" },
  { name: REF, value: "hostonly-orphan-invalid", domain: "app.smartout.ai", path: "/", secure: true, sameSite: "Lax" },
  { name: VERIFIER, value: "verifier-should-survive", domain: ".smartout.ai", path: "/", secure: true, sameSite: "Lax" },
]);
console.log("  seeded:\n    " + fmt(await ctx2.cookies()));
const page2 = await ctx2.newPage();
await page2.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
console.log("  after /dashboard -> URL:", page2.url());
const after2 = sb(await ctx2.cookies());
const v2 = after2.find((c) => c.name === VERIFIER);
console.log("  verifier survived:", v2 && v2.value.length > 0 ? `YES ✓` : "NUKED ✗");
console.log("  remaining sb-cookies:\n    " + fmt(after2));

await browser.close();
console.log("\n=== done ===");
