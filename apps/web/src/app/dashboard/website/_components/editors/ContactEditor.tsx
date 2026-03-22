"use client";

import { useEffect } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { contactContentSchema, type ContactContent } from "@smartout/website";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Props = {
  content: ContactContent;
  onChange: (content: ContactContent) => void;
  websiteId: string;
};

const visibilityToggles: { name: keyof ContactContent; label: string }[] = [
  { name: "showEmail", label: "Vis e-post" },
  { name: "showPhone", label: "Vis telefon" },
  { name: "showAddress", label: "Vis adresse" },
  { name: "showSocial", label: "Vis sosiale medier" },
];

export default function ContactEditor({ content, onChange }: Props) {
  const form = useForm<ContactContent>({
    resolver: zodResolver(contactContentSchema) as Resolver<ContactContent>,
    defaultValues: content,
  });

  const values = form.watch();

  useEffect(() => {
    onChange(values);
  }, [JSON.stringify(values)]);

  return (
    <form className="space-y-6 p-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Overskrift</Label>
          <Input {...form.register("heading")} />
        </div>
        <div className="col-span-2">
          <Label>Introduksjonstekst</Label>
          <Textarea {...form.register("body")} rows={3} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Vis kontaktinfo</Label>
        {visibilityToggles.map(({ name, label }) => (
          <div key={name} className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm font-medium">{label}</span>
            <Controller
              control={form.control}
              name={name}
              render={({ field }) => (
                <Switch checked={field.value as boolean} onCheckedChange={field.onChange} />
              )}
            />
          </div>
        ))}
      </div>
    </form>
  );
}
