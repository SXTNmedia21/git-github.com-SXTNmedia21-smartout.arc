"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Mail,
  Megaphone,
  Bell,
  Newspaper,
  FileText,
  ArrowLeft,
  MessageSquare,
  Smartphone,
  Inbox,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type TemplateRow = {
  template_id: string;
  name: string;
  channel?: string;
  category: string;
  subject: string;
  status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ChannelFilter = "all" | "email" | "sms" | "push" | "in_app";

const DEFAULT_CATEGORY = { label: "Custom", icon: FileText, color: "text-muted-foreground" };

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof Mail; color: string }> = {
  trial: { label: "Trial", icon: Mail, color: "text-blue-500" },
  newsletter: { label: "Newsletter", icon: Newspaper, color: "text-green-500" },
  alert: { label: "Alert", icon: Bell, color: "text-orange-500" },
  announcement: { label: "Announcement", icon: Megaphone, color: "text-purple-500" },
  custom: DEFAULT_CATEGORY,
};

const CHANNEL_CONFIG: Record<
  string,
  { label: string; icon: typeof Mail; color: string; bgColor: string }
> = {
  email: {
    label: "Email",
    icon: Mail,
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  sms: {
    label: "SMS",
    icon: MessageSquare,
    color: "text-emerald-600",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
  },
  push: {
    label: "Push",
    icon: Smartphone,
    color: "text-orange-600",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
  },
  in_app: {
    label: "In-App",
    icon: Inbox,
    color: "text-violet-600",
    bgColor: "bg-violet-100 dark:bg-violet-900/30",
  },
};

const CHANNEL_TABS: { value: ChannelFilter; label: string; icon: typeof Mail }[] = [
  { value: "all", label: "All", icon: FileText },
  { value: "email", label: "Email", icon: Mail },
  { value: "sms", label: "SMS", icon: MessageSquare },
  { value: "push", label: "Push", icon: Smartphone },
  { value: "in_app", label: "In-App", icon: Inbox },
];

export function TemplateListClient({ templates }: { templates: TemplateRow[] }) {
  const router = useRouter();
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");

  const filteredTemplates = useMemo(() => {
    if (channelFilter === "all") return templates;
    return templates.filter((t) => (t.channel ?? "email") === channelFilter);
  }, [templates, channelFilter]);

  /** Count templates per channel for tab badges */
  const channelCounts = useMemo(() => {
    const counts: Record<string, number> = { all: templates.length };
    for (const t of templates) {
      const ch = t.channel ?? "email";
      counts[ch] = (counts[ch] ?? 0) + 1;
    }
    return counts;
  }, [templates]);

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/platform-admin/communications"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">Templates</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Create and manage templates for platform communications
            </p>
          </div>
        </div>
        <Button onClick={() => router.push("/platform-admin/communications/templates/new/edit")}>
          <Plus className="mr-1.5 h-4 w-4" />
          New Template
        </Button>
      </div>

      {/* Channel filter tabs */}
      <div className="border-border flex gap-1 border-b pb-px">
        {CHANNEL_TABS.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = channelFilter === tab.value;
          const count = channelCounts[tab.value] ?? 0;
          return (
            <button
              key={tab.value}
              onClick={() => setChannelFilter(tab.value)}
              className={`flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "border-primary text-foreground -mb-px border-b-2"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <TabIcon className="h-3.5 w-3.5" />
              {tab.label}
              {count > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
                    isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="text-muted-foreground mb-3 h-10 w-10" />
            <p className="text-muted-foreground text-sm">
              {channelFilter === "all"
                ? "No templates yet"
                : `No ${CHANNEL_CONFIG[channelFilter]?.label ?? channelFilter} templates yet`}
            </p>
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
          {filteredTemplates.map((t) => {
            const cat = CATEGORY_CONFIG[t.category] ?? DEFAULT_CATEGORY;
            const CatIcon = cat.icon;
            const ch = CHANNEL_CONFIG[t.channel ?? "email"] ?? CHANNEL_CONFIG.email!;
            const ChIcon = ch.icon;

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
                    <CatIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-0.5">
                    <CardTitle className="text-sm font-medium">
                      {t.name || "Untitled Template"}
                    </CardTitle>
                    <p className="text-muted-foreground text-xs">{t.subject || "No subject set"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Channel badge */}
                    <Badge variant="outline" className={`gap-1 text-xs ${ch.color}`}>
                      <ChIcon className="h-3 w-3" />
                      {ch.label}
                    </Badge>
                    {/* Category badge */}
                    <Badge variant="outline" className="text-xs capitalize">
                      {cat.label}
                    </Badge>
                    {/* Status badge */}
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
