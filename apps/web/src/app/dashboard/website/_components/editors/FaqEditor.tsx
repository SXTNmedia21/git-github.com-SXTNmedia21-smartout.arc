"use client";

import { useEffect } from "react";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { faqContentSchema, type FaqContent } from "@smartout/website";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Trash2, GripVertical, Plus } from "lucide-react";

type Props = {
  content: FaqContent;
  onChange: (content: FaqContent) => void;
  websiteId: string;
};

export default function FaqEditor({ content, onChange }: Props) {
  const form = useForm<FaqContent>({
    resolver: zodResolver(faqContentSchema) as Resolver<FaqContent>,
    defaultValues: content,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const values = form.watch();

  useEffect(() => {
    onChange(values);
  }, [JSON.stringify(values)]);

  return (
    <form className="space-y-6 p-6">
      <div>
        <Label>Overskrift</Label>
        <Input {...form.register("heading")} />
      </div>

      <div className="space-y-3">
        <Label>Spørsmål og svar</Label>
        {fields.map((field, index) => (
          <div key={field.id} className="border-border space-y-3 rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <GripVertical className="text-muted-foreground h-4 w-4 shrink-0 cursor-grab" />
              <span className="text-muted-foreground text-sm font-medium">
                Spørsmål {index + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-auto h-7 w-7"
                onClick={() => remove(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div>
              <Label>Spørsmål</Label>
              <Input {...form.register(`items.${index}.question`)} />
            </div>
            <div>
              <Label>Svar</Label>
              <Textarea {...form.register(`items.${index}.answer`)} rows={3} />
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ question: "", answer: "" })}
        >
          <Plus className="mr-2 h-4 w-4" />
          Legg til spørsmål
        </Button>
      </div>
    </form>
  );
}
