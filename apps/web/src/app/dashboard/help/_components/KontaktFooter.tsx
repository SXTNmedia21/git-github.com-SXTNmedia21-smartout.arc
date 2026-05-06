/**
 * KontaktFooter — Tier 5 of the /dashboard/help Multi-Tier Hub (ADR-0219).
 *
 * What: Three contact channels with honest svartider + a system status badge.
 * Why: Trust through transparency. Users deserve to know what to expect before
 *      they reach out — wrong expectations erode confidence in the product.
 *
 * Inclusivity (I-2): Status badge communicates via BOTH color dot AND text
 * label — color alone is forbidden per the 5 Falsifiable Inclusivity Invariants.
 *
 * Status (v1): Hardcoded to STATUS_OK = true. Real endpoint wiring is v2.
 * TODO Phase 2: replace STATUS_OK with a live /api/status probe so the badge
 *               reflects actual system health.
 *
 * Design spec: docs/superpowers/specs/2026-04-28-dashboard-help-design.md §Tier 5
 *
 * Server Component — no client-side state needed for v1 static content.
 */

import { Clock, Mail, MessageSquare } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// v1: hardcoded — wire to a real status endpoint in Phase 2.
const STATUS_OK = true;

type ContactMethod = {
  Icon: LucideIcon;
  title: string;
  description: string;
  svartid: string;
  href: string;
  hrefLabel: string;
};

const CONTACT_METHODS: ContactMethod[] = [
  {
    Icon: Mail,
    title: "E-post",
    description: "For ikke-akutte henvendelser, spørsmål og tilbakemeldinger.",
    svartid: "Svar innen 4 timer på hverdager",
    href: "mailto:support@smartout.no",
    hrefLabel: "support@smartout.no",
  },
  {
    Icon: MessageSquare,
    title: "Botsson chat",
    description: "Stokk og søk i håndboken, få hjelp med vakter og lønn — tilgjengelig nå.",
    svartid: "Svar umiddelbart",
    href: "#botsson-hero",
    hrefLabel: "Start samtale",
  },
  {
    Icon: Clock,
    title: "Helpdesk-saker",
    description: "Registrer en sak for oppfølging av leder eller support. Spores med SLA.",
    svartid: "Svar innen 1 arbeidsdag",
    href: "/dashboard/communications",
    hrefLabel: "Gå til Komm",
  },
];

export function KontaktFooter() {
  return (
    <footer
      aria-labelledby="kontakt-footer-heading"
      className="border-border bg-card rounded-xl border p-6"
    >
      {/* Heading row with system status badge */}
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2
          id="kontakt-footer-heading"
          className="text-muted-foreground text-sm font-semibold tracking-widest uppercase"
        >
          Kontakt
        </h2>

        {/* I-2 dual-channel status badge: color dot + text label — never color alone */}
        <div
          role="status"
          aria-live="polite"
          aria-label={STATUS_OK ? "Systemstatus: OK" : "Systemstatus: Feil oppdaget"}
          className="border-border flex items-center gap-1.5 rounded-full border px-3 py-1"
        >
          {/* Color dot (channel 1) */}
          {/* TODO Phase 2 Nordic Split: replace bg-emerald-500 / bg-destructive with
              semantic tokens bg-signal-live / bg-signal-error once tokens are minted. */}
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${STATUS_OK ? "bg-emerald-500" : "bg-destructive"}`}
          />
          {/* Text label (channel 2) */}
          <span className="text-foreground text-xs font-medium">
            {STATUS_OK ? "Alle systemer fungerer" : "Feil oppdaget"}
          </span>
        </div>
      </div>

      {/* Contact method list */}
      <ul className="divide-border divide-y" role="list">
        {CONTACT_METHODS.map(({ Icon, title, description, svartid, href, hrefLabel }) => (
          <li key={title} className="flex items-start gap-4 py-4">
            {/* Icon */}
            <div className="mt-0.5 shrink-0">
              <Icon className="text-muted-foreground h-5 w-5" aria-hidden="true" />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <p className="text-foreground text-sm font-medium">{title}</p>
              <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                <Clock className="mr-1 inline h-3 w-3 align-text-bottom" aria-hidden="true" />
                {svartid}
              </p>
            </div>

            {/* CTA link */}
            <a
              href={href}
              className="text-primary shrink-0 text-sm font-medium underline-offset-4 hover:underline"
            >
              {hrefLabel}
            </a>
          </li>
        ))}
      </ul>
    </footer>
  );
}
