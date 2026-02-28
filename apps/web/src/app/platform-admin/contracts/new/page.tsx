"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

type Template = {
  template_id: string;
  name: string;
  contract_type: string;
  description: string | null;
};

type Company = {
  company_id: string;
  name: string;
};

type Workspace = {
  workspace_id: string;
  name: string;
  slug: string;
};

export default function NewContractPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    template_id: "",
    company_id: "",
    workspace_id: "",
    recipient_name: "",
    recipient_email: "",
    title: "",
    notes: "",
  });

  useEffect(() => {
    async function loadData() {
      const [templatesRes, companiesRes] = await Promise.all([
        fetch("/api/platform-admin/contracts?type=templates"),
        fetch("/api/platform-admin/contracts?type=companies"),
      ]);

      if (templatesRes.ok) {
        const { data } = await templatesRes.json();
        setTemplates(data ?? []);
      }
      if (companiesRes.ok) {
        const { data } = await companiesRes.json();
        setCompanies(data ?? []);
      }
    }
    loadData();
  }, []);

  // Load workspaces when company changes
  useEffect(() => {
    if (!formData.company_id) {
      setWorkspaces([]);
      setFormData((prev) => ({ ...prev, workspace_id: "" }));
      return;
    }

    async function loadWorkspaces() {
      const res = await fetch(
        `/api/platform-admin/contracts?type=workspaces&company_id=${formData.company_id}`,
      );
      if (res.ok) {
        const { data } = await res.json();
        const ws = data ?? [];
        setWorkspaces(ws);
        // Auto-select if only one workspace
        if (ws.length === 1) {
          setFormData((prev) => ({ ...prev, workspace_id: ws[0].workspace_id }));
        } else {
          setFormData((prev) => ({ ...prev, workspace_id: "" }));
        }
      }
    }
    loadWorkspaces();
  }, [formData.company_id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.template_id || !formData.recipient_email || !formData.recipient_name) {
      toast.error("Fyll ut alle obligatoriske felt");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/platform-admin/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          // Only send workspace_id if selected
          workspace_id: formData.workspace_id || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Kunne ikke opprette kontrakt");
      }

      const result = await res.json();
      const status = result.data?.status;

      if (status === "sent") {
        toast.success("Kontrakt opprettet og sendt");
      } else {
        toast.success("Kontrakt opprettet som utkast", {
          description: result.warning || "Kontrakten kan sendes manuelt fra kontraktsiden.",
        });
      }

      router.push("/platform-admin/contracts");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Noe gikk galt");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link href="/platform-admin/contracts">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Ny kontrakt</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Opprett og send en ny kontrakt til en kunde
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Mal og mottaker</CardTitle>
              <CardDescription>Velg kontraktsmal og fyll inn mottakerinfo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="template">
                  Kontraktsmal *
                </label>
                <Select
                  value={formData.template_id}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, template_id: v }))}
                >
                  <SelectTrigger id="template">
                    <SelectValue placeholder="Velg mal..." />
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

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="company">
                  Selskap *
                </label>
                <Select
                  value={formData.company_id}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, company_id: v }))}
                >
                  <SelectTrigger id="company">
                    <SelectValue placeholder="Velg selskap..." />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.company_id} value={c.company_id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {workspaces.length > 1 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="workspace">
                    Arbeidssted
                  </label>
                  <Select
                    value={formData.workspace_id}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, workspace_id: v }))}
                  >
                    <SelectTrigger id="workspace">
                      <SelectValue placeholder="Velg arbeidssted..." />
                    </SelectTrigger>
                    <SelectContent>
                      {workspaces.map((w) => (
                        <SelectItem key={w.workspace_id} value={w.workspace_id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="recipient_name">
                  Mottakers navn *
                </label>
                <Input
                  id="recipient_name"
                  value={formData.recipient_name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, recipient_name: e.target.value }))
                  }
                  placeholder="Ola Nordmann"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="recipient_email">
                  Mottakers e-post *
                </label>
                <Input
                  id="recipient_email"
                  type="email"
                  value={formData.recipient_email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, recipient_email: e.target.value }))
                  }
                  placeholder="ola@example.com"
                  required
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detaljer</CardTitle>
              <CardDescription>Tilpass kontrakten for denne mottakeren</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="title">
                  Tittel
                </label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Smartout Kundeavtale — Ola Nordmann"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="notes">
                  Interne notater
                </label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Notater som bare er synlige for admins..."
                  rows={4}
                />
              </div>
            </CardContent>
            <CardFooter className="justify-end gap-3">
              <Link href="/platform-admin/contracts">
                <Button variant="outline" type="button">
                  Avbryt
                </Button>
              </Link>
              <Button type="submit" disabled={loading}>
                <Send className="mr-2 h-4 w-4" />
                {loading ? "Oppretter..." : "Opprett og send"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </form>
    </div>
  );
}
