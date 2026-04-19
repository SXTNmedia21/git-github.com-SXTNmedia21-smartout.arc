"use client";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// Side-panel preview of InvoiceDetail. The list page renders this
// unconditionally; open/close is derived purely from the `preview`
// search param. The Sheet stays mounted during close animation so
// Radix can complete its exit transition without racing a parent
// unmount — a conditional parent render would tear the component out
// mid-animation and surface as `null.dispatchEvent` at History.pushState.

export function InvoiceDetailSheet() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previewId = searchParams.get("preview");

  // Retain the last id during close animation so content does not
  // blank out before the slide-out finishes.
  const [displayedId, setDisplayedId] = useState<string | null>(previewId);
  useEffect(() => {
    if (previewId) setDisplayedId(previewId);
  }, [previewId]);

  const open = Boolean(previewId);

  const handleOpenChange = (next: boolean) => {
    if (next) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("preview");
    const q = params.toString();
    router.push(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-[800px] max-w-[90vw] overflow-y-auto">
        <SheetTitle className="sr-only">Fakturadetalj</SheetTitle>
        {displayedId ? (
          <div className="py-4">
            <p className="text-muted-foreground text-sm">
              Åpner faktura <span className="font-mono text-xs">{displayedId.slice(0, 8)}…</span>
            </p>
            <p className="text-muted-foreground text-sm">Bruk fullvisning for komplett faktura.</p>
            <a
              href={`/platform-admin/billing/invoices/${displayedId}`}
              className="text-foreground mt-4 inline-block underline"
            >
              Åpne full visning →
            </a>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
