import { z } from "zod";
import { defineTool } from "../../types";
import type { ContractToolContext, EditorAction } from "./types";

/**
 * add_image — Inserts an image (logo, watermark, or inline) into the document.
 * Returns an EditorAction for client-side image insertion.
 */
export const addImage = defineTool({
  name: "add_image",
  description:
    "Insert an image into the contract document. Can be used for logos, watermarks, or inline images. Provide a URL to the image.",
  schema: z.object({
    url: z.string().url().describe("URL of the image to insert"),
    alt: z.string().describe("Alt text description for the image"),
    position: z
      .enum(["header", "footer", "inline", "watermark"])
      .describe("Where to place the image"),
    width: z.number().optional().describe("Image width in pixels"),
  }),
  execute: async ({ url, alt, position, width }, _ctx: ContractToolContext) => {
    const action: EditorAction = {
      type: "add_image",
      data: { url, alt, position, width },
    };

    return JSON.stringify({
      success: true,
      action,
      message: `Image will be inserted at "${position}" position.`,
    });
  },
});
