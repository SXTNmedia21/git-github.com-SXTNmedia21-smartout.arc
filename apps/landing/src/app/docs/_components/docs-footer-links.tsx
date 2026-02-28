import Link from "next/link";

type LinkItem = {
  label: string;
  href: string;
  external?: boolean;
};

type DocsFooterLinksProps = {
  webAppOrigin: string;
};

const publicSiteLinks: LinkItem[] = [
  { label: "Forside", href: "/" },
  { label: "Om oss", href: "/om-oss" },
  { label: "Priser", href: "/pricing" },
  { label: "Kundehistorier", href: "/blog" },
  { label: "Dokumentasjon", href: "/docs" },
  { label: "API dokumentasjon", href: "/docs/api" },
  { label: "Logg inn", href: "/login" },
  { label: "Registrer konto", href: "/signup" },
];

const docsModuleLinks: LinkItem[] = [
  { label: "Kom i gang", href: "/docs/kom-i-gang" },
  { label: "Onboarding", href: "/docs/onboarding" },
  { label: "Vaktplan", href: "/docs/vaktplan" },
  { label: "Ansatte", href: "/docs/ansatte" },
  { label: "Oppgaver og rutiner", href: "/docs/oppgaver-rutiner" },
  { label: "HACCP", href: "/docs/haccp" },
  { label: "Kommunikasjon", href: "/docs/kommunikasjon" },
  { label: "Lise AI-assistent", href: "/docs/ai-assistent" },
  { label: "Rapporter", href: "/docs/rapporter" },
  { label: "Innstillinger", href: "/docs/innstillinger" },
];

const featureAndConceptLinks: LinkItem[] = [
  { label: "Feature: Shift Planner", href: "/features/shiftplanner" },
  { label: "Feature: Staff Training", href: "/features/staff-training" },
  { label: "Feature: Punchclock", href: "/features/punchclock-timetracking" },
  { label: "Feature: Task & Rutines", href: "/features/task-rutines" },
  { label: "Feature: Communications", href: "/features/communications" },
  { label: "Feature: HACCP", href: "/features/haccp-complience" },
  { label: "Concept: Daily Session", href: "/concepts/daily-session" },
  { label: "Concept: Lokations", href: "/concepts/lokations" },
  { label: "Concept: Procedures", href: "/concepts/procedures" },
  { label: "Concept: Seasons", href: "/concepts/seasons" },
];

const docsSourceLinks: LinkItem[] = [
  { label: "API roadmap", href: "/docs/api#roadmap" },
  { label: "API inventory", href: "/docs/api#inventory" },
  { label: "API endpoint reference", href: "/docs/api#endpoint-reference" },
  { label: "OpenAPI source spec", href: "/docs/api#openapi" },
  { label: "Release visibility profiles", href: "/docs/api#visibility" },
];

function renderLink(item: LinkItem) {
  if (item.external) {
    return (
      <a
        key={item.href}
        href={item.href}
        target="_blank"
        rel="noreferrer"
        className="text-zinc-400 transition-colors hover:text-orange-300"
      >
        {item.label}
      </a>
    );
  }

  return (
    <Link
      key={item.href}
      href={item.href}
      className="text-zinc-400 transition-colors hover:text-orange-300"
    >
      {item.label}
    </Link>
  );
}

export function DocsFooterLinks({ webAppOrigin }: DocsFooterLinksProps) {
  const webAppLinks: LinkItem[] = [
    { label: "Web-app dashboard", href: `${webAppOrigin}/dashboard`, external: true },
    { label: "Web-app onboarding", href: `${webAppOrigin}/onboarding`, external: true },
    { label: "Web-app login", href: `${webAppOrigin}/login`, external: true },
    { label: "Web-app signup", href: `${webAppOrigin}/signup`, external: true },
  ];

  const redirectLinks: LinkItem[] = [
    { label: "Auth callback (default /dashboard)", href: "/api/auth/callback?code=demo" },
    {
      label: "Auth callback with next=/onboarding",
      href: "/api/auth/callback?code=demo&next=/onboarding",
    },
    { label: "Auth callback error fallback", href: "/api/auth/callback" },
  ];

  return (
    <footer className="mt-16 border-t border-white/10 pt-8">
      <h3 className="mb-5 text-sm font-semibold tracking-wide text-zinc-300 uppercase">
        Lenker og redirects
      </h3>

      <div className="grid gap-8 md:grid-cols-2">
        <section className="space-y-2">
          <h4 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            Public pages
          </h4>
          <div className="flex flex-col gap-1 text-sm">{publicSiteLinks.map(renderLink)}</div>
        </section>

        <section className="space-y-2">
          <h4 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            Docs modules
          </h4>
          <div className="flex flex-col gap-1 text-sm">{docsModuleLinks.map(renderLink)}</div>
        </section>

        <section className="space-y-2">
          <h4 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            Features and concepts
          </h4>
          <div className="flex flex-col gap-1 text-sm">
            {featureAndConceptLinks.map(renderLink)}
          </div>
        </section>

        <section className="space-y-2">
          <h4 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            API docs links
          </h4>
          <div className="flex flex-col gap-1 text-sm">{docsSourceLinks.map(renderLink)}</div>
        </section>

        <section className="space-y-2">
          <h4 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            Web-app links
          </h4>
          <div className="flex flex-col gap-1 text-sm">{webAppLinks.map(renderLink)}</div>
        </section>

        <section className="space-y-2">
          <h4 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            Redirect behaviors
          </h4>
          <div className="flex flex-col gap-1 text-sm">{redirectLinks.map(renderLink)}</div>
        </section>
      </div>
    </footer>
  );
}
