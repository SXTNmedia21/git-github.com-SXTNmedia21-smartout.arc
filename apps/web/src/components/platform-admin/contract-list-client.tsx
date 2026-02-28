"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "./data-table";
import { createContractColumns, type ContractRow, type ContractAction } from "./contract-columns";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { toast } from "sonner";

const CONTRACT_STATUSES = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "viewed", label: "Viewed" },
  { value: "signed", label: "Signed" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
  { value: "declined", label: "Declined" },
  { value: "terminated", label: "Terminated" },
  { value: "voided", label: "Voided" },
];

const CONTRACT_TYPES = [
  { value: "all", label: "All types" },
  { value: "client", label: "Client" },
  { value: "employee", label: "Employee" },
  { value: "haccp", label: "HACCP" },
  { value: "training", label: "Training" },
  { value: "season", label: "Season" },
  { value: "custom", label: "Custom" },
];

export function ContractListClient({ data }: { data: ContractRow[] }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const handleAction = useCallback(
    (action: ContractAction) => {
      switch (action.type) {
        case "preview":
          router.push(`/platform-admin/contracts/${action.contractId}`);
          break;
        case "remind":
          toast.info(
            "Reminder functionality will be available when the contract microservice is running.",
          );
          break;
        case "cancel":
          toast.info(
            "Cancel functionality will be available when the contract microservice is running.",
          );
          break;
        case "download":
          if (action.pdfUrl) {
            window.open(action.pdfUrl, "_blank");
          }
          break;
      }
    },
    [router],
  );

  const columns = useMemo(() => createContractColumns(handleAction), [handleAction]);

  const filteredData = useMemo(() => {
    let result = data;

    if (statusFilter !== "all") {
      result = result.filter((c) => c.status === statusFilter);
    }

    if (typeFilter !== "all") {
      result = result.filter((c) => c.contract_type === typeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.recipient_name.toLowerCase().includes(q) ||
          c.recipient_email.toLowerCase().includes(q) ||
          (c.company?.name || "").toLowerCase().includes(q),
      );
    }

    return result;
  }, [data, statusFilter, typeFilter, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm min-w-[200px] flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search by company, name, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {CONTRACT_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {CONTRACT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-muted-foreground text-sm">
          {filteredData.length} contract{filteredData.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredData}
        onRowClick={(row) => router.push(`/platform-admin/contracts/${row.contract_id}`)}
      />
    </div>
  );
}
