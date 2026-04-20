"use client";

import dynamic from "next/dynamic";
import { withEntrance } from "@smartout/ui";
import { EditorSkeleton } from "@/components/ui/editor-skeleton";

/**
 * Client wrapper that dynamic-imports TemplateEditor. Required because the
 * consumer (`platform-admin/contracts/templates/[id]/edit/page.tsx`) is a
 * Server Component and `dynamic({ ssr: false })` only works inside a Client
 * Component context.
 *
 * Re-exports `TemplateEditor` with the same name + props as the original,
 * wrapped in `withEntrance` so the swap from skeleton to real editor follows
 * the canonical Nordic Split content-swap spring.
 */
export const TemplateEditor = dynamic(
  () =>
    import("./template-editor").then((m) => ({
      default: withEntrance(m.TemplateEditor),
    })),
  { ssr: false, loading: () => <EditorSkeleton /> },
);
