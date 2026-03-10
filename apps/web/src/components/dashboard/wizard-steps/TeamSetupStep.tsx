"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import Papa from "papaparse";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Upload, AlertCircle, Shield } from "lucide-react";
import { HelpTip } from "@/components/dashboard/wizard-steps/HelpTip";
import { CsvMappingDialog } from "@/components/dashboard/wizard-steps/csv-column-mapper";
import { MAPPABLE_FIELDS } from "@/components/dashboard/wizard-steps/csv-synonyms";
import type { TeamMember } from "./wizard-state";

// ─── Types ──────────────────────────────────────────────────

type InviteRow = TeamMember & {
  validationErrors: string[];
};

const ROLE_OPTIONS: { value: TeamMember["role"]; label: string; description: string }[] = [
  { value: "employee", label: "Ansatt", description: "Tilgang til opplæring og håndbok" },
  { value: "manager", label: "Leder", description: "Kan administrere team og vakter" },
  { value: "admin", label: "Administrator", description: "Full tilgang til arbeidsrommet" },
];

function createEmptyRow(): InviteRow {
  return {
    id: crypto.randomUUID(),
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    departmentId: "",
    employmentForm: "",
    positionId: "",
    hourlyRate: 0,
    startDate: "",
    positionPct: 0,
    birthDate: "",
    address: "",
    role: "employee",
    extraData: {},
    validationErrors: [],
  };
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateRow(row: InviteRow): string[] {
  const errors: string[] = [];
  if (!row.firstName.trim()) errors.push("Fornavn mangler");
  if (!row.lastName.trim()) errors.push("Etternavn mangler");
  if (!row.email.trim()) errors.push("E-post mangler");
  else if (!validateEmail(row.email.trim())) errors.push("Ugyldig e-post");
  return errors;
}

// ─── InviteRowCard ──────────────────────────────────────────

function InviteRowCard({
  row,
  isDark,
  departments,
  positions,
  employmentForms,
  onUpdate,
  onRemove,
}: {
  row: InviteRow;
  isDark: boolean;
  departments: { department_id: string; name: string }[];
  positions: { position_id: string; name: string }[];
  employmentForms: { type: string; label: string }[];
  onUpdate: (id: string, patch: Partial<InviteRow>) => void;
  onRemove: (id: string) => void;
}) {
  const hasValidationErrors = row.validationErrors.length > 0;

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        hasValidationErrors
          ? isDark
            ? "border-red-800/40 bg-red-950/20"
            : "border-red-200 bg-red-50/30"
          : isDark
            ? "border-zinc-800 bg-zinc-900/50"
            : "border-zinc-200 bg-white"
      }`}
    >
      {/* Row 1: Name + Email + Phone */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Input
          placeholder="Fornavn"
          value={row.firstName}
          onChange={(e) => onUpdate(row.id, { firstName: e.target.value })}
          className={`h-9 text-sm ${!row.firstName.trim() && hasValidationErrors ? "border-red-500" : ""} ${isDark ? "border-zinc-700 bg-zinc-800/50" : ""}`}
        />
        <Input
          placeholder="Etternavn"
          value={row.lastName}
          onChange={(e) => onUpdate(row.id, { lastName: e.target.value })}
          className={`h-9 text-sm ${!row.lastName.trim() && hasValidationErrors ? "border-red-500" : ""} ${isDark ? "border-zinc-700 bg-zinc-800/50" : ""}`}
        />
        <Input
          placeholder="E-post"
          type="email"
          value={row.email}
          onChange={(e) => onUpdate(row.id, { email: e.target.value })}
          className={`h-9 text-sm ${row.validationErrors.some((e) => e.includes("post")) ? "border-red-500" : ""} ${isDark ? "border-zinc-700 bg-zinc-800/50" : ""}`}
        />
        <Input
          placeholder="Telefon"
          type="tel"
          value={row.phone}
          onChange={(e) => onUpdate(row.id, { phone: e.target.value })}
          className={`h-9 text-sm ${isDark ? "border-zinc-700 bg-zinc-800/50" : ""}`}
        />
      </div>

      {/* Row 2: Role + Department + Employment form + Position + Rate */}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Select
          value={row.role}
          onValueChange={(v) => onUpdate(row.id, { role: v as TeamMember["role"] })}
        >
          <SelectTrigger
            className={`h-9 text-sm ${
              row.role !== "employee"
                ? isDark
                  ? "border-orange-500/40 text-orange-300"
                  : "border-orange-300 text-orange-700"
                : isDark
                  ? "border-zinc-700 bg-zinc-800/50"
                  : ""
            }`}
          >
            <div className="flex items-center gap-1.5 truncate">
              {row.role !== "employee" && <Shield className="h-3 w-3 shrink-0" />}
              <span className="truncate">
                {ROLE_OPTIONS.find((o) => o.value === row.role)?.label ?? "Ansatt"}
              </span>
            </div>
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <span className="font-medium">{opt.label}</span>
                <span className="ml-1.5 text-xs text-zinc-400">— {opt.description}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={row.departmentId || undefined}
          onValueChange={(v) => onUpdate(row.id, { departmentId: v })}
        >
          <SelectTrigger
            className={`h-9 text-sm ${isDark ? "border-zinc-700 bg-zinc-800/50" : ""}`}
          >
            <SelectValue placeholder="Avdeling" />
          </SelectTrigger>
          <SelectContent>
            {departments.map((d, i) => (
              <SelectItem key={d.department_id || `dept-${i}`} value={d.department_id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={row.employmentForm || undefined}
          onValueChange={(v) => onUpdate(row.id, { employmentForm: v })}
        >
          <SelectTrigger
            className={`h-9 text-sm ${isDark ? "border-zinc-700 bg-zinc-800/50" : ""}`}
          >
            <SelectValue placeholder="Ansettelsesform" />
          </SelectTrigger>
          <SelectContent>
            {employmentForms.map((f) => (
              <SelectItem key={f.type} value={f.type}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={row.positionId || undefined}
          onValueChange={(v) => onUpdate(row.id, { positionId: v })}
        >
          <SelectTrigger
            className={`h-9 text-sm ${isDark ? "border-zinc-700 bg-zinc-800/50" : ""}`}
          >
            <SelectValue placeholder="Stilling" />
          </SelectTrigger>
          <SelectContent>
            {positions.map((p) => (
              <SelectItem key={p.position_id} value={p.position_id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative">
          <Input
            type="number"
            placeholder="0"
            value={row.hourlyRate || ""}
            onChange={(e) => onUpdate(row.id, { hourlyRate: parseFloat(e.target.value) || 0 })}
            className={`h-9 pr-10 text-sm ${isDark ? "border-zinc-700 bg-zinc-800/50" : ""}`}
          />
          <span
            className={`pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs ${
              isDark ? "text-zinc-500" : "text-zinc-400"
            }`}
          >
            kr/t
          </span>
        </div>
      </div>

      {/* Row 3: Validation errors + Remove */}
      <div className="mt-2 flex items-center justify-between">
        <div>
          {hasValidationErrors && (
            <div className="flex items-center gap-1.5 text-xs text-red-500">
              <AlertCircle className="h-3.5 w-3.5" />
              {row.validationErrors.join(", ")}
            </div>
          )}
        </div>
        <button
          onClick={() => onRemove(row.id)}
          className={`rounded-lg p-1.5 transition-colors ${
            isDark
              ? "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          }`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─── TeamSetupStep ──────────────────────────────────────────

export function TeamSetupStep({
  isDark,
  extractedEmployees,
  teamMembers,
  onTeamChange,
}: {
  isDark: boolean;
  extractedEmployees?: Array<{
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    department?: string;
    position?: string;
    source: string;
  }>;
  teamMembers: TeamMember[];
  onTeamChange: (members: TeamMember[]) => void;
}) {
  const { workspace } = useWorkspace();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasPreFilledRef = useRef(false);

  const [rows, setRows] = useState<InviteRow[]>(() => {
    if (teamMembers.length > 0) {
      return teamMembers.map((m) => ({ ...m, validationErrors: [] }));
    }
    return [createEmptyRow()];
  });
  const [csvMappingOpen, setCsvMappingOpen] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRawRows, setCsvRawRows] = useState<Record<string, string>[]>([]);

  // ── Sync rows → parent wizard state ──

  useEffect(() => {
    const members: TeamMember[] = rows
      .filter((r) => r.firstName.trim() || r.lastName.trim() || r.email.trim())
      .map(({ validationErrors: _ve, ...member }) => member);
    onTeamChange(members);
  }, [rows, onTeamChange]);

  // ── Queries ──

  const { data: departmentsRaw } = useQuery({
    queryKey: ["departments", workspace.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("department")
        .select("department_id, name")
        .eq("workspace_id", workspace.workspace_id)
        .order("name");
      return data ?? [];
    },
  });
  const departments = useMemo(() => departmentsRaw ?? [], [departmentsRaw]);

  const { data: positionsRaw } = useQuery({
    queryKey: ["positions", workspace.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("position")
        .select("position_id, name")
        .eq("workspace_id", workspace.workspace_id)
        .eq("is_active", true)
        .order("name");
      return data ?? [];
    },
  });
  const positions = useMemo(() => positionsRaw ?? [], [positionsRaw]);

  const { data: employmentPolicy } = useQuery({
    queryKey: ["employment-policy", workspace.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("policy")
        .select("rules_json")
        .eq("workspace_id", workspace.workspace_id)
        .eq("policy_type", "hr")
        .eq("name", "Ansettelsesvilkår")
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
  });

  const employmentForms = useMemo(() => {
    const rules = employmentPolicy?.rules_json as Record<string, unknown> | null;
    const forms = (rules?.employment_forms ?? []) as { type: string; label: string }[];
    return forms.length > 0 ? forms : [{ type: "fast_heltid", label: "Fast heltid" }];
  }, [employmentPolicy]);

  const { data: wagePolicy } = useQuery({
    queryKey: ["payroll-policies", workspace.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("policy")
        .select("rules_json")
        .eq("workspace_id", workspace.workspace_id)
        .eq("policy_type", "payroll")
        .eq("name", "Stillingslønn")
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
  });

  // ── Wage lookup helper ──

  const positionWageMap = useMemo(() => {
    const map = new Map<string, number>();
    const rules = wagePolicy?.rules_json as Record<string, unknown> | null;
    const positionWages = (rules?.positions ?? []) as {
      position_id: string;
      hourly_rate: number;
    }[];
    for (const pw of positionWages) {
      map.set(pw.position_id, pw.hourly_rate);
    }
    return map;
  }, [wagePolicy]);

  // ── Name lookup maps ──

  const deptNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of departments) {
      map.set(d.name.toLowerCase(), d.department_id);
    }
    return map;
  }, [departments]);

  const posNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of positions) {
      map.set(p.name.toLowerCase(), p.position_id);
    }
    return map;
  }, [positions]);

  // ── Pre-fill from extracted employees ──

  useEffect(() => {
    if (hasPreFilledRef.current) return;
    if (!extractedEmployees || extractedEmployees.length === 0) return;
    const isInitial =
      rows.length === 1 &&
      !rows[0]!.firstName.trim() &&
      !rows[0]!.lastName.trim() &&
      !rows[0]!.email.trim();
    if (!isInitial) return;

    hasPreFilledRef.current = true;

    const mapped: InviteRow[] = extractedEmployees.map((emp) => {
      const departmentId = emp.department
        ? (deptNameMap.get(emp.department.toLowerCase()) ?? "")
        : "";
      const positionId = emp.position ? (posNameMap.get(emp.position.toLowerCase()) ?? "") : "";
      const hourlyRate = positionId ? (positionWageMap.get(positionId) ?? 0) : 0;

      const row: InviteRow = {
        ...createEmptyRow(),
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email ?? "",
        phone: emp.phone ?? "",
        departmentId,
        positionId,
        hourlyRate,
      };
      row.validationErrors = validateRow(row);
      return row;
    });

    setRows(mapped);
  }, [extractedEmployees, rows, deptNameMap, posNameMap, positionWageMap]);

  // ── Row handlers ──

  const handleUpdate = useCallback(
    (id: string, patch: Partial<InviteRow>) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r;
          const updated = { ...r, ...patch, validationErrors: [] };
          if (patch.positionId && patch.positionId !== r.positionId) {
            const wage = positionWageMap.get(patch.positionId);
            if (wage !== undefined) {
              updated.hourlyRate = wage;
            }
          }
          return updated;
        }),
      );
    },
    [positionWageMap],
  );

  const handleRemove = useCallback((id: string) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== id);
      return next.length === 0 ? [createEmptyRow()] : next;
    });
  }, []);

  const handleAddRow = useCallback(() => {
    setRows((prev) => [...prev, createEmptyRow()]);
  }, []);

  // ── CSV upload ──

  const handleCsvUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        if (results.data.length === 0) {
          toast.error("Ingen rader funnet i CSV-filen");
          return;
        }
        const headers = results.meta.fields ?? [];
        if (headers.length === 0) {
          toast.error("Ingen kolonner funnet i CSV-filen");
          return;
        }
        setCsvHeaders(headers);
        setCsvRawRows(results.data);
        setCsvMappingOpen(true);
      },
      error: () => {
        toast.error("Kunne ikke lese CSV-filen");
      },
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleMappingConfirm = useCallback(
    (mapping: Record<string, string>) => {
      const csvRows: InviteRow[] = csvRawRows
        .filter((row) => {
          const hasData = Object.entries(mapping).some(([header, fieldKey]) => {
            const field = MAPPABLE_FIELDS.find((f) => f.key === fieldKey);
            return field?.required && row[header]?.trim();
          });
          return hasData;
        })
        .map((row) => {
          const newRow = createEmptyRow();
          const extraData: Record<string, string> = {};

          for (const [header, fieldKey] of Object.entries(mapping)) {
            const value = row[header]?.trim() ?? "";
            if (!value) continue;

            if (fieldKey === "_skip") {
              extraData[header] = value;
              continue;
            }

            switch (fieldKey) {
              case "firstName":
                newRow.firstName = value;
                break;
              case "lastName":
                newRow.lastName = value;
                break;
              case "email":
                newRow.email = value;
                break;
              case "phone":
                newRow.phone = value;
                break;
              case "departmentId":
                newRow.departmentId = deptNameMap.get(value.toLowerCase()) ?? "";
                break;
              case "positionId": {
                const posId = posNameMap.get(value.toLowerCase()) ?? "";
                newRow.positionId = posId;
                if (posId) {
                  newRow.hourlyRate = positionWageMap.get(posId) ?? 0;
                }
                break;
              }
              case "employmentForm":
                newRow.employmentForm = value;
                break;
              case "hourlyRate":
                newRow.hourlyRate = parseFloat(value) || 0;
                break;
              case "startDate":
                newRow.startDate = value;
                break;
              case "positionPct":
                newRow.positionPct = parseFloat(value) || 0;
                break;
              case "birthDate":
                newRow.birthDate = value;
                break;
              case "address":
                newRow.address = value;
                break;
              default:
                extraData[header] = value;
            }
          }

          newRow.extraData = extraData;
          newRow.validationErrors = validateRow(newRow);
          return newRow;
        });

      if (csvRows.length === 0) {
        toast.error("Ingen gyldige rader funnet i CSV-filen");
        setCsvMappingOpen(false);
        return;
      }

      setRows((prev) => {
        const nonEmpty = prev.filter(
          (r) => r.firstName.trim() || r.lastName.trim() || r.email.trim(),
        );
        return [...nonEmpty, ...csvRows];
      });

      const errorCount = csvRows.filter((r) => r.validationErrors.length > 0).length;
      if (errorCount > 0) {
        toast.warning(`${csvRows.length} rader importert, ${errorCount} med valideringsfeil`);
      } else {
        toast.success(`${csvRows.length} rader importert fra CSV`);
      }

      setCsvMappingOpen(false);
    },
    [csvRawRows, deptNameMap, posNameMap, positionWageMap],
  );

  // ── Derived ──

  const filledCount = rows.filter(
    (r) => r.firstName.trim() || r.lastName.trim() || r.email.trim(),
  ).length;
  const leaderCount = rows.filter(
    (r) => (r.role === "manager" || r.role === "admin") && r.firstName.trim(),
  ).length;

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h3 className={`text-sm font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
            Legg til teamet ditt
          </h3>
          <HelpTip text="Legg til ansatte manuelt eller last opp en CSV-fil. Alle invitasjoner sendes når du fullfører oppsettet." />
        </div>
        <p className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
          Sett tilgangsniv&aring; per person. Invitasjoner sendes n&aring;r du trykker
          &laquo;Fullf&oslash;r&raquo; i siste steg.
        </p>
      </div>

      {/* Summary */}
      {filledCount > 0 && (
        <div
          className={`flex items-center gap-4 rounded-lg px-4 py-2.5 text-xs font-medium ${
            isDark ? "bg-zinc-900/50 text-zinc-400" : "bg-zinc-50 text-zinc-500"
          }`}
        >
          <span>
            {filledCount} {filledCount === 1 ? "person" : "personer"} lagt til
          </span>
          {leaderCount > 0 && (
            <span className="flex items-center gap-1">
              <Shield className="h-3 w-3 text-orange-500" />
              {leaderCount} {leaderCount === 1 ? "leder" : "ledere"}
            </span>
          )}
        </div>
      )}

      {/* Invite rows */}
      <div className="space-y-3">
        {rows.map((row) => (
          <InviteRowCard
            key={row.id}
            row={row}
            isDark={isDark}
            departments={departments}
            positions={positions}
            employmentForms={employmentForms}
            onUpdate={handleUpdate}
            onRemove={handleRemove}
          />
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleAddRow}
          className={`flex items-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-2.5 text-sm font-medium transition-colors ${
            isDark
              ? "border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
              : "border-zinc-300 text-zinc-500 hover:border-zinc-400 hover:text-zinc-600"
          }`}
        >
          <Plus className="h-4 w-4" />
          Legg til manuelt
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleCsvUpload}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className={`flex items-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-2.5 text-sm font-medium transition-colors ${
            isDark
              ? "border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
              : "border-zinc-300 text-zinc-500 hover:border-zinc-400 hover:text-zinc-600"
          }`}
        >
          <Upload className="h-4 w-4" />
          Last opp CSV
        </button>
      </div>

      {/* CSV format hint */}
      <p className={`text-[11px] leading-relaxed ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
        Last opp en CSV-fil med kolonnenavn i første rad. Du kobler kolonnene til riktige felt
        i neste steg.
      </p>

      <CsvMappingDialog
        open={csvMappingOpen}
        onOpenChange={setCsvMappingOpen}
        isDark={isDark}
        csvHeaders={csvHeaders}
        csvPreviewRows={csvRawRows.slice(0, 3)}
        totalRowCount={csvRawRows.length}
        onConfirm={handleMappingConfirm}
      />
    </div>
  );
}
