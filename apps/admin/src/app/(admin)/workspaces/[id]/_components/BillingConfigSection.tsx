// BillingConfigSection.tsx — pricing terms snapshot
//
// Shows the current pricing_terms row for this workspace:
// monthly cost, per-employee price, free users, billing interval,
// and delivery channel.
//
// pricingTerms === null means RLS denied (orders_only scope) —
// renders a gray "Ikke tilgang" placeholder in that case.
//
// Server Component. No "use client".

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { emit, nonEmpty } from "@/lib/telemetry";
import type { KartotekPricingTerms } from "@smartout/billing/server";

type Props = {
  pricingTerms: KartotekPricingTerms | null;
  /** True when any full_kartotek section was denied. */
  hasPartialAccess: boolean;
  workspaceId: string;
  userId: string;
};

function formatNok(amount: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 0,
  }).format(amount);
}

function intervalLabel(interval: string): string {
  switch (interval) {
    case "monthly":
      return "Månedlig";
    case "quarterly":
      return "Kvartalsvis";
    case "yearly":
      return "Årlig";
    default:
      return interval;
  }
}

export async function BillingConfigSection({
  pricingTerms,
  hasPartialAccess,
  workspaceId,
  userId,
}: Props) {
  // RLS denied — emit section_failed and render placeholder.
  if (pricingTerms === null && hasPartialAccess) {
    await emit({
      event: "kartotek section_failed",
      actor_id: nonEmpty(userId, "actor_id"),
      workspace_id: null,
      properties: {
        entity: { entity_type: "workspace", entity_id: workspaceId },
        data: { workspace_id: workspaceId, section: "billing_config", reason: "rls_denied" },
      },
    });

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fakturaoppsett</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Ikke tilgang — denne seksjonen krever full kartotek-tilgang
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!pricingTerms) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fakturaoppsett</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Ingen aktive prisvilkår funnet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Fakturaoppsett</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <p className="text-muted-foreground text-xs tracking-wide uppercase">
              Månedlig kostnad
            </p>
            <p className="mt-1 font-mono text-sm font-medium">
              {formatNok(pricingTerms.monthly_cost)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs tracking-wide uppercase">Per ansatt</p>
            <p className="mt-1 font-mono text-sm font-medium">
              {formatNok(pricingTerms.price_per_employee)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs tracking-wide uppercase">Gratis brukere</p>
            <p className="mt-1 font-mono text-sm font-medium">{pricingTerms.free_users}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs tracking-wide uppercase">
              Faktureringsintervall
            </p>
            <p className="mt-1 text-sm font-medium">
              {intervalLabel(pricingTerms.billing_interval)}
            </p>
          </div>
        </div>

        {/* Additional fields if present — cast unknown index-sig fields to string */}
        {(() => {
          const deliveryChannel =
            pricingTerms.delivery_channel != null ? String(pricingTerms.delivery_channel) : null;
          const paymentTermsDays =
            pricingTerms.payment_terms_days != null
              ? String(pricingTerms.payment_terms_days)
              : null;

          if (!deliveryChannel && !paymentTermsDays) return null;

          return (
            <>
              <Separator className="my-4" />
              <div className="flex flex-wrap gap-6 text-sm">
                {deliveryChannel && (
                  <div>
                    <span className="text-muted-foreground">Leveringskanal </span>
                    <span className="font-mono">{deliveryChannel}</span>
                  </div>
                )}
                {paymentTermsDays && (
                  <div>
                    <span className="text-muted-foreground">Betalingsfrist </span>
                    <span className="font-mono">{paymentTermsDays} dager</span>
                  </div>
                )}
              </div>
            </>
          );
        })()}
      </CardContent>
    </Card>
  );
}
