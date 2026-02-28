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
import { ArrowLeft, Plus } from "lucide-react";
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

  // Pricing
  price_per_employee: "",
  monthly_cost: "",
  billing_interval: "monthly",
  onboarding_package: "",
  onboarding_cost: "",
  discount_percent: "",
  discount_label: "",
  trial_days: "",
  effective_from: todayISO(),
  effective_until: "",
  pricing_notes: "",

  // Contract
  template_id: "",

  // Subscription
  subscription_plan: "trial",
  subscription_status: "trial",
  trial_ends_at: "",
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

  // Auto-calculate trial_ends_at from trial_days + effective_from
  useEffect(() => {
    if (form.trial_days && form.effective_from) {
      const days = parseInt(form.trial_days, 10);
      if (!isNaN(days) && days > 0) {
        const start = new Date(form.effective_from);
        start.setDate(start.getDate() + days);
        setForm((prev) => ({ ...prev, trial_ends_at: start.toISOString() }));
      }
    }
  }, [form.trial_days, form.effective_from]);

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
        billing_interval: dp.billing_interval ?? prev.billing_interval,
        onboarding_package: dp.onboarding_package ?? prev.onboarding_package,
        onboarding_cost: dp.onboarding_cost?.toString() ?? prev.onboarding_cost,
        discount_percent: dp.discount_percent?.toString() ?? prev.discount_percent,
        discount_label: dp.discount_label ?? prev.discount_label,
        trial_days: dp.trial_days?.toString() ?? prev.trial_days,
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
    if (!form.price_per_employee) {
      toast.error("Fyll inn pris per ansatt");
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
        price_per_employee: parseFloat(form.price_per_employee) || 0,
        monthly_cost: form.monthly_cost ? parseFloat(form.monthly_cost) : undefined,
        onboarding_cost: form.onboarding_cost ? parseFloat(form.onboarding_cost) : undefined,
        discount_percent: form.discount_percent ? parseFloat(form.discount_percent) : undefined,
        trial_days: form.trial_days ? parseInt(form.trial_days, 10) : undefined,
        template_id: form.template_id || undefined,
        workspace_slug: form.workspace_slug || undefined,
        trial_ends_at: form.trial_ends_at || undefined,
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
        const msg = typeof err.error === "string" ? err.error : "Kunne ikke opprette arbeidssted";
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
        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── Card 1: Selskap (full width) ── */}
          <Card className="lg:col-span-2">
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
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Selskapsnavn *</label>
                    <Input
                      value={form.company_name}
                      onChange={set("company_name")}
                      placeholder="Smartout AS"
                      required={form.is_new_company}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Organisasjonsnummer *</label>
                    <Input
                      value={form.company_org_number}
                      onChange={set("company_org_number")}
                      placeholder="123 456 789"
                      required={form.is_new_company}
                    />
                  </div>
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

          {/* ── Card 3: Pris og betaling ── */}
          <Card>
            <CardHeader>
              <CardTitle>Pris og betaling</CardTitle>
              <CardDescription>Onboarding, lisens og fakturering</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Onboarding-pakke</label>
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
                <label className="text-sm font-medium">Onboarding-kostnad ({form.currency})</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.onboarding_cost}
                  onChange={set("onboarding_cost")}
                  placeholder="Engangskostnad"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Månedlig kostnad ({form.currency})</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.monthly_cost}
                  onChange={set("monthly_cost")}
                  placeholder="995"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Pris per ansatt ({form.currency}) *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price_per_employee}
                  onChange={set("price_per_employee")}
                  placeholder="149"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Faktureringsintervall</label>
                <Select value={form.billing_interval} onValueChange={setSelect("billing_interval")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Månedlig</SelectItem>
                    <SelectItem value="quarterly">Kvartalsvis</SelectItem>
                    <SelectItem value="yearly">Årlig</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Rabatt %</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={form.discount_percent}
                    onChange={set("discount_percent")}
                    placeholder="20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Rabattbeskrivelse</label>
                  <Input
                    value={form.discount_label}
                    onChange={set("discount_label")}
                    placeholder="Årsrabatt"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Prøveperiode (dager)</label>
                <Input
                  type="number"
                  min="0"
                  value={form.trial_days}
                  onChange={set("trial_days")}
                  placeholder="14"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Gyldig fra *</label>
                  <Input
                    type="date"
                    value={form.effective_from}
                    onChange={set("effective_from")}
                    required
                  />
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

              <div className="space-y-2">
                <label className="text-sm font-medium">Notater</label>
                <Textarea
                  value={form.pricing_notes}
                  onChange={set("pricing_notes")}
                  placeholder="Interne notater om priser og avtale..."
                  rows={3}
                />
              </div>
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

          {/* ── Card 5: Abonnement + Submit ── */}
          <Card>
            <CardHeader>
              <CardTitle>Abonnement</CardTitle>
              <CardDescription>Abonnementsplan og status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Abonnementsplan</label>
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

              {form.trial_ends_at && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Prøveperiode utløper</label>
                  <p className="text-muted-foreground text-sm">
                    {new Date(form.trial_ends_at).toLocaleDateString("nb-NO")}
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter className="justify-end gap-3">
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
