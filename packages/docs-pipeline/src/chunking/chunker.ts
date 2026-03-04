// ============================================
// chunker.ts
// Splits markdown documents into chunks for embedding.
// Strategy varies by document type: ADRs stay whole,
// larger docs split on ## headings with ### sub-splits.
// Connected to: src/commands/ingest.ts (called during ingestion)
// Connected to: src/chunking/metadata-extractor.ts (provides doc metadata)
// ============================================

import { extractMetadata, type DocType } from "./metadata-extractor";
import { estimateTokens } from "../utils/tokens";
import { hashString } from "../utils/hash";

/** Maximum tokens per chunk before sub-splitting */
const MAX_CHUNK_TOKENS = 1200;

/** Number of overlap sentences to include between chunks for continuity */
const OVERLAP_SENTENCES = 2;

/**
 * A single chunk of documentation ready for embedding.
 */
export type Chunk = {
  sourcePath: string;
  sourceHash: string;
  contentHash: string;
  docType: DocType;
  chunkIndex: number;
  sectionTitle: string | null;
  content: string;
  tokenCount: number;
  metadata: Record<string, unknown>;
};

/**
 * Doc types that should be kept as a single chunk (whole-file).
 * ADRs and roadmaps are typically under 1200 tokens.
 */
const WHOLE_FILE_TYPES: ReadonlySet<DocType> = new Set(["adr", "roadmap"]);

/**
 * Chunks a markdown document into pieces suitable for embedding.
 *
 * Why: Embedding works best on focused chunks of 800-1200 tokens.
 * ADRs are small enough to embed whole. Larger docs (modules,
 * architecture) need splitting on heading boundaries to keep
 * each chunk semantically coherent.
 *
 * @param content - Raw markdown content of the file
 * @param sourcePath - Relative path to the file (from project root)
 * @param sourceHash - SHA-256 hash of the entire file
 * @returns Array of Chunk objects ready for embedding and insertion
 */
export function chunkDocument(content: string, sourcePath: string, sourceHash: string): Chunk[] {
  const meta = extractMetadata(content, sourcePath);
  const { docType, title, bodyContent } = meta;

  // Build context header that gets prepended to every chunk
  const contextHeader = buildContextHeader(title, docType, sourcePath);

  // ADRs and roadmaps: embed as a single chunk
  if (WHOLE_FILE_TYPES.has(docType)) {
    const chunkContent = `${contextHeader}\n\n${bodyContent}`.trim();
    return [
      {
        sourcePath,
        sourceHash,
        contentHash: hashString(chunkContent),
        docType,
        chunkIndex: 0,
        sectionTitle: title,
        content: chunkContent,
        tokenCount: estimateTokens(chunkContent),
        metadata: buildMetadata(meta.frontmatter, title),
      },
    ];
  }

  // Split on ## headings for larger documents
  const sections = splitOnHeadings(bodyContent, 2);

  // If the entire doc fits in one chunk, keep it whole
  const fullContent = `${contextHeader}\n\n${bodyContent}`.trim();
  if (estimateTokens(fullContent) <= MAX_CHUNK_TOKENS) {
    return [
      {
        sourcePath,
        sourceHash,
        contentHash: hashString(fullContent),
        docType,
        chunkIndex: 0,
        sectionTitle: title,
        content: fullContent,
        tokenCount: estimateTokens(fullContent),
        metadata: buildMetadata(meta.frontmatter, title),
      },
    ];
  }

  const chunks: Chunk[] = [];
  let chunkIndex = 0;

  for (const section of sections) {
    const sectionWithHeader = `${contextHeader}\n\n${section.content}`.trim();
    const sectionTokens = estimateTokens(sectionWithHeader);

    // If section fits within limit, add as single chunk
    if (sectionTokens <= MAX_CHUNK_TOKENS) {
      chunks.push({
        sourcePath,
        sourceHash,
        contentHash: hashString(sectionWithHeader),
        docType,
        chunkIndex,
        sectionTitle: section.title,
        content: sectionWithHeader,
        tokenCount: sectionTokens,
        metadata: buildMetadata(meta.frontmatter, title, section.title),
      });
      chunkIndex++;
      continue;
    }

    // Sub-split on ### headings if section is too large
    const subSections = splitOnHeadings(section.content, 3);

    for (const subSection of subSections) {
      const subContent = `${contextHeader}\n\n${subSection.content}`.trim();
      const subTokens = estimateTokens(subContent);

      // If still too large, split on paragraph boundaries
      if (subTokens > MAX_CHUNK_TOKENS) {
        const paraChunks = splitOnParagraphs(subSection.content, MAX_CHUNK_TOKENS, contextHeader);
        for (const paraChunk of paraChunks) {
          chunks.push({
            sourcePath,
            sourceHash,
            contentHash: hashString(paraChunk.content),
            docType,
            chunkIndex,
            sectionTitle: subSection.title ?? section.title,
            content: paraChunk.content,
            tokenCount: paraChunk.tokenCount,
            metadata: buildMetadata(meta.frontmatter, title, subSection.title ?? section.title),
          });
          chunkIndex++;
        }
      } else {
        chunks.push({
          sourcePath,
          sourceHash,
          contentHash: hashString(subContent),
          docType,
          chunkIndex,
          sectionTitle: subSection.title ?? section.title,
          content: subContent,
          tokenCount: subTokens,
          metadata: buildMetadata(meta.frontmatter, title, subSection.title ?? section.title),
        });
        chunkIndex++;
      }
    }
  }

  // Add overlap sentences between consecutive chunks for continuity
  return addOverlapSentences(chunks);
}

