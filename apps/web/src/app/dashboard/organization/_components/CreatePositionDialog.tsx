"use client";

import { useContext } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { createClient } from "@smartout/supabase/client";
import { emit, nonEmpty } from "@smartout/telemetry";
import { EntityFormDialog } from "@smartout/ui";

import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { FormField } from "@/components/forms/FormField";
import { FormTextarea } from "@/components/forms/FormTextarea";
import { FormSelect } from "@/components/forms/FormSelect";
import { FormColorPicker } from "@/components/forms/FormColorPicker";
import { FormIconPicker } from "@/components/forms/FormIconPicker";

import { COLOR_PRESETS, ICON_PRESETS, toSlug } from "./types";
import { ICON_COMPONENTS, ROLE_OPTIONS } from "./constants";

const positionFormSchema = z.object({
  name: z.string().trim().min(1, "Position name is required"),
  description: z.string(),
  minimum_role: z.enum(["owner", "admin", "manager", "employee"]),
  color: z.string().nullable(),
  icon: z.string().nullable(),
});

type PositionFormValues = z.infer<typeof positionFormSchema>;

const DEFAULT_VALUES: PositionFormValues = {
  name: "",
  description: "",
  minimum_role: "employee",
  color: null,
  icon: null,
};

type CreatePositionDialogProps = {
  departmentId: string;
  departmentName: string;
  workspaceId: string;
  existingCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => Promise<void>;
};

export function CreatePositionDialog({
  departmentId,
  departmentName,
  workspaceId,
  existingCount,
  open,
  onOpenChange,
  onSave,
}: CreatePositionDialogProps) {
  const { profileId } = useContext(DashboardContext);

  const form = useForm<PositionFormValues>({
    resolver: zodResolver(positionFormSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onChange",
  });

  const mutation = useMutation({
    mutationFn: async (values: PositionFormValues) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("position")
        .insert({
          name: values.name,
          slug: toSlug(values.name),
          description: values.description.trim() || null,
          minimum_role: values.minimum_role,
          color: values.color,
          icon: values.icon,
          department_id: departmentId,
          workspace_id: workspaceId,
          is_active: true,
          sort_order: existingCount,
        })
        .select("position_id, name")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      void emit({
        event: "position created",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          entity: {
            entity_type: "position",
            entity_id: data.position_id,
            entity_label: data.name,
          },
          data: { name: data.name },
        },
      });
      toast.success(`Position "${data.name}" created in ${departmentName}`);
      form.reset(DEFAULT_VALUES);
      onOpenChange(false);
      await onSave();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to create position");
    },
  });

  function handleOpenChange(next: boolean) {
    if (!next) form.reset(DEFAULT_VALUES);
    onOpenChange(next);
  }

  return (
    <FormProvider {...form}>
      <EntityFormDialog
        open={open}
        onOpenChange={handleOpenChange}
        mode="create"
        title="Add Position"
        description={`Create a new position in ${departmentName}.`}
        onSubmit={form.handleSubmit((values) => mutation.mutateAsync(values))}
        canSubmit={form.formState.isValid}
        saving={mutation.isPending}
      >
        <FormField<PositionFormValues>
          name="name"
          label="Name"
          placeholder="e.g. Head Chef, Bartender, Server"
          required
          autoFocus
        />
        <FormSelect<PositionFormValues>
          name="minimum_role"
          label="Minimum Role"
          options={ROLE_OPTIONS}
          required
        />
        <FormTextarea<PositionFormValues>
          name="description"
          label="Description"
          placeholder="What does this position entail?"
        />
        <FormColorPicker<PositionFormValues> name="color" label="Color" presets={COLOR_PRESETS} />
        <FormIconPicker<PositionFormValues>
          name="icon"
          label="Icon"
          presets={ICON_PRESETS}
          icons={ICON_COMPONENTS}
        />
      </EntityFormDialog>
    </FormProvider>
  );
}
