"use client";

import { useEffect } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { bookingCtaContentSchema, type BookingCtaContent } from "@smartout/website";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  content: BookingCtaContent;
  onChange: (content: BookingCtaContent) => void;
  websiteId: string;
};

export default function BookingCtaEditor({ content, onChange }: Props) {
  const form = useForm<BookingCtaContent>({
    resolver: zodResolver(bookingCtaContentSchema) as Resolver<BookingCtaContent>,
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
          <Textarea {...form.register("body")} rows={3} />
        </div>
        <div>
          <Label>Knappetekst</Label>
          <Input {...form.register("buttonText")} />
        </div>
        <div>
          <Label>Bookingleverandør</Label>
          <Select
            value={form.watch("provider")}
            onValueChange={(v) =>
              form.setValue("provider", v as "none" | "dinnerbooking" | "opentable" | "custom", {
                shouldDirty: true,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Ingen</SelectItem>
              <SelectItem value="dinnerbooking">Dinnerbooking</SelectItem>
              <SelectItem value="opentable">OpenTable</SelectItem>
              <SelectItem value="custom">Egendefinert URL</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label>Booking-URL</Label>
          <Input {...form.register("bookingUrl")} placeholder="https://..." />
        </div>
        <div className="col-span-2 flex items-center justify-between rounded-lg border p-3">
          <span className="text-sm font-medium">Vis telefonnummer</span>
          <Controller
            control={form.control}
            name="showPhone"
            render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
        </div>
      </div>
    </form>
  );
}
