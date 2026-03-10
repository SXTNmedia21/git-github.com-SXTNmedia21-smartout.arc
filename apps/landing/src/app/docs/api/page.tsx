"use client";

import { useState } from "react";
import { ApiSidebar } from "../_components/api-sidebar";

/* ─── Types ─── */

type Tier = "public" | "internal" | "admin";

const TIERS: {
  id: Tier;
  label: string;
  color: string;
  bg: string;
  border: string;
  desc: string;
}[] = [
  {
    id: "public",
    label: "Public API",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    desc: "Third-party integrations via API key",
  },
  {
    id: "internal",
    label: "Internal",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    desc: "SmartOut dashboard & services",
  },
  {
    id: "admin",
    label: "Admin",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    desc: "Platform administration (godmode)",
  },
];

/* ─── Helpers ─── */

function M({ method }: { method: string }) {
  const c: Record<string, string> = {
    GET: "bg-emerald-500/15 text-emerald-400",
    POST: "bg-blue-500/15 text-blue-400",
    PATCH: "bg-amber-500/15 text-amber-400",
    DELETE: "bg-rose-500/15 text-rose-400",
  };
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 font-mono text-xs font-bold ${c[method] ?? "bg-zinc-500/15 text-zinc-400"}`}
    >
      {method}
    </span>
  );
}

function TierBadge({ tier }: { tier: Tier }) {
  const t = TIERS.find((x) => x.id === tier)!;
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${t.bg} ${t.color}`}
    >
      {t.label}
    </span>
  );
}

