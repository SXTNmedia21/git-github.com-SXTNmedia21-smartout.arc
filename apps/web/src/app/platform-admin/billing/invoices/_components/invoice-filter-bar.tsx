"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function InvoiceFilterBar() {
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
    // Resetting filter also clears any open preview — stale id after
    // refilter is a common trap.
    params.delete("preview");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex gap-2">
      <Select
        value={searchParams.get("status") ?? "all"}
        onValueChange={(v) => setFilter("status", v)}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle statuser</SelectItem>
          <SelectItem value="draft">Utkast</SelectItem>
          <SelectItem value="issued">Utstedt</SelectItem>
          <SelectItem value="sent">Sendt</SelectItem>
          <SelectItem value="paid">Betalt</SelectItem>
          <SelectItem value="overdue">Forfalt</SelectItem>
          <SelectItem value="void">Annullert</SelectItem>
          <SelectItem value="uncollectible">Avskrevet</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
