"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, Eye, TestTube, Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AudienceSelector,
  type AudienceFilter,
} from "@/components/platform-admin/audience-selector";
import dynamic from "next/dynamic";
import { withEntrance } from "@smartout/ui";
import { EditorSkeleton } from "@/components/ui/editor-skeleton";

const EmailRichEditor = dynamic(
  () =>
    import("./email-rich-editor").then((m) => ({
      default: withEntrance(m.EmailRichEditor),
    })),
  { ssr: false, loading: () => <EditorSkeleton /> },
);
import { ItemsBuilder } from "./items-builder";
import { EmailPreview } from "./email-preview";
import type { SendGridTemplateData } from "@smartout/notifications";

type TemplateMode = "inline" | "sendgrid-dynamic";

const EXISTING_TEMPLATES = [
  { value: "platform-announcement", label: "Plattform-kunngjoring" },
  { value: "workspace-notification", label: "Workspace-varsling" },
  { value: "trial-reminder", label: "Proveperiode-paminnelse" },
  { value: "payment-reminder", label: "Betalingspaminnelse" },
  { value: "contract-reminder", label: "Kontraktpaminnelse" },
] as const;

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="border-border bg-card hover:bg-accent flex w-full items-center justify-between rounded-lg border px-4 py-3 text-sm font-medium">
        {title}
        <ChevronDown
          className={`text-muted-foreground h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-3 px-1">{children}</CollapsibleContent>
    </Collapsible>
  );
}

type SavedTemplate = {
  template_id: string;
  name: string;
  category: string;
  subject: string;
  sections: unknown[];
  placeholders: unknown[];
};

type ComposePageClientProps = {
  savedTemplates?: SavedTemplate[];
};

export function ComposePageClient({ savedTemplates = [] }: ComposePageClientProps) {
  const router = useRouter();

  // Form state
  const [audience, setAudience] = useState<AudienceFilter | null>(null);
  const [templateMode, setTemplateMode] = useState<TemplateMode>("sendgrid-dynamic");
  const [inlineTemplate, setInlineTemplate] = useState("platform-announcement");
  const [sendgridTemplateId, setSendgridTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [showPreview, setShowPreview] = useState(true);

  // SendGrid template data
  const [templateData, setTemplateData] = useState<SendGridTemplateData>({
    header: "",
  });

  // UI state
  const [sending, setSending] = useState(false);
  const [dryRunning, setDryRunning] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<{
    recipientCount: number;
    preview: string;
  } | null>(null);

  function updateTemplateData(patch: Partial<SendGridTemplateData>) {
    setTemplateData((prev) => ({ ...prev, ...patch }));
  }

  const handleAiCorrect = useCallback(async (text: string): Promise<string> => {
    const res = await fetch("/api/platform-admin/communications/ai-correct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, locale: "no" }),
    });
    if (!res.ok) {
      toast.error("AI-korrigering feilet");
      return text;
    }
    const data = await res.json();
    return data.corrected;
  }, []);

  async function handleDryRun() {
    if (!audience) {
      toast.error("Velg en målgruppe forst");
      return;
    }

    setDryRunning(true);
    try {
      const res = await fetch("/api/platform-admin/communications/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience }),
      });
      if (!res.ok) {
        toast.error("Dry-run feilet");
        return;
      }
      const data = await res.json();
      setDryRunResult(data);
      toast.success(`${data.recipientCount} mottakere funnet`);
    } finally {
      setDryRunning(false);
    }
  }

  async function handleSend() {
    if (!audience) {
      toast.error("Velg en målgruppe");
      return;
    }
    if (!subject.trim()) {
      toast.error("Skriv inn et emne");
      return;
    }

    if (templateMode === "sendgrid-dynamic") {
      if (!sendgridTemplateId.trim()) {
        toast.error("Skriv inn SendGrid Template ID");
        return;
      }
      if (!templateData.header.trim()) {
        toast.error("Header er påkrevd");
        return;
      }
    }

    setSending(true);
    try {
      const body =
        templateMode === "sendgrid-dynamic"
          ? {
              audience,
              template: "sendgrid-dynamic",
              subject,
              sendgridTemplateId,
              templateData,
            }
          : {
              audience,
              template: inlineTemplate,
              subject,
              message: templateData.message ?? "",
            };

      const res = await fetch("/api/platform-admin/communications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Sending feilet");
        return;
      }

      const data = await res.json();
      toast.success(`Sendt til ${data.job?.sentCount ?? 0} mottakere`);
      router.push("/platform-admin/communications");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* Top bar */}
      <div className="border-border flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/platform-admin/communications")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold">Skriv e-post</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            {showPreview ? "Skjul" : "Vis"} forhåndsvisning
          </Button>
          <Button variant="outline" size="sm" onClick={handleDryRun} disabled={dryRunning}>
            {dryRunning ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <TestTube className="mr-1.5 h-3.5 w-3.5" />
            )}
            Dry Run
          </Button>
          <Button size="sm" onClick={handleSend} disabled={sending}>
            {sending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-3.5 w-3.5" />
            )}
            Send
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Form side */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-2xl space-y-6">
            {/* Audience + Template */}
            <div className="border-border bg-card space-y-4 rounded-lg border p-4">
              <div className="space-y-2">
                <Label>Målgruppe</Label>
                <AudienceSelector value={audience} onChange={setAudience} />
              </div>

              {dryRunResult && (
                <div className="bg-muted/50 rounded-md p-3 text-sm">
                  <span className="font-medium">{dryRunResult.recipientCount} mottakere</span>
                  <p className="text-muted-foreground mt-1 text-xs">{dryRunResult.preview}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Mal-type</Label>
                <Select
                  value={templateMode}
                  onValueChange={(v) => setTemplateMode(v as TemplateMode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sendgrid-dynamic">Egendefinert (SendGrid)</SelectItem>
                    <SelectItem value="inline">Standard-mal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {templateMode === "inline" && (
                <div className="space-y-2">
                  <Label>Velg mal</Label>
                  <Select value={inlineTemplate} onValueChange={setInlineTemplate}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXISTING_TEMPLATES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {templateMode === "sendgrid-dynamic" && (
                <div className="space-y-3">
                  {savedTemplates.length > 0 && (
                    <div className="space-y-2">
                      <Label>Last inn lagret mal</Label>
                      <Select
                        onValueChange={(id) => {
                          const t = savedTemplates.find((tpl) => tpl.template_id === id);
                          if (t) {
                            setSubject(t.subject ?? "");
                            toast.success(`Mal "${t.name}" lastet`);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Velg en lagret mal..." />
                        </SelectTrigger>
                        <SelectContent>
                          {savedTemplates.map((t) => (
                            <SelectItem key={t.template_id} value={t.template_id}>
                              {t.name} ({t.category})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-muted-foreground text-xs">
                        Eller skriv inn SendGrid Template ID manuelt nedenfor
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>SendGrid Template ID</Label>
                    <Input
                      value={sendgridTemplateId}
                      onChange={(e) => setSendgridTemplateId(e.target.value)}
                      placeholder="d-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Emne *</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="E-postemne..."
                />
              </div>
            </div>

            {templateMode === "sendgrid-dynamic" && (
              <>
                {/* Hero section */}
                <CollapsibleSection title="Hero" defaultOpen>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Hero-bilde URL</Label>
                      <Input
                        value={templateData.hero_image ?? ""}
                        onChange={(e) => updateTemplateData({ hero_image: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Header *</Label>
                      <Input
                        value={templateData.header}
                        onChange={(e) => updateTemplateData({ header: e.target.value })}
                        placeholder="E-post header..."
                      />
                    </div>
                  </div>
                </CollapsibleSection>

                {/* Content section */}
                <div className="border-border bg-card space-y-3 rounded-lg border p-4">
                  <h3 className="text-sm font-medium">Innhold</h3>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Hovedtittel</Label>
                    <Input
                      value={templateData.main_title ?? ""}
                      onChange={(e) => updateTemplateData({ main_title: e.target.value })}
                      placeholder="Hovedtittel..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Melding</Label>
                    <EmailRichEditor
                      value={templateData.message ?? ""}
                      onChange={(html) => updateTemplateData({ message: html })}
                      onAiCorrect={handleAiCorrect}
                      placeholder="Skriv meldingen din..."
                    />
                  </div>
                </div>

                {/* Items section */}
                <CollapsibleSection title="Elementer">
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Undertittel</Label>
                      <Input
                        value={templateData.subTitle ?? ""}
                        onChange={(e) => updateTemplateData({ subTitle: e.target.value })}
                        placeholder="Undertittel for seksjonen..."
                      />
                    </div>
                    <ItemsBuilder
                      items={templateData.items ?? []}
                      onChange={(items) => updateTemplateData({ items })}
                    />
                    <div className="space-y-1.5">
                      <Label className="text-xs">Ekstra melding</Label>
                      <Textarea
                        value={templateData.message2 ?? ""}
                        onChange={(e) => updateTemplateData({ message2: e.target.value })}
                        placeholder="Ekstra tekst etter elementer..."
                        rows={3}
                      />
                    </div>
                  </div>
                </CollapsibleSection>

                {/* CTA Button section */}
                <CollapsibleSection title="CTA-knapp">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Knappetekst</Label>
                      <Input
                        value={templateData.linkText ?? ""}
                        onChange={(e) => updateTemplateData({ linkText: e.target.value })}
                        placeholder="Les mer"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Knapp-URL</Label>
                      <Input
                        value={templateData.link ?? ""}
                        onChange={(e) => updateTemplateData({ link: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </CollapsibleSection>

                {/* Info Box section */}
                <CollapsibleSection title="Infoboks">
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Tittel</Label>
                      <Input
                        value={templateData.footer_title ?? ""}
                        onChange={(e) => updateTemplateData({ footer_title: e.target.value })}
                        placeholder="Infoboks-tittel..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Melding</Label>
                      <Textarea
                        value={templateData.footer_message ?? ""}
                        onChange={(e) =>
                          updateTemplateData({
                            footer_message: e.target.value,
                          })
                        }
                        placeholder="Infoboks-melding..."
                        rows={3}
                      />
                    </div>
                  </div>
                </CollapsibleSection>
              </>
            )}

            {templateMode === "inline" && (
              <div className="border-border bg-card space-y-3 rounded-lg border p-4">
                <h3 className="text-sm font-medium">Melding</h3>
                <EmailRichEditor
                  value={templateData.message ?? ""}
                  onChange={(html) => updateTemplateData({ message: html })}
                  onAiCorrect={handleAiCorrect}
                  placeholder="Skriv meldingen din..."
                />
              </div>
            )}
          </div>
        </div>

        {/* Preview side */}
        {showPreview && templateMode === "sendgrid-dynamic" && (
          <div className="border-border hidden w-[45%] border-l lg:block">
            <EmailPreview templateData={templateData} />
          </div>
        )}
      </div>
    </div>
  );
}
