"use client";

// OrderDetailSheet.tsx — always-mounted side-panel preview.
//
// Verbatim copy of platform-admin/billing/invoices/_components/invoice-detail-sheet.tsx.
// Pattern: Sheet stays mounted; open/close derived from ?preview search param.
// This solves the Radix + Next.js router race condition: conditional parent
// unmount mid-close animation causes null.dispatchEvent at History.pushState.
//
// Links to the full detail page at /orders/<id> for complete view.

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function OrderDetailSheet() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previewId = searchParams.get("preview");

  // Retain the last id during close animation so content does not blank
  // out before the slide-out finishes.
  const [displayedId, setDisplayedId] = useState<string | null>(previewId);
  useEffect(() => {
    // Intentional: retain last id during Sheet close animation so content
    // does not blank out before the Radix slide-out finishes (Radix/Next race).
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
        <SheetTitle className="sr-only">Ordredetalj</SheetTitle>
        {displayedId ? (
          <div className="py-4">
            <p className="text-muted-foreground text-sm">
              Åpner ordre <span className="font-mono text-xs">{displayedId.slice(0, 8)}…</span>
            </p>
            <p className="text-muted-foreground text-sm">
              Bruk fullvisning for komplett ordredetalj.
            </p>
            <a
              href={`/orders/${displayedId}`}
              className="text-foreground mt-4 inline-block underline"
            >
              Åpne fullvisning →
            </a>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
