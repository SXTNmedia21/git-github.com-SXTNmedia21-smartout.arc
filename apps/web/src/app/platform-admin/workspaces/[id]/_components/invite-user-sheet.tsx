"use client";

// Invite users into a workspace from platform-admin. Two flows:
//   1. Single: one row, manual fields.
//   2. CSV: drop a file with email + name columns + optional role column.
//
// Both flows POST a batch payload to /api/admin/invite (single becomes a
// 1-element batch). Backend gate is `withWorkspaceAdmin`, which passes
// because the godmode creator was auto-granted an admin profile when the
// workspace was created (see /api/platform-admin/workspaces/route.ts).
//
// UI role labels: owner | admin | user. "user" maps to InviteRoleSchema
// value "employee" before submit. owner + admin map straight through.

import { useState, useRef, useCallback } from "react";
import Papa from "papaparse";
import { Upload, X, FileSpreadsheet, Send, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Role mapping ─────────────────────────────────────────────────────────
// UI shows owner | admin | user. Backend expects InviteRoleSchema:
// "owner" | "admin" | "manager" | "employee". "user" → "employee".
type UiRole = "owner" | "admin" | "user";
type InviteRole = "owner" | "admin" | "manager" | "employee";

function toInviteRole(ui: UiRole): InviteRole {
  return ui === "user" ? "employee" : ui;
}

// ── CSV column synonyms (subset of /setup wizard csv-synonyms.ts) ───────
const SYNONYMS: Record<keyof CsvRow, string[]> = {
  firstName: ["fornavn", "first_name", "firstname", "förnamn", "name", "namn", "navn", "fornamn"],
  lastName: ["etternavn", "last_name", "lastname", "efternamn", "surname", "familienavn"],
  email: ["epost", "email", "mail", "epostadresse", "emailaddress"],
  role: ["rolle", "role", "tilgang", "type", "access", "permission"],
};

type CsvRow = {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
};

function autoMatchHeaders(headers: string[]): Partial<Record<keyof CsvRow, string>> {
  const mapping: Partial<Record<keyof CsvRow, string>> = {};
  const used = new Set<string>();
  for (const header of headers) {
    const norm = header
      .trim()
      .toLowerCase()
      .replace(/[^a-zæøåäöü0-9_]/g, "");
    for (const [field, syns] of Object.entries(SYNONYMS) as [keyof CsvRow, string[]][]) {
      if (mapping[field]) continue;
      if (syns.includes(norm) && !used.has(header)) {
        mapping[field] = header;
        used.add(header);
        break;
      }
    }
  }
  return mapping;
}

function parseCsvRole(raw: string | undefined): UiRole {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "owner" || v === "eier") return "owner";
  if (v === "admin" || v === "administrator") return "admin";
  return "user";
}

// ── Submission payload (matches BatchInviteRowSchema in /api/admin/invite) ─
type BatchInviteRow = {
  email: string;
  role: InviteRole;
  first_name: string;
  last_name: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
};

