"use client";

/**
 * WebsiteOverview — main client component for /dashboard/website.
 *
 * Shows site status, stats, page list, and action bar for admins.
 * Handles the "no website yet" empty state by linking to /setup.
 */

import { useContext } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Globe, Eye, UploadCloud, FileText, Layers, Tag, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button, Badge, Card, CardContent, CardHeader, CardTitle } from "@smartout/ui";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWebsite } from "../_hooks/use-website";
import { usePages } from "../_hooks/use-pages";
import { publishWebsite } from "../_actions/publish-actions";
import { createPreviewToken } from "../_actions/preview-actions";

export default function WebsiteOverview() {
  const { isDark } = useContext(DashboardContext);
  const router = useRouter();

  const { website, isLoading } = useWebsite();
  const { pages } = usePages(website?.website_id ?? null);

  // ─── Loading state ────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="z-10 flex-1 overflow-y-auto px-10 pt-8 pb-20">
        <div
          className={`h-8 w-48 animate-pulse rounded ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`}
        />
      </div>
    );
  }

  // ─── Empty state — no website created yet ────────────────────

  if (!website) {
    return (
      <div className="z-10 flex-1 overflow-y-auto px-10 pt-8 pb-20">
        <div className="mb-6">
          <h1
            className={`mb-2 text-3xl font-extrabold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}
          >
            Nettside
          </h1>
          <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
            Du har ingen nettside ennå. Kom i gang med en mal.
          </p>
        </div>

        <div
          className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-16 ${
            isDark ? "border-zinc-800 bg-zinc-900/20" : "border-zinc-300 bg-zinc-50"
          }`}
        >
          <Globe className={`mb-4 h-12 w-12 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />
          <p className={`mb-6 text-base font-medium ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
            Ingen nettside opprettet
          </p>
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
    <div className="z-10 flex-1 overflow-y-auto px-10 pt-8 pb-20">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="mb-1 flex items-center gap-3">
            <h1
              className={`text-3xl font-extrabold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}
            >
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
              className={`flex items-center gap-1 text-sm hover:underline ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
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

      {/* Stat cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                <Icon className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
                  {stat.value}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Page list */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
            Sider
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/dashboard/website/pages/new")}
          >
            + Legg til side
          </Button>
        </div>

        <div
          className={`divide-y rounded-xl border ${isDark ? "divide-zinc-800 border-zinc-800 bg-zinc-900/40" : "divide-zinc-200 border-zinc-200 bg-white"}`}
        >
          {pages.length === 0 ? (
            <div
              className={`px-5 py-8 text-center text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              Ingen sider ennå
            </div>
          ) : (
            pages.map((page) => (
              <div
                key={page.website_page_id}
                className={`flex items-center justify-between px-5 py-4`}
              >
                <div className="flex items-center gap-3">
                  <FileText className={`h-4 w-4 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
                  <div>
                    <p
                      className={`text-sm font-medium ${isDark ? "text-zinc-100" : "text-zinc-900"}`}
                    >
                      {page.title}
                    </p>
                    <p className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                      /{page.slug}
                    </p>
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
