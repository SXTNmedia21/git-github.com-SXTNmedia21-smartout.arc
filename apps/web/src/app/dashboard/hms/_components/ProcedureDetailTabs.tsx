"use client";

import { LayoutDashboard, ListOrdered, ClipboardCheck, PenTool, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useProcedureSteps } from "../_hooks/use-procedure-steps";
import { useTranslation } from "@smartout/i18n";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

type Tab = "overview" | "steps" | "quiz" | "confirmation";

// Icons associated per tab — icons don't need translation
const TAB_ICONS: Record<Tab, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  steps: ListOrdered,
  quiz: ClipboardCheck,
  confirmation: PenTool,
};

const TAB_IDS: Tab[] = ["overview", "steps", "quiz", "confirmation"];

function useProcedureMeta(procedureId: string) {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: ["hms", "procedure-meta", procedureId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("procedure")
        .select(
          "procedure_id, name, description, is_active, updated_at, protocol:protocol_id(name, protocol_id, policy:policy_id(name, policy_type))",
        )
        .eq("procedure_id", procedureId)
        .eq("workspace_id", workspace.workspace_id)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function ProcedureDetailTabs({ procedureId }: { procedureId: string }) {
  const { data: meta, isLoading: metaLoading } = useProcedureMeta(procedureId);
  const { data: steps, isLoading: stepsLoading } = useProcedureSteps(procedureId);
  const { t } = useTranslation("dashboard");

  if (metaLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="border-border rounded-xl border-2 border-dashed p-8 text-center">
        <p className="text-muted-foreground text-sm">{t("hms.procedureDetailTabs.not_found")}</p>
      </div>
    );
  }

  const protocol = meta.protocol as unknown as {
    // SAFETY: Supabase join returns union type; runtime shape matches the cast
    name: string;
    protocol_id: string;
    policy: { name: string; policy_type: string } | null;
  } | null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="mb-1 flex items-center gap-2">
          {protocol?.policy && (
            <Badge variant="outline" className="text-xs">
              {protocol.policy.policy_type}
            </Badge>
          )}
          <Badge variant={meta.is_active ? "default" : "secondary"}>
            {meta.is_active
              ? t("hms.procedureDetailTabs.active")
              : t("hms.procedureDetailTabs.inactive")}
          </Badge>
        </div>
        <h1 className="text-foreground text-2xl font-bold">{meta.name}</h1>
        {meta.description && (
          <p className="text-muted-foreground mt-1 text-sm">{meta.description}</p>
        )}
        {protocol && (
          <p className="text-muted-foreground mt-1 text-xs">
            {t("hms.procedureDetailTabs.protocol_label")}: {protocol.name}
            {protocol.policy &&
              ` | ${t("hms.procedureDetailTabs.policy_label")}: ${protocol.policy.name}`}
          </p>
        )}
      </div>

      {/* WCAG 4.1.2: Radix TabsPrimitive provides role=tablist + tab + tabpanel
          + aria-selected + aria-controls out of the box. No manual ARIA needed. */}
      <Tabs defaultValue="overview">
        <TabsList className="border-border bg-muted/50 flex h-auto w-full gap-1 rounded-xl border p-1">
          {TAB_IDS.map((id) => {
            const Icon = TAB_ICONS[id];
            return (
              <TabsTrigger
                key={id}
                value={id}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium"
              >
                <Icon className="h-4 w-4" />
                {t(`hms.procedureDetailTabs.${id}`)}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <InfoCard label={t("hms.procedureDetailTabs.steps_count")} value={steps?.length ?? 0} />
            <InfoCard
              label={t("hms.procedureDetailTabs.last_updated")}
              value={new Date(meta.updated_at).toLocaleDateString("nb-NO")}
            />
          </div>
        </TabsContent>

        <TabsContent value="steps" className="mt-6">
          <div className="space-y-3">
            {stepsLoading ? (
              <Loader2 className="text-muted-foreground mx-auto h-5 w-5 animate-spin" />
            ) : !steps || steps.length === 0 ? (
              <p className="text-muted-foreground text-center text-sm">
                {t("hms.procedureDetailTabs.no_steps")}
              </p>
            ) : (
              steps.map((step, i) => (
                <div key={step.stepId} className="border-border rounded-lg border p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="bg-muted text-muted-foreground flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold">
                      {i + 1}
                    </span>
                    <h3 className="text-foreground font-semibold">{step.title}</h3>
                    {step.isRequired && (
                      <Badge variant="outline" className="text-[10px]">
                        {t("hms.procedureDetailTabs.required")}
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground ml-8 text-sm">{step.description}</p>
                  {step.trainingContent && (
                    <div className="border-info/20 bg-info/5 mt-2 ml-8 rounded-md border p-3">
                      <p className="text-info mb-1 text-[10px] font-medium">
                        {t("hms.procedureDetailTabs.training_content_label")}
                      </p>
                      <div className="prose prose-sm dark:prose-invert max-w-none text-xs">
                        <ReactMarkdown rehypePlugins={[rehypeSanitize]} remarkPlugins={[remarkGfm]}>
                          {step.trainingContent}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="quiz" className="mt-6">
          <div className="border-border rounded-xl border-2 border-dashed p-8 text-center">
            <ClipboardCheck className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
            <p className="text-muted-foreground text-sm">
              {t("hms.procedureDetailTabs.knowledge_tests_placeholder")}
            </p>
          </div>
        </TabsContent>

        <TabsContent value="confirmation" className="mt-6">
          <div className="border-border rounded-xl border-2 border-dashed p-8 text-center">
            <PenTool className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
            <p className="text-muted-foreground text-sm">
              {t("hms.procedureDetailTabs.confirmations_placeholder")}
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border-border rounded-lg border p-4">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className="text-foreground text-lg font-bold">{value}</p>
    </div>
  );
}
