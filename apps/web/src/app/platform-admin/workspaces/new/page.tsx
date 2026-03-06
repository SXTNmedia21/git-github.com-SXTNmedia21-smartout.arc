"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Plus, Search, Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Company = {
  company_id: string;
  name: string;
  org_number: string;
  email: string | null;
  industry: string;
  country: string;
};

type DefaultPricing = {
  monthly_cost?: number;
  price_per_employee?: number;
  billing_interval?: string;
  onboarding_package?: string;
  onboarding_cost?: number;
  discount_percent?: number;
  discount_label?: string;
  trial_days?: number;
};

type Template = {
  template_id: string;
  name: string;
  contract_type: string;
  description: string | null;
  default_pricing: DefaultPricing | null;
};

type BrregCandidate = {
  orgNumber: string;
  name: string;
  city: string;
  industry: string;
  industryCode: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NACE_TO_INDUSTRY: Record<string, string> = {
  "56.101": "restaurant",
  "56.102": "restaurant",
  "56.301": "bar",
  "55.101": "hotel",
  "55.102": "hotel",
  "56.210": "catering",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0] ?? "";
}

// ---------------------------------------------------------------------------
// Form State
// ---------------------------------------------------------------------------

const INITIAL_FORM = {
  // Company
  is_new_company: false,
  company_id: "",
  company_name: "",
  company_org_number: "",
  company_email: "",
  company_industry: "restaurant",
  company_country: "NO",

  // Workspace
  workspace_name: "",
  workspace_slug: "",
  address_line_1: "",
  address_line_2: "",
  postal_code: "",
  city: "",
  country: "NO",
  language: "no",
  currency: "NOK",
  timezone: "Europe/Oslo",
  email: "",
  phone: "",
  is_active: true,

  // Subscription pricing (Stripe-aligned)
  billing_interval: "month" as "month" | "year",
  price_per_employee: "", // Recurring per-unit price (per seat/month or /year)
  monthly_cost: "", // Recurring flat-rate price (base fee)
  trial_period_days: "", // Stripe: trial_period_days on subscription

  // One-time prices
  has_onboarding: false,
  onboarding_package: "",
  onboarding_cost: "", // One-time price (Stripe: type=one_time)

  // Coupon / discount (Stripe: Coupon object)
  has_discount: false,
  discount_type: "percent_off" as "percent_off" | "amount_off",
  discount_value: "", // percent (0-100) or amount in minor units
  discount_duration: "once" as "once" | "repeating" | "forever",
  discount_duration_months: "", // only if duration=repeating
  discount_label: "", // Stripe: coupon.name

  // Meta
  effective_from: todayISO(),
  effective_until: "",
  pricing_notes: "",

  // Contract
  template_id: "",

  // Subscription
  subscription_plan: "trial",
  subscription_status: "trial",
};

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function NewWorkspacePage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  // Brreg lookup state
  const [lookupLoading, setLookupLoading] = useState(false);
  const [candidates, setCandidates] = useState<BrregCandidate[]>([]);
  const [showCandidates, setShowCandidates] = useState(false);
  const [lookupMeta, setLookupMeta] = useState<{
    dagligLeder?: string | null;
    companyType?: string | null;
    employeeCount?: number | null;
    naceDescription?: string | null;
    vatRegistered?: boolean;
    foundingDate?: string | null;
    website?: string | null;
  } | null>(null);

  // Lookup: identify by org number (exact match)
  const identifyByOrg = useCallback(async (orgNumber: string) => {
    setLookupLoading(true);
    setCandidates([]);
    setShowCandidates(false);
    try {
      const res = await fetch(
        `/api/platform-admin/workspaces/lookup?orgNumber=${encodeURIComponent(orgNumber)}`,
      );
      if (!res.ok) {
        toast.error("Fant ikke bedriften i Brønnøysundregistrene");
        return;
      }
      const data = await res.json();
      if (data.type !== "match" || !data.company) {
        toast.error("Fant ikke bedriften i Brønnøysundregistrene");
        return;
      }
      applyLookupData(data.company);
      setLookupMeta({
        dagligLeder: data.company.dagligLeder || null,
        companyType: data.company.companyType || null,
        employeeCount: data.company.employeeCount ?? null,
        naceDescription: data.company.naceDescription || null,
        vatRegistered: data.company.vatRegistered ?? false,
        foundingDate: data.company.foundingDate || null,
        website: data.company.website || null,
      });
      toast.success("Bedrift funnet", { description: data.company.legalName });
    } catch {
      toast.error("Kunne ikke søke i Brønnøysundregistrene");
    } finally {
      setLookupLoading(false);
    }
  }, []);

  // Lookup: search by name (fuzzy → candidate list)
  const searchByName = useCallback(
    async (name: string) => {
      setLookupLoading(true);
      try {
        const params = new URLSearchParams({ name });
        if (form.city) params.set("city", form.city);
        const res = await fetch(`/api/platform-admin/workspaces/lookup?${params}`);
        if (!res.ok) {
          toast.error("Søk feilet");
          return;
        }
        const data = await res.json();
        const results: BrregCandidate[] = data?.candidates || [];
        if (results.length === 0) {
          toast.error("Ingen treff", { description: "Prøv med organisasjonsnummer" });
          return;
        }
        if (results.length === 1) {
          await identifyByOrg(results[0]!.orgNumber);
          return;
        }
        setCandidates(results);
        setShowCandidates(true);
      } catch {
        toast.error("Kunne ikke søke i Brønnøysundregistrene");
      } finally {
        setLookupLoading(false);
      }
    },
    [form.city, identifyByOrg],
  );

  // Apply lookup data to form fields
  const applyLookupData = useCallback(
    (company: {
      orgNumber?: string;
      legalName?: string;
      naceCode?: string;
      address?: { street?: string; postalCode?: string; city?: string; country?: string };
      website?: string | null;
      email?: string | null;
      phone?: string | null;
      employeeCount?: number | null;
      companyType?: string | null;
      [key: string]: unknown;
    }) => {
      const nace = company.naceCode ?? "";
      const industry = NACE_TO_INDUSTRY[nace] ?? "other";
      const country = company.address?.country ?? "NO";

      setForm((prev) => ({
        ...prev,
        is_new_company: true,
        company_name: company.legalName ?? prev.company_name,
        company_org_number: company.orgNumber ?? prev.company_org_number,
        company_industry: industry,
        company_country: (["NO", "SE", "DK", "FI"].includes(country)
          ? country
          : "NO") as typeof prev.company_country,
        workspace_name: company.legalName ?? prev.workspace_name,
        address_line_1: company.address?.street ?? prev.address_line_1,
        postal_code: company.address?.postalCode ?? prev.postal_code,
        city: company.address?.city ?? prev.city,
        country: (["NO", "SE", "DK", "FI"].includes(country)
          ? country
          : "NO") as typeof prev.country,
        company_email: company.email ?? prev.company_email,
        email: company.email ?? prev.email,
        phone: company.phone ?? prev.phone,
      }));
    },
    [],
  );

  // Main lookup handler
  const handleLookup = useCallback(() => {
    const org = form.company_org_number.replace(/\s/g, "").trim();
    const name = form.company_name.trim();

    if (org && org.length >= 9) {
      void identifyByOrg(org);
    } else if (name) {
      void searchByName(name);
    } else {
      toast.warning("Fyll inn selskapsnavn eller organisasjonsnummer først");
    }
  }, [form.company_org_number, form.company_name, identifyByOrg, searchByName]);

  // Select a candidate from the list
  const handleSelectCandidate = useCallback(
    (candidate: BrregCandidate) => {
      setShowCandidates(false);
      setCandidates([]);
      void identifyByOrg(candidate.orgNumber);
    },
    [identifyByOrg],
  );

  // Load dropdown data
  useEffect(() => {
    async function loadData() {
      const [companiesRes, templatesRes] = await Promise.all([
        fetch("/api/platform-admin/workspaces?type=companies"),
        fetch("/api/platform-admin/workspaces?type=templates"),
      ]);
      if (companiesRes.ok) {
        const { data } = await companiesRes.json();
        setCompanies(data ?? []);
      }
      if (templatesRes.ok) {
        const { data } = await templatesRes.json();
        setTemplates(data ?? []);
      }
    }
    loadData();
  }, []);

  // Auto-generate slug from workspace name
  useEffect(() => {
    if (!slugManuallyEdited && form.workspace_name) {
      setForm((prev) => ({ ...prev, workspace_slug: slugify(prev.workspace_name) }));
    }
  }, [form.workspace_name, slugManuallyEdited]);

  // Template → pricing pre-fill
  const handleTemplateChange = useCallback(
    (templateId: string) => {
      setForm((prev) => ({ ...prev, template_id: templateId }));

      if (!templateId) return;

      const template = templates.find((t) => t.template_id === templateId);
      const dp = template?.default_pricing;
      if (!dp) return;

      setForm((prev) => ({
        ...prev,
        monthly_cost: dp.monthly_cost?.toString() ?? prev.monthly_cost,
        price_per_employee: dp.price_per_employee?.toString() ?? prev.price_per_employee,
        billing_interval: (dp.billing_interval as "month" | "year") ?? prev.billing_interval,
        onboarding_package: dp.onboarding_package ?? prev.onboarding_package,
        onboarding_cost: dp.onboarding_cost?.toString() ?? prev.onboarding_cost,
        has_onboarding: !!dp.onboarding_package || !!dp.onboarding_cost,
        has_discount: !!dp.discount_percent,
        discount_value: dp.discount_percent?.toString() ?? prev.discount_value,
        discount_label: dp.discount_label ?? prev.discount_label,
        trial_period_days: dp.trial_days?.toString() ?? prev.trial_period_days,
      }));

      toast.info("Prisfelt fylt ut fra mal");
    },
    [templates],
  );

  // Field updater
  const set = useCallback(
    (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    },
    [],
  );

  const setSelect = useCallback(
    (field: string) => (value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  // Submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.workspace_name) {
      toast.error("Fyll inn navn på arbeidssted");
      return;
    }
    if (form.is_new_company && (!form.company_name || !form.company_org_number)) {
      toast.error("Fyll inn selskapsnavn og organisasjonsnummer");
      return;
    }
    if (!form.is_new_company && !form.company_id) {
      toast.error("Velg et eksisterende selskap");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...form,
        price_per_employee: form.price_per_employee
          ? parseFloat(form.price_per_employee)
          : undefined,
        monthly_cost: form.monthly_cost ? parseFloat(form.monthly_cost) : undefined,
        onboarding_cost:
          form.has_onboarding && form.onboarding_cost
            ? parseFloat(form.onboarding_cost)
            : undefined,
        onboarding_package: form.has_onboarding ? form.onboarding_package : undefined,
        trial_days: form.trial_period_days ? parseInt(form.trial_period_days, 10) : undefined,
        discount_percent:
          form.has_discount && form.discount_type === "percent_off" && form.discount_value
            ? parseFloat(form.discount_value)
            : undefined,
        discount_amount:
          form.has_discount && form.discount_type === "amount_off" && form.discount_value
            ? parseFloat(form.discount_value)
            : undefined,
        discount_duration: form.has_discount ? form.discount_duration : undefined,
        discount_duration_months:
          form.has_discount &&
          form.discount_duration === "repeating" &&
          form.discount_duration_months
            ? parseInt(form.discount_duration_months, 10)
            : undefined,
        discount_label: form.has_discount ? form.discount_label : undefined,
        template_id: form.template_id || undefined,
        workspace_slug: form.workspace_slug || undefined,
        effective_until: form.effective_until || undefined,
        pricing_currency: form.currency,
      };

      const res = await fetch("/api/platform-admin/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        let msg: string;
        if (typeof err.error === "string") {
          msg = err.error;
        } else if (typeof err.error === "object" && err.error !== null) {
          // Zod field errors — show first failing field
          const fields = Object.entries(err.error)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
            .join("; ");
          msg = fields || "Validering feilet";
        } else {
          msg = "Kunne ikke opprette arbeidssted";
        }
        throw new Error(msg);
      }

      const result = await res.json();
      toast.success("Arbeidssted opprettet", {
        description: `Slug: ${result.data.slug}`,
      });
      router.push("/platform-admin/workspaces");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Noe gikk galt");
    } finally {
      setLoading(false);
    }
  }

  // Selected template description
  const selectedTemplate = templates.find((t) => t.template_id === form.template_id);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link href="/platform-admin/workspaces">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Nytt arbeidssted</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Opprett et nytt arbeidssted med priser og abonnement
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {/* ── Card 1: Selskap (full width) ── */}
          <Card>
            <CardHeader>
              <CardTitle>Selskap</CardTitle>
              <CardDescription>Velg eksisterende selskap eller opprett nytt</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Toggle buttons */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={!form.is_new_company ? "default" : "outline"}
                  size="sm"
                  onClick={() => setForm((prev) => ({ ...prev, is_new_company: false }))}
                >
                  Eksisterende selskap
                </Button>
                <Button
                  type="button"
                  variant={form.is_new_company ? "default" : "outline"}
                  size="sm"
                  onClick={() => setForm((prev) => ({ ...prev, is_new_company: true }))}
                >
                  Nytt selskap
                </Button>
              </div>

              {!form.is_new_company ? (
                <div className="max-w-md space-y-2">
                  <label className="text-sm font-medium">Selskap *</label>
                  <Select value={form.company_id} onValueChange={setSelect("company_id")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Velg selskap..." />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c.company_id} value={c.company_id}>
                          {c.name} ({c.org_number})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Selskapsnavn *</label>
                      <Input
                        value={form.company_name}
                        onChange={set("company_name")}
                        placeholder="Smartout AS"
                        required={form.is_new_company}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleLookup())}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Organisasjonsnummer *</label>
                      <Input
                        value={form.company_org_number}
                        onChange={set("company_org_number")}
                        placeholder="123 456 789"
                        required={form.is_new_company}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleLookup())}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleLookup}
                        disabled={
                          lookupLoading ||
                          (!form.company_name.trim() && !form.company_org_number.trim())
                        }
                        className="w-full"
                      >
                        {lookupLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="mr-2 h-4 w-4" />
                        )}
                        {lookupLoading ? "Søker..." : "Finn bedrift"}
                      </Button>
                    </div>
                  </div>

                  {/* Candidate list from Brreg name search */}
                  {showCandidates && candidates.length > 0 && (
                    <div className="border-border rounded-md border">
                      <div className="border-border bg-muted/50 border-b px-3 py-2">
                        <p className="text-muted-foreground text-sm font-medium">
                          {candidates.length} treff — velg riktig bedrift:
                        </p>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {candidates.map((c) => (
                          <button
                            key={c.orgNumber}
                            type="button"
                            onClick={() => handleSelectCandidate(c)}
                            className="hover:bg-muted/50 flex w-full items-center gap-3 border-b px-3 py-2.5 text-left last:border-b-0"
                          >
                            <Building2 className="text-muted-foreground h-4 w-4 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{c.name}</p>
                              <p className="text-muted-foreground text-xs">
                                {c.orgNumber} · {c.city} · {c.industry}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {lookupMeta && (
                    <div className="bg-muted/50 space-y-1 rounded-md border px-3 py-2">
                      {lookupMeta.dagligLeder && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-28 shrink-0 text-xs">
                            Daglig leder
                          </span>
                          <span className="text-sm font-medium">{lookupMeta.dagligLeder}</span>
                        </div>
                      )}
                      {lookupMeta.companyType && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-28 shrink-0 text-xs">
                            Selskapsform
                          </span>
                          <span className="text-sm">{lookupMeta.companyType}</span>
                        </div>
                      )}
                      {lookupMeta.employeeCount != null && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-28 shrink-0 text-xs">
                            Ansatte (Brreg)
                          </span>
                          <span className="text-sm">{lookupMeta.employeeCount}</span>
                        </div>
                      )}
                      {lookupMeta.naceDescription && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-28 shrink-0 text-xs">
                            Næring
                          </span>
                          <span className="text-sm">{lookupMeta.naceDescription}</span>
                        </div>
                      )}
                      {lookupMeta.vatRegistered !== undefined && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-28 shrink-0 text-xs">
                            MVA-registrert
                          </span>
                          <span className="text-sm">{lookupMeta.vatRegistered ? "Ja" : "Nei"}</span>
                        </div>
                      )}
                      {lookupMeta.foundingDate && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-28 shrink-0 text-xs">
                            Stiftet
                          </span>
                          <span className="text-sm">{lookupMeta.foundingDate}</span>
                        </div>
                      )}
                      {lookupMeta.website && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-28 shrink-0 text-xs">
                            Nettside
                          </span>
                          <span className="text-sm">{lookupMeta.website}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Kontakt e-post</label>
                      <Input
                        type="email"
                        value={form.company_email}
                        onChange={set("company_email")}
                        placeholder="post@selskap.no"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Bransje</label>
                      <Select
                        value={form.company_industry}
                        onValueChange={setSelect("company_industry")}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="restaurant">Restaurant</SelectItem>
                          <SelectItem value="hotel">Hotell</SelectItem>
                          <SelectItem value="cafe">Kafe</SelectItem>
                          <SelectItem value="bar">Bar</SelectItem>
                          <SelectItem value="catering">Catering</SelectItem>
                          <SelectItem value="other">Annet</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Land</label>
                      <Select
                        value={form.company_country}
                        onValueChange={setSelect("company_country")}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NO">Norge</SelectItem>
                          <SelectItem value="SE">Sverige</SelectItem>
                          <SelectItem value="DK">Danmark</SelectItem>
                          <SelectItem value="FI">Finland</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Card 2: Arbeidssted ── */}
          <Card>
            <CardHeader>
              <CardTitle>Arbeidssted</CardTitle>
              <CardDescription>Detaljer om det nye arbeidsstedet</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Navn *</label>
                <Input
                  value={form.workspace_name}
                  onChange={set("workspace_name")}
                  placeholder="Spatind Sportell"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">URL-slug</label>
                <div className="flex items-center gap-2">
                  <Input
                    value={form.workspace_slug}
                    onChange={(e) => {
                      setSlugManuallyEdited(true);
                      setForm((prev) => ({ ...prev, workspace_slug: e.target.value }));
                    }}
                    placeholder="spatind-sportell"
                    className="font-mono"
                  />
                </div>
                <p className="text-muted-foreground text-xs">
                  {form.workspace_slug
                    ? `${form.workspace_slug}.smartout.ai`
                    : "Genereres automatisk fra navn"}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Adresse</label>
                  <Input
                    value={form.address_line_1}
                    onChange={set("address_line_1")}
                    placeholder="Gateadresse"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Adresse 2</label>
                  <Input
                    value={form.address_line_2}
                    onChange={set("address_line_2")}
                    placeholder="c/o, etasje, etc."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Postnummer</label>
                  <Input
                    value={form.postal_code}
                    onChange={set("postal_code")}
                    placeholder="0150"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">By</label>
                  <Input value={form.city} onChange={set("city")} placeholder="Oslo" />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Land</label>
                  <Select value={form.country} onValueChange={setSelect("country")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NO">Norge</SelectItem>
                      <SelectItem value="SE">Sverige</SelectItem>
                      <SelectItem value="DK">Danmark</SelectItem>
                      <SelectItem value="FI">Finland</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Valuta</label>
                  <Select
                    value={form.currency}
                    onValueChange={(v) => {
                      setForm((prev) => ({ ...prev, currency: v }));
                    }}
                  >
                    <SelectTrigger>
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
                <div className="space-y-2">
                  <label className="text-sm font-medium">Språk</label>
                  <Select value={form.language} onValueChange={setSelect("language")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">Norsk</SelectItem>
                      <SelectItem value="sv">Svenska</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="da">Dansk</SelectItem>
                      <SelectItem value="fi">Suomi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tidssone</label>
                  <Input value={form.timezone} onChange={set("timezone")} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">E-post</label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={set("email")}
                    placeholder="kontakt@arbeidssted.no"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Telefon</label>
                  <Input value={form.phone} onChange={set("phone")} placeholder="+47 123 45 678" />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, is_active: checked }))
                  }
                />
                <label className="text-sm font-medium">Aktiv</label>
              </div>
            </CardContent>
          </Card>

          {/* ── Card 3: Pris og betaling (Stripe-aligned) ── */}
          <Card>
            <CardHeader>
              <CardTitle>Abonnement</CardTitle>
              <CardDescription>
                Recurring prices — mappes til Stripe Products &amp; Prices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Billing interval (Stripe: price.recurring.interval) */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Faktureringsintervall</label>
                <Select
                  value={form.billing_interval}
                  onValueChange={(v) =>
                    setForm((prev) => ({ ...prev, billing_interval: v as "month" | "year" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Månedlig</SelectItem>
                    <SelectItem value="year">Årlig</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Per-seat price (Stripe: price with per_unit billing_scheme) */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Pris per ansatt ({form.currency}/
                  {form.billing_interval === "month" ? "mnd" : "år"})
                </label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={form.price_per_employee}
                  onChange={set("price_per_employee")}
                  placeholder="149"
                />
                <p className="text-muted-foreground text-xs">
                  Stripe: recurring per-unit price (quantity = antall ansatte)
                </p>
              </div>

              {/* Flat-rate base fee (Stripe: flat-rate recurring price) */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Fast månedskostnad ({form.currency})</label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={form.monthly_cost}
                  onChange={set("monthly_cost")}
                  placeholder="995"
                />
                <p className="text-muted-foreground text-xs">
                  Stripe: recurring flat-rate price (valgfritt, i tillegg til per-seat)
                </p>
              </div>

              {/* Trial period (Stripe: subscription.trial_period_days) */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Prøveperiode (dager)</label>
                <Input
                  type="number"
                  min="0"
                  value={form.trial_period_days}
                  onChange={set("trial_period_days")}
                  placeholder="14"
                />
                <p className="text-muted-foreground text-xs">
                  Stripe: trial_period_days — ingen fakturering i prøveperioden
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Plan</label>
                  <Select
                    value={form.subscription_plan}
                    onValueChange={setSelect("subscription_plan")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={form.subscription_status}
                    onValueChange={setSelect("subscription_status")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="active">Aktiv</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Gyldig fra</label>
                  <Input type="date" value={form.effective_from} onChange={set("effective_from")} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Gyldig til</label>
                  <Input
                    type="date"
                    value={form.effective_until}
                    onChange={set("effective_until")}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Card 3b: Onboarding (one-time price) ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Onboarding</CardTitle>
                  <CardDescription>Engangskostnad for oppsett og opplæring</CardDescription>
                </div>
                <Switch
                  checked={form.has_onboarding}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, has_onboarding: checked }))
                  }
                />
              </div>
            </CardHeader>
            {form.has_onboarding && (
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Pakke</label>
                  <Select
                    value={form.onboarding_package}
                    onValueChange={setSelect("onboarding_package")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Velg pakke..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                      <SelectItem value="custom">Egendefinert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Kostnad ({form.currency})</label>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={form.onboarding_cost}
                    onChange={set("onboarding_cost")}
                    placeholder="4 990"
                  />
                  <p className="text-muted-foreground text-xs">
                    Stripe: one-time price — faktureres som separat invoice item
                  </p>
                </div>
              </CardContent>
            )}
          </Card>

          {/* ── Card 3c: Rabatt (Stripe Coupon) ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Rabatt</CardTitle>
                  <CardDescription>Stripe Coupon — prosent eller fast beløp</CardDescription>
                </div>
                <Switch
                  checked={form.has_discount}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, has_discount: checked }))
                  }
                />
              </div>
            </CardHeader>
            {form.has_discount && (
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Type</label>
                    <Select
                      value={form.discount_type}
                      onValueChange={(v) =>
                        setForm((prev) => ({
                          ...prev,
                          discount_type: v as "percent_off" | "amount_off",
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent_off">Prosent (%)</SelectItem>
                        <SelectItem value="amount_off">Fast beløp ({form.currency})</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {form.discount_type === "percent_off"
                        ? "Prosent"
                        : `Beløp (${form.currency})`}
                    </label>
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      max={form.discount_type === "percent_off" ? "100" : undefined}
                      value={form.discount_value}
                      onChange={set("discount_value")}
                      placeholder={form.discount_type === "percent_off" ? "20" : "500"}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Varighet</label>
                    <Select
                      value={form.discount_duration}
                      onValueChange={(v) =>
                        setForm((prev) => ({
                          ...prev,
                          discount_duration: v as "once" | "repeating" | "forever",
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="once">Én gang (første faktura)</SelectItem>
                        <SelectItem value="repeating">Flere måneder</SelectItem>
                        <SelectItem value="forever">For alltid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.discount_duration === "repeating" && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Antall måneder</label>
                      <Input
                        type="number"
                        min="1"
                        value={form.discount_duration_months}
                        onChange={set("discount_duration_months")}
                        placeholder="3"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Rabattnavn</label>
                  <Input
                    value={form.discount_label}
                    onChange={set("discount_label")}
                    placeholder="Tidlig-kunde rabatt"
                  />
                  <p className="text-muted-foreground text-xs">
                    Stripe: coupon.name — synlig for kunden
                  </p>
                </div>
              </CardContent>
            )}
          </Card>

          {/* ── Card 3d: Notater ── */}
          <Card>
            <CardHeader>
              <CardTitle>Notater</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={form.pricing_notes}
                onChange={set("pricing_notes")}
                placeholder="Interne notater om priser og avtale..."
                rows={3}
              />
            </CardContent>
          </Card>

          {/* ── Card 4: Kontrakt ── */}
          <Card>
            <CardHeader>
              <CardTitle>Kontrakt</CardTitle>
              <CardDescription>Koble til en kontraktsmal (valgfritt)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Kontraktsmal</label>
                <Select value={form.template_id} onValueChange={handleTemplateChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ingen kontrakt" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.template_id} value={t.template_id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTemplate?.description && (
                <p className="text-muted-foreground text-sm">{selectedTemplate.description}</p>
              )}

              {selectedTemplate?.default_pricing && (
                <p className="text-muted-foreground text-xs italic">
                  Malen har standardpriser som er fylt inn i prisfeltene.
                </p>
              )}
            </CardContent>
          </Card>

          {/* ── Submit ── */}
          <Card>
            <CardFooter className="justify-end gap-3 pt-6">
              <Link href="/platform-admin/workspaces">
                <Button variant="outline" type="button">
                  Avbryt
                </Button>
              </Link>
              <Button type="submit" disabled={loading}>
                <Plus className="mr-2 h-4 w-4" />
                {loading ? "Oppretter..." : "Opprett arbeidssted"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </form>
    </div>
  );
}
