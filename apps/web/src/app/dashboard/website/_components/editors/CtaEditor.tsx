"use client";

import { useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ctaContentSchema, type CtaContent } from "@smartout/website";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Props = {
  content: CtaContent;
  onChange: (content: CtaContent) => void;
  websiteId: string;
};

export default function CtaEditor({ content, onChange }: Props) {
  const form = useForm<CtaContent>({
    resolver: zodResolver(ctaContentSchema) as Resolver<CtaContent>,
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
          <Label>Brødtekst</Label>
          <Textarea {...form.register("body")} rows={4} />
        </div>
        <div>
          <Label>Primærknapp — tekst</Label>
          <Input {...form.register("buttonText")} />
        </div>
        <div>
          <Label>Primærknapp — URL</Label>
          <Input {...form.register("buttonUrl")} />
        </div>
        <div>
          <Label>Sekundærknapp — tekst</Label>
          <Input {...form.register("secondaryButtonText")} />
        </div>
        <div>
          <Label>Sekundærknapp — URL</Label>
          <Input {...form.register("secondaryButtonUrl")} />
        </div>
      </div>
    </form>
  );
}
