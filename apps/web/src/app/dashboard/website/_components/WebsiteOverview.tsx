"use client";

/**
 * WebsiteOverview — main client component for /dashboard/website.
 *
 * Shows site status, stats, page list, and action bar for admins.
 * Handles the "no website yet" empty state by linking to /setup.
 * Fully responsive — 2-column stats on mobile, 4-column on desktop.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Globe, Eye, UploadCloud, FileText, Layers, Tag, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button, Badge, Card, CardContent, CardHeader, CardTitle } from "@smartout/ui";
import { useWebsite } from "../_hooks/use-website";
import { usePages } from "../_hooks/use-pages";
import { publishWebsite } from "../_actions/publish-actions";
import { createPreviewToken } from "../_actions/preview-actions";

export default function WebsiteOverview() {
  const router = useRouter();

  const { website, isLoading } = useWebsite();
  const { pages } = usePages(website?.website_id ?? null);

  // ─── Loading state ────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="z-10 flex-1 overflow-y-auto px-4 pt-8 pb-20 md:px-10">
        <div className="bg-muted h-8 w-48 animate-pulse rounded" />
      </div>
    );
  }

  // ─── Empty state — no website created yet ────────────────────

  if (!website) {
    return (
      <div className="z-10 flex-1 overflow-y-auto px-4 pt-8 pb-20 md:px-10">
        <div className="mb-6">
          <h1 className="text-foreground mb-2 text-3xl font-extrabold tracking-tight">Nettside</h1>
          <p className="text-muted-foreground text-sm">
            Du har ingen nettside ennå. Kom i gang med en mal.
          </p>
        </div>

        <div className="border-border flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-16">
          <Globe className="text-muted-foreground mb-4 h-12 w-12" />
          <p className="text-foreground mb-6 text-base font-medium">Ingen nettside opprettet</p>
          <Button asChild>
            <Link href="/dashboard/website/setup">Opprett nettside</Link>
          </Button>
        </div>
      </div>
    );
  }

  // ─── Stat cards ───────────────────────────────────────────────

  const isPublished = website.visibility === "live";
  const domainUrl = `${website.site_slug}.smartout.info`;

  const stats = [
    { label: "Sider", value: pages.length, icon: FileText },
    { label: "Seksjoner", value: "—", icon: Layers },
    { label: "Versjon", value: "—", icon: Tag },
    {
      label: "Domene",
      value: website.site_slug ? `${website.site_slug}.smartout.info` : "—",
      icon: Globe,
    },
  ];

  // ─── Publish handler ─────────────────────────────────────────

  async function handlePublish() {
    if (!website) return;
    const result = await publishWebsite(website.website_id);
    if (result.success) {
      toast.success(`Nettside publisert — versjon ${result.version}`);
    } else {
      toast.error(result.error);
    }
  }

  // ─── Preview handler ─────────────────────────────────────────

  async function handlePreview() {
    if (!website) return;
    const result = await createPreviewToken(website.website_id);
    if (result.success) {
      window.open(`https://${domainUrl}?preview=${result.token}`, "_blank");
    } else {
      toast.error(result.error ?? "Kunne ikke opprette forhåndsvisning");
    }
  }

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="z-10 flex-1 overflow-y-auto px-4 pt-8 pb-20 md:px-10">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-3">
            <h1 className="text-foreground text-3xl font-extrabold tracking-tight">
              {website.name}
            </h1>
            <Badge variant={isPublished ? "default" : "secondary"}>
              {isPublished ? "Publisert" : "Kladd"}
            </Badge>
          </div>
          {website.site_slug && (
            <a
              href={`https://${domainUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground flex items-center gap-1 text-sm hover:underline"
            >
              {domainUrl}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {/* Action bar */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePreview}>
            <Eye className="mr-2 h-4 w-4" />
            Forhåndsvisning
          </Button>
          <Button onClick={handlePublish}>
            <UploadCloud className="mr-2 h-4 w-4" />
            Publiser endringer
          </Button>
        </div>
      </div>

      {/* Stat cards — 2 cols on mobile, 4 on desktop */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                <Icon className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-foreground text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Page list */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-foreground text-lg font-semibold">Sider</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/dashboard/website/pages/new")}
          >
            + Legg til side
          </Button>
        </div>

        <div className="border-border divide-border divide-y rounded-xl border">
          {pages.length === 0 ? (
            <div className="text-muted-foreground px-5 py-8 text-center text-sm">
              Ingen sider ennå
            </div>
          ) : (
            pages.map((page) => (
              <div
                key={page.website_page_id}
                className="flex items-center justify-between px-5 py-4"
              >
                <div className="flex items-center gap-3">
                  <FileText className="text-muted-foreground h-4 w-4" />
                  <div>
                    <p className="text-foreground text-sm font-medium">{page.title}</p>
                    <p className="text-muted-foreground text-xs">/{page.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={page.is_visible ? "default" : "secondary"} className="text-xs">
                    {page.is_visible ? "Synlig" : "Skjult"}
                  </Badge>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/dashboard/website/pages/${page.website_page_id}`}>Rediger</Link>
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
