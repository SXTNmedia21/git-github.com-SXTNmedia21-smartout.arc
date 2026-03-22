"use client";

/**
 * SetupWizard — 3-step wizard for creating a workspace website from a template.
 *
 * Step 1 (Velg mal): Template gallery — pick a template key.
 * Step 2 (Tilpass): Site name + color theme + font selector.
 * Step 3 (Ferdig): Summary card + submit.
 */

import { useState, useContext } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Card, CardContent } from "@smartout/ui";
import { Check, ChevronRight } from "lucide-react";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { createWebsiteFromTemplate } from "../_actions/website-actions";
import TemplateGallery from "./TemplateGallery";

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardStep = "template" | "customize" | "confirm";

type Theme = {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  fontFamily: string;
};

const DEFAULT_THEME: Theme = {
  primaryColor: "#1a1a1a",
  secondaryColor: "#6b7280",
  backgroundColor: "#ffffff",
  fontFamily: "inter",
};

const FONT_OPTIONS = [
  { value: "inter", label: "Inter" },
  { value: "geist", label: "Geist" },
  { value: "playfair", label: "Playfair Display" },
  { value: "lora", label: "Lora" },
];

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS: { id: WizardStep; label: string }[] = [
  { id: "template", label: "Velg mal" },
  { id: "customize", label: "Tilpass" },
  { id: "confirm", label: "Ferdig" },
];

