import type { SnapshotNavPage, SnapshotAsset } from "@smartout/website";
import { MobileNavToggle } from "./MobileNavToggle";

export function SiteNavigation({
  siteName,
  pages,
  logoAsset,
  storageBaseUrl,
}: {
  siteName: string;
  pages: SnapshotNavPage[];
  logoAsset?: SnapshotAsset;
  storageBaseUrl: string;
}) {
  const sortedPages = [...pages].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <header className="site-bg-background site-border-muted sticky top-0 z-50 border-b">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative flex h-16 items-center justify-between">
          {/* Logo / Site name */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- public site uses native anchor for customer domain routing */}
          <a href="/" className="flex shrink-0 items-center gap-3">
            {logoAsset && (
              <img
                src={`${storageBaseUrl}/${logoAsset.storagePath}`}
                alt={logoAsset.alt || siteName}
                className="h-8 w-auto"
              />
            )}
            <span
              className="text-lg font-semibold"
              style={{ fontFamily: "var(--site-font-heading)" }}
            >
              {siteName}
            </span>
          </a>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-6 md:flex">
            {sortedPages.map((page) => (
              <a
                key={page.slug}
                href={page.slug === "" ? "/" : `/${page.slug}`}
                className="site-hover-text-primary text-sm font-medium transition-colors"
              >
                {page.title}
              </a>
            ))}
          </nav>

          {/* Mobile nav */}
          <MobileNavToggle>
            {sortedPages.map((page) => (
              <a
                key={page.slug}
                href={page.slug === "" ? "/" : `/${page.slug}`}
                className="site-hover-text-primary py-2 text-sm font-medium transition-colors"
              >
                {page.title}
              </a>
            ))}
          </MobileNavToggle>
        </div>
      </div>
    </header>
  );
}
