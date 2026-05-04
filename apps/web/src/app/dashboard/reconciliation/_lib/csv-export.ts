/**
 * CSV export for reconciliation list.
 * Norwegian locale: space thousand separator, comma decimal, DD.MM.YYYY date.
 * Addresses Hospitality Council F-2 requirement (back-office admin needs
 * monthly exports for accountant).
 */

type ReconciliationRow = {
  reconciliation_id: string;
  reconciliation_date: string;
  status: string;
  revenue_total: number | null;
  total_actual_hours: number | null;
  total_labor_cost: number | null;
  labor_percentage: number | null;
  department_session: {
    department: { name: string };
  } | null;
};

function formatDateNO(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${d.getFullYear()}`;
}

function formatNumberNO(n: number | null, fractionDigits = 0): string {
  if (n === null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("nb-NO", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n);
}

function csvEscape(field: string): string {
  if (field.includes('"') || field.includes(",") || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export function buildReconciliationCsv(rows: ReconciliationRow[]): string {
  const headers = [
    "Dato",
    "Avdeling",
    "Omsetning (kr)",
    "Arbeidstid (t)",
    "Lønnskostnad (kr)",
    "Labor %",
    "Status",
  ];

  const body = rows.map((r) =>
    [
      csvEscape(formatDateNO(r.reconciliation_date)),
      csvEscape(r.department_session?.department?.name ?? "—"),
      csvEscape(formatNumberNO(r.revenue_total)),
      csvEscape(formatNumberNO(r.total_actual_hours, 1)),
      csvEscape(formatNumberNO(r.total_labor_cost)),
      csvEscape(formatNumberNO(r.labor_percentage, 1)),
      csvEscape(r.status),
    ].join(","),
  );

  // Prepend UTF-8 BOM so Excel reads Norwegian characters correctly.
  return "\uFEFF" + headers.join(",") + "\n" + body.join("\n");
}

export function triggerCsvDownload(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
