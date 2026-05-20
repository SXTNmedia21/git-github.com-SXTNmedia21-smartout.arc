"use client";

// Avtaler tab — three sections stacked vertically:
// 1. Status row: subscription plan, contract status, trial countdown
// 2. Prisvilkar: editable pricing terms (create or update)
// 3. Kontrakter: list of DocuSeal contracts via ContractListClient

import { useState } from "react";
import Link from "next/link";
import { Pencil, Check, X, Plus } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/platform-admin/status-badge";
import { ContractListClient } from "@/components/platform-admin/contract-list-client";
import type { ContractRow } from "@/components/platform-admin/contract-columns";

// ── PricingTermsData ──────────────────────────────────────────────────────────
// Exported so workspace-detail-client and the server page can import it.
export type PricingTermsData = {
  pricingTermsId: string;
  companyId: string;
  workspaceId: string | null;
  monthlyCost: number | null;
  pricePerEmployee: number;
  billingInterval: string;
  currency: string;
  discountPercent: number | null;
  discountLabel: string | null;
  onboardingPackage: string | null;
  onboardingCost: number | null;
  trialDays: number | null;
  effectiveFrom: string;
  effectiveUntil: string | null;
  notes: string | null;
  contractId: string | null;
  updatedAt: string;
};

// ── Props ─────────────────────────────────────────────────────────────────────

type ContractTabProps = {
  workspaceId: string;
  companyId: string | null;
  companyName: string;
  dagligLeder: string;
  companyEmail: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  contractStatus: string;
  activeContractId: string | null;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  contracts: ContractRow[];
  pricingTerms: PricingTermsData | null;
  signatory: { profileId: string; displayName: string; email: string } | null;
};

// Contract status badge colors — distinct from the generic StatusBadge map.
const contractStatusColor: Record<string, string> = {
  none: "bg-muted text-muted-foreground",
  pending_contract: "bg-yellow-500/10 text-yellow-400",
  active: "bg-green-500/10 text-green-400",
  suspended: "bg-red-500/10 text-red-400",
  deactivated: "bg-muted text-muted-foreground",
};

// ── Edit form state — mirrors PricingTermsData but as strings for controlled inputs ──

type PricingFormState = {
  monthlyCost: string;
  pricePerEmployee: string;
  billingInterval: string;
  currency: string;
  discountPercent: string;
  discountLabel: string;
  onboardingPackage: string;
  onboardingCost: string;
  trialDays: string;
  effectiveFrom: string;
  notes: string;
};

function toFormState(terms: PricingTermsData | null): PricingFormState {
  return {
    monthlyCost: terms?.monthlyCost?.toString() ?? "",
    pricePerEmployee: terms?.pricePerEmployee?.toString() ?? "",
    billingInterval: terms?.billingInterval ?? "monthly",
    currency: terms?.currency ?? "NOK",
    discountPercent: terms?.discountPercent?.toString() ?? "",
    discountLabel: terms?.discountLabel ?? "",
    onboardingPackage: terms?.onboardingPackage ?? "",
    onboardingCost: terms?.onboardingCost?.toString() ?? "",
    trialDays: terms?.trialDays?.toString() ?? "",
    effectiveFrom: terms?.effectiveFrom?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    notes: terms?.notes ?? "",
  };
}

// ════════════════════════════════════════════════════════════════════════════

