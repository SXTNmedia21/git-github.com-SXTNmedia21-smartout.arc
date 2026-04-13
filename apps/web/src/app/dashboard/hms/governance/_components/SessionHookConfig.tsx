"use client";

/**
 * SessionHookConfig — Links a maintenance procedure to a department session
 * lifecycle point (pre_open or close). Renders a compact form with department
 * selector and hook type radio, then calls useCreateSessionHook() on save.
 *
 * Shown inline within each procedure card in the expanded view.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { useTranslation } from "@smartout/i18n";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { useCreateSessionHook } from "../_hooks/use-maintenance-procedures";

type SessionHookConfigProps = {
  procedureId: string;
};

type Department = {
  department_id: string;
  name: string;
};

export function SessionHookConfig({ procedureId }: SessionHookConfigProps) {
  const { t } = useTranslation("cleaning");
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;

  const [isAdding, setIsAdding] = useState(false);
  const [departmentId, setDepartmentId] = useState<string>("");
  const [hookType, setHookType] = useState<"pre_open" | "close">("pre_open");

  const createHook = useCreateSessionHook();

  /* Fetch departments for the selector */
  const { data: departments } = useQuery({
    queryKey: ["departments", wsId],
    enabled: !!wsId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("department")
        .select("department_id, name")
        .eq("workspace_id", wsId!)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Department[];
    },
  });

  function handleSave() {
    if (!departmentId) return;

    createHook.mutate(
      {
        department_id: departmentId,
        hook_type: hookType,
        linked_procedure_id: procedureId,
      },
      {
        onSuccess: () => {
          setIsAdding(false);
          setDepartmentId("");
          setHookType("pre_open");
        },
      },
    );
  }

  if (!isAdding) {
    return (
      <Button variant="outline" size="sm" onClick={() => setIsAdding(true)} className="gap-1.5">
        <Plus className="h-3.5 w-3.5" />
        {t("cleaning.linkToDepartment")}
      </Button>
    );
  }

  return (
    <div className="border-border bg-muted/30 space-y-3 rounded-lg border p-3">
      {/* Department selector */}
      <div className="space-y-1.5">
        <Label className="text-xs">{t("cleaning.selectDepartment")}</Label>
        <Select value={departmentId} onValueChange={setDepartmentId}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder={t("cleaning.selectDepartment")} />
          </SelectTrigger>
          <SelectContent>
            {(departments ?? []).map((dept) => (
              <SelectItem key={dept.department_id} value={dept.department_id}>
                {dept.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Hook type radio */}
      <div className="space-y-1.5">
        <Label className="text-xs">{t("cleaning.selectHookType")}</Label>
        <RadioGroup
          value={hookType}
          onValueChange={(val) => setHookType(val as "pre_open" | "close")}
          className="flex gap-4"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="pre_open" id="hook-pre-open" />
            <Label htmlFor="hook-pre-open" className="cursor-pointer text-sm">
              {t("cleaning.hookPreOpen")}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="close" id="hook-close" />
            <Label htmlFor="hook-close" className="cursor-pointer text-sm">
              {t("cleaning.hookClose")}
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={!departmentId || createHook.isPending}>
          {t("cleaning.save")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setIsAdding(false);
            setDepartmentId("");
          }}
        >
          {t("cleaning.cancel")}
        </Button>
      </div>
    </div>
  );
}
