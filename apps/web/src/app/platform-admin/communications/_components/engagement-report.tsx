"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type CommunicationEntry = {
  id: string;
  subject: string;
  template: string;
  classification: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  openedCount: number;
  clickedCount: number;
  status: string;
  createdAt: string;
};

type Props = {
  communications: CommunicationEntry[];
};

function KpiCard({
  label,
  value,
  variant = "default",
}: {
  label: string;
  value: string | number;
  variant?: "default" | "warning";
}) {
  return (
    <div className="border-border bg-card rounded-xl border p-4">
      <div className="text-muted-foreground text-xs font-medium">{label}</div>
      <div
        className={`mt-1 text-2xl font-bold ${variant === "warning" ? "text-amber-500" : "text-foreground"}`}
      >
        {value}
      </div>
    </div>
  );
}

export function EngagementReport({ communications }: Props) {
  const totals = communications.reduce(
    (acc, c) => ({
      sent: acc.sent + (c.sentCount ?? 0),
      opened: acc.opened + (c.openedCount ?? 0),
      clicked: acc.clicked + (c.clickedCount ?? 0),
      failed: acc.failed + (c.failedCount ?? 0),
    }),
    { sent: 0, opened: 0, clicked: 0, failed: 0 },
  );

  const openRate = totals.sent > 0 ? ((totals.opened / totals.sent) * 100).toFixed(1) : "0";
  const clickRate = totals.opened > 0 ? ((totals.clicked / totals.opened) * 100).toFixed(1) : "0";

  if (communications.length === 0) {
    return (
      <div className="text-muted-foreground py-12 text-center text-sm">
        Ingen kommunikasjon sendt ennå.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total sendt" value={totals.sent} />
        <KpiCard label="Åpningsrate" value={`${openRate}%`} />
        <KpiCard label="Klikkrate" value={`${clickRate}%`} />
        <KpiCard
          label="Feilet"
          value={totals.failed}
          variant={totals.failed > 0 ? "warning" : "default"}
        />
      </div>

      <div className="border-border rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Emne</TableHead>
              <TableHead>Dato</TableHead>
              <TableHead className="text-right">Sendt</TableHead>
              <TableHead className="text-right">Åpnet</TableHead>
              <TableHead className="text-right">Klikket</TableHead>
              <TableHead className="text-right">Åpningsrate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {communications.map((c) => {
              const rate =
                c.sentCount > 0 ? (((c.openedCount ?? 0) / c.sentCount) * 100).toFixed(1) : "—";
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.subject}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(c.createdAt).toLocaleDateString("nb-NO", {
                      day: "numeric",
                      month: "short",
                    })}
                  </TableCell>
                  <TableCell className="text-right">{c.sentCount}</TableCell>
                  <TableCell className="text-right text-blue-500">{c.openedCount ?? 0}</TableCell>
                  <TableCell className="text-right text-purple-500">
                    {c.clickedCount ?? 0}
                  </TableCell>
                  <TableCell className="text-right">{rate}%</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
