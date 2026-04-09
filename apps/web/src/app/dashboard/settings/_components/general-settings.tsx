"use client";

/**
 * General workspace settings form — name, contact info, timezone, currency.
 * Reads current workspace data from WorkspaceContext, then fetches full row
 * for editable fields (address, phone, email) not included in the context.
 *
 * UI Events:
 * - action: updateWorkspace mutation on save
 */

import { useContext, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Skeleton,
} from "@smartout/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { createClient } from "@smartout/supabase/client";
import type { Database } from "@smartout/supabase";
import { emit } from "@smartout/telemetry";
import { toast } from "sonner";

type CurrencyEnum = Database["public"]["Enums"]["currency"];

// ─── Schema ────────────────────────────────────────────────────────────────

const generalSettingsSchema = z.object({
  name: z.string().min(1, "Workspace name is required"),
  timezone: z.string().min(1, "Timezone is required"),
  currency: z.string().min(1, "Currency is required"),
  phone: z.string(),
  email: z.string().email("Invalid email").or(z.literal("")),
  address_line_1: z.string(),
  postal_code: z.string(),
  city: z.string(),
});

type GeneralSettingsInput = z.infer<typeof generalSettingsSchema>;

const TIMEZONES = [
  { value: "Europe/Oslo", label: "Oslo (CET/CEST)" },
  { value: "Europe/Stockholm", label: "Stockholm (CET/CEST)" },
  { value: "Europe/Copenhagen", label: "Copenhagen (CET/CEST)" },
  { value: "Europe/Helsinki", label: "Helsinki (EET/EEST)" },
] as const;

const CURRENCIES = [
  { value: "NOK", label: "NOK — Norwegian Krone" },
  { value: "SEK", label: "SEK — Swedish Krona" },
  { value: "DKK", label: "DKK — Danish Krone" },
  { value: "EUR", label: "EUR — Euro" },
] as const;

// ─── Loading skeleton ──────────────────────────────────────────────────────

function GeneralSettingsSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-4">
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-4">
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────

export function GeneralSettings() {
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  const wsId = workspace.workspace_id;

  // Fetch full workspace row (includes address/phone/email not in context)
  const { data: wsData, isLoading } = useQuery({
    queryKey: ["settings", "general", wsId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace")
        .select("name, timezone, currency, phone, email, address_line_1, postal_code, city")
        .eq("workspace_id", wsId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<GeneralSettingsInput>({
    resolver: zodResolver(generalSettingsSchema),
    defaultValues: {
      name: "",
      timezone: "Europe/Oslo",
      currency: "NOK",
      phone: "",
      email: "",
      address_line_1: "",
      postal_code: "",
      city: "",
    },
  });

  // Populate form once data arrives
  useEffect(() => {
    if (wsData) {
      form.reset({
        name: wsData.name ?? "",
        timezone: wsData.timezone ?? "Europe/Oslo",
        currency: wsData.currency ?? "NOK",
        phone: wsData.phone ?? "",
        email: wsData.email ?? "",
        address_line_1: wsData.address_line_1 ?? "",
        postal_code: wsData.postal_code ?? "",
        city: wsData.city ?? "",
      });
    }
  }, [wsData, form]);

  const updateMutation = useMutation({
    mutationFn: async (values: GeneralSettingsInput) => {
      const { error } = await supabase
        .from("workspace")
        .update({
          name: values.name,
          timezone: values.timezone,
          currency: values.currency as CurrencyEnum,
          phone: values.phone || null,
          email: values.email || null,
          address_line_1: values.address_line_1 || null,
          postal_code: values.postal_code || null,
          city: values.city || null,
        })
        .eq("workspace_id", wsId);
      if (error) throw error;
    },
    onSuccess: () => {
      void emit({
        event: "workspace_settings updated",
        workspace_id: wsId,
        actor_id: profileId ?? "",
        properties: { data: { section: "general" } },
      });
      void queryClient.invalidateQueries({ queryKey: ["settings", "general", wsId] });
      toast.success("General settings saved");
    },
    onError: (error: Error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  if (isLoading) return <GeneralSettingsSkeleton />;

  const onSubmit = form.handleSubmit((values) => updateMutation.mutate(values));

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <h2 className="text-foreground text-lg font-semibold">General Settings</h2>
        <p className="text-muted-foreground text-sm">
          Workspace name, timezone, currency, and contact information.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Business info card */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Business Info</CardTitle>
            <CardDescription>Name, timezone, and currency for this workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ws-name" className="text-sm font-medium">
                Workspace Name
              </Label>
              <Input id="ws-name" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-destructive text-xs">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ws-timezone" className="text-sm font-medium">
                Timezone
              </Label>
              <Select
                value={form.watch("timezone")}
                onValueChange={(v) => form.setValue("timezone", v, { shouldDirty: true })}
              >
                <SelectTrigger id="ws-timezone">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ws-currency" className="text-sm font-medium">
                Currency
              </Label>
              <Select
                value={form.watch("currency")}
                onValueChange={(v) => form.setValue("currency", v, { shouldDirty: true })}
              >
                <SelectTrigger id="ws-currency">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Contact info card */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Contact & Address</CardTitle>
            <CardDescription>Phone, email, and physical address.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ws-phone" className="text-sm font-medium">
                Phone
              </Label>
              <Input id="ws-phone" type="tel" {...form.register("phone")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ws-email" className="text-sm font-medium">
                Email
              </Label>
              <Input id="ws-email" type="email" {...form.register("email")} />
              {form.formState.errors.email && (
                <p className="text-destructive text-xs">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ws-address" className="text-sm font-medium">
                Address
              </Label>
              <Input id="ws-address" {...form.register("address_line_1")} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ws-postal" className="text-sm font-medium">
                  Postal Code
                </Label>
                <Input id="ws-postal" {...form.register("postal_code")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ws-city" className="text-sm font-medium">
                  City
                </Label>
                <Input id="ws-city" {...form.register("city")} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <Button type="submit" disabled={updateMutation.isPending || !form.formState.isDirty}>
          {updateMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>
    </form>
  );
}
