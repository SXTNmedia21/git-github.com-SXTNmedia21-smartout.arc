import { z } from "zod";
import { defineTool } from "../../types";
import type { ContractToolContext } from "./types";

/**
 * generate_preview — Generates an HTML preview of the contract.
 * Returns the current HTML wrapped in a complete document template for preview rendering.
 */
export const generatePreview = defineTool({
  name: "generate_preview",
  description:
    "Generate a complete HTML preview of the contract document. Wraps the current editor content in a styled HTML template suitable for preview or PDF generation via the contract microservice.",
  schema: z.object({
    accentColor: z
      .string()
      .optional()
      .default("#FF6B35")
      .describe("Accent color for headers and design elements"),
    includeWatermark: z.boolean().optional().default(false).describe("Include a DRAFT watermark"),
  }),
  execute: async ({ accentColor, includeWatermark }, ctx: ContractToolContext) => {
    if (!ctx.editorState) {
      return JSON.stringify({ error: "No editor state available" });
    }

    const watermarkCss = includeWatermark
      ? `
        body::before {
          content: 'UTKAST';
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-45deg);
          font-size: 120px;
          font-weight: bold;
          color: rgba(0,0,0,0.05);
          z-index: 0;
          pointer-events: none;
        }
      `
      : "";

    const previewHtml = `<!DOCTYPE html>
<html lang="no">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kontraktsforhåndsvisning</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Inter, -apple-system, system-ui, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
      background: white;
    }
    h1 { color: ${accentColor}; font-size: 24px; margin-bottom: 16px; }
    h2 { color: ${accentColor}; font-size: 18px; margin: 24px 0 12px; border-bottom: 2px solid ${accentColor}20; padding-bottom: 4px; }
    h3 { font-size: 16px; margin: 16px 0 8px; }
    p { margin-bottom: 8px; }
    [data-type="placeholder-field"] {
      display: inline;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      background: #f0f0f0;
      border: 1px solid #ddd;
    }
    [data-type="signature-field"] {
      border: 2px dashed #ccc;
      padding: 24px;
      margin: 16px 0;
      border-radius: 8px;
      text-align: center;
      color: #888;
    }
    ${watermarkCss}
  </style>
</head>
<body>
  ${ctx.editorState.html}
</body>
</html>`;

    return JSON.stringify({
      success: true,
      previewHtml,
      message: "HTML preview generated. Ready for PDF conversion via contract microservice.",
    });
  },
});