export function ContractTab({
  workspaceId,
  companyId,
  companyName,
  dagligLeder,
  companyEmail,
  subscriptionPlan,
  subscriptionStatus,
  contractStatus,
  trialEndsAt,
  trialDaysLeft,
  contracts,
  pricingTerms: initialPricingTerms,
  signatory,
}: ContractTabProps) {
  // Build pre-filled "Ny kontrakt" URL with all known data
  const newContractParams = new URLSearchParams();
  if (companyId) newContractParams.set("company_id", companyId);
  newContractParams.set("workspace_id", workspaceId);
  if (dagligLeder) newContractParams.set("recipient_name", dagligLeder);
  if (companyEmail) newContractParams.set("recipient_email", companyEmail);
  if (companyName) {
    newContractParams.set("title", `Smartout Kundeavtale \u2014 ${companyName}`);
  }
  const newContractHref = `/platform-admin/contracts/new?${newContractParams.toString()}`;

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pricingTerms, setPricingTerms] = useState<PricingTermsData | null>(initialPricingTerms);
  const [formState, setFormState] = useState<PricingFormState>(() =>
    toFormState(initialPricingTerms),
  );

  // ── Pricing terms save ───────────────────────────────────────────────────

  async function handleSavePricing() {
    setIsSaving(true);
    try {
      const payload = {
        workspace_id: workspaceId,
        company_id: companyId,
        monthly_cost: formState.monthlyCost ? parseFloat(formState.monthlyCost) : null,
        price_per_employee: parseFloat(formState.pricePerEmployee) || 0,
        billing_interval: formState.billingInterval,
        currency: formState.currency,
        discount_percent: formState.discountPercent ? parseFloat(formState.discountPercent) : null,
        discount_label: formState.discountLabel || null,
        onboarding_package: formState.onboardingPackage || null,
        onboarding_cost: formState.onboardingCost ? parseFloat(formState.onboardingCost) : null,
        trial_days: formState.trialDays ? parseInt(formState.trialDays, 10) : null,
        effective_from: formState.effectiveFrom,
        notes: formState.notes || null,
        // Include the existing record ID for PATCH
        ...(pricingTerms ? { pricing_terms_id: pricingTerms.pricingTermsId } : {}),
      };

      const method = pricingTerms ? "PATCH" : "POST";
      const res = await fetch("/api/platform-admin/pricing-terms", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Kunne ikke lagre prisvilkar");
      }

      const { data } = await res.json();
      setPricingTerms(data);
      setFormState(toFormState(data));
      setIsEditing(false);
      toast.success("Prisvilkar lagret");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Noe gikk galt");
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancelEdit() {
    setFormState(toFormState(pricingTerms));
    setIsEditing(false);
  }

  function setField(key: keyof PricingFormState, value: string) {
    setFormState((prev) => ({ ...prev, [key]: value }));
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <TabsContent value="avtaler" className="mt-4 space-y-6">
      {/* ── Signatory (prokura) ───────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-muted-foreground text-xs uppercase">Signatar (prokura)</p>
              {signatory ? (
                <div className="mt-1.5">
                  <p className="text-base font-medium">{signatory.displayName}</p>
                  <p className="text-muted-foreground text-sm">{signatory.email}</p>
                </div>
              ) : (
                <p className="mt-1.5 text-sm text-amber-500">
                  Ingen signatar satt — invitér owner først (Champions-fanen).
                </p>
              )}
            </div>
            <Badge variant={signatory ? "default" : "outline"} className="text-xs">
              {signatory ? "Klar for kontrakt" : "Mangler"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 1: Status row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Abonnement */}
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs uppercase">Abonnement</p>
            <p className="mt-2 text-lg font-semibold capitalize">{subscriptionPlan}</p>
            <div className="mt-2">
              <StatusBadge status={subscriptionStatus} />
            </div>
          </CardContent>
        </Card>

        {/* Kontraktstatus */}
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs uppercase">Kontraktstatus</p>
            <p className="mt-2 text-lg font-semibold capitalize">
              {contractStatus.replace(/_/g, " ")}
            </p>
            <div className="mt-2">
              <Badge
                variant="outline"
                className={`text-xs ${contractStatusColor[contractStatus] ?? "bg-muted text-muted-foreground"}`}
              >
                {contractStatus.replace(/_/g, " ")}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Trial — only shown when trialDaysLeft is not null */}
        {trialDaysLeft !== null && (
          <Card>
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs uppercase">Trial</p>
              <p
                className={`mt-2 text-lg font-semibold ${trialDaysLeft <= 3 ? "text-destructive" : ""}`}
              >
                {trialDaysLeft} dager igjen
              </p>
              {trialEndsAt && (
                <p className="text-muted-foreground text-xs">
                  Utloper {new Date(trialEndsAt).toLocaleDateString("no-NO")}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Section 2: Prisvilkar ─────────────────────────────────────────── */}
      {pricingTerms || isEditing ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base">Gjeldende vilkar</CardTitle>
            {!isEditing ? (
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Rediger
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSavePricing} disabled={isSaving}>
                  <Check className="mr-2 h-3.5 w-3.5" />
                  {isSaving ? "Lagrer..." : "Lagre"}
                </Button>
                <Button variant="ghost" size="sm" onClick={handleCancelEdit} disabled={isSaving}>
                  <X className="mr-2 h-3.5 w-3.5" />
                  Avbryt
                </Button>
              </div>
            )}
          </CardHeader>

          <CardContent>
            {isEditing ? (
              /* ── Edit mode ── */
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="monthlyCost">Basispris / mnd</Label>
                  <Input
                    id="monthlyCost"
                    type="number"
                    min="0"
                    value={formState.monthlyCost}
                    onChange={(e) => setField("monthlyCost", e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pricePerEmployee">Pris per ekstra ansatt</Label>
                  <Input
                    id="pricePerEmployee"
                    type="number"
                    min="0"
                    value={formState.pricePerEmployee}
                    onChange={(e) => setField("pricePerEmployee", e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="billingInterval">Faktureringsintervall</Label>
                  <Select
                    value={formState.billingInterval}
                    onValueChange={(v) => setField("billingInterval", v)}
                  >
                    <SelectTrigger id="billingInterval">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="currency">Valuta</Label>
                  <Select value={formState.currency} onValueChange={(v) => setField("currency", v)}>
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NOK">NOK</SelectItem>
                      <SelectItem value="SEK">SEK</SelectItem>
                      <SelectItem value="DKK">DKK</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="discountPercent">Rabatt (%)</Label>
                  <Input
                    id="discountPercent"
                    type="number"
                    min="0"
                    max="100"
                    value={formState.discountPercent}
                    onChange={(e) => setField("discountPercent", e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="discountLabel">Rabatt-etikett</Label>
                  <Input
                    id="discountLabel"
                    value={formState.discountLabel}
                    onChange={(e) => setField("discountLabel", e.target.value)}
                    placeholder="Partner-rabatt"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="onboardingPackage">Onboarding-pakke</Label>
                  <Input
                    id="onboardingPackage"
                    value={formState.onboardingPackage}
                    onChange={(e) => setField("onboardingPackage", e.target.value)}
                    placeholder="Standard"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="onboardingCost">Onboarding-kostnad</Label>
                  <Input
                    id="onboardingCost"
                    type="number"
                    min="0"
                    value={formState.onboardingCost}
                    onChange={(e) => setField("onboardingCost", e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="trialDays">Trial-dager</Label>
                  <Input
                    id="trialDays"
                    type="number"
                    min="0"
                    value={formState.trialDays}
                    onChange={(e) => setField("trialDays", e.target.value)}
                    placeholder="14"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="effectiveFrom">Gyldig fra</Label>
                  <Input
                    id="effectiveFrom"
                    type="date"
                    value={formState.effectiveFrom}
                    onChange={(e) => setField("effectiveFrom", e.target.value)}
                  />
                </div>

                <div className="col-span-full space-y-1.5">
                  <Label htmlFor="notes">Notater</Label>
                  <Textarea
                    id="notes"
                    value={formState.notes}
                    onChange={(e) => setField("notes", e.target.value)}
                    placeholder="Interne notater om denne prisavtalen..."
                    rows={3}
                  />
                </div>
              </div>
            ) : (
              /* ── Read mode ── */
              <>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-3">
                  <div>
                    <dt className="text-muted-foreground text-xs">Basispris / mnd</dt>
                    <dd className="mt-0.5 text-sm font-medium">
                      {pricingTerms?.monthlyCost != null
                        ? `${pricingTerms.monthlyCost.toLocaleString("no-NO")} ${pricingTerms.currency}`
                        : "—"}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-muted-foreground text-xs">Pris per ekstra ansatt</dt>
                    <dd className="mt-0.5 text-sm font-medium">
                      {`${pricingTerms?.pricePerEmployee.toLocaleString("no-NO")} ${pricingTerms?.currency}`}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-muted-foreground text-xs">Faktureringsintervall</dt>
                    <dd className="mt-0.5 text-sm font-medium capitalize">
                      {pricingTerms?.billingInterval}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-muted-foreground text-xs">Valuta</dt>
                    <dd className="mt-0.5 text-sm font-medium">{pricingTerms?.currency}</dd>
                  </div>

                  {pricingTerms?.discountPercent != null && pricingTerms.discountPercent > 0 && (
                    <div>
                      <dt className="text-muted-foreground text-xs">Rabatt</dt>
                      <dd className="mt-0.5 text-sm font-medium">
                        {pricingTerms.discountPercent}%
                        {pricingTerms.discountLabel && ` — ${pricingTerms.discountLabel}`}
                      </dd>
                    </div>
                  )}

                  {pricingTerms?.onboardingPackage && (
                    <div>
                      <dt className="text-muted-foreground text-xs">Onboarding</dt>
                      <dd className="mt-0.5 text-sm font-medium">
                        {pricingTerms.onboardingPackage}
                        {pricingTerms.onboardingCost != null &&
                          ` (${pricingTerms.onboardingCost.toLocaleString("no-NO")} ${pricingTerms.currency})`}
                      </dd>
                    </div>
                  )}

                  {pricingTerms?.trialDays != null && (
                    <div>
                      <dt className="text-muted-foreground text-xs">Trial-dager</dt>
                      <dd className="mt-0.5 text-sm font-medium">{pricingTerms.trialDays}</dd>
                    </div>
                  )}

                  <div>
                    <dt className="text-muted-foreground text-xs">Gyldig fra</dt>
                    <dd className="mt-0.5 text-sm font-medium">
                      {pricingTerms?.effectiveFrom
                        ? new Date(pricingTerms.effectiveFrom).toLocaleDateString("no-NO")
                        : "—"}
                    </dd>
                  </div>

                  {pricingTerms?.notes && (
                    <div className="col-span-full">
                      <dt className="text-muted-foreground text-xs">Notater</dt>
                      <dd className="mt-0.5 text-sm">{pricingTerms.notes}</dd>
                    </div>
                  )}
                </dl>

                {pricingTerms?.updatedAt && (
                  <p className="text-muted-foreground mt-4 text-xs">
                    Sist endret{" "}
                    {new Date(pricingTerms.updatedAt).toLocaleDateString("no-NO", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        /* ── Empty state for pricing terms ── */
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground text-sm">Ingen prisvilkar registrert</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setIsEditing(true)}>
            <Plus className="mr-2 h-3.5 w-3.5" />
            Opprett vilkar
          </Button>
        </div>
      )}

      {/* ── Section 3: Kontrakter ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base">Kontrakter</CardTitle>
          <Link href={newContractHref}>
            <Button variant="outline" size="sm">
              <Plus className="mr-2 h-3.5 w-3.5" />
              Ny kontrakt
            </Button>
          </Link>
        </CardHeader>

        <CardContent>
          {contracts.length > 0 ? (
            <ContractListClient data={contracts} />
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-muted-foreground text-sm">Ingen kontrakter</p>
              <Link href={newContractHref}>
                <Button variant="outline" size="sm" className="mt-3">
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  Opprett forste kontrakt
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
