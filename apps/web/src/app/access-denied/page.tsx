import Link from "next/link";

export default async function AccessDeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;

  const messages: Record<string, { title: string; description: string }> = {
    "workspace-not-found": {
      title: "Workspace ikke funnet",
      description: "Denne workspace-adressen finnes ikke. Sjekk URL-en og prøv igjen.",
    },
    "no-profile": {
      title: "Ingen tilgang",
      description:
        "Du har ikke en profil i denne workspace-en. Kontakt en administrator for å få tilgang.",
    },
  };

  const msg = messages[reason ?? ""] ?? {
    title: "Tilgang nektet",
    description: "Du har ikke tilgang til denne siden.",
  };

  const portalUrl =
    process.env.NEXT_PUBLIC_ROOT_DOMAIN && process.env.NEXT_PUBLIC_ROOT_DOMAIN !== "localhost"
      ? `https://app.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/select-workspace`
      : "/";

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h1 className="text-foreground mb-2 text-2xl font-black">{msg.title}</h1>
        <p className="text-muted-foreground mb-8">{msg.description}</p>
        <Link
          href={portalUrl}
          className="text-foreground hover:bg-accent inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold transition-colors"
        >
          Gå til mine workspaces
        </Link>
      </div>
    </div>
  );
}
