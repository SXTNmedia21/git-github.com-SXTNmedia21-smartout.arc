import { Suspense } from "react";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/server";
import { resolveDashboardContext } from "../_data/resolve-page-context";
import { HandbookPageClient } from "./_components/handbook-page-client";
import HandbookLoading from "./loading";
import { handbookReaderKeys, type HandbookChapter } from "./_hooks/use-handbook-chapters";

// UI Events:
// - nav: /dashboard/handbook (sidebar link)
// - nav: chapter selection in sidebar

/**
 * /dashboard/handbook — Server Component shell.
 *
 * Pre-fetches handbook chapters server-side and hydrates them into the
 * TanStack cache so ChapterReader's `useHandbookChapters()` returns data
 * immediately on first render. Per ADR-0115 RSC migration pattern + canonical
 * Next.js 16 + TanStack Query v5 HydrationBoundary pattern.
 */
export default async function HandbookPage() {
  const { workspace } = await resolveDashboardContext();

  const supabase = await createClient();
  const { data } = await supabase
    .from("handbook_chapter")
    .select("handbook_chapter_id, chapter_key, title, content, updated_at")
    .eq("workspace_id", workspace.workspace_id)
    .order("chapter_key");

  const chapters: HandbookChapter[] = (data ?? []).map((row) => ({
    id: row.handbook_chapter_id,
    chapterKey: row.chapter_key,
    title: row.title,
    content: row.content,
    updatedAt: row.updated_at,
  }));

  const queryClient = new QueryClient();
  queryClient.setQueryData(handbookReaderKeys.chapters(workspace.workspace_id), chapters);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<HandbookLoading />}>
        <HandbookPageClient />
      </Suspense>
    </HydrationBoundary>
  );
}
