import type { PublicSectionProps } from "./types";

export function PdfViewerPublic({ content, assets }: PublicSectionProps) {
  const heading = content.heading as string | undefined;
  const pdfAssetId = content.pdfAssetId as string | undefined;
  const pdf = pdfAssetId ? assets.byId[pdfAssetId] : undefined;

  if (!pdf) return null;

  const pdfUrl = `${assets.storageBaseUrl}/${pdf.storagePath}`;

  return (
    <section className="py-12 md:py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {heading && (
          <h2
            className="mb-8 text-center text-2xl font-bold md:text-3xl"
            style={{ fontFamily: "var(--site-font-heading)" }}
          >
            {heading}
          </h2>
        )}
        <div
          className="aspect-[3/4] w-full overflow-hidden"
          style={{ borderRadius: "var(--site-radius)" }}
        >
          <iframe
            src={pdfUrl}
            className="h-full w-full border-0"
            title={heading ?? "PDF-dokument"}
          />
        </div>
        <div className="mt-4 text-center">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-[var(--site-primary)] hover:underline"
          >
            Last ned PDF
          </a>
        </div>
      </div>
    </section>
  );
}
