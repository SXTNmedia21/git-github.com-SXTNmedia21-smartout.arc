import { z } from "zod";

export const pdfViewerContentSchema = z.object({
  heading: z.string().default(""),
  pdfAssetId: z.string().uuid().optional(),
  showDownloadButton: z.boolean().default(true),
  downloadButtonText: z.string().default("Download PDF"),
});

export type PdfViewerContent = z.infer<typeof pdfViewerContentSchema>;

export const pdfViewerDefaults: PdfViewerContent = {
  heading: "",
  showDownloadButton: true,
  downloadButtonText: "Download PDF",
};
