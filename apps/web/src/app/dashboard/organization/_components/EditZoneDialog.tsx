"use client";

import { useContext, useEffect } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { EntityFormDialog } from "@smartout/ui";

import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspace } from "@/lib/workspace-context";
import { FormField } from "@/components/forms/FormField";
import { FormNumberField } from "@/components/forms/FormNumberField";
import { FormTextarea } from "@/components/forms/FormTextarea";
import { FormColorPicker } from "@/components/forms/FormColorPicker";

import type { ZoneRow } from "./types";
import { COLOR_PRESETS, toSlug } from "./types";

const zoneFormSchema = z.object({
  name: z.string().trim().min(1, "Zone name is required"),
  description: z.string(),
  capacity: z.number().int().min(0).nullable(),
  color: z.string().nullable(),
});

type ZoneFormValues = z.infer<typeof zoneFormSchema>;

function buildChanges(
  initial: ZoneFormValues,
  next: ZoneFormValues,
): Record<string, { before: unknown; after: unknown }> {
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  (Object.keys(next) as Array<keyof ZoneFormValues>).forEach((key) => {
    if (initial[key] !== next[key]) {
      changes[key] = { before: initial[key], after: next[key] };
    }
  });
  return changes;
}

type EditZoneDialogProps = {
  zone: ZoneRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => Promise<void>;
};

export function EditZoneDialog({ zone, open, onOpenChange, onSave }: EditZoneDialogProps) {
  const { profileId } = useContext(DashboardContext);
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  const initialValues: ZoneFormValues = {
    name: zone.name,
    description: zone.description ?? "",
    capacity: zone.capacity,
    color: zone.color,
  };

  const form = useForm<ZoneFormValues>({
    resolver: zodResolver(zoneFormSchema),
    defaultValues: initialValues,
    mode: "onChange",
  });

  // Re-sync defaults if the user opens the dialog on a different zone.
  useEffect(() => {
    form.reset(initialValues);
  }, [zone.zone_id]);

  const mutation = useMutation({
    mutationFn: async (values: ZoneFormValues) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("zone")
        .update({
          name: values.name,
          slug: toSlug(values.name),
          description: values.description.trim() || null,
          capacity: values.capacity,
          color: values.color,
        })
        .eq("zone_id", zone.zone_id);

      if (error) throw error;
      return { name: values.name };
    },
    onSuccess: async (_data, values) => {
      const changes = buildChanges(initialValues, values);
      void emit({
        event: "zone updated",
        workspace_id: workspaceId,
        actor_id: profileId ?? "",
        properties: {
          entity: {
            entity_type: "zone",
            entity_id: zone.zone_id,
            entity_label: values.name,
          },
          changes,
        },
      });
      toast.success(`Zone "${values.name}" updated`);
      onOpenChange(false);
      await onSave();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update zone");
    },
  });

  return (
    <FormProvider {...form}>
      <EntityFormDialog
        open={open}
        onOpenChange={onOpenChange}
        mode="edit"
        title="Edit Zone"
        description="Update zone details."
        onSubmit={form.handleSubmit((values) => mutation.mutateAsync(values))}
        canSubmit={form.formState.isValid && form.formState.isDirty}
        saving={mutation.isPending}
      >
        <FormField<ZoneFormValues>
          name="name"
          label="Name"
          placeholder="e.g. Section A, Patio, VIP Area"
          required
          autoFocus
        />
        <FormTextarea<ZoneFormValues>
          name="description"
          label="Description"
          placeholder="What is this zone used for?"
        />
        <FormNumberField<ZoneFormValues>
          name="capacity"
          label="Capacity"
          min={0}
          placeholder="Max people"
          helperText="Leave empty if no fixed capacity."
        />
        <FormColorPicker<ZoneFormValues> name="color" label="Color" presets={COLOR_PRESETS} />
      </EntityFormDialog>
    </FormProvider>
  );
}
