"use client";

import { useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { hoursContentSchema, type HoursContent } from "@smartout/website";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Info } from "lucide-react";

type Props = {
  content: HoursContent;
  onChange: (content: HoursContent) => void;
  websiteId: string;
};

export default function HoursEditor({ content, onChange }: Props) {
  const form = useForm<HoursContent>({
    resolver: zodResolver(hoursContentSchema) as Resolver<HoursContent>,
    defaultValues: content,
  });

  const values = form.watch();

  useEffect(() => {
    onChange(values);
  }, [JSON.stringify(values)]);

  return (
    <form className="space-y-6 p-6">
      {/* System bridge info banner */}
      <div className="flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-400">
        <Info className="h-4 w-4 shrink-0" />
        Denne seksjonen kobles til Smartout-data i en fremtidig oppdatering
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Overskrift</Label>
          <Input {...form.register("heading")} />
        </div>
        <div className="col-span-2">
          <Label>Beskrivelse</Label>
          <Textarea {...form.register("description")} rows={3} />
        </div>
        <div className="col-span-2">
          <Label>Spesialnote</Label>
          <Input {...form.register("specialNote")} placeholder="f.eks. Stengt på helligdager" />
        </div>
      </div>
    </form>
  );
}
