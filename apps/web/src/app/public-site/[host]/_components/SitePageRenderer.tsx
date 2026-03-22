import type { SnapshotPage, WebsiteTheme, SnapshotAsset } from "@smartout/website";
import { PUBLIC_SECTION_MAP } from "./sections";

/**
 * Renders all sections for a page in sort order.
 * Unknown section types are skipped with a console warning.
 */
export function SitePageRenderer({
  page,
  theme,
  assets,
}: {
  page: SnapshotPage;
  theme: WebsiteTheme;
  assets: { byId: Record<string, SnapshotAsset>; storageBaseUrl: string };
}) {
  const sorted = [...page.sections].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <main>
      {sorted.map((section) => {
        const Renderer = PUBLIC_SECTION_MAP[section.type];
        if (!Renderer) {
          console.warn(`[public-site] Unknown section type: "${section.type}", skipping`);
          return null;
        }
        return (
          <Renderer
            key={section.id}
            content={section.content}
            settings={section.settings}
            theme={theme}
            assets={assets}
          />
        );
      })}
    </main>
  );
}
