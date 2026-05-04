"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MoreHorizontal, Eye, Bell, XCircle, Download } from "lucide-react";

export type ContractEvent = {
  contract_id: string;
  event_type: string;
  actor_type: string;
  created_at: string;
};

export type ContractRow = {
  contract_id: string;
  title: string;
  status: string;
  contract_type: string;
  recipient_name: string;
  recipient_email: string;
  sent_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  expires_at: string | null;
  created_at: string;
  signed_pdf_url: string | null;
  company: { name: string } | null;
  template: { name: string; contract_type: string } | null;
  events: ContractEvent[];
};

const statusColor: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  sent: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  viewed: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  signed: "bg-green-500/10 text-green-400 border-green-500/20",
  active: "bg-green-500/10 text-green-400 border-green-500/20",
  expired: "bg-red-500/10 text-red-400 border-red-500/20",
  cancelled: "bg-muted text-muted-foreground border-border",
  declined: "bg-red-500/10 text-red-400 border-red-500/20",
  terminated: "bg-red-500/10 text-red-400 border-red-500/20",
  voided: "bg-muted text-muted-foreground border-border",
};

const typeColor: Record<string, string> = {
  client: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  employee: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  haccp: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  training: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  season: "bg-green-500/10 text-green-400 border-green-500/20",
  custom: "bg-muted text-muted-foreground border-border",
};

export type ContractAction = {
  type: "preview" | "remind" | "cancel" | "download";
  contractId: string;
  pdfUrl?: string | null;
};

export function createContractColumns(
  onAction: (action: ContractAction) => void,
): ColumnDef<ContractRow>[] {
  return [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
    },
    {
      accessorFn: (row) => row.company?.name,
      id: "company",
      header: "Company",
      cell: ({ getValue }) => (
        <span className="text-muted-foreground">{(getValue() as string) || "\u2014"}</span>
      ),
    },
    {
      accessorKey: "recipient_email",
      header: "Recipient",
      cell: ({ row }) => (
        <div>
          <div className="text-sm">{row.original.recipient_name}</div>
          <div className="text-muted-foreground text-xs">{row.original.recipient_email}</div>
        </div>
      ),
    },
    {
      accessorKey: "contract_type",
      header: "Type",
      cell: ({ getValue }) => {
        const type = getValue() as string;
        return (
          <Badge variant="outline" className={`text-xs capitalize ${typeColor[type] || ""}`}>
            {type.replace("_", " ")}
          </Badge>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => {
        const status = getValue() as string;
        return (
          <Badge variant="outline" className={`text-xs capitalize ${statusColor[status] || ""}`}>
            {status}
          </Badge>
        );
      },
    },
    {
      id: "tracking",
      header: "Tracking",
      cell: ({ row }) => {
        const c = row.original;
        const steps = [
          { key: "created", label: "Opprettet", done: true, at: c.created_at },
          { key: "sent", label: "Sendt", done: !!c.sent_at, at: c.sent_at },
          { key: "viewed", label: "Sett", done: !!c.viewed_at, at: c.viewed_at },
          { key: "signed", label: "Signert", done: !!c.signed_at, at: c.signed_at },
        ];
        const cancelled =
          c.status === "cancelled" || c.status === "declined" || c.status === "expired";
        return (
          <TooltipProvider delayDuration={200}>
            <div className="flex items-center gap-1">
              {steps.map((step, i) => (
                <Tooltip key={step.key}>
                  <TooltipTrigger asChild>
                    <div className="flex items-center">
                      <div
                        className={`h-2.5 w-2.5 rounded-full ${
                          cancelled && !step.done
                            ? "bg-red-500/30"
                            : step.done
                              ? "bg-green-500"
                              : "bg-muted-foreground/20"
                        }`}
                      />
                      {i < steps.length - 1 && (
                        <div
                          className={`h-0.5 w-3 ${
                            cancelled && !step.done
                              ? "bg-red-500/20"
                              : step.done && steps[i + 1]?.done
                                ? "bg-green-500/50"
                                : "bg-muted-foreground/10"
                          }`}
                        />
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <span className="font-medium">{step.label}</span>
                    {step.at && (
                      <span className="text-muted-foreground ml-1">
                        {new Date(step.at).toLocaleDateString("no-NO")}
                      </span>
                    )}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        );
      },
    },
    {
      id: "last_event",
      header: "Siste hendelse",
      cell: ({ row }) => {
        const events = row.original.events;
        if (!events.length) {
          return <span className="text-muted-foreground text-xs">Ingen hendelser</span>;
        }
        const last = events[0]!;
        const eventLabels: Record<string, string> = {
          created: "Opprettet",
          sent: "Sendt",
          form_viewed: "Sett av mottaker",
          form_completed: "Signert",
          submission_completed: "Signert",
          cancelled: "Kansellert",
          expired: "Utl\u00f8pt",
          reminder_sent: "P\u00e5minnelse sendt",
        };
        return (
          <div className="text-xs">
            <div className="font-medium">{eventLabels[last.event_type] ?? last.event_type}</div>
            <div className="text-muted-foreground">
              {new Date(last.created_at).toLocaleDateString("no-NO", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "expires_at",
      header: "Utl\u00f8per",
      cell: ({ getValue }) => {
        const val = getValue() as string | null;
        if (!val) return <span className="text-muted-foreground">{"\u2014"}</span>;
        const date = new Date(val);
        const isExpired = date < new Date();
        return (
          <span className={`text-xs ${isExpired ? "text-red-400" : "text-muted-foreground"}`}>
            {date.toLocaleDateString("no-NO")}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const contract = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onAction({
                    type: "preview",
                    contractId: contract.contract_id,
                  });
                }}
              >
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </DropdownMenuItem>
              {(contract.status === "sent" || contract.status === "viewed") && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction({
                      type: "remind",
                      contractId: contract.contract_id,
                    });
                  }}
                >
                  <Bell className="mr-2 h-4 w-4" />
                  Send reminder
                </DropdownMenuItem>
              )}
              {contract.status !== "cancelled" &&
                contract.status !== "signed" &&
                contract.status !== "active" && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onAction({
                        type: "cancel",
                        contractId: contract.contract_id,
                      });
                    }}
                    className="text-red-400"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancel
                  </DropdownMenuItem>
                )}
              {contract.signed_pdf_url && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction({
                      type: "download",
                      contractId: contract.contract_id,
                      pdfUrl: contract.signed_pdf_url,
                    });
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
