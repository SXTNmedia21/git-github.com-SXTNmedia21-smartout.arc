"use client";

import { useRouter } from "next/navigation";
import { Plus, Mail, Megaphone, Bell, Newspaper, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type TemplateRow = {
  template_id: string;
  name: string;
  category: string;
  subject: string;
  status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const DEFAULT_CATEGORY = { label: "Custom", icon: FileText, color: "text-muted-foreground" };

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof Mail; color: string }> = {
  trial: { label: "Trial", icon: Mail, color: "text-blue-500" },
  newsletter: { label: "Newsletter", icon: Newspaper, color: "text-green-500" },
  alert: { label: "Alert", icon: Bell, color: "text-orange-500" },
  announcement: { label: "Announcement", icon: Megaphone, color: "text-purple-500" },
  custom: DEFAULT_CATEGORY,
};

export function TemplateListClient({ templates }: { templates: TemplateRow[] }) {
  const router = useRouter();

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Email Templates</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Create and manage email templates for platform communications
          </p>
        </div>
        <Button onClick={() => router.push("/platform-admin/communications/templates/new/edit")}>
          <Plus className="mr-1.5 h-4 w-4" />
          New Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="text-muted-foreground mb-3 h-10 w-10" />
            <p className="text-muted-foreground text-sm">No email templates yet</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push("/platform-admin/communications/templates/new/edit")}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Create your first template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {templates.map((t) => {
            const cat = CATEGORY_CONFIG[t.category] ?? DEFAULT_CATEGORY;
            const Icon = cat.icon;

            return (
              <Card
                key={t.template_id}
                className="hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() =>
                  router.push(`/platform-admin/communications/templates/${t.template_id}/edit`)
                }
              >
                <CardHeader className="flex flex-row items-center gap-4 py-3">
                  <div className={`rounded-md border p-2 ${cat.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-0.5">
                    <CardTitle className="text-sm font-medium">
                      {t.name || "Untitled Template"}
                    </CardTitle>
                    <p className="text-muted-foreground text-xs">{t.subject || "No subject set"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs capitalize">
                      {cat.label}
                    </Badge>
                    <Badge
                      variant={t.status === "active" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {t.status === "draft" ? "Draft" : t.status === "active" ? "Active" : t.status}
                    </Badge>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {new Date(t.updated_at).toLocaleDateString("no-NO", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