// --- Internal helpers ---

type Section = {
  title: string | null;
  content: string;
};

/**
 * Splits markdown content on heading boundaries.
 *
 * @param content - Markdown text to split
 * @param headingLevel - Level of heading to split on (2 = ##, 3 = ###)
 * @returns Array of sections with their title and content
 */
function splitOnHeadings(content: string, headingLevel: number): Section[] {
  // Build regex for the target heading level (e.g., /^## /m for level 2)
  const prefix = "#".repeat(headingLevel);
  const regex = new RegExp(`^${prefix}\\s+`, "m");

  const lines = content.split("\n");
  const sections: Section[] = [];
  let currentTitle: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    if (regex.test(line)) {
      // Save the previous section if it has content
      if (currentLines.length > 0) {
        sections.push({
          title: currentTitle,
          content: currentLines.join("\n").trim(),
        });
      }
      // Start a new section
      currentTitle = line.replace(/^#+\s+/, "").trim();
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  // Don't forget the last section
  if (currentLines.length > 0) {
    sections.push({
      title: currentTitle,
      content: currentLines.join("\n").trim(),
    });
  }

  return sections;
}

/**
 * Splits content on paragraph boundaries when heading splits aren't enough.
 */
function splitOnParagraphs(
  content: string,
  maxTokens: number,
  contextHeader: string,
): Array<{ content: string; tokenCount: number }> {
  const paragraphs = content.split(/\n\n+/);
  const chunks: Array<{ content: string; tokenCount: number }> = [];
  let currentParagraphs: string[] = [];
  let currentTokens = estimateTokens(contextHeader) + 2; // +2 for \n\n

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para);

    if (currentTokens + paraTokens > maxTokens && currentParagraphs.length > 0) {
      // Flush current chunk
      const chunkContent = `${contextHeader}\n\n${currentParagraphs.join("\n\n")}`.trim();
      chunks.push({
        content: chunkContent,
        tokenCount: estimateTokens(chunkContent),
      });
      currentParagraphs = [];
      currentTokens = estimateTokens(contextHeader) + 2;
    }

    currentParagraphs.push(para);
    currentTokens += paraTokens;
  }

  // Flush remaining
  if (currentParagraphs.length > 0) {
    const chunkContent = `${contextHeader}\n\n${currentParagraphs.join("\n\n")}`.trim();
    chunks.push({
      content: chunkContent,
      tokenCount: estimateTokens(chunkContent),
    });
  }

  return chunks;
}

/**
 * Builds a context header prepended to every chunk.
 * Helps the embedding model understand the chunk's origin.
 */
function buildContextHeader(title: string | null, docType: DocType, sourcePath: string): string {
  const parts = [`[${docType.toUpperCase()}]`];
  if (title) parts.push(title);
  parts.push(`(${sourcePath})`);
  return parts.join(" — ");
}

/**
 * Builds metadata JSONB for a chunk.
 */
function buildMetadata(
  frontmatter: Record<string, unknown>,
  docTitle: string | null,
  sectionTitle?: string | null,
): Record<string, unknown> {
  const meta: Record<string, unknown> = {};
  if (docTitle) meta["doc_title"] = docTitle;
  if (sectionTitle) meta["section_title"] = sectionTitle;
  if (frontmatter["id"]) meta["doc_id"] = frontmatter["id"];
  if (frontmatter["status"]) meta["status"] = frontmatter["status"];
  if (frontmatter["layer"]) meta["layer"] = frontmatter["layer"];
  return meta;
}

/**
 * Adds overlap sentences from the end of chunk N to the beginning of chunk N+1.
 * Helps embedding models understand context across chunk boundaries.
 */
function addOverlapSentences(chunks: Chunk[]): Chunk[] {
  if (chunks.length <= 1) return chunks;

  for (let i = 1; i < chunks.length; i++) {
    const prevChunk = chunks[i - 1];
    if (!prevChunk) continue;

    // Only overlap chunks from the same source file
    if (prevChunk.sourcePath !== chunks[i]!.sourcePath) continue;

    // Extract last N sentences from previous chunk
    const sentences = prevChunk.content.match(/[^.!?]+[.!?]+/g);
    if (!sentences || sentences.length === 0) continue;

    const overlapText = sentences.slice(-OVERLAP_SENTENCES).join("").trim();

    if (overlapText) {
      const updatedContent = `${chunks[i]!.content}\n\n[Context from previous section: ${overlapText}]`;
      chunks[i] = {
        ...chunks[i]!,
        content: updatedContent,
        contentHash: hashString(updatedContent),
        tokenCount: estimateTokens(updatedContent),
      };
    }
  }

  return chunks;
}
