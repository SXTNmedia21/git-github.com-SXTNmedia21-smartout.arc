import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ApiSidebar } from "../_components/api-sidebar";

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
  children,
  code,
  noBorder,
}: {
  id: string;
  children: React.ReactNode;
  code?: React.ReactNode;
  noBorder?: boolean;
}) {
  return (
    <div id={id} className={`flex scroll-mt-0 ${noBorder ? "" : "border-b border-white/5"}`}>
      <div className="min-w-0 flex-1 px-8 py-8 lg:px-10 lg:py-10">{children}</div>
      <div className="hidden w-105 shrink-0 border-l border-white/5 bg-[#09090d] px-6 py-8 lg:py-10 xl:block">
        {code}
      </div>
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-2xl font-bold tracking-tight text-white">{children}</h2>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-base font-bold text-zinc-200">{children}</h3>;
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
      <p className="mb-1.5 text-xs font-bold tracking-wider text-zinc-500 uppercase">Feilkoder</p>
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

function Endpoint({ method, path, auth }: { method: string; path: string; auth: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-white/5 bg-white/2 px-3 py-2.5">
      <M method={method} />
      <code className="text-sm font-semibold text-white">{path}</code>
      <span className="ml-auto text-[11px] font-semibold tracking-wider text-zinc-600 uppercase">
        {auth}
      </span>
    </div>
  );
}

/* ─── Page ─── */

export default function ApiDocsPage() {
  return (
    <div className="fixed inset-0 z-50 flex bg-[#050505] text-white">
      <ApiSidebar />

      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* ════════ OVERVIEW ════════ */}
        <SectionRow
          id="oversikt"
          code={
            <div className="space-y-4">
              <Code label="Base URLs">{`# Web dashboard
https://app.smartout.ai/api/*

# Landing
https://smartout.ai/api/*

# Edge Functions
https://<ref>.supabase.co/functions/v1/*`}</Code>
              <div className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/5 px-3 py-2.5 text-[13px] text-fuchsia-300">
                Under lokal utvikling:
                <div className="mt-1 font-mono text-xs text-zinc-400">
                  localhost:3050 (web)
                  <br />
                  localhost:3055 (landing)
                  <br />
                  127.0.0.1:54321 (edge fn)
                </div>
              </div>
            </div>
          }
        >
          <h1 className="mb-2 text-3xl font-black tracking-tight text-white">
            SmartOut API Reference
          </h1>
          <div className="mb-4 inline-block rounded-full bg-fuchsia-500/10 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-fuchsia-400 uppercase">
            REST API v1
          </div>
          <P>
            Komplett referansedokumentasjon for SmartOut sitt API. Denne guiden dekker
            autentisering, endepunkter, feilhåndtering og kodeeksempler.
          </P>
          <P>
            SmartOut-APIet er tilgjengelig via tre base-URLer avhengig av kontekst —
            dashboard-appen, landingssiden, og Supabase Edge Functions.
          </P>
          <div className="mt-6 rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3">
            <p className="text-xs font-bold tracking-wider text-blue-400 uppercase">Tilgang</p>
            <p className="mt-1 text-[13px] text-zinc-400">
              Alle endepunkter krever en aktiv SmartOut-konto og gyldig sesjon eller bearer-token,
              med unntak av helsesjekk og publisert innhold.
            </p>
          </div>
        </SectionRow>

        {/* ════════ AUTHENTICATION ════════ */}
        <SectionRow
          id="autentisering"
          code={
            <div className="space-y-4">
              <Code label="Bearer Token">{`curl -X POST \\
  https://<ref>.supabase.co/functions/v1/create-invitation \\
  -H "Authorization: Bearer <access-token>" \\
  -H "Content-Type: application/json" \\
  -d '{"workspace_id":"...","invites":[...]}'`}</Code>
              <Code label="Session (browser)">{`// Supabase handles cookies automatically
const { data } = await supabase
  .from('profile')
  .select('*')
  .eq('workspace_id', id);`}</Code>
            </div>
          }
        >
          <H2>Autentisering</H2>
          <P>
            SmartOut bruker flere autentiseringsmønstre avhengig av endepunkttype. De fleste
            brukerrettede ruter autentiseres via Supabase session-cookies.
          </P>
          <div className="space-y-3">
            {[
              {
                name: "Session Auth",
                desc: "Cookie-basert, automatisk via Supabase i nettleser. Alle dashboard-ruter.",
              },
              {
                name: "Bearer Token",
                desc: "For Edge Functions og maskin-til-maskin kall. Send i Authorization-header.",
              },
              {
                name: "Webhook Secret",
                desc: "Statisk signaturvalidering for innkommende webhooks (DocuSeal).",
              },
              {
                name: "Offentlig",
                desc: "Helsesjekk og publisert innhold krever ingen autentisering.",
              },
            ].map((m) => (
              <div key={m.name} className="rounded-lg border border-white/5 bg-white/2 px-3 py-2.5">
                <p className="text-sm font-semibold text-white">{m.name}</p>
                <p className="mt-0.5 text-[13px] text-zinc-400">{m.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <p className="text-xs font-bold tracking-wider text-amber-400 uppercase">Viktig</p>
            <p className="mt-1 text-[13px] text-zinc-400">
              Eksponer aldri <IC>SUPABASE_SERVICE_ROLE_KEY</IC> i klientkode. Den omgår all Row
              Level Security og skal kun brukes server-side.
            </p>
          </div>
        </SectionRow>

        {/* ════════ RATE LIMITS ════════ */}
        <SectionRow
          id="rate-limits"
          code={
            <Code label="429 Response">{`{
  "error": "Too many requests",
  "details": "Rate limit exceeded. Retry after 60s."
}`}</Code>
          }
        >
          <H2>Rate limits</H2>
          <P>
            For mange forespørsler utløser <IC>429 Too Many Requests</IC>. Implementer eksponensiell
            backoff ved retry.
          </P>
          <div className="overflow-x-auto rounded-lg border border-white/5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-white/5 bg-white/2">
                  <th className="px-3 py-2 text-left font-semibold text-zinc-300">Endepunkt</th>
                  <th className="px-3 py-2 text-left font-semibold text-zinc-300">Grense</th>
                  <th className="px-3 py-2 text-left font-semibold text-zinc-300">Vindu</th>
                </tr>
              </thead>
              <tbody className="text-zinc-400">
                {[
                  ["POST /api/telemetry", "100 req", "per min"],
                  ["POST /api/onboarding-agent", "30 req", "per min"],
                  ["Edge Functions", "60 req", "per min"],
                  ["GET /api/health", "Ubegrenset", "—"],
                ].map(([ep, limit, window]) => (
                  <tr key={ep} className="border-b border-white/3 last:border-b-0">
                    <td className="px-3 py-2 font-medium text-white">{ep}</td>
                    <td className="px-3 py-2">{limit}</td>
                    <td className="px-3 py-2">{window}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionRow>

        {/* ════════ ERROR FORMAT ════════ */}
        <SectionRow
          id="feilformat"
          code={
            <div className="space-y-4">
              <Code label="Error Response">{`{
  "error": "Human-readable error message",
  "details": "Optional technical context"
}`}</Code>
              <Code label="Validation Error">{`{
  "error": "Validation failed",
  "details": "workspace_id: Expected uuid"
}`}</Code>
            </div>
          }
        >
          <H2>Feilformat</H2>
          <P>
            Alle endepunkter returnerer en konsistent JSON-feilstruktur. Status&shy;koden indikerer
            feilkategorien.
          </P>
          <div className="overflow-x-auto rounded-lg border border-white/5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-white/5 bg-white/2">
                  <th className="px-3 py-2 text-left font-semibold text-zinc-300">Kode</th>
                  <th className="px-3 py-2 text-left font-semibold text-zinc-300">Betydning</th>
                </tr>
              </thead>
              <tbody className="text-zinc-400">
                {[
                  ["200", "Vellykket forespørsel", "text-emerald-400"],
                  ["202", "Akseptert (asynkron)", "text-emerald-400"],
                  ["400", "Ugyldig forespørsel", "text-amber-400"],
                  ["401", "Ikke autentisert", "text-amber-400"],
                  ["403", "Ikke autorisert", "text-amber-400"],
                  ["404", "Ressurs ikke funnet", "text-amber-400"],
                  ["409", "Konflikt", "text-orange-400"],
                  ["429", "Rate limit", "text-orange-400"],
                  ["500", "Serverfeil", "text-rose-400"],
                  ["503", "Utilgjengelig", "text-rose-400"],
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

        {/* ════════════════════════════════════════════
            ROUTE HANDLERS
            ════════════════════════════════════════════ */}

        {/* ── Health ── */}
        <SectionRow
          id="get-health"
          code={
            <div className="space-y-4">
              <Code label="curl">{`curl -X GET https://app.smartout.ai/api/health \\
  -H "Authorization: Bearer YOUR_SECRET"`}</Code>
              <p className="text-xs font-semibold text-zinc-500">Response:</p>
              <Code>{`{
  "status": "healthy",
  "timestamp": "2026-02-28T14:30:00.000Z",
  "version": "1.0.0",
  "checks": {
    "database": {
      "status": "ok",
      "latency_ms": 12
    },
    "memory": {
      "status": "ok",
      "heap_used_mb": 45.2
    }
  }
}`}</Code>
            </div>
          }
        >
          <H2>Health</H2>
          <Endpoint method="GET" path="/api/health" auth="Offentlig / Bearer" />
          <P>
            Helsesjekk for web-appen med database- og minnekontroll. Returnerer overall status og
            individuelle sjekker.
          </P>
          <Params
            title="Respons"
            items={[
              { name: "status", type: "string", desc: "'healthy' | 'degraded' | 'unhealthy'" },
              { name: "timestamp", type: "string", desc: "ISO 8601 tidsstempel" },
              { name: "version", type: "string", desc: "Appversjon" },
              { name: "checks", type: "object", desc: "Database- og minnesjekk-resultater" },
            ]}
          />
          <Errors
            items={[
              { code: "401", desc: "Ugyldig bearer (når konfigurert)" },
              { code: "503", desc: "Systemet er unhealthy" },
            ]}
          />
        </SectionRow>

        {/* ── Auth Callback ── */}
        <SectionRow
          id="get-auth-callback"
          code={
            <div className="space-y-4">
              <Code label="Redirect-flyt">{`# Vellykket innlogging
GET /api/auth/callback?code=abc123&next=/dashboard
→ 302 Redirect → /dashboard

# Feil / ugyldig kode
GET /api/auth/callback?code=invalid
→ 302 Redirect → /login?error=Invalid_link`}</Code>
            </div>
          }
        >
          <H2>Auth Callback</H2>
          <Endpoint method="GET" path="/api/auth/callback" auth="Auth-kode" />
          <P>
            Utveksler Supabase auth-kode mot sesjon og redirecter brukeren. Brukes som callback
            etter innlogging/registrering.
          </P>
          <Params
            title="Query-parametre"
            items={[
              {
                name: "code",
                type: "string",
                req: true,
                desc: "Supabase auth-kode fra OAuth-flyten",
              },
              { name: "next", type: "string", desc: "Redirect-mål. Standard: /dashboard" },
            ]}
          />
        </SectionRow>

        {/* ── Content ── */}
        <SectionRow
          id="get-content-slug"
          code={
            <div className="space-y-4">
              <Code label="curl">{`curl -X GET https://smartout.ai/api/content/hero-section`}</Code>
              <p className="text-xs font-semibold text-zinc-500">Response:</p>
              <Code>{`{
  "slug": "hero-section",
  "name": "Hero Section Config",
  "locale": "no",
  "content": { "headline": "...", "cta": "..." },
  "version": 3,
  "published_at": "2026-02-28T10:00:00Z"
}`}</Code>
            </div>
          }
        >
          <H2>Content</H2>
          <Endpoint method="GET" path="/api/content/[slug]" auth="Offentlig" />
          <P>
            Henter publisert innholdsconfig for frontend. Brukes til dynamisk innhold på
            landingssiden.
          </P>
          <Params
            title="Respons"
            items={[
              { name: "slug", type: "string", desc: "Innholds-identifikator" },
              { name: "content", type: "object", desc: "Publisert JSON-payload" },
              { name: "version", type: "number", desc: "Versjonsnummer" },
              { name: "published_at", type: "datetime", desc: "Publiseringstidspunkt" },
            ]}
          />
          <Errors items={[{ code: "404", desc: "Innhold ikke funnet" }]} />
        </SectionRow>

        {/* ── Docs Agent ── */}
        <SectionRow
          id="post-docs-agent"
          code={
            <div className="space-y-4">
              <Code label="curl">{`curl -X POST https://smartout.ai/api/docs-agent \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "Hvordan setter jeg opp HACCP?",
    "history": []
  }'`}</Code>
              <p className="text-xs font-semibold text-zinc-500">Response:</p>
              <Code>{`{
  "answer": "For å sette opp HACCP i SmartOut...",
  "sources": [
    {
      "title": "HACCP og Mattilsynet",
      "href": "/docs/haccp"
    }
  ]
}`}</Code>
            </div>
          }
        >
          <H2>Docs Agent</H2>
          <Endpoint method="POST" path="/api/docs-agent" auth="Ingen" />
          <P>
            AI-drevet dokumentasjonsagent som besvarer spørsmål basert på brukerhåndboken. Søker i
            dokumentasjonen og returnerer kontekstuelt svar.
          </P>
          <Params
            title="Forespørsel"
            items={[
              {
                name: "message",
                type: "string",
                req: true,
                desc: "Brukerens spørsmål (1–4000 tegn)",
              },
              { name: "history", type: "array", desc: "Samtalehistorikk: [{role, content}]" },
            ]}
          />
          <Params
            title="Respons"
            items={[
              { name: "answer", type: "string", desc: "AI-generert svar" },
              { name: "sources", type: "array", desc: "Kilder med title og href" },
            ]}
          />
          <Errors
            items={[
              { code: "400", desc: "Ugyldig forespørsel" },
              { code: "500", desc: "Prosesseringsfeil" },
            ]}
          />
        </SectionRow>

        {/* ── Wizard ── */}
        <SectionRow
          id="post-wizard-start"
          code={
            <div className="space-y-4">
              <Code label="curl">{`curl -X POST https://app.smartout.ai/api/wizard/start \\
  -H "Content-Type: application/json" \\
  -d '{"mission_id": "mr-botsson"}'`}</Code>
              <p className="text-xs font-semibold text-zinc-500">Response:</p>
              <Code>{`{
  "joinUrl": "wss://voice.ultravox.ai/...",
  "callId": "call_abc123",
  "mission": "mr-botsson"
}`}</Code>
            </div>
          }
        >
          <H2>Voice Mission</H2>
          <Endpoint method="POST" path="/api/wizard/start" auth="Server-nøkkel" />
          <P>
            Starter en Ultravox stemmemisjon. Returnerer join-URL for sanntids stemmesamtale med
            AI-assistenten.
          </P>
          <Params
            title="Forespørsel"
            items={[
              { name: "mission_id", type: "string", desc: "Misjons-ID. Standard: 'mr-botsson'" },
              { name: "metadata", type: "object", desc: "Tilleggsmetadata" },
            ]}
          />
          <Params
            title="Respons"
            items={[
              { name: "joinUrl", type: "string", desc: "WebSocket-URL for stemmeøkt" },
              { name: "callId", type: "string", desc: "Unik samtale-ID" },
              { name: "mission", type: "string", desc: "Misjonsnavn" },
            ]}
          />
          <Errors
            items={[
              { code: "503", desc: "Voice-nøkkel mangler" },
              { code: "502", desc: "Oppstrøms feil" },
            ]}
          />
        </SectionRow>

        {/* ── Onboarding Agent ── */}
        <SectionRow
          id="post-onboarding-agent"
          code={
            <div className="space-y-4">
              <Code label="curl">{`curl -X POST https://app.smartout.ai/api/onboarding-agent \\
  -H "Content-Type: application/json" \\
  -H "Cookie: sb-access-token=<token>" \\
  -d '{
    "sessionId": "b0000000-...",
    "userMessage": "Vi er en restaurant med 15 ansatte",
    "conversationHistory": [],
    "extractIntelligence": false
  }'`}</Code>
              <p className="text-xs font-semibold text-zinc-500">Response:</p>
              <Code>{`{
  "text": "Flott! La meg sette opp forslag...",
  "toolCalls": [
    {
      "name": "suggest_departments",
      "args": {
        "departments": ["Kjøkken", "Sal", "Bar"]
      }
    }
  ],
  "toolResults": [...]
}`}</Code>
            </div>
          }
        >
          <H2>Onboarding Agent</H2>
          <Endpoint method="POST" path="/api/onboarding-agent" auth="Supabase-sesjon" />
          <P>
            Kjører onboarding-samtaleagenten. Kan enten føre en samtale eller hente ut strukturert
            intelligens fra samtaledata.
          </P>
          <Params
            title="Forespørsel"
            items={[
              { name: "sessionId", type: "uuid", req: true, desc: "Onboarding-sesjons-ID" },
              {
                name: "userMessage",
                type: "string",
                req: true,
                desc: "Brukerens melding (1–5000 tegn)",
              },
              {
                name: "conversationHistory",
                type: "array",
                req: true,
                desc: "Historikk: [{role, content}]",
              },
              {
                name: "extractIntelligence",
                type: "boolean",
                desc: "Hent intelligens istedenfor samtale",
              },
            ]}
          />
          <Params
            title="Respons (samtale)"
            items={[
              { name: "text", type: "string", desc: "Agentens svar" },
              { name: "toolCalls", type: "array", desc: "Verktøykall fra agenten" },
              { name: "toolResults", type: "array", desc: "Resultater fra verktøykall" },
            ]}
          />
          <Errors
            items={[
              { code: "401", desc: "Ikke autentisert" },
              { code: "403", desc: "Feil sesjonseier" },
              { code: "404", desc: "Sesjon ikke funnet" },
              { code: "500", desc: "Agentfeil" },
            ]}
          />
        </SectionRow>

        {/* ── Telemetry ── */}
        <SectionRow
          id="post-telemetry"
          code={
            <div className="space-y-4">
              <Code label="JavaScript">{`await fetch('/api/telemetry', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    event: 'page_view',
    workspace_id: 'b0000000-...',
    actor_id: 'e0000000-...',
    properties: { page: '/dashboard' }
  })
});`}</Code>
              <p className="text-xs font-semibold text-zinc-500">Response:</p>
              <Code>{`{ "ok": true }  // 202 Accepted`}</Code>
            </div>
          }
        >
          <H2>Telemetry</H2>
          <Endpoint method="POST" path="/api/telemetry" auth="Supabase-sesjon" />
          <P>
            Mottar og videresender telemetri-hendelser. Validerer at <IC>actor_id</IC> matcher
            autentisert bruker. Rate-limited til 100 req/min.
          </P>
          <Params
            title="Forespørsel"
            items={[
              { name: "event", type: "string", req: true, desc: "Hendelsesnavn" },
              { name: "workspace_id", type: "uuid", req: true, desc: "Arbeidsplassens ID" },
              { name: "actor_id", type: "uuid", req: true, desc: "Bruker-ID (må matche sesjon)" },
              { name: "properties", type: "object", desc: "Hendelses-egenskaper" },
              { name: "timestamp", type: "datetime", desc: "Tidsstempel" },
            ]}
          />
          <Errors
            items={[
              { code: "429", desc: "Rate limit" },
              { code: "401", desc: "Ikke autentisert" },
              { code: "403", desc: "Actor mismatch" },
              { code: "400", desc: "Ugyldig payload" },
            ]}
          />
        </SectionRow>

        {/* ── Webhooks ── */}
        <SectionRow
          id="post-webhooks-docuseal"
          code={
            <div className="space-y-4">
              <Code label="Webhook payload">{`{
  "event_type": "form.completed",
  "timestamp": "2026-02-28T12:00:00Z",
  "data": {
    "id": 12345,
    "submission_id": 67890,
    "status": "completed",
    "submitters": [
      {
        "email": "ansatt@bedrift.no",
        "completed_at": "2026-02-28T11:58:00Z"
      }
    ]
  }
}`}</Code>
              <p className="text-xs font-semibold text-zinc-500">Response:</p>
              <Code>{`{
  "received": true,
  "status": "signed"
}`}</Code>
            </div>
          }
        >
          <H2>DocuSeal Webhook</H2>
          <Endpoint method="POST" path="/api/webhooks/docuseal" auth="Webhook-signatur" />
          <P>
            Mottar DocuSeal-hendelser og oppdaterer kontraktstatus i SmartOut. Signaturvalidering
            via <IC>x-docuseal-signature</IC> header.
          </P>
          <Params
            title="Forespørsel"
            items={[
              { name: "event_type", type: "string", req: true, desc: "Hendelsesnavn" },
              { name: "timestamp", type: "datetime", req: true, desc: "Hendelsestidspunkt" },
              { name: "data.id", type: "number", req: true, desc: "Entitets-ID" },
              { name: "data.submission_id", type: "number", desc: "DocuSeal innleverings-ID" },
              { name: "data.status", type: "string", desc: "Oppstrøms status" },
              { name: "data.submitters", type: "array", desc: "Undertegner-data" },
            ]}
          />
          <Errors
            items={[
              { code: "401", desc: "Ugyldig signatur" },
              { code: "400", desc: "Ugyldig payload" },
              { code: "404", desc: "Kontrakt ikke funnet" },
              { code: "500", desc: "Skrivefeil" },
            ]}
          />
        </SectionRow>

        {/* ════════════════════════════════════════════
            EDGE FUNCTIONS
            ════════════════════════════════════════════ */}

        {/* ── Gather ── */}
        <SectionRow
          id="fn-gather"
          code={
            <div className="space-y-4">
              <Code label="curl">{`curl -X POST \\
  https://<ref>.supabase.co/functions/v1/gather-workspace-intelligence \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://restaurant.no","orgNumber":"999888777"}'`}</Code>
              <p className="text-xs font-semibold text-zinc-500">Response:</p>
              <Code>{`{
  "success": true,
  "sessionId": "sess_abc123",
  "scrapedData": {
    "companyName": "Restaurant AS",
    "locations": ["Hovedsal", "Terrasse"],
    "departments": ["Kjøkken", "Servering"]
  },
  "brregData": {
    "name": "Restaurant AS",
    "orgNumber": "999888777",
    "address": "Storgata 1, Oslo"
  }
}`}</Code>
            </div>
          }
        >
          <H2>Gather Intelligence</H2>
          <Endpoint
            method="POST"
            path="/functions/v1/gather-workspace-intelligence"
            auth="Valgfri Bearer"
          />
          <P>
            Samler bedriftsinformasjon fra nettside-skraping og Brønnøysund&shy;registrene.
            Oppretter en innsamlings-sesjon for videre analyse.
          </P>
          <Params
            title="Forespørsel"
            items={[
              { name: "url", type: "string", req: true, desc: "Bedriftens nettside-URL" },
              { name: "orgNumber", type: "string", desc: "Org.nr. for Brønnøysund-oppslag" },
            ]}
          />
          <Params
            title="Respons"
            items={[
              { name: "sessionId", type: "string", desc: "Innsamlings-sesjons-ID" },
              { name: "scrapedData", type: "object", desc: "Data fra nettside" },
              { name: "brregData", type: "object", desc: "Data fra Brønnøysundregistrene" },
            ]}
          />
        </SectionRow>

        {/* ── Analyze ── */}
        <SectionRow
          id="fn-analyze"
          code={
            <Code label="curl">{`curl -X POST \\
  https://<ref>.supabase.co/functions/v1/analyze-workspace \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"sessionId":"sess_abc123","companyName":"Restaurant AS"}'`}</Code>
          }
        >
          <H2>Analyze Workspace</H2>
          <Endpoint method="POST" path="/functions/v1/analyze-workspace" auth="Bearer" />
          <P>
            Analyserer innsamlet data med AI og foreslår organisasjonsstruktur — avdelinger,
            stillinger, team og rutiner.
          </P>
          <Params
            title="Forespørsel"
            items={[
              { name: "sessionId", type: "string", req: true, desc: "Sesjons-ID fra gather" },
              { name: "companyName", type: "string", desc: "Bedriftsnavn" },
              { name: "scrapedData", type: "object", desc: "Skrapede data" },
            ]}
          />
        </SectionRow>

        {/* ── Finalize ── */}
        <SectionRow
          id="fn-finalize"
          code={
            <Code label="curl">{`curl -X POST \\
  https://<ref>.supabase.co/functions/v1/finalize-workspace \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "companyName": "Restaurant AS",
    "locations": [{"name":"Hovedsal"}],
    "departments": [{"name":"Kjøkken"},{"name":"Sal"}]
  }'`}</Code>
          }
        >
          <H2>Finalize Workspace</H2>
          <Endpoint method="POST" path="/functions/v1/finalize-workspace" auth="Bearer" />
          <P>
            Oppretter workspace med company, lokasjoner, avdelinger og policies i én transaksjon.
          </P>
          <Params
            title="Forespørsel"
            items={[
              { name: "companyName", type: "string", req: true, desc: "Bedriftsnavn" },
              { name: "locations", type: "array", desc: "Lokasjoner" },
              { name: "departments", type: "array", desc: "Avdelinger" },
              { name: "policies", type: "array", desc: "Policies" },
            ]}
          />
        </SectionRow>

        {/* ── Activate ── */}
        <SectionRow
          id="fn-activate"
          code={
            <Code label="curl">{`curl -X POST \\
  https://<ref>.supabase.co/functions/v1/activate-workspace \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"workspaceData":{...}}'`}</Code>
          }
        >
          <H2>Activate Workspace</H2>
          <Endpoint method="POST" path="/functions/v1/activate-workspace" auth="Bearer" />
          <P>Aktiverer et opprettet workspace. Markerer det som klart til bruk.</P>
          <Params
            title="Forespørsel"
            items={[
              {
                name: "workspaceData",
                type: "object",
                req: true,
                desc: "Payload til activate RPC",
              },
            ]}
          />
        </SectionRow>

        {/* ── Create Invitation ── */}
        <SectionRow
          id="fn-invite"
          code={
            <div className="space-y-4">
              <Code label="curl">{`curl -X POST \\
  https://<ref>.supabase.co/functions/v1/create-invitation \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "workspace_id": "b0000000-...",
    "company_id": "a0000000-...",
    "invites": [
      {
        "email": "ny.ansatt@firma.no",
        "first_name": "Ola",
        "last_name": "Nordmann",
        "role": "employee",
        "department_ids": ["dept-uuid"]
      }
    ]
  }'`}</Code>
              <p className="text-xs font-semibold text-zinc-500">Response:</p>
              <Code>{`{
  "success": true,
  "count": 1,
  "invitations": [
    {
      "invitation_id": "inv_abc123",
      "email": "ny.ansatt@firma.no",
      "status": "pending",
      "expires_at": "2026-03-14T..."
    }
  ]
}`}</Code>
            </div>
          }
        >
          <H2>Create Invitation</H2>
          <Endpoint
            method="POST"
            path="/functions/v1/create-invitation"
            auth="Bearer (admin/owner)"
          />
          <P>
            Oppretter invitasjoner for nye ansatte. Krever admin- eller eier-rolle i workspacet.
          </P>
          <Params
            title="Forespørsel"
            items={[
              { name: "workspace_id", type: "uuid", req: true, desc: "Arbeidsplassens ID" },
              { name: "company_id", type: "uuid", req: true, desc: "Bedriftens ID" },
              { name: "invites[].email", type: "string", req: true, desc: "E-post" },
              { name: "invites[].first_name", type: "string", req: true, desc: "Fornavn" },
              { name: "invites[].last_name", type: "string", req: true, desc: "Etternavn" },
              { name: "invites[].role", type: "string", desc: "employee | manager | admin" },
              { name: "invites[].department_ids", type: "uuid[]", desc: "Avdelings-IDer" },
            ]}
          />
          <Params
            title="Respons"
            items={[
              { name: "success", type: "boolean", desc: "Vellykket" },
              { name: "count", type: "number", desc: "Antall opprettet" },
              { name: "invitations", type: "array", desc: "Invitasjonsobjekter" },
            ]}
          />
        </SectionRow>

        {/* ── Extract / Scrape / WebSearch ── */}
        <SectionRow
          id="fn-extract"
          code={
            <Code label="curl">{`curl -X POST \\
  https://<ref>.supabase.co/functions/v1/extract-workspace-data \\
  -H "Authorization: Bearer <token>" \\
  -d '{"url":"https://restaurant.no"}'`}</Code>
          }
        >
          <H2>Extract Data</H2>
          <Endpoint method="POST" path="/functions/v1/extract-workspace-data" auth="Bearer" />
          <P>Henter strukturert data fra en nettside via skrapingstjenesten.</P>
          <Params
            title="Forespørsel"
            items={[
              { name: "url", type: "string", req: true, desc: "URL å skrape" },
              { name: "config", type: "object", desc: "Skrapingskonfigurasjon" },
            ]}
          />
        </SectionRow>

        <SectionRow
          id="fn-scrape-raw"
          code={
            <Code label="curl">{`curl -X POST \\
  https://<ref>.supabase.co/functions/v1/scrape-raw-data \\
  -H "Authorization: Bearer <token>" \\
  -d '{"url":"https://restaurant.no"}'`}</Code>
          }
        >
          <H2>Scrape Raw</H2>
          <Endpoint method="POST" path="/functions/v1/scrape-raw-data" auth="Bearer" />
          <P>Rå skraping uten strukturering. Returnerer tittel, tekst, bilder og filer.</P>
        </SectionRow>

        <SectionRow
          id="fn-websearch"
          code={
            <Code label="curl">{`curl -X POST \\
  https://<ref>.supabase.co/functions/v1/web-search-intelligence \\
  -H "Authorization: Bearer <token>" \\
  -d '{"sessionId":"...","companyName":"Restaurant AS"}'`}</Code>
          }
        >
          <H2>Web Search</H2>
          <Endpoint method="POST" path="/functions/v1/web-search-intelligence" auth="Bearer" />
          <P>Nettsøk etter bedriftsinformasjon — anmeldelser, sesongmønstre, stillingsannonser.</P>
          <Params
            title="Forespørsel"
            items={[
              { name: "sessionId", type: "string", req: true, desc: "Innsamlings-sesjons-ID" },
              { name: "companyName", type: "string", req: true, desc: "Bedriftsnavn" },
              { name: "city", type: "string", desc: "By for lokalisert søk" },
            ]}
          />
        </SectionRow>

        {/* ── Monitoring ── */}
        <SectionRow
          id="fn-monitoring"
          code={
            <Code label="curl">{`curl -X GET \\
  https://<ref>.supabase.co/functions/v1/health-check \\
  -H "Authorization: Bearer <WATCHDOG_SECRET>"`}</Code>
          }
        >
          <H2>Monitoring</H2>
          <P>
            Tre overvåkningsfunksjoner for systemhelse, dataintegritet og oppetid. Alle aksepterer
            valgfri <IC>WATCHDOG_CRON_SECRET</IC>.
          </P>
          <div className="overflow-x-auto rounded-lg border border-white/5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-white/5 bg-white/2">
                  <th className="px-3 py-2 text-left font-semibold text-zinc-300">Funksjon</th>
                  <th className="px-3 py-2 text-left font-semibold text-zinc-300">Formål</th>
                </tr>
              </thead>
              <tbody className="text-zinc-400">
                <tr className="border-b border-white/3">
                  <td className="px-3 py-2 font-mono text-xs text-white">health-check</td>
                  <td className="px-3 py-2">Database + runtime helse</td>
                </tr>
                <tr className="border-b border-white/3">
                  <td className="px-3 py-2 font-mono text-xs text-white">watchdog-integrity</td>
                  <td className="px-3 py-2">Data-integritetssjekk</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono text-xs text-white">watchdog-uptime</td>
                  <td className="px-3 py-2">Oppetidssjekk mot /api/health</td>
                </tr>
              </tbody>
            </table>
          </div>
        </SectionRow>

        {/* ════════════════════════════════════════════
            ADMIN
            ════════════════════════════════════════════ */}

        <SectionRow
          id="platform-admin"
          code={
            <Code label="curl">{`curl -X GET \\
  https://app.smartout.ai/api/platform-admin/content/configs \\
  -H "Cookie: sb-access-token=<super-admin-token>"`}</Code>
          }
        >
          <H2>Platform Admin</H2>
          <P>
            Admin-endepunkter for CMS-innhold. Krever super-admin tilgang. Alle ruter under{" "}
            <IC>/api/platform-admin/</IC>.
          </P>
          <div className="overflow-x-auto rounded-lg border border-white/5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-white/5 bg-white/2">
                  <th className="px-3 py-2 text-left text-zinc-300">Metode</th>
                  <th className="px-3 py-2 text-left text-zinc-300">Sti</th>
                  <th className="px-3 py-2 text-left text-zinc-300">Formål</th>
                </tr>
              </thead>
              <tbody className="text-zinc-400">
                {[
                  ["GET", ".../configs", "List alle"],
                  ["POST", ".../configs", "Opprett draft"],
                  ["GET", ".../configs/[slug]", "Hent config"],
                  ["PATCH", ".../configs/[slug]", "Oppdater"],
                  ["DELETE", ".../configs/[slug]", "Arkiver"],
                  ["POST", ".../configs/[slug]/publish", "Publiser"],
                ].map(([method, path, purpose]) => (
                  <tr key={`${method}-${path}`} className="border-b border-white/3 last:border-b-0">
                    <td className="px-3 py-2">
                      <M method={method!} />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-white">{path}</td>
                    <td className="px-3 py-2">{purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionRow>

        <SectionRow
          id="interne-tjenester"
          noBorder
          code={
            <Code label="Internal only">{`# Scrapling service (private network)
POST /extract   → Structured extraction
POST /scrape-raw → Raw content
GET  /health    → Service status`}</Code>
          }
        >
          <H2>Internal Services</H2>
          <P>
            Interne mikrotjenester på privat nettverk. Ikke eksponert eksternt — kun tilgjengelig
            for Edge Functions og backend-prosesser.
          </P>
          <div className="mt-4 rounded-lg border border-white/5 bg-white/2 px-4 py-3">
            <H3>Scrapling</H3>
            <p className="text-[13px] text-zinc-400">
              Python FastAPI-tjeneste for nettside-ekstraksjon. Kjører i eget virtmiljø bak intern
              nettverksgrense.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded border border-white/5 px-2 py-0.5 font-mono text-xs text-zinc-300">
                POST /extract
              </span>
              <span className="rounded border border-white/5 px-2 py-0.5 font-mono text-xs text-zinc-300">
                POST /scrape-raw
              </span>
              <span className="rounded border border-white/5 px-2 py-0.5 font-mono text-xs text-zinc-300">
                GET /health
              </span>
            </div>
          </div>

          <div className="mt-8">
            <div className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/5 px-4 py-3">
              <p className="text-xs font-bold tracking-wider text-fuchsia-400 uppercase">
                Integrasjon?
              </p>
              <p className="mt-1 text-[13px] text-zinc-400">
                Interessert i API-integrasjon med SmartOut?{" "}
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-1 font-semibold text-fuchsia-300 hover:text-fuchsia-200"
                >
                  Ta kontakt <ArrowRight className="h-3 w-3" />
                </Link>
              </p>
            </div>
          </div>
        </SectionRow>
      </div>
    </div>
  );
}
