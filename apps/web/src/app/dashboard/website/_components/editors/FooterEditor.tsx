"use client";

import { useEffect } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { footerContentSchema, type FooterContent } from "@smartout/website";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  content: FooterContent;
  onChange: (content: FooterContent) => void;
  websiteId: string;
};

export default function FooterEditor({ content, onChange }: Props) {
  const form = useForm<FooterContent>({
    resolver: zodResolver(footerContentSchema) as Resolver<FooterContent>,
    defaultValues: content,
  });

  const values = form.watch();

  useEffect(() => {
    onChange(values);
  }, [JSON.stringify(values)]);

  const toggleFields: { name: keyof FooterContent; label: string }[] = [
    { name: "showLogo", label: "Vis logo" },
    { name: "showSocial", label: "Vis sosiale medier" },
    { name: "showContact", label: "Vis kontaktinformasjon" },
    { name: "showHours", label: "Vis åpningstider" },
  ];

  return (
    <form className="space-y-6 p-6">
      <div className="space-y-4">
        <Label>Innholdsblokker</Label>
        {toggleFields.map(({ name, label }) => (
          <div key={name} className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm font-medium">{label}</span>
            <Controller
              control={form.control}
              name={name}
              render={({ field }) => (
                <Switch
                  checked={field.value as boolean}
                  onCheckedChange={(checked) => field.onChange(checked)}
                />
              )}
            />
          </div>
        ))}
      </div>

      <div>
        <Label>Opphavsrettstekst</Label>
        <Input
          {...form.register("copyrightText")}
          placeholder="© {year} {bedriftsnavn}. Alle rettigheter forbeholdt."
        />
      </div>

      <div>
        <Label>Kolonner</Label>
        <Select
          value={form.watch("columns")}
          onValueChange={(v) =>
            form.setValue("columns", v as "1" | "2" | "3" | "4", { shouldDirty: true })
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 kolonne</SelectItem>
            <SelectItem value="2">2 kolonner</SelectItem>
            <SelectItem value="3">3 kolonner</SelectItem>
            <SelectItem value="4">4 kolonner</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </form>
  );
}
