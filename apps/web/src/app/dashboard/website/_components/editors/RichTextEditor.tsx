"use client";

import { useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { richTextContentSchema, type RichTextContent } from "@smartout/website";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  content: RichTextContent;
  onChange: (content: RichTextContent) => void;
  websiteId: string;
};

export default function RichTextEditor({ content, onChange }: Props) {
  const form = useForm<RichTextContent>({
    resolver: zodResolver(richTextContentSchema) as Resolver<RichTextContent>,
    defaultValues: content,
  });

  const values = form.watch();

  useEffect(() => {
    onChange(values);
  }, [JSON.stringify(values)]);

  return (
    <form className="space-y-6 p-6">
      <div>
        <Label>HTML-innhold</Label>
        <Textarea {...form.register("html")} rows={16} className="font-mono text-sm" />
      </div>
    </form>
  );
}
