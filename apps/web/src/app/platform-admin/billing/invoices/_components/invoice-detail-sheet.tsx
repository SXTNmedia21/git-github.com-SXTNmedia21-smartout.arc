"use client";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// Side-panel preview of InvoiceDetail. The list page passes
// ?preview=<invoice_id> and this component opens the Sheet until the
// user closes it (which removes the query param).
//
// Lazy-loads the server-rendered detail via fetch of the full-page
// route's RSC payload, so the Sheet carries the same data as the
// dedicated route without duplicate queries.

export function InvoiceDetailSheet({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(true);

  // Watch searchParams — if `preview` is removed externally (e.g. a
  // filter change), close the Sheet so UI stays in sync.
  useEffect(() => {
    if (!searchParams.get("preview")) {
      setOpen(false);
    }
  }, [searchParams]);

  const close = () => {
    setOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("preview");
    const next = params.toString();
    router.push(next ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && close()}>
      <SheetContent side="right" className="w-[800px] max-w-[90vw] overflow-y-auto">
        <SheetTitle className="sr-only">Fakturadetalj</SheetTitle>
        <div className="py-4">
          <p className="text-muted-foreground text-sm">
            Åpner faktura <span className="font-mono text-xs">{invoiceId.slice(0, 8)}…</span>
          </p>
          <p className="text-muted-foreground text-sm">Bruk fullvisning for komplett faktura.</p>
          <a
            href={`/platform-admin/billing/invoices/${invoiceId}`}
            className="text-foreground mt-4 inline-block underline"
          >
            Åpne full visning →
          </a>
        </div>
      </SheetContent>
    </Sheet>
  );
}