function Code({ children, label }: { children: string; label?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/5 bg-[#06060a]">
      {label && (
        <div className="border-b border-white/5 px-3 py-1.5 text-[11px] font-semibold tracking-wider text-zinc-600 uppercase">
          {label}
        </div>
      )}
      <pre className="overflow-x-auto p-3 font-mono text-[13px] leading-relaxed text-zinc-400">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function SectionRow({
  id,
  tier,
  children,
  code,
  noBorder,
}: {
  id: string;
  tier?: Tier;
  children: React.ReactNode;
  code?: React.ReactNode;
  noBorder?: boolean;
}) {
  return (
    <div id={id} className={`flex scroll-mt-0 ${noBorder ? "" : "border-b border-white/5"}`}>
      <div className="min-w-0 flex-1 px-8 py-8 lg:px-10 lg:py-10">
        {tier && (
          <div className="mb-3">
            <TierBadge tier={tier} />
          </div>
        )}
        {children}
      </div>
      <div className="hidden w-105 shrink-0 border-l border-white/5 bg-[#09090d] px-6 py-8 lg:py-10 xl:block">
        {code}
      </div>
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-2xl font-bold tracking-tight text-white">{children}</h2>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 text-sm leading-relaxed text-zinc-400">{children}</p>;
}

function IC({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-white/5 px-1 py-0.5 font-mono text-[13px] text-orange-300">
      {children}
    </code>
  );
}

function Params({
  title,
  items,
}: {
  title: string;
  items: { name: string; type: string; req?: boolean; desc: string }[];
}) {
  return (
    <div className="mt-4 mb-4">
      <p className="mb-2 text-xs font-bold tracking-wider text-zinc-500 uppercase">{title}</p>
      <div className="space-y-0 rounded-lg border border-white/5">
        {items.map((p) => (
          <div
            key={p.name}
            className="flex gap-3 border-b border-white/3 px-3 py-2.5 last:border-b-0"
          >
            <div className="w-32 shrink-0">
              <code className="text-[13px] font-semibold text-white">{p.name}</code>
              {p.req && <span className="ml-1 text-[11px] font-bold text-orange-400">*</span>}
              <div className="mt-0.5 font-mono text-[11px] text-zinc-600">{p.type}</div>
            </div>
            <p className="text-[13px] leading-relaxed text-zinc-400">{p.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Errors({ items }: { items: { code: string; desc: string }[] }) {
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-xs font-bold tracking-wider text-zinc-500 uppercase">Error codes</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((e) => (
          <span
            key={e.code}
            className="rounded border border-white/5 px-2 py-1 text-xs text-zinc-400"
          >
            <span className="font-mono font-bold text-rose-400">{e.code}</span> {e.desc}
          </span>
        ))}
      </div>
    </div>
  );
}

function Endpoint({
  method,
  path,
  auth,
  scope,
}: {
  method: string;
  path: string;
  auth: string;
  scope?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-white/5 bg-white/2 px-3 py-2.5">
      <M method={method} />
      <code className="text-sm font-semibold text-white">{path}</code>
      {scope && (
        <span className="rounded bg-fuchsia-500/10 px-1.5 py-0.5 text-[10px] font-bold text-fuchsia-400">
          {scope}
        </span>
      )}
      <span className="ml-auto text-[11px] font-semibold tracking-wider text-zinc-600 uppercase">
        {auth}
      </span>
    </div>
  );
}

/* ─── Tier Selector ─── */

function TierSelector({
  active,
  onChange,
}: {
  active: Set<Tier>;
  onChange: (t: Set<Tier>) => void;
}) {
  function toggle(tier: Tier) {
    const next = new Set(active);
    if (next.has(tier)) {
      if (next.size > 1) next.delete(tier);
    } else {
      next.add(tier);
    }
    onChange(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {TIERS.map((t) => {
        const on = active.has(t.id);
        return (
          <button
            key={t.id}
            onClick={() => toggle(t.id)}
            className={`rounded-lg border px-3 py-2 text-left transition-all ${
              on
                ? `${t.border} ${t.bg} ${t.color}`
                : "border-white/5 bg-white/2 text-zinc-600 hover:border-white/10 hover:text-zinc-400"
            }`}
          >
            <div className="text-xs font-bold">{t.label}</div>
            <div className={`mt-0.5 text-[11px] ${on ? "opacity-70" : "opacity-50"}`}>{t.desc}</div>
          </button>
        );
      })}
    </div>
  );
}

/* ─── Visibility helper ─── */

function Section({
  tier,
  active,
  children,
}: {
  tier: Tier;
  active: Set<Tier>;
  children: React.ReactNode;
}) {
  if (!active.has(tier)) return null;
  return <>{children}</>;
}

/* ─── Page ─── */

export default function ApiDocsPage() {
  const [activeTiers, setActiveTiers] = useState<Set<Tier>>(new Set(["public"]));

  return (
    <div className="fixed inset-0 z-50 flex bg-[#050505] text-white">
      <ApiSidebar activeTiers={activeTiers} />

      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* ════════ OVERVIEW ════════ */}
        <SectionRow
          id="overview"
          code={
            <div className="space-y-4">
              <Code label="Base URL">{`https://api.smartout.ai/v1/`}</Code>
              <div className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/5 px-3 py-2.5 text-[13px] text-fuchsia-300">
                All endpoints return JSON and require{" "}
                <span className="font-mono text-white">Content-Type: application/json</span>
              </div>
            </div>
          }
        >
          <h1 className="mb-2 text-3xl font-black tracking-tight text-white">SmartOut API</h1>
          <div className="mb-4 inline-block rounded-full bg-fuchsia-500/10 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-fuchsia-400 uppercase">
            REST v1
          </div>
          <P>
            The SmartOut API lets you read employee, organization, contract and training data from
            your workspace. All endpoints are scoped to a single workspace via your API key.
          </P>

          <div className="mt-6 mb-2">
            <p className="mb-2 text-xs font-bold tracking-wider text-zinc-500 uppercase">
              API Layers
            </p>
            <TierSelector active={activeTiers} onChange={setActiveTiers} />
          </div>

          <div className="mt-5 rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3">
            <p className="text-xs font-bold tracking-wider text-blue-400 uppercase">Access</p>
            <p className="mt-1 text-[13px] text-zinc-400">
              Public API endpoints require a workspace API key (<IC>smo_sk_live_*</IC>). Internal
              and admin endpoints use session auth or service keys.
            </p>
          </div>
        </SectionRow>

        {/* ════════ AUTHENTICATION ════════ */}
        <SectionRow
          id="authentication"
          code={
            <div className="space-y-4">
              <Code label="API Key">{`curl https://api.smartout.ai/v1/profiles \\
  -H "Authorization: Bearer smo_sk_live_abc123..."`}</Code>
              <Section tier="internal" active={activeTiers}>
                <Code label="Session (browser)">{`// Supabase handles cookies
const { data } = await supabase
  .from('profile')
  .select('*')`}</Code>
              </Section>
              <Section tier="admin" active={activeTiers}>
                <Code label="Service key">{`curl https://api.smartout.ai/v1/... \\
  -H "Authorization: Bearer smo_svc_live_..."`}</Code>
              </Section>
            </div>
          }
        >
          <H2>Authentication</H2>
          <P>
            Every request must include a valid credential. The auth method depends on the API layer
            you are using.
          </P>
          <div className="space-y-3">
            <Section tier="public" active={activeTiers}>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <TierBadge tier="public" />
                  <p className="text-sm font-semibold text-white">API Key</p>
                </div>
                <p className="mt-1 text-[13px] text-zinc-400">
                  Send your workspace API key as a Bearer token. Keys are created in Settings &rarr;
                  API Keys. Prefix: <IC>smo_sk_live_*</IC> (production) or <IC>smo_sk_test_*</IC>{" "}
                  (sandbox).
                </p>
              </div>
            </Section>
            <Section tier="internal" active={activeTiers}>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <TierBadge tier="internal" />
                  <p className="text-sm font-semibold text-white">Session Auth</p>
                </div>
                <p className="mt-1 text-[13px] text-zinc-400">
                  Cookie-based via Supabase Auth. Used by the SmartOut dashboard and landing page.
                  Automatic session management in browser.
                </p>
              </div>
            </Section>
            <Section tier="admin" active={activeTiers}>
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <TierBadge tier="admin" />
                  <p className="text-sm font-semibold text-white">Service Key</p>
                </div>
                <p className="mt-1 text-[13px] text-zinc-400">
                  Machine-to-machine keys for platform services. Prefix: <IC>smo_svc_live_*</IC>.
                  Requires <IC>is_godmode</IC> for admin operations.
                </p>
              </div>
            </Section>
          </div>
          <div className="mt-5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <p className="text-xs font-bold tracking-wider text-amber-400 uppercase">Important</p>
            <p className="mt-1 text-[13px] text-zinc-400">
              Never expose your API key in client-side code. All API calls should be made from your
              server.
            </p>
          </div>
        </SectionRow>

        {/* ════════ RATE LIMITS ════════ */}
        <SectionRow
          id="rate-limits"
          code={
            <div className="space-y-4">
              <Code label="429 Response">{`{
  "error": "Rate limit exceeded"
}

// Check headers:
X-RateLimit-Remaining: 0
Retry-After: 42`}</Code>
            </div>
          }
        >
          <H2>Rate Limits</H2>
          <P>
            All endpoints are rate-limited per API key. When exceeded, you receive a <IC>429</IC>{" "}
            response with <IC>Retry-After</IC> header.
          </P>
          <div className="overflow-x-auto rounded-lg border border-white/5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-white/5 bg-white/2">
                  <th className="px-3 py-2 text-left font-semibold text-zinc-300">Layer</th>
                  <th className="px-3 py-2 text-left font-semibold text-zinc-300">Limit</th>
                  <th className="px-3 py-2 text-left font-semibold text-zinc-300">Window</th>
                </tr>
              </thead>
              <tbody className="text-zinc-400">
                {[
                  ["Public API (/v1/*)", "60 req", "per minute", "public"],
                  ["Internal routes", "100 req", "per minute", "internal"],
                  ["Edge Functions", "60 req", "per minute", "internal"],
                  ["Admin endpoints", "30 req", "per minute", "admin"],
                ].map(([ep, limit, window, tier]) => (
                  <tr
                    key={ep}
                    className={`border-b border-white/3 last:border-b-0 ${!activeTiers.has(tier as Tier) ? "opacity-30" : ""}`}
                  >
                    <td className="px-3 py-2 font-medium text-white">{ep}</td>
                    <td className="px-3 py-2">{limit}</td>
                    <td className="px-3 py-2">{window}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <P>
            Implement exponential backoff when retrying. Usage is tracked per key in hourly buckets.
          </P>
        </SectionRow>

        {/* ════════ ERRORS ════════ */}
        <SectionRow
          id="errors"
          code={
            <div className="space-y-4">
              <Code label="Error response">{`{
  "error": "Missing scope: profiles:read"
}`}</Code>
              <Code label="Validation error">{`{
  "error": "Validation failed",
  "details": "workspace_id: Expected uuid"
}`}</Code>
            </div>
          }
        >
          <H2>Errors</H2>
          <P>
            All errors return a consistent JSON structure with an <IC>error</IC> field and optional{" "}
            <IC>details</IC>.
          </P>
          <div className="overflow-x-auto rounded-lg border border-white/5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-white/5 bg-white/2">
                  <th className="px-3 py-2 text-left font-semibold text-zinc-300">Code</th>
                  <th className="px-3 py-2 text-left font-semibold text-zinc-300">Meaning</th>
                </tr>
              </thead>
              <tbody className="text-zinc-400">
                {[
                  ["200", "Success", "text-emerald-400"],
                  ["400", "Bad request / validation", "text-amber-400"],
                  ["401", "Invalid or missing API key", "text-amber-400"],
                  ["403", "Missing required scope", "text-amber-400"],
                  ["404", "Unknown endpoint or resource", "text-amber-400"],
                  ["429", "Rate limit exceeded", "text-orange-400"],
                  ["500", "Internal server error", "text-rose-400"],
                ].map(([code, desc, color]) => (
                  <tr key={code} className="border-b border-white/3 last:border-b-0">
                    <td className={`px-3 py-2 font-mono font-bold ${color}`}>{code}</td>
                    <td className="px-3 py-2">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionRow>

        {/* ════════ PAGINATION ════════ */}
        <SectionRow
          id="pagination"
          code={
            <Code label="Example">{`GET /v1/profiles?limit=25&offset=50

{
  "data": {
    "profiles": [...],
    "limit": 25,
    "offset": 50
  }
}`}</Code>
          }
        >
          <H2>Pagination</H2>
          <P>
            List endpoints support <IC>limit</IC> and <IC>offset</IC> query parameters. Maximum
            limit is <IC>200</IC>, default is <IC>50</IC>.
          </P>
          <Params
            title="Query parameters"
            items={[
              { name: "limit", type: "number", desc: "Items per page (1-200, default 50)" },
              { name: "offset", type: "number", desc: "Number of items to skip (default 0)" },
            ]}
          />
        </SectionRow>

        {/* ════════════════════════════════════════════
            PUBLIC API — Workspace API v1
            ════════════════════════════════════════════ */}

        <Section tier="public" active={activeTiers}>
          {/* ── Profiles ── */}
          <SectionRow
            id="get-profiles"
            tier="public"
            code={
              <div className="space-y-4">
                <Code label="curl">{`curl https://api.smartout.ai/v1/profiles \\
  -H "Authorization: Bearer smo_sk_live_..."`}</Code>
                <Code label="Response">{`{
  "data": {
    "profiles": [
      {
        "profile_id": "uuid",
        "profile_code": "EMP-001",
        "display_name": "Ola Nordmann",
        "role": "employee",
        "status": "active",
        "is_active": true,
        "job_title": "Servitor",
        "employee_number": "1001",
        "department_id": "uuid",
        "location_id": "uuid",
        "joined_at": "2026-01-15T09:00:00Z"
      }
    ],
    "limit": 50,
    "offset": 0
  }
}`}</Code>
              </div>
            }
          >
            <H2>List Profiles</H2>
            <Endpoint method="GET" path="/v1/profiles" auth="API Key" scope="profiles:read" />
            <P>
              Returns all employee profiles in your workspace. Supports filtering by status and
              active state.
            </P>
            <Params
              title="Query parameters"
              items={[
                {
                  name: "status",
                  type: "string",
                  desc: "Filter by status: trainee, active, inactive, offboarding",
                },
                { name: "is_active", type: "boolean", desc: "Filter by active state" },
                { name: "limit", type: "number", desc: "Items per page (max 200)" },
                { name: "offset", type: "number", desc: "Pagination offset" },
              ]}
            />
            <Params
              title="Response fields"
              items={[
                { name: "profile_id", type: "uuid", desc: "Unique profile identifier" },
                {
                  name: "profile_code",
                  type: "string",
                  desc: "Human-readable code (e.g. EMP-001)",
                },
                { name: "display_name", type: "string", desc: "Full name" },
                { name: "role", type: "string", desc: "employee | manager | admin | owner" },
                {
                  name: "status",
                  type: "string",
                  desc: "trainee | active | inactive | offboarding",
                },
                { name: "is_active", type: "boolean", desc: "Whether profile is active" },
                { name: "job_title", type: "string?", desc: "Job title" },
                { name: "employee_number", type: "string?", desc: "Internal employee number" },
                { name: "department_id", type: "uuid?", desc: "Department assignment" },
                { name: "location_id", type: "uuid?", desc: "Location assignment" },
                { name: "joined_at", type: "datetime", desc: "When the employee joined" },
              ]}
            />
            <Errors
              items={[
                { code: "401", desc: "Invalid API key" },
                { code: "403", desc: "Missing profiles:read scope" },
              ]}
            />
          </SectionRow>

          {/* ── Departments ── */}
          <SectionRow
            id="get-departments"
            tier="public"
            code={
              <div className="space-y-4">
                <Code label="curl">{`curl https://api.smartout.ai/v1/departments \\
  -H "Authorization: Bearer smo_sk_live_..."`}</Code>
                <Code label="Response">{`{
  "data": {
    "departments": [
      {
        "department_id": "uuid",
        "name": "Kitchen",
        "description": "Main kitchen",
        "is_active": true,
        "created_at": "2026-01-10T08:00:00Z"
      }
    ]
  }
}`}</Code>
              </div>
            }
          >
            <H2>List Departments</H2>
            <Endpoint method="GET" path="/v1/departments" auth="API Key" scope="profiles:read" />
            <P>Returns all departments in your workspace, sorted by name.</P>
            <Params
              title="Response fields"
              items={[
                { name: "department_id", type: "uuid", desc: "Unique identifier" },
                { name: "name", type: "string", desc: "Department name" },
                { name: "description", type: "string?", desc: "Description" },
                { name: "is_active", type: "boolean", desc: "Whether department is active" },
                { name: "created_at", type: "datetime", desc: "Creation timestamp" },
              ]}
            />
            <Errors
              items={[
                { code: "401", desc: "Invalid API key" },
                { code: "403", desc: "Missing profiles:read scope" },
              ]}
            />
          </SectionRow>

          {/* ── Teams ── */}
          <SectionRow
            id="get-teams"
            tier="public"
            code={
              <div className="space-y-4">
                <Code label="curl">{`curl https://api.smartout.ai/v1/teams \\
  -H "Authorization: Bearer smo_sk_live_..."`}</Code>
                <Code label="Response">{`{
  "data": {
    "teams": [
      {
        "team_id": "uuid",
        "name": "A-team",
        "description": "Evening crew",
        "department_id": "uuid",
        "leader_profile_id": "uuid",
        "is_active": true,
        "created_at": "2026-01-10T08:00:00Z"
      }
    ]
  }
}`}</Code>
              </div>
            }
          >
            <H2>List Teams</H2>
            <Endpoint method="GET" path="/v1/teams" auth="API Key" scope="profiles:read" />
            <P>Returns all teams in your workspace, sorted by name.</P>
            <Params
              title="Response fields"
              items={[
                { name: "team_id", type: "uuid", desc: "Unique identifier" },
                { name: "name", type: "string", desc: "Team name" },
                { name: "description", type: "string?", desc: "Description" },
                { name: "department_id", type: "uuid", desc: "Parent department" },
                { name: "leader_profile_id", type: "uuid?", desc: "Team leader profile" },
                { name: "is_active", type: "boolean", desc: "Whether team is active" },
                { name: "created_at", type: "datetime", desc: "Creation timestamp" },
              ]}
            />
            <Errors
              items={[
                { code: "401", desc: "Invalid API key" },
                { code: "403", desc: "Missing profiles:read scope" },
              ]}
            />
          </SectionRow>

          {/* ── Locations ── */}
          <SectionRow
            id="get-locations"
            tier="public"
            code={
              <div className="space-y-4">
                <Code label="curl">{`curl https://api.smartout.ai/v1/locations \\
  -H "Authorization: Bearer smo_sk_live_..."`}</Code>
                <Code label="Response">{`{
  "data": {
    "locations": [
      {
        "location_id": "uuid",
        "name": "Hovedrestauranten",
        "address": "Storgata 1",
        "city": "Oslo",
        "postal_code": "0001",
        "country": "NO",
        "is_active": true,
        "created_at": "2026-01-10T08:00:00Z"
      }
    ]
  }
}`}</Code>
              </div>
            }
          >
            <H2>List Locations</H2>
            <Endpoint method="GET" path="/v1/locations" auth="API Key" scope="profiles:read" />
            <P>Returns all physical locations in your workspace, sorted by name.</P>
            <Params
              title="Response fields"
              items={[
                { name: "location_id", type: "uuid", desc: "Unique identifier" },
                { name: "name", type: "string", desc: "Location name" },
                { name: "address", type: "string?", desc: "Street address" },
                { name: "city", type: "string?", desc: "City" },
                { name: "postal_code", type: "string?", desc: "Postal code" },
                { name: "country", type: "string?", desc: "Country code (e.g. NO)" },
                { name: "is_active", type: "boolean", desc: "Whether location is active" },
                { name: "created_at", type: "datetime", desc: "Creation timestamp" },
              ]}
            />
            <Errors
              items={[
                { code: "401", desc: "Invalid API key" },
                { code: "403", desc: "Missing profiles:read scope" },
              ]}
            />
          </SectionRow>

          {/* ── Contracts ── */}
          <SectionRow
            id="get-contracts"
            tier="public"
            code={
              <div className="space-y-4">
                <Code label="curl">{`curl https://api.smartout.ai/v1/contracts\\
?status=signed \\
  -H "Authorization: Bearer smo_sk_live_..."`}</Code>
                <Code label="Response">{`{
  "data": {
    "contracts": [
      {
        "contract_id": "uuid",
        "profile_id": "uuid",
        "status": "signed",
        "position_title": "Servitor",
        "employment_category": "hourly",
        "employment_percentage": 80,
        "start_date": "2026-02-01",
        "end_date": null,
        "signed_at": "2026-01-28T14:30:00Z",
        "created_at": "2026-01-20T10:00:00Z"
      }
    ],
    "limit": 50,
    "offset": 0
  }
}`}</Code>
              </div>
            }
          >
            <H2>List Contracts</H2>
            <Endpoint method="GET" path="/v1/contracts" auth="API Key" scope="contracts:read" />
            <P>
              Returns employment contracts. Sensitive fields (document URLs, signature IDs) are
              excluded from the API response.
            </P>
            <Params
              title="Query parameters"
              items={[
                { name: "profile_id", type: "uuid", desc: "Filter by employee profile" },
                { name: "status", type: "string", desc: "Filter by contract status" },
                { name: "limit", type: "number", desc: "Items per page (max 200)" },
                { name: "offset", type: "number", desc: "Pagination offset" },
              ]}
            />
            <Params
              title="Response fields"
              items={[
                { name: "contract_id", type: "uuid", desc: "Unique identifier" },
                { name: "profile_id", type: "uuid", desc: "Employee profile" },
                { name: "status", type: "string", desc: "Contract status" },
                { name: "position_title", type: "string", desc: "Job position" },
                {
                  name: "employment_category",
                  type: "string",
                  desc: "Category (hourly, salaried, etc.)",
                },
                {
                  name: "employment_percentage",
                  type: "number",
                  desc: "Employment percentage (0-100)",
                },
                { name: "start_date", type: "date", desc: "Contract start date" },
                { name: "end_date", type: "date?", desc: "Contract end date (null = permanent)" },
                { name: "signed_at", type: "datetime?", desc: "When the contract was signed" },
                { name: "created_at", type: "datetime", desc: "Creation timestamp" },
              ]}
            />
            <Errors
              items={[
                { code: "401", desc: "Invalid API key" },
                { code: "403", desc: "Missing contracts:read scope" },
              ]}
            />
          </SectionRow>

          {/* ── Protocols ── */}
          <SectionRow
            id="get-protocols"
            tier="public"
            code={
              <div className="space-y-4">
                <Code label="curl">{`curl https://api.smartout.ai/v1/protocols \\
  -H "Authorization: Bearer smo_sk_live_..."`}</Code>
                <Code label="Response">{`{
  "data": {
    "protocols": [
      {
        "protocol_id": "uuid",
        "policy_id": "uuid",
        "name": "Food Safety Basics",
        "description": "Core hygiene...",
        "type": "procedure",
        "is_active": true,
        "created_at": "2026-01-05T12:00:00Z"
      }
    ],
    "limit": 50,
    "offset": 0
  }
}`}</Code>
              </div>
            }
          >
            <H2>List Protocols</H2>
            <Endpoint method="GET" path="/v1/protocols" auth="API Key" scope="training:read" />
            <P>
              Returns training protocols (procedures, routines, checklists, etc.) in your workspace.
            </P>
            <Params
              title="Response fields"
              items={[
                { name: "protocol_id", type: "uuid", desc: "Unique identifier" },
                { name: "policy_id", type: "uuid", desc: "Parent policy" },
                { name: "name", type: "string", desc: "Protocol name" },
                { name: "description", type: "string?", desc: "Description" },
                {
                  name: "type",
                  type: "string",
                  desc: "procedure | routine | runbook | control_list | knowledge_test | confirmation",
                },
                { name: "is_active", type: "boolean", desc: "Whether protocol is active" },
                { name: "created_at", type: "datetime", desc: "Creation timestamp" },
              ]}
            />
            <Errors
              items={[
                { code: "401", desc: "Invalid API key" },
                { code: "403", desc: "Missing training:read scope" },
              ]}
            />
          </SectionRow>

          {/* ── Assignments ── */}
          <SectionRow
            id="get-assignments"
            tier="public"
            code={
              <div className="space-y-4">
                <Code label="curl">{`curl https://api.smartout.ai/v1/assignments\\
?profile_id=uuid \\
  -H "Authorization: Bearer smo_sk_live_..."`}</Code>
                <Code label="Response">{`{
  "data": {
    "assignments": [
      {
        "assignment_id": "uuid",
        "protocol_id": "uuid",
        "profile_id": "uuid",
        "status": "completed",
        "assigned_at": "2026-01-15T09:00:00Z",
        "completed_at": "2026-01-20T14:30:00Z",
        "protocol_name": "Food Safety Basics"
      }
    ],
    "limit": 50,
    "offset": 0
  }
}`}</Code>
              </div>
            }
          >
            <H2>List Assignments</H2>
            <Endpoint method="GET" path="/v1/assignments" auth="API Key" scope="training:read" />
            <P>
              Returns protocol assignments for employees. Use <IC>profile_id</IC> to check a
              specific employee&apos;s training progress.
            </P>
            <Params
              title="Query parameters"
              items={[
                { name: "profile_id", type: "uuid", desc: "Filter by employee profile" },
                { name: "limit", type: "number", desc: "Items per page (max 200)" },
                { name: "offset", type: "number", desc: "Pagination offset" },
              ]}
            />
            <Params
              title="Response fields"
              items={[
                { name: "assignment_id", type: "uuid", desc: "Unique identifier" },
                { name: "protocol_id", type: "uuid", desc: "Assigned protocol" },
                { name: "profile_id", type: "uuid", desc: "Assigned employee" },
                { name: "status", type: "string", desc: "Assignment status" },
                { name: "assigned_at", type: "datetime", desc: "When assigned" },
                {
                  name: "completed_at",
                  type: "datetime?",
                  desc: "When completed (null if pending)",
                },
                { name: "protocol_name", type: "string", desc: "Protocol name (joined)" },
              ]}
            />
            <Errors
              items={[
                { code: "401", desc: "Invalid API key" },
                { code: "403", desc: "Missing training:read scope" },
              ]}
            />
          </SectionRow>
        </Section>

        {/* ════════════════════════════════════════════
            SCHEDULES
            ════════════════════════════════════════════ */}

        <Section tier="public" active={activeTiers}>
          {/* ── Shifts ── */}
          <SectionRow
            id="get-shifts"
            tier="public"
            code={
              <div className="space-y-4">
                <Code label="curl">{`curl https://api.smartout.ai/v1/shifts?date_from=2026-03-01 \\
  -H "Authorization: Bearer smo_sk_live_..."`}</Code>
                <Code label="Response">{`{
  "data": {
    "shifts": [
      {
        "schedule_shift_id": "uuid",
        "employee_id": "uuid",
        "shift_date": "2026-03-15",
        "start_time": "09:00",
        "end_time": "17:00",
        "status": "published"
      }
    ],
    "limit": 50,
    "offset": 0
  }
}`}</Code>
              </div>
            }
          >
            <H2>List Shifts</H2>
            <Endpoint method="GET" path="/v1/shifts" auth="API Key" scope="schedules:read" />
            <P>
              Returns scheduled shifts in your workspace. Use date filters to query specific periods
              and <IC>employee_id</IC> for a single employee&apos;s schedule.
            </P>
            <Params
              title="Query parameters"
              items={[
                { name: "date_from", type: "date", desc: "Start date (YYYY-MM-DD)" },
                { name: "date_to", type: "date", desc: "End date (YYYY-MM-DD)" },
                { name: "employee_id", type: "uuid", desc: "Filter by employee profile" },
                { name: "status", type: "string", desc: "Filter by shift status" },
                { name: "limit", type: "number", desc: "Items per page (max 200)" },
                { name: "offset", type: "number", desc: "Pagination offset" },
              ]}
            />
            <Errors
              items={[
                { code: "401", desc: "Invalid API key" },
                { code: "403", desc: "Missing schedules:read scope" },
              ]}
            />
          </SectionRow>

          {/* ── Absences ── */}
          <SectionRow
            id="get-absences"
            tier="public"
            code={
              <div className="space-y-4">
                <Code label="curl">{`curl https://api.smartout.ai/v1/absences \\
  -H "Authorization: Bearer smo_sk_live_..."`}</Code>
                <Code label="Response">{`{
  "data": {
    "absences": [
      {
        "absence_id": "uuid",
        "employee_id": "uuid",
        "absence_type": "sick",
        "start_date": "2026-03-10",
        "end_date": "2026-03-11",
        "status": "approved"
      }
    ],
    "limit": 50,
    "offset": 0
  }
}`}</Code>
              </div>
            }
          >
            <H2>List Absences</H2>
            <Endpoint method="GET" path="/v1/absences" auth="API Key" scope="schedules:read" />
            <P>
              Returns absence records for your workspace. Filter by employee or status to find
              specific absence entries.
            </P>
            <Params
              title="Query parameters"
              items={[
                { name: "employee_id", type: "uuid", desc: "Filter by employee profile" },
                { name: "status", type: "string", desc: "Filter by absence status" },
                { name: "limit", type: "number", desc: "Items per page (max 200)" },
                { name: "offset", type: "number", desc: "Pagination offset" },
              ]}
            />
            <Errors
              items={[
                { code: "401", desc: "Invalid API key" },
                { code: "403", desc: "Missing schedules:read scope" },
              ]}
            />
          </SectionRow>
        </Section>

        {/* ════════════════════════════════════════════
            OPERATIONS
            ════════════════════════════════════════════ */}

        <Section tier="public" active={activeTiers}>
          {/* ── Sessions ── */}
          <SectionRow
            id="get-sessions"
            tier="public"
            code={
              <div className="space-y-4">
                <Code label="curl">{`curl https://api.smartout.ai/v1/sessions?date_from=2026-03-01 \\
  -H "Authorization: Bearer smo_sk_live_..."`}</Code>
                <Code label="Response">{`{
  "data": {
    "sessions": [
      {
        "session_id": "uuid",
        "department_id": "uuid",
        "session_date": "2026-03-15",
        "status": "active",
        "opened_at": "2026-03-15T09:00:00Z"
      }
    ],
    "limit": 50,
    "offset": 0
  }
}`}</Code>
              </div>
            }
          >
            <H2>List Sessions</H2>
            <Endpoint method="GET" path="/v1/sessions" auth="API Key" scope="operations:read" />
            <P>
              Returns department sessions. Sessions are daily containers per department that track
              operational lifecycle from opening to close.
            </P>
            <Params
              title="Query parameters"
              items={[
                { name: "department_id", type: "uuid", desc: "Filter by department" },
                { name: "status", type: "string", desc: "Filter by session status" },
                { name: "date_from", type: "date", desc: "Start date (YYYY-MM-DD)" },
                { name: "date_to", type: "date", desc: "End date (YYYY-MM-DD)" },
                { name: "limit", type: "number", desc: "Items per page (max 200)" },
                { name: "offset", type: "number", desc: "Pagination offset" },
              ]}
            />
            <Errors
              items={[
                { code: "401", desc: "Invalid API key" },
                { code: "403", desc: "Missing operations:read scope" },
              ]}
            />
          </SectionRow>

          {/* ── Deviations ── */}
          <SectionRow
            id="get-deviations"
            tier="public"
            code={
              <div className="space-y-4">
                <Code label="curl">{`curl https://api.smartout.ai/v1/deviations \\
  -H "Authorization: Bearer smo_sk_live_..."`}</Code>
                <Code label="Response">{`{
  "data": {
    "deviations": [
      {
        "deviation_id": "uuid",
        "domain": "operations",
        "severity": "medium",
        "status": "open",
        "description": "Temperature out of range",
        "created_at": "2026-03-15T14:30:00Z"
      }
    ],
    "limit": 50,
    "offset": 0
  }
}`}</Code>
              </div>
            }
          >
            <H2>List Deviations</H2>
            <Endpoint method="GET" path="/v1/deviations" auth="API Key" scope="operations:read" />
            <P>
              Returns operational deviations. Filter by domain, severity, or status to find specific
              deviation records.
            </P>
            <Params
              title="Query parameters"
              items={[
                {
                  name: "domain",
                  type: "string",
                  desc: "Filter by domain (e.g. operations, food_safety)",
                },
                {
                  name: "severity",
                  type: "string",
                  desc: "Filter by severity: low, medium, high, critical",
                },
                {
                  name: "status",
                  type: "string",
                  desc: "Filter by status: open, resolved, dismissed",
                },
                { name: "limit", type: "number", desc: "Items per page (max 200)" },
                { name: "offset", type: "number", desc: "Pagination offset" },
              ]}
            />
            <Errors
              items={[
                { code: "401", desc: "Invalid API key" },
                { code: "403", desc: "Missing operations:read scope" },
              ]}
            />
          </SectionRow>
        </Section>

        {/* ════════════════════════════════════════════
            REPORTS
            ════════════════════════════════════════════ */}

        <Section tier="public" active={activeTiers}>
          {/* ── Reconciliations ── */}
          <SectionRow
            id="get-reconciliations"
            tier="public"
            code={
              <div className="space-y-4">
                <Code label="curl">{`curl https://api.smartout.ai/v1/reconciliations?date_from=2026-03-01 \\
  -H "Authorization: Bearer smo_sk_live_..."`}</Code>
                <Code label="Response">{`{
  "data": {
    "reconciliations": [
      {
        "reconciliation_id": "uuid",
        "department_id": "uuid",
        "session_date": "2026-03-15",
        "status": "completed",
        "total_revenue": 45000
      }
    ],
    "limit": 50,
    "offset": 0
  }
}`}</Code>
              </div>
            }
          >
            <H2>List Reconciliations</H2>
            <Endpoint method="GET" path="/v1/reconciliations" auth="API Key" scope="reports:read" />
            <P>
              Returns daily reconciliation records. Reconciliations capture revenue, labor costs,
              and operational metrics per department session.
            </P>
            <Params
              title="Query parameters"
              items={[
                { name: "department_id", type: "uuid", desc: "Filter by department" },
                { name: "status", type: "string", desc: "Filter by reconciliation status" },
                { name: "date_from", type: "date", desc: "Start date (YYYY-MM-DD)" },
                { name: "date_to", type: "date", desc: "End date (YYYY-MM-DD)" },
                { name: "limit", type: "number", desc: "Items per page (max 200)" },
                { name: "offset", type: "number", desc: "Pagination offset" },
              ]}
            />
            <Errors
              items={[
                { code: "401", desc: "Invalid API key" },
                { code: "403", desc: "Missing reports:read scope" },
              ]}
            />
          </SectionRow>

          {/* ── Shift Approvals ── */}
          <SectionRow
            id="get-shift-approvals"
            tier="public"
            code={
              <div className="space-y-4">
                <Code label="curl">{`curl https://api.smartout.ai/v1/shift-approvals?status=pending \\
  -H "Authorization: Bearer smo_sk_live_..."`}</Code>
                <Code label="Response">{`{
  "data": {
    "shift_approvals": [
      {
        "approval_id": "uuid",
        "reconciliation_id": "uuid",
        "employee_id": "uuid",
        "status": "pending",
        "hours_worked": 8.5
      }
    ],
    "limit": 50,
    "offset": 0
  }
}`}</Code>
              </div>
            }
          >
            <H2>List Shift Approvals</H2>
            <Endpoint method="GET" path="/v1/shift-approvals" auth="API Key" scope="reports:read" />
            <P>
              Returns shift approval records tied to reconciliations. Use <IC>reconciliation_id</IC>{" "}
              to get approvals for a specific session.
            </P>
            <Params
              title="Query parameters"
              items={[
                { name: "reconciliation_id", type: "uuid", desc: "Filter by reconciliation" },
                { name: "status", type: "string", desc: "Filter by approval status" },
                { name: "limit", type: "number", desc: "Items per page (max 200)" },
                { name: "offset", type: "number", desc: "Pagination offset" },
              ]}
            />
            <Errors
              items={[
                { code: "401", desc: "Invalid API key" },
                { code: "403", desc: "Missing reports:read scope" },
              ]}
            />
          </SectionRow>

          {/* ── KPI Targets ── */}
          <SectionRow
            id="get-kpi-targets"
            tier="public"
            code={
              <div className="space-y-4">
                <Code label="curl">{`curl https://api.smartout.ai/v1/kpi-targets \\
  -H "Authorization: Bearer smo_sk_live_..."`}</Code>
                <Code label="Response">{`{
  "data": {
    "kpi_targets": [
      {
        "kpi_target_id": "uuid",
        "metric": "labor_percentage",
        "target_value": 28.0,
        "unit": "percent"
      }
    ]
  }
}`}</Code>
              </div>
            }
          >
            <H2>List KPI Targets</H2>
            <Endpoint method="GET" path="/v1/kpi-targets" auth="API Key" scope="reports:read" />
            <P>
              Returns all KPI targets configured for your workspace. These define operational goals
              such as labor percentage and revenue targets.
            </P>
            <Errors
              items={[
                { code: "401", desc: "Invalid API key" },
                { code: "403", desc: "Missing reports:read scope" },
              ]}
            />
          </SectionRow>

          {/* ── Budgets ── */}
          <SectionRow
            id="get-budgets"
            tier="public"
            code={
              <div className="space-y-4">
                <Code label="curl">{`curl https://api.smartout.ai/v1/budgets?date_from=2026-03-01 \\
  -H "Authorization: Bearer smo_sk_live_..."`}</Code>
                <Code label="Response">{`{
  "data": {
    "budgets": [
      {
        "budget_id": "uuid",
        "budget_date": "2026-03-15",
        "revenue_target": 50000,
        "labor_budget": 14000
      }
    ]
  }
}`}</Code>
              </div>
            }
          >
            <H2>List Budgets</H2>
            <Endpoint method="GET" path="/v1/budgets" auth="API Key" scope="reports:read" />
            <P>
              Returns operational budget targets. Use date filters to query budget data for specific
              periods.
            </P>
            <Params
              title="Query parameters"
              items={[
                { name: "date_from", type: "date", desc: "Start date (YYYY-MM-DD)" },
                { name: "date_to", type: "date", desc: "End date (YYYY-MM-DD)" },
              ]}
            />
            <Errors
              items={[
                { code: "401", desc: "Invalid API key" },
                { code: "403", desc: "Missing reports:read scope" },
              ]}
            />
          </SectionRow>
        </Section>

        {/* ════════════════════════════════════════════
            GUARDIAN
            ════════════════════════════════════════════ */}

        <Section tier="public" active={activeTiers}>
          {/* ── Signals ── */}
          <SectionRow
            id="get-signals"
            tier="public"
            code={
              <div className="space-y-4">
                <Code label="curl">{`curl https://api.smartout.ai/v1/signals?severity=high \\
  -H "Authorization: Bearer smo_sk_live_..."`}</Code>
                <Code label="Response">{`{
  "data": {
    "signals": [
      {
        "signal_id": "uuid",
        "domain": "food_safety",
        "severity": "high",
        "status": "active",
        "message": "Fridge temperature above threshold",
        "created_at": "2026-03-15T10:30:00Z"
      }
    ],
    "limit": 50,
    "offset": 0
  }
}`}</Code>
              </div>
            }
          >
            <H2>List Signals</H2>
            <Endpoint method="GET" path="/v1/signals" auth="API Key" scope="guardian:read" />
            <P>
              Returns guardian signals — automated alerts triggered by operational conditions. By
              default only active signals are returned; pass <IC>status=all</IC> for everything.
            </P>
            <Params
              title="Query parameters"
              items={[
                {
                  name: "domain",
                  type: "string",
                  desc: "Filter by domain (e.g. food_safety, operations)",
                },
                {
                  name: "severity",
                  type: "string",
                  desc: "Filter by severity: low, medium, high, critical",
                },
                {
                  name: "status",
                  type: "string",
                  desc: "Filter by status (default: active, use 'all' for everything)",
                },
                { name: "limit", type: "number", desc: "Items per page (max 200)" },
                { name: "offset", type: "number", desc: "Pagination offset" },
              ]}
            />
            <Errors
              items={[
                { code: "401", desc: "Invalid API key" },
                { code: "403", desc: "Missing guardian:read scope" },
              ]}
            />
          </SectionRow>

          {/* ── Guardian Log ── */}
          <SectionRow
            id="get-guardian-log"
            tier="public"
            code={
              <div className="space-y-4">
                <Code label="curl">{`curl https://api.smartout.ai/v1/guardian-log?since=2026-03-01T00:00:00Z \\
  -H "Authorization: Bearer smo_sk_live_..."`}</Code>
                <Code label="Response">{`{
  "data": {
    "entries": [
      {
        "entry_id": "uuid",
        "event_type": "signal_created",
        "payload": {},
        "created_at": "2026-03-15T10:30:00Z"
      }
    ],
    "limit": 50,
    "offset": 0
  }
}`}</Code>
              </div>
            }
          >
            <H2>Guardian Log</H2>
            <Endpoint method="GET" path="/v1/guardian-log" auth="API Key" scope="guardian:read" />
            <P>
              Returns the guardian event log — a chronological record of all guardian actions
              including signal creation, resolution, and escalation events.
            </P>
            <Params
              title="Query parameters"
              items={[
                { name: "event_type", type: "string", desc: "Filter by event type" },
                {
                  name: "since",
                  type: "datetime",
                  desc: "Only events after this timestamp (ISO 8601)",
                },
                { name: "limit", type: "number", desc: "Items per page (max 200)" },
                { name: "offset", type: "number", desc: "Pagination offset" },
              ]}
            />
            <Errors
              items={[
                { code: "401", desc: "Invalid API key" },
                { code: "403", desc: "Missing guardian:read scope" },
              ]}
            />
          </SectionRow>
        </Section>

        {/* ════════════════════════════════════════════
            EVENTS
            ════════════════════════════════════════════ */}

        <Section tier="public" active={activeTiers}>
          {/* ── Events ── */}
          <SectionRow
            id="get-events"
            tier="public"
            code={
              <div className="space-y-4">
                <Code label="curl">{`curl https://api.smartout.ai/v1/events?since=2026-03-01T00:00:00Z \\
  -H "Authorization: Bearer smo_sk_live_..."`}</Code>
                <Code label="Response">{`{
  "data": {
    "events": [
      {
        "event_id": "uuid",
        "event_type": "shift.started",
        "payload": {},
        "created_at": "2026-03-15T09:00:00Z"
      }
    ],
    "limit": 50,
    "offset": 0
  }
}`}</Code>
              </div>
            }
          >
            <H2>List Events</H2>
            <Endpoint method="GET" path="/v1/events" auth="API Key" scope="events:read" />
            <P>
              Returns the engine event stream. Events are emitted by the system when significant
              actions occur (shifts, sessions, deviations, etc.).
            </P>
            <Params
              title="Query parameters"
              items={[
                {
                  name: "event_type",
                  type: "string",
                  desc: "Filter by event type (e.g. shift.started)",
                },
                {
                  name: "since",
                  type: "datetime",
                  desc: "Only events after this timestamp (ISO 8601)",
                },
                { name: "limit", type: "number", desc: "Items per page (max 200)" },
                { name: "offset", type: "number", desc: "Pagination offset" },
              ]}
            />
            <Errors
              items={[
                { code: "401", desc: "Invalid API key" },
                { code: "403", desc: "Missing events:read scope" },
              ]}
            />
          </SectionRow>
        </Section>

        {/* ════════════════════════════════════════════
            SUPPLIERS
            ════════════════════════════════════════════ */}

        <Section tier="public" active={activeTiers}>
          {/* ── Suppliers ── */}
          <SectionRow
            id="get-suppliers"
            tier="public"
            code={
              <div className="space-y-4">
                <Code label="curl">{`curl https://api.smartout.ai/v1/suppliers \\
  -H "Authorization: Bearer smo_sk_live_..."`}</Code>
                <Code label="Response">{`{
  "data": {
    "suppliers": [
      {
        "supplier_id": "uuid",
        "name": "Nordic Foods AS",
        "category": "food",
        "contact_email": "order@nordicfoods.no",
        "is_active": true
      }
    ]
  }
}`}</Code>
              </div>
            }
          >
            <H2>List Suppliers</H2>
            <Endpoint method="GET" path="/v1/suppliers" auth="API Key" scope="suppliers:read" />
            <P>
              Returns all suppliers registered in your workspace. Optionally filter by category to
              find suppliers of a specific type.
            </P>
            <Params
              title="Query parameters"
              items={[{ name: "category", type: "string", desc: "Filter by supplier category" }]}
            />
            <Errors
              items={[
                { code: "401", desc: "Invalid API key" },
                { code: "403", desc: "Missing suppliers:read scope" },
              ]}
            />
          </SectionRow>

          {/* ── Supplier Orders ── */}
          <SectionRow
            id="get-supplier-orders"
            tier="public"
            code={
              <div className="space-y-4">
                <Code label="curl">{`curl https://api.smartout.ai/v1/supplier-orders?date_from=2026-03-01 \\
  -H "Authorization: Bearer smo_sk_live_..."`}</Code>
                <Code label="Response">{`{
  "data": {
    "orders": [
      {
        "order_id": "uuid",
        "supplier_id": "uuid",
        "order_date": "2026-03-15",
        "total_amount": 12500,
        "status": "delivered"
      }
    ],
    "limit": 50,
    "offset": 0
  }
}`}</Code>
              </div>
            }
          >
            <H2>List Orders</H2>
            <Endpoint
              method="GET"
              path="/v1/supplier-orders"
              auth="API Key"
              scope="suppliers:read"
            />
            <P>
              Returns supplier orders. Use <IC>supplier_id</IC> to get orders from a specific
              supplier, or date filters for a time range.
            </P>
            <Params
              title="Query parameters"
              items={[
                { name: "supplier_id", type: "uuid", desc: "Filter by supplier" },
                { name: "date_from", type: "date", desc: "Start date (YYYY-MM-DD)" },
                { name: "date_to", type: "date", desc: "End date (YYYY-MM-DD)" },
                { name: "limit", type: "number", desc: "Items per page (max 200)" },
                { name: "offset", type: "number", desc: "Pagination offset" },
              ]}
            />
            <Errors
              items={[
                { code: "401", desc: "Invalid API key" },
                { code: "403", desc: "Missing suppliers:read scope" },
              ]}
            />
          </SectionRow>
        </Section>

        {/* ════════════════════════════════════════════
            WASTE
            ════════════════════════════════════════════ */}

        <Section tier="public" active={activeTiers}>
          {/* ── Waste Logs ── */}
          <SectionRow
            id="get-waste-logs"
            tier="public"
            code={
              <div className="space-y-4">
                <Code label="curl">{`curl https://api.smartout.ai/v1/waste-logs?date_from=2026-03-01 \\
  -H "Authorization: Bearer smo_sk_live_..."`}</Code>
                <Code label="Response">{`{
  "data": {
    "waste_logs": [
      {
        "waste_log_id": "uuid",
        "category": "food",
        "department_id": "uuid",
        "quantity_kg": 2.5,
        "estimated_cost": 450,
        "logged_at": "2026-03-15T22:00:00Z"
      }
    ],
    "limit": 50,
    "offset": 0
  }
}`}</Code>
              </div>
            }
          >
            <H2>List Waste Logs</H2>
            <Endpoint method="GET" path="/v1/waste-logs" auth="API Key" scope="waste:read" />
            <P>
              Returns waste log entries. Track food waste, material waste, and other categories by
              department over time.
            </P>
            <Params
              title="Query parameters"
              items={[
                { name: "category", type: "string", desc: "Filter by waste category" },
                { name: "department_id", type: "uuid", desc: "Filter by department" },
                { name: "date_from", type: "date", desc: "Start date (YYYY-MM-DD)" },
                { name: "date_to", type: "date", desc: "End date (YYYY-MM-DD)" },
                { name: "limit", type: "number", desc: "Items per page (max 200)" },
                { name: "offset", type: "number", desc: "Pagination offset" },
              ]}
            />
            <Errors
              items={[
                { code: "401", desc: "Invalid API key" },
                { code: "403", desc: "Missing waste:read scope" },
              ]}
            />
          </SectionRow>
        </Section>

        {/* ════════════════════════════════════════════
            EQUIPMENT
            ════════════════════════════════════════════ */}

        <Section tier="public" active={activeTiers}>
          {/* ── Assets ── */}
          <SectionRow
            id="get-assets"
            tier="public"
            code={
              <div className="space-y-4">
                <Code label="curl">{`curl https://api.smartout.ai/v1/assets \\
  -H "Authorization: Bearer smo_sk_live_..."`}</Code>
                <Code label="Response">{`{
  "data": {
    "assets": [
      {
        "asset_id": "uuid",
        "name": "Walk-in Fridge #1",
        "category": "refrigeration",
        "location_id": "uuid",
        "status": "operational"
      }
    ]
  }
}`}</Code>
              </div>
            }
          >
            <H2>List Assets</H2>
            <Endpoint method="GET" path="/v1/assets" auth="API Key" scope="equipment:read" />
            <P>
              Returns all equipment assets registered in your workspace, including their current
              operational status and location.
            </P>
            <Errors
              items={[
                { code: "401", desc: "Invalid API key" },
                { code: "403", desc: "Missing equipment:read scope" },
              ]}
            />
          </SectionRow>

          {/* ── Asset Maintenance ── */}
          <SectionRow
            id="get-asset-maintenance"
            tier="public"
            code={
              <div className="space-y-4">
                <Code label="curl">{`curl https://api.smartout.ai/v1/asset-maintenance?asset_id=uuid \\
  -H "Authorization: Bearer smo_sk_live_..."`}</Code>
                <Code label="Response">{`{
  "data": {
    "maintenance_logs": [
      {
        "maintenance_id": "uuid",
        "asset_id": "uuid",
        "maintenance_type": "preventive",
        "description": "Filter replacement",
        "completed_at": "2026-03-10T14:00:00Z"
      }
    ],
    "limit": 50,
    "offset": 0
  }
}`}</Code>
              </div>
            }
          >
            <H2>Maintenance Log</H2>
            <Endpoint
              method="GET"
              path="/v1/asset-maintenance"
              auth="API Key"
              scope="equipment:read"
            />
            <P>
              Returns maintenance records for equipment assets. Use <IC>asset_id</IC> to get the
              maintenance history for a specific asset.
            </P>
            <Params
              title="Query parameters"
              items={[
                { name: "asset_id", type: "uuid", desc: "Filter by asset" },
                { name: "limit", type: "number", desc: "Items per page (max 200)" },
                { name: "offset", type: "number", desc: "Pagination offset" },
              ]}
            />
            <Errors
              items={[
                { code: "401", desc: "Invalid API key" },
                { code: "403", desc: "Missing equipment:read scope" },
              ]}
            />
          </SectionRow>

          {/* ── Asset Downtime ── */}
          <SectionRow
            id="get-asset-downtime"
            tier="public"
            code={
              <div className="space-y-4">
                <Code label="curl">{`curl https://api.smartout.ai/v1/asset-downtime?active_only=true \\
  -H "Authorization: Bearer smo_sk_live_..."`}</Code>
                <Code label="Response">{`{
  "data": {
    "downtime_logs": [
      {
        "downtime_id": "uuid",
        "asset_id": "uuid",
        "reason": "Compressor failure",
        "started_at": "2026-03-14T18:00:00Z",
        "resolved_at": null
      }
    ],
    "limit": 50,
    "offset": 0
  }
}`}</Code>
              </div>
            }
          >
            <H2>Downtime Log</H2>
            <Endpoint
              method="GET"
              path="/v1/asset-downtime"
              auth="API Key"
              scope="equipment:read"
            />
            <P>
              Returns downtime records for equipment assets. Use <IC>active_only</IC> to see only
              currently unresolved downtime events.
            </P>
            <Params
              title="Query parameters"
              items={[
                { name: "asset_id", type: "uuid", desc: "Filter by asset" },
                {
                  name: "active_only",
                  type: "boolean",
                  desc: "Only show unresolved downtime (default: false)",
                },
                { name: "limit", type: "number", desc: "Items per page (max 200)" },
                { name: "offset", type: "number", desc: "Pagination offset" },
              ]}
            />
            <Errors
              items={[
                { code: "401", desc: "Invalid API key" },
                { code: "403", desc: "Missing equipment:read scope" },
              ]}
            />
          </SectionRow>
        </Section>

        {/* ════════════════════════════════════════════
            INTERNAL — Dashboard & Edge Functions
            ════════════════════════════════════════════ */}

        <Section tier="internal" active={activeTiers}>
          <SectionRow
            id="internal-routes"
            tier="internal"
            code={
              <Code label="Edge Function base">{`https://<ref>.supabase.co/functions/v1/*

# Local development:
# localhost:3050 (dashboard)
# localhost:3055 (landing)
# 127.0.0.1:54321 (edge functions)`}</Code>
            }
          >
            <H2>Internal Endpoints</H2>
            <P>
              These endpoints are used by the SmartOut dashboard and landing page. They require
              session authentication and are not intended for third-party use.
            </P>
            <h3 className="mb-3 text-lg font-bold text-white">Web Dashboard</h3>
            <div className="space-y-2">
              {[
                {
                  method: "GET",
                  path: "/api/health",
                  desc: "System health check with DB and memory status",
                },
                {
                  method: "GET",
                  path: "/api/auth/callback",
                  desc: "OAuth callback handler (code exchange + redirect)",
                },
                {
                  method: "GET",
                  path: "/api/content/[slug]",
                  desc: "Dynamic content config for frontend",
                },
                {
                  method: "POST",
                  path: "/api/onboarding-agent",
                  desc: "Conversational onboarding agent",
                },
                {
                  method: "POST",
                  path: "/api/contract-agent",
                  desc: "Contract generation AI agent",
                },
                { method: "POST", path: "/api/journey-agent", desc: "Journey builder AI agent" },
                { method: "POST", path: "/api/reports-agent", desc: "Reports AI agent" },
                { method: "POST", path: "/api/agent/memory", desc: "Agent memory persistence" },
                { method: "POST", path: "/api/wizard/start", desc: "Start Ultravox voice session" },
                { method: "POST", path: "/api/telemetry", desc: "Event telemetry ingestion" },
                { method: "POST", path: "/api/scrape/raw", desc: "Raw website scraping proxy" },
                {
                  method: "POST",
                  path: "/api/onboarding/clauses",
                  desc: "Contract clause generation",
                },
                {
                  method: "POST",
                  path: "/api/onboarding/send-contract",
                  desc: "Send contract for signing",
                },
                {
                  method: "POST",
                  path: "/api/webhooks/docuseal",
                  desc: "DocuSeal contract webhook",
                },
              ].map((ep) => (
                <div
                  key={ep.path}
                  className="flex items-start gap-2 rounded-lg border border-white/5 bg-white/2 px-3 py-2"
                >
                  <M method={ep.method} />
                  <div>
                    <code className="text-[13px] font-semibold text-white">{ep.path}</code>
                    <p className="mt-0.5 text-[12px] text-zinc-500">{ep.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <h3 className="mt-8 mb-3 text-lg font-bold text-white">Landing Site</h3>
            <div className="space-y-2">
              {[
                { method: "GET", path: "/api/health", desc: "Landing health check" },
                { method: "GET", path: "/api/auth/callback", desc: "OAuth callback (landing)" },
                { method: "POST", path: "/api/docs-agent", desc: "AI documentation assistant" },
                { method: "POST", path: "/api/track", desc: "Analytics event tracking" },
                { method: "POST", path: "/api/revalidate", desc: "ISR revalidation trigger" },
                { method: "POST", path: "/api/wizard/start", desc: "Voice mission launcher" },
                {
                  method: "POST",
                  path: "/api/wizard/engine-start",
                  desc: "Engine-based voice session",
                },
              ].map((ep) => (
                <div
                  key={ep.path}
                  className="flex items-start gap-2 rounded-lg border border-white/5 bg-white/2 px-3 py-2"
                >
                  <M method={ep.method} />
                  <div>
                    <code className="text-[13px] font-semibold text-white">{ep.path}</code>
                    <p className="mt-0.5 text-[12px] text-zinc-500">{ep.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <h3 className="mt-8 mb-3 text-lg font-bold text-white">Edge Functions</h3>
            <div className="space-y-2">
              {[
                { name: "workspace-api", desc: "Public API gateway (v1 endpoints)" },
                {
                  name: "gather-workspace-intelligence",
                  desc: "Scrape company website + Bronnøysund",
                },
                { name: "analyze-workspace", desc: "AI analysis of gathered data" },
                { name: "finalize-workspace", desc: "Create workspace from analyzed data" },
                { name: "activate-workspace", desc: "Activate workspace after onboarding" },
                { name: "identify-company", desc: "Company identification from URL/org number" },
                { name: "google-places-intelligence", desc: "Google Places data enrichment" },
                { name: "create-invitation", desc: "Send employee invitations" },
                { name: "accept-invitation", desc: "Process invitation acceptance" },
                { name: "extract-workspace-data", desc: "Export workspace data" },
                { name: "validate-api-key", desc: "API key validation service" },
                { name: "cleanup-api-keys", desc: "Scheduled expired key cleanup" },
                { name: "engine-dispatch", desc: "Stage Engine event dispatcher" },
                { name: "contract-lifecycle", desc: "Contract state machine" },
                { name: "scrape-website", desc: "Website scraping service" },
                { name: "scrape-raw-data", desc: "Raw data extraction" },
                { name: "web-search-intelligence", desc: "Web search for company intel" },
                { name: "search-brreg", desc: "Bronnøysund registry lookup" },
                { name: "process-settlement-image", desc: "Settlement image OCR processing" },
                { name: "validate-settlement", desc: "Settlement validation logic" },
                { name: "leader-pulse", desc: "Leader engagement pulse checks" },
                { name: "guardian-sweep", desc: "Scheduled compliance checks" },
                { name: "guardian-notify", desc: "Guardian alert notifications" },
                { name: "guardian-actions", desc: "Automated guardian actions" },
                { name: "sendgrid-webhook", desc: "SendGrid inbound email webhook" },
                { name: "watchdog-integrity", desc: "Data integrity monitor" },
                { name: "watchdog-uptime", desc: "Uptime monitoring" },
                { name: "health-check", desc: "Edge function health check" },
              ].map((fn) => (
                <div
                  key={fn.name}
                  className="flex items-start gap-2 rounded border border-white/5 bg-white/2 px-3 py-2"
                >
                  <span className="shrink-0 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                    FN
                  </span>
                  <div>
                    <code className="text-[13px] font-semibold text-white">{fn.name}</code>
                    <p className="mt-0.5 text-[12px] text-zinc-500">{fn.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionRow>
        </Section>

        {/* ════════════════════════════════════════════
            ADMIN — Platform Administration
            ════════════════════════════════════════════ */}

        <Section tier="admin" active={activeTiers}>
          <SectionRow
            id="admin-endpoints"
            tier="admin"
            code={
              <Code label="Admin auth">{`// Requires is_godmode = true
// on user_identity table

// Service key pattern:
Authorization: Bearer smo_svc_live_...`}</Code>
            }
          >
            <H2>Admin Endpoints</H2>
            <P>
              Platform administration endpoints require <IC>is_godmode</IC> access on the
              user_identity table. These are used for platform management and are never exposed to
              workspace users or third parties.
            </P>
            <div className="space-y-2">
              {[
                {
                  name: "API Keys",
                  path: "/api/platform-admin/keys/*",
                  desc: "Create, rotate, revoke, usage tracking",
                },
                {
                  name: "Workspaces",
                  path: "/api/platform-admin/workspaces/*",
                  desc: "Lookup, provision, manage workspaces",
                },
                {
                  name: "Contracts",
                  path: "/api/platform-admin/contracts/*",
                  desc: "Send, remind, cancel contracts",
                },
                {
                  name: "Communications",
                  path: "/api/platform-admin/communications/*",
                  desc: "Send, translate, dry-run, AI correct, history",
                },
                {
                  name: "Journeys",
                  path: "/api/platform-admin/journeys/*",
                  desc: "Journey builder wizard, test runs, steps, transitions",
                },
                {
                  name: "Content",
                  path: "/api/platform-admin/content/*",
                  desc: "Content configs, publish management",
                },
                {
                  name: "Secrets",
                  path: "/api/platform-admin/secrets/*",
                  desc: "Vault secret management, bulk operations",
                },
                {
                  name: "Services",
                  path: "/api/platform-admin/services/*",
                  desc: "Service config, health, restart, env sync",
                },
                {
                  name: "Health",
                  path: "/api/platform-admin/health/*",
                  desc: "System status, speed tests",
                },
                {
                  name: "Users",
                  path: "/api/platform-admin/users/*",
                  desc: "Toggle godmode access",
                },
                {
                  name: "Audit Log",
                  path: "/api/platform-admin/audit-log",
                  desc: "Platform-wide audit trail",
                },
                {
                  name: "Visitor Analytics",
                  path: "/api/admin/visitor-sessions",
                  desc: "Session events, visitor tagging",
                },
              ].map((item) => (
                <div
                  key={item.name}
                  className="rounded-lg border border-rose-500/10 bg-rose-500/5 px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{item.name}</p>
                    <code className="shrink-0 text-[11px] text-zinc-600">{item.path}</code>
                  </div>
                  <p className="mt-0.5 text-[12px] text-zinc-500">{item.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3">
              <p className="text-xs font-bold tracking-wider text-rose-400 uppercase">Restricted</p>
              <p className="mt-1 text-[13px] text-zinc-400">
                Admin endpoints are not documented publicly. Contact platform team for access.
              </p>
            </div>
          </SectionRow>
        </Section>

        {/* ════════ SCOPES REFERENCE ════════ */}
        <SectionRow
          id="scopes"
          noBorder
          code={
            <Code label="Key with scopes">{`// When creating an API key,
// select which scopes to grant:

{
  "name": "POS Integration",
  "scopes": [
    "profiles:read",
    "schedules:read"
  ]
}`}</Code>
          }
        >
          <H2>Scopes Reference</H2>
          <P>
            API keys are granted specific scopes that control which endpoints they can access.
            Create keys with minimal scopes for your integration needs.
          </P>
          <div className="overflow-x-auto rounded-lg border border-white/5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-white/5 bg-white/2">
                  <th className="px-3 py-2 text-left font-semibold text-zinc-300">Scope</th>
                  <th className="px-3 py-2 text-left font-semibold text-zinc-300">Endpoints</th>
                  <th className="px-3 py-2 text-left font-semibold text-zinc-300">Status</th>
                </tr>
              </thead>
              <tbody className="text-zinc-400">
                {[
                  ["profiles:read", "/v1/profiles, departments, teams, locations", "Active"],
                  ["contracts:read", "/v1/contracts", "Active"],
                  ["training:read", "/v1/protocols, assignments", "Active"],
                  ["schedules:read", "/v1/shifts, absences", "Active"],
                  ["operations:read", "/v1/sessions, deviations", "Active"],
                  [
                    "reports:read",
                    "/v1/reconciliations, shift-approvals, kpi-targets, budgets",
                    "Active",
                  ],
                  ["guardian:read", "/v1/signals, guardian-log", "Active"],
                  ["events:read", "/v1/events", "Active"],
                  ["suppliers:read", "/v1/suppliers, supplier-orders", "Active"],
                  ["waste:read", "/v1/waste-logs", "Active"],
                  ["equipment:read", "/v1/assets, asset-maintenance, asset-downtime", "Active"],
                ].map(([scope, endpoints, status]) => (
                  <tr key={scope} className="border-b border-white/3 last:border-b-0">
                    <td className="px-3 py-2 font-mono font-semibold text-fuchsia-400">{scope}</td>
                    <td className="px-3 py-2">{endpoints}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
                          status === "Active"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-zinc-500/10 text-zinc-500"
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionRow>
      </div>
    </div>
  );
}