function StepProgress({ currentStep }: { currentStep: WizardStep }) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);
  return (
    <div className="mb-8 flex items-center gap-2">
      {STEPS.map((step, index) => {
        const isDone = index < currentIndex;
        const isActive = index === currentIndex;
        return (
          <div key={step.id} className="flex items-center gap-2">
            <div
              className={[
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors",
                isDone
                  ? "bg-primary text-primary-foreground"
                  : isActive
                    ? "border-primary bg-primary/10 text-primary border-2"
                    : "border-border bg-background text-foreground/30 border",
              ].join(" ")}
            >
              {isDone ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </div>
            <span
              className={`text-sm font-medium ${isActive ? "text-foreground" : "text-foreground/40"}`}
            >
              {step.label}
            </span>
            {index < STEPS.length - 1 && (
              <ChevronRight className="text-foreground/20 mx-1 h-4 w-4" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── SetupWizard ──────────────────────────────────────────────────────────────

export default function SetupWizard() {
  const router = useRouter();
  const ctx = useWorkspaceOptional();
  const { isDark } = useContext(DashboardContext);

  const [step, setStep] = useState<WizardStep>("template");
  const [templateKey, setTemplateKey] = useState<string | null>(null);
  const [name, setName] = useState(ctx?.workspace.name ?? "");
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [isCreating, setIsCreating] = useState(false);

  // ─── Step 1: Template selection ─────────────────────────────

  function handleTemplateSelect(key: string) {
    setTemplateKey(key);
  }

  function handleTemplateNext() {
    if (!templateKey) {
      toast.error("Velg en mal for å fortsette");
      return;
    }
    setStep("customize");
  }

  // ─── Step 2: Customization ───────────────────────────────────

  function handleCustomizeNext() {
    if (!name.trim()) {
      toast.error("Skriv inn et navn på nettsiden");
      return;
    }
    setStep("confirm");
  }

  // ─── Step 3: Create ─────────────────────────────────────────

  async function handleCreate() {
    if (!templateKey || !ctx) return;
    setIsCreating(true);
    try {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      await createWebsiteFromTemplate({
        workspaceId: ctx.workspace.workspace_id,
        templateKey,
        name: name.trim(),
        siteSlug: slug,
        theme,
      });

      toast.success("Nettside opprettet!");
      router.push("/dashboard/website");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunne ikke opprette nettside");
    } finally {
      setIsCreating(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div>
      <StepProgress currentStep={step} />

      {/* Step 1: Template gallery */}
      {step === "template" && (
        <div>
          <h2 className="text-foreground mb-4 text-lg font-semibold">Velg en mal</h2>
          <TemplateGallery selectedKey={templateKey} onSelect={handleTemplateSelect} />
          <div className="mt-6 flex justify-end">
            <Button onClick={handleTemplateNext} disabled={!templateKey}>
              Neste
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Customize */}
      {step === "customize" && (
        <div>
          <h2 className="text-foreground mb-4 text-lg font-semibold">Tilpass utseende</h2>
          <div className="max-w-lg space-y-5">
            {/* Site name */}
            <div>
              <label
                htmlFor="site-name"
                className="text-foreground mb-1.5 block text-sm font-medium"
              >
                Navn på nettsiden
              </label>
              <input
                id="site-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="f.eks. Restauranten AS"
                className={[
                  "w-full rounded-lg border px-3 py-2 text-sm transition outline-none",
                  "border-border bg-background text-foreground placeholder:text-foreground/30",
                  "focus:border-primary focus:ring-primary focus:ring-1",
                ].join(" ")}
              />
            </div>

            {/* Primary color */}
            <div>
              <label
                htmlFor="primary-color"
                className="text-foreground mb-1.5 block text-sm font-medium"
              >
                Primærfarge
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="primary-color"
                  type="color"
                  value={theme.primaryColor}
                  onChange={(e) => setTheme((t) => ({ ...t, primaryColor: e.target.value }))}
                  className="border-border bg-background h-8 w-12 cursor-pointer rounded border"
                />
                <span className="text-foreground/50 text-xs">{theme.primaryColor}</span>
              </div>
            </div>

            {/* Secondary color */}
            <div>
              <label
                htmlFor="secondary-color"
                className="text-foreground mb-1.5 block text-sm font-medium"
              >
                Sekundærfarge
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="secondary-color"
                  type="color"
                  value={theme.secondaryColor}
                  onChange={(e) => setTheme((t) => ({ ...t, secondaryColor: e.target.value }))}
                  className="border-border bg-background h-8 w-12 cursor-pointer rounded border"
                />
                <span className="text-foreground/50 text-xs">{theme.secondaryColor}</span>
              </div>
            </div>

            {/* Background color */}
            <div>
              <label
                htmlFor="bg-color"
                className="text-foreground mb-1.5 block text-sm font-medium"
              >
                Bakgrunnsfarge
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="bg-color"
                  type="color"
                  value={theme.backgroundColor}
                  onChange={(e) => setTheme((t) => ({ ...t, backgroundColor: e.target.value }))}
                  className="border-border bg-background h-8 w-12 cursor-pointer rounded border"
                />
                <span className="text-foreground/50 text-xs">{theme.backgroundColor}</span>
              </div>
            </div>

            {/* Font */}
            <div>
              <label
                htmlFor="font-family"
                className="text-foreground mb-1.5 block text-sm font-medium"
              >
                Skrifttype
              </label>
              <select
                id="font-family"
                value={theme.fontFamily}
                onChange={(e) => setTheme((t) => ({ ...t, fontFamily: e.target.value }))}
                className={[
                  "w-full rounded-lg border px-3 py-2 text-sm transition outline-none",
                  "border-border bg-background text-foreground",
                  "focus:border-primary focus:ring-primary focus:ring-1",
                ].join(" ")}
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 flex justify-between">
            <Button variant="outline" onClick={() => setStep("template")}>
              Tilbake
            </Button>
            <Button onClick={handleCustomizeNext}>
              Neste
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === "confirm" && (
        <div>
          <h2 className="text-foreground mb-4 text-lg font-semibold">Klar til å opprette</h2>
          <Card className="max-w-md">
            <CardContent className="space-y-3 pt-5">
              <SummaryRow label="Mal" value={templateKey ?? "—"} />
              <SummaryRow label="Navn" value={name || "—"} />
              <SummaryRow
                label="Domene"
                value={`${name
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-+|-+$/g, "")}.smartout.info`}
              />
              <SummaryRow label="Primærfarge" value={theme.primaryColor} />
              <SummaryRow label="Skrifttype" value={theme.fontFamily} />
            </CardContent>
          </Card>

          <div className="mt-6 flex justify-between">
            <Button variant="outline" onClick={() => setStep("customize")}>
              Tilbake
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? "Oppretter..." : "Opprett nettside"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-foreground/60">{label}</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}
