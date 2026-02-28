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
import { MoreHorizontal, Eye, Bell, XCircle, Download } from "lucide-react";

export type ContractRow = {
  contract_id: string;
  title: string;
  status: string;
  contract_type: string;
  recipient_name: string;
  recipient_email: string;
  sent_at: string | null;
  signed_at: string | null;
  expires_at: string | null;
  created_at: string;
  signed_pdf_url: string | null;
  company: { name: string } | null;
  template: { name: string; contract_type: string } | null;
};

const statusColor: Record<string, string> = {
  draft: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  sent: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  viewed: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  signed: "bg-green-500/10 text-green-400 border-green-500/20",
  active: "bg-green-500/10 text-green-400 border-green-500/20",
  expired: "bg-red-500/10 text-red-400 border-red-500/20",
  cancelled: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  declined: "bg-red-500/10 text-red-400 border-red-500/20",
  terminated: "bg-red-500/10 text-red-400 border-red-500/20",
  voided: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

const typeColor: Record<string, string> = {
  client: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  employee: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  haccp: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  training: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  season: "bg-green-500/10 text-green-400 border-green-500/20",
  custom: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
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
      accessorKey: "sent_at",
      header: "Sent",
      cell: ({ getValue }) => {
        const val = getValue() as string | null;
        return (
          <span className="text-muted-foreground">
            {val ? new Date(val).toLocaleDateString("no-NO") : "\u2014"}
          </span>
        );
      },
    },
    {
      accessorKey: "signed_at",
      header: "Signed",
      cell: ({ getValue }) => {
        const val = getValue() as string | null;
        return (
          <span className="text-muted-foreground">
            {val ? new Date(val).toLocaleDateString("no-NO") : "\u2014"}
          </span>
        );
      },
    },
    {
      accessorKey: "expires_at",
      header: "Expires",
      cell: ({ getValue }) => {
        const val = getValue() as string | null;
        if (!val) return <span className="text-muted-foreground">{"\u2014"}</span>;
        const date = new Date(val);
        const isExpired = date < new Date();
        return (
          <span className={isExpired ? "text-red-400" : "text-muted-foreground"}>
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