export function InviteUserSheet({ open, onOpenChange, workspaceId }: Props) {
  const [tab, setTab] = useState<"single" | "csv">("single");
  const [submitting, setSubmitting] = useState(false);

  // Single-form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UiRole>("admin");

  // CSV state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvRows, setCsvRows] = useState<BatchInviteRow[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);

  const resetSingle = useCallback(() => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setRole("admin");
  }, []);

  const resetCsv = useCallback(() => {
    setCsvFileName(null);
    setCsvRows([]);
    setCsvErrors([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleClose = useCallback(() => {
    resetSingle();
    resetCsv();
    setTab("single");
    onOpenChange(false);
  }, [onOpenChange, resetSingle, resetCsv]);

  const submit = useCallback(
    async (invites: BatchInviteRow[]) => {
      if (invites.length === 0) {
        toast.error("Ingen invitasjoner å sende");
        return;
      }
      setSubmitting(true);
      try {
        const payload =
          invites.length === 1
            ? {
                workspace_id: workspaceId,
                channels: ["email" as const],
                email: invites[0]!.email,
                role: invites[0]!.role,
                first_name: invites[0]!.first_name,
                last_name: invites[0]!.last_name,
              }
            : {
                workspace_id: workspaceId,
                invites,
                skip_dispatch: false,
              };

        const res = await fetch("/api/admin/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = (await res.json().catch(() => ({ error: "Ukjent feil" }))) as {
            error?: string;
          };
          toast.error(err.error ?? `HTTP ${res.status}`);
          return;
        }

        const data = (await res.json()) as
          | { invitations?: unknown[] }
          | { invitation_id?: string }
          | Record<string, unknown>;
        const count =
          "invitations" in data && Array.isArray(data.invitations)
            ? data.invitations.length
            : invites.length;
        toast.success(count === 1 ? "Invitasjon sendt" : `${count} invitasjoner sendt`);
        handleClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Nettverksfeil");
      } finally {
        setSubmitting(false);
      }
    },
    [workspaceId, handleClose],
  );

  const handleSingleSubmit = useCallback(() => {
    if (!email.trim() || !firstName.trim() || !lastName.trim()) {
      toast.error("Fyll ut alle felt");
      return;
    }
    void submit([
      {
        email: email.trim(),
        role: toInviteRole(role),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      },
    ]);
  }, [email, firstName, lastName, role, submit]);

  const handleCsvFile = useCallback((file: File) => {
    setCsvFileName(file.name);
    setCsvRows([]);
    setCsvErrors([]);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const headers = result.meta.fields ?? [];
        if (headers.length === 0) {
          setCsvErrors(["CSV-filen mangler kolonneoverskrifter."]);
          return;
        }
        const mapping = autoMatchHeaders(headers);
        if (!mapping.email) {
          setCsvErrors(["Kunne ikke finne e-post-kolonne i CSV-en."]);
          return;
        }
        if (!mapping.firstName || !mapping.lastName) {
          setCsvErrors(["Kunne ikke finne navn-kolonner (fornavn + etternavn)."]);
          return;
        }
        const rows: BatchInviteRow[] = [];
        const errs: string[] = [];
        result.data.forEach((raw, idx) => {
          const e = (raw[mapping.email!] ?? "").trim();
          const fn = (raw[mapping.firstName!] ?? "").trim();
          const ln = (raw[mapping.lastName!] ?? "").trim();
          const rRaw = mapping.role ? raw[mapping.role] : undefined;
          if (!e || !fn || !ln) {
            errs.push(`Rad ${idx + 2}: mangler email/fornavn/etternavn`);
            return;
          }
          rows.push({
            email: e,
            role: toInviteRole(parseCsvRole(rRaw)),
            first_name: fn,
            last_name: ln,
          });
        });
        setCsvRows(rows);
        setCsvErrors(errs);
      },
      error: (err) => {
        setCsvErrors([`Kunne ikke lese CSV: ${err.message}`]);
      },
    });
  }, []);

  return (
    <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : handleClose())}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Invitér bruker</SheetTitle>
          <SheetDescription>
            Send invitasjon på e-post. Velg rolle: eier, admin eller bruker.
          </SheetDescription>
        </SheetHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "single" | "csv")} className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single">Enkelt</TabsTrigger>
            <TabsTrigger value="csv">CSV</TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="invite-first">Fornavn</Label>
                <Input
                  id="invite-first"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-last">Etternavn</Label>
                <Input
                  id="invite-last"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-email">E-post</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-role">Rolle</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as UiRole)}
                disabled={submitting}
              >
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Eier (owner)</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">Bruker (employee)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="csv" className="mt-4 space-y-4">
            <p className="text-muted-foreground text-sm">
              Last opp CSV med kolonner: fornavn, etternavn, e-post, rolle (valgfri). Standard rolle
              er <span className="font-medium">bruker</span>.
            </p>

            <div className="border-border rounded-md border border-dashed p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                disabled={submitting}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCsvFile(file);
                }}
              />
              {csvFileName ? (
                <div className="space-y-2">
                  <FileSpreadsheet className="text-muted-foreground mx-auto h-8 w-8" />
                  <p className="text-sm font-medium">{csvFileName}</p>
                  <p className="text-muted-foreground text-xs">
                    {csvRows.length} gyldige rader
                    {csvErrors.length > 0 ? `, ${csvErrors.length} feil` : ""}
                  </p>
                  <Button variant="ghost" size="sm" onClick={resetCsv} disabled={submitting}>
                    <X className="mr-1 h-3 w-3" /> Velg ny fil
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={submitting}
                >
                  <Upload className="mr-2 h-4 w-4" /> Last opp CSV
                </Button>
              )}
            </div>

            {csvErrors.length > 0 && (
              <div className="border-destructive/40 bg-destructive/5 rounded-md border p-3">
                <div className="text-destructive flex items-start gap-2 text-sm">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div className="space-y-1">
                    {csvErrors.slice(0, 5).map((err, i) => (
                      <p key={i}>{err}</p>
                    ))}
                    {csvErrors.length > 5 && (
                      <p className="text-xs">+ {csvErrors.length - 5} flere feil</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {csvRows.length > 0 && (
              <div className="border-border max-h-48 overflow-y-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr className="text-muted-foreground text-left">
                      <th className="px-2 py-1.5">Navn</th>
                      <th className="px-2 py-1.5">E-post</th>
                      <th className="px-2 py-1.5">Rolle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-border border-t">
                        <td className="px-2 py-1">
                          {r.first_name} {r.last_name}
                        </td>
                        <td className="px-2 py-1">{r.email}</td>
                        <td className="px-2 py-1 capitalize">{r.role}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvRows.length > 50 && (
                  <p className="text-muted-foreground border-border border-t p-2 text-center text-xs">
                    Viser 50 av {csvRows.length} rader
                  </p>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <SheetFooter className="mt-6">
          <Button variant="ghost" onClick={handleClose} disabled={submitting}>
            Avbryt
          </Button>
          {tab === "single" ? (
            <Button onClick={handleSingleSubmit} disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send invitasjon
            </Button>
          ) : (
            <Button
              onClick={() => void submit(csvRows)}
              disabled={submitting || csvRows.length === 0}
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send {csvRows.length} invitasjoner
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
