"use client";

import { useState, useMemo, useCallback, useRef, type DragEvent } from "react";
import { Upload, Loader2, AlertTriangle, Check, FileUp } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { StatusBadge } from "@/components/platform-admin/status-badge";
import { TagBadge } from "./tag-badge";
import { ENV_VAR_MAP, type ServiceEntry } from "./service-registry";

type ParsedEntry = {
  envVar: string;
  value: string;
  service: ServiceEntry | null;
  matched: boolean;
};

function parseEnvContent(content: string): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const envVar = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!envVar || !value) continue;

    const service = ENV_VAR_MAP.get(envVar) ?? null;
    entries.push({
      envVar,
      value,
      service,
      matched: service !== null,
    });
  }

  return entries;
}

function maskValue(value: string): string {
  if (value.length <= 8) return "****";
  return value.slice(0, 4) + "****" + value.slice(-4);
}

type EnvImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
};

export function EnvImportDialog({ open, onOpenChange, onImported }: EnvImportDialogProps) {
  const [rawText, setRawText] = useState("");
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<"paste" | "preview">("paste");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseEnvContent(rawText), [rawText]);
  const matched = useMemo(() => parsed.filter((e) => e.matched), [parsed]);
  const unmatched = useMemo(() => parsed.filter((e) => !e.matched), [parsed]);

  const readFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === "string") setRawText(text);
    };
    reader.readAsText(file);
  }, []);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      setRawText("");
      setStep("paste");
      setDragging(false);
    }
    onOpenChange(nextOpen);
  }

  function handlePreview() {
    if (parsed.length === 0) {
      toast.error("No valid KEY=VALUE lines found");
      return;
    }
    if (matched.length === 0) {
      toast.error("No lines matched known services");
      return;
    }
    setStep("preview");
  }

  async function handleImport() {
    setImporting(true);
    try {
      const secrets = matched.map((entry) => ({
        key: entry.service!.key,
        provider: entry.service!.provider,
        vault_secret_name: entry.service!.key,
        secret_value: entry.value,
        environment: "live",
        description: `${entry.service!.label} (imported from .env)`,
      }));

      const res = await fetch("/api/platform-admin/secrets/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import", secrets }),
      });

      if (!res.ok) {
        const json = await res.json();
        toast.error(typeof json.error === "string" ? json.error : "Bulk import failed");
        return;
      }

      const json = await res.json();
      toast.success(`Imported ${json.data?.imported ?? matched.length} secrets`);
      onImported();
      handleClose(false);
    } catch {
      toast.error("Network error");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import from .env</DialogTitle>
          <DialogDescription>
            {step === "paste"
              ? "Drop a .env file, browse for one, or paste contents. Keys are matched against known services and stored in Vault."
              : `${matched.length} of ${parsed.length} keys matched. Review before importing.`}
          </DialogDescription>
        </DialogHeader>

        {step === "paste" ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className="relative"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".env,.env.*,.txt,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) readFile(file);
                e.target.value = "";
              }}
            />

            {!rawText ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed py-12 transition-colors ${
                  dragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-muted-foreground/50"
                }`}
              >
                <FileUp
                  className={`h-8 w-8 ${dragging ? "text-primary" : "text-muted-foreground"}`}
                />
                <div className="text-center">
                  <p className="text-sm font-medium">
                    {dragging ? "Drop file here" : "Drop .env file or click to browse"}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Or paste contents directly below
                  </p>
                </div>
              </button>
            ) : (
              <div className="bg-muted/50 mb-2 flex items-center justify-between rounded-md border px-3 py-2">
                <span className="text-muted-foreground text-xs">
                  {parsed.length} key{parsed.length !== 1 ? "s" : ""} parsed
                  {matched.length > 0 && (
                    <span className="text-emerald-500"> · {matched.length} matched</span>
                  )}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Replace file
                </Button>
              </div>
            )}

            <Textarea
              placeholder={`# Paste your .env contents here\nOPENROUTER_API_KEY=sk-or-...\nSTRIPE_SECRET_KEY=sk_live_...\nSENDGRID_API_KEY=SG....`}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={rawText ? 10 : 3}
              className="[field-sizing:fixed] max-h-64 resize-none overflow-y-auto font-mono text-xs"
            />
          </div>
        ) : (
          <div className="max-h-[400px] space-y-4 overflow-y-auto">
            {matched.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Check className="h-4 w-4 text-emerald-500" />
                  Matched ({matched.length})
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Service</TableHead>
                        <TableHead className="text-xs">Tag</TableHead>
                        <TableHead className="text-xs">Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matched.map((entry) => (
                        <TableRow key={entry.envVar}>
                          <TableCell className="text-sm">
                            <span className="font-medium">{entry.service!.label}</span>
                          </TableCell>
                          <TableCell>
                            <TagBadge tag={entry.service!.tag} />
                          </TableCell>
                          <TableCell>
                            <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
                              {maskValue(entry.value)}
                            </code>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {unmatched.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Unmatched — skipped ({unmatched.length})
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Env Var</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unmatched.map((entry) => (
                        <TableRow key={entry.envVar}>
                          <TableCell>
                            <code className="font-mono text-xs">{entry.envVar}</code>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status="unconfigured" size="sm" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "paste" ? (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button onClick={handlePreview} disabled={!rawText.trim()}>
                <Upload className="mr-2 h-4 w-4" />
                Preview
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("paste")}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import {matched.length} secrets
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
