"use client";

import { useState, useMemo } from "react";
import { Upload, Loader2, AlertTriangle, Check } from "lucide-react";
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

  const parsed = useMemo(() => parseEnvContent(rawText), [rawText]);
  const matched = useMemo(() => parsed.filter((e) => e.matched), [parsed]);
  const unmatched = useMemo(() => parsed.filter((e) => !e.matched), [parsed]);

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      setRawText("");
      setStep("paste");
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
              ? "Paste your .env file contents. Keys will be matched against known services and stored in Vault."
              : `${matched.length} of ${parsed.length} keys matched. Review before importing.`}
          </DialogDescription>
        </DialogHeader>

        {step === "paste" ? (
          <Textarea
            placeholder={`# Paste your .env contents here\nOPENROUTER_API_KEY=sk-or-...\nSTRIPE_SECRET_KEY=sk_live_...\nSENDGRID_API_KEY=SG....`}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={12}
            className="font-mono text-xs"
          />
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
