"use client";

// OrderFilterBar.tsx — URL-param-driven order filter bar.
//
// Lifted from platform-admin/billing/invoices/_components/invoice-filter-bar.tsx.
// Status labels use accountant terminology ("Mottatt og betalt" for paid,
// "Alle ordre" for all) per blueprint §1 naming table.
// On filter change clears ?preview= to avoid stale Sheet open.

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function OrderFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    // Resetting filter clears any open preview — stale id after refilter is a common trap.
    params.delete("preview");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex gap-2">
      <Select
        value={searchParams.get("status") ?? "all"}
        onValueChange={(v) => setFilter("status", v)}
      >
        <SelectTrigger className="w-52">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle ordre</SelectItem>
          <SelectItem value="draft">Utkast</SelectItem>
          <SelectItem value="issued">Utstedt</SelectItem>
          <SelectItem value="sent">Sendt</SelectItem>
          <SelectItem value="paid">Mottatt og betalt</SelectItem>
          <SelectItem value="overdue">Forfalt</SelectItem>
          <SelectItem value="void">Annullert</SelectItem>
          <SelectItem value="uncollectible">Avskrevet</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
