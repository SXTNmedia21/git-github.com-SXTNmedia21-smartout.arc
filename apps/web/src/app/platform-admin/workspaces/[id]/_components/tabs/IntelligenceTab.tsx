"use client";

// Intelligence tab: knowledge bank chunks, agent memories, file uploads, gathered intelligence.
// Exports DocChunk, MemoryRow, StorageFile types so the shell can reference them.

import { Brain, FileText, Database, Globe } from "lucide-react";
import { TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocumentDrop } from "@/components/platform-admin/document-drop";

// ── Exported types ───────────────────────────────────────────────────────────

export type DocChunk = {
  id: string;
  sourceType: string;
  sourcePath: string;
  title: string;
  tokenCount: number;
  createdAt: string;
};

export type MemoryRow = {
  id: string;
  memoryType: string;
  content: string;
  createdAt: string;
};

export type StorageFile = {
  name: string;
  size: number | undefined;
  mimeType: string | undefined;
  createdAt: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

// Maps raw sourceType values from the DB to human-readable labels.
const sourceTypeLabels: Record<string, string> = {
  handbook_chapter: "Handbook",
  policy: "Policy",
  protocol: "Protocol",
  procedure: "Procedure",
  routine: "Routine",
  runbook: "Runbook",
  other: "Other",
};

// Unused in this tab, kept here so DocumentDrop can rely on it indirectly if needed.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function formatBytes(bytes: number | undefined) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Props ────────────────────────────────────────────────────────────────────

type Props = {
  intelligence: {
    docChunks: DocChunk[];
    memories: MemoryRow[];
    files: StorageFile[];
  };
  workspaceId: string;
  intelligenceData: Record<string, unknown>;
};

export function IntelligenceTab({ intelligence, workspaceId, intelligenceData }: Props) {
  // Aggregate counts per source/memory type for the badge summaries.
  const chunksByType = intelligence.docChunks.reduce(
    (acc, c) => {
      acc[c.sourceType] = (acc[c.sourceType] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const memsByType = intelligence.memories.reduce(
    (acc, m) => {
      acc[m.memoryType] = (acc[m.memoryType] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <TabsContent value="intelligence" className="mt-4 space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="text-muted-foreground h-4 w-4" />
              <span className="text-muted-foreground text-xs uppercase">Knowledge Bank</span>
            </div>
            <p className="mt-2 text-2xl font-semibold">{intelligence.docChunks.length}</p>
            <p className="text-muted-foreground text-xs">document chunks indexed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Brain className="text-muted-foreground h-4 w-4" />
              <span className="text-muted-foreground text-xs uppercase">Agent Memories</span>
            </div>
            <p className="mt-2 text-2xl font-semibold">{intelligence.memories.length}</p>
            <p className="text-muted-foreground text-xs">stored memories</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Database className="text-muted-foreground h-4 w-4" />
              <span className="text-muted-foreground text-xs uppercase">Files</span>
            </div>
            <p className="mt-2 text-2xl font-semibold">{intelligence.files.length}</p>
            <p className="text-muted-foreground text-xs">uploaded documents</p>
          </CardContent>
        </Card>
      </div>

      {/* Intelligence Data gathered from Brreg, web scraping, Google Places */}
      {Object.keys(intelligenceData).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4" /> Gathered Intelligence
            </CardTitle>
            <CardDescription>
              Data collected from Brreg, web scraping, and Google Places
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted max-h-64 overflow-auto rounded-md p-3 text-xs">
              {JSON.stringify(intelligenceData, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Knowledge Bank chunks by type */}
      {intelligence.docChunks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" /> Knowledge Bank
            </CardTitle>
            <CardDescription>Indexed document chunks by source type</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {Object.entries(chunksByType).map(([type, count]) => (
                <Badge key={type} variant="secondary" className="text-xs">
                  {sourceTypeLabels[type] ?? type}: {count}
                </Badge>
              ))}
            </div>
            <div className="border-border rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-border text-muted-foreground border-b text-left text-xs tracking-wider uppercase">
                    <th className="px-4 py-2">Title</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Tokens</th>
                    <th className="px-4 py-2">Indexed</th>
                  </tr>
                </thead>
                <tbody>
                  {intelligence.docChunks.slice(0, 25).map((d) => (
                    <tr key={d.id} className="border-border border-b last:border-0">
                      <td className="px-4 py-2 font-medium">{d.title || d.sourcePath}</td>
                      <td className="px-4 py-2">
                        <Badge variant="outline" className="text-xs">
                          {sourceTypeLabels[d.sourceType] ?? d.sourceType}
                        </Badge>
                      </td>
                      <td className="text-muted-foreground px-4 py-2 font-mono">{d.tokenCount}</td>
                      <td className="text-muted-foreground px-4 py-2">
                        {new Date(d.createdAt).toLocaleDateString("no-NO")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {intelligence.docChunks.length > 25 && (
                <p className="text-muted-foreground border-border border-t p-2 text-center text-xs">
                  Showing 25 of {intelligence.docChunks.length} chunks
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent Memories */}
      {intelligence.memories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4" /> Agent Memories
            </CardTitle>
            <CardDescription>Stored by Mr. Botsson during conversations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {Object.entries(memsByType).map(([type, count]) => (
                <Badge key={type} variant="secondary" className="text-xs capitalize">
                  {type}: {count}
                </Badge>
              ))}
            </div>
            <div className="space-y-2">
              {intelligence.memories.slice(0, 20).map((m) => (
                <div key={m.id} className="border-border rounded border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs capitalize">
                      {m.memoryType}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {new Date(m.createdAt).toLocaleDateString("no-NO")}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{m.content}</p>
                </div>
              ))}
              {intelligence.memories.length > 20 && (
                <p className="text-muted-foreground text-center text-xs">
                  Showing 20 of {intelligence.memories.length} memories
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4" /> Documents
          </CardTitle>
          <CardDescription>
            Upload workspace documents (PDF, DOCX, XLSX, images). Files are stored in the
            workspace-documents bucket.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DocumentDrop
            bucket="workspace-documents"
            pathPrefix={workspaceId}
            workspaceId={workspaceId}
            existingFiles={intelligence.files}
            enableAnalysis
          />
        </CardContent>
      </Card>

      {/* Empty state — shown when the workspace has no intelligence data at all */}
      {intelligence.docChunks.length === 0 &&
        intelligence.memories.length === 0 &&
        intelligence.files.length === 0 &&
        Object.keys(intelligenceData).length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Brain className="text-muted-foreground mx-auto h-8 w-8" />
              <p className="text-muted-foreground mt-2 text-sm">
                No intelligence data yet. Data will appear here after onboarding and agent
                conversations.
              </p>
            </CardContent>
          </Card>
        )}
    </TabsContent>
  );
}
