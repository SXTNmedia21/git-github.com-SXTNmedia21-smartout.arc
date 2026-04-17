"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Build the export URL and open it in a new tab — the Route Handler
// returns `Content-Disposition: attachment` so the browser downloads
// directly. No Server Action needed because the response isn't
// JSON-serialisable and must stream as a file.

export function ExportForm() {
  const today = new Date();
  const defaultTo = today.toISOString().split("T")[0] as string;
  const defaultFromDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const defaultFrom = defaultFromDate.toISOString().split("T")[0] as string;

  const [periodFrom, setPeriodFrom] = useState(defaultFrom);
  const [periodTo, setPeriodTo] = useState(defaultTo);
  const [companyId, setCompanyId] = useState("");

  const submit = () => {
    const params = new URLSearchParams({
      period_from: periodFrom,
      period_to: periodTo,
    });
    if (companyId.trim()) {
      params.set("company", companyId.trim());
    }
    // Navigate in-place triggers the download. `window.location.assign`
    // rather than a fetch preserves the browser's native file-save UX.
    window.location.assign(`/platform-admin/billing/export/csv?${params.toString()}`);
  };

  const disabled = !periodFrom || !periodTo || periodFrom > periodTo;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="period-from">Periode fra</Label>
          <Input
            id="period-from"
            type="date"
            value={periodFrom}
            onChange={(e) => setPeriodFrom(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="period-to">Periode til</Label>
          <Input
            id="period-to"
            type="date"
            value={periodTo}
            onChange={(e) => setPeriodTo(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="company-id">Selskap (valgfritt UUID-filter)</Label>
        <Input
          id="company-id"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          placeholder="Tom = alle selskaper"
        />
      </div>
      <Button type="submit" disabled={disabled}>
        Last ned CSV
      </Button>
    </form>
  );
}
