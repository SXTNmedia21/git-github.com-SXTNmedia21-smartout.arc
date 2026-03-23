"use client";

/**
 * HoursEditor — bidirectional system bridge for company_opening_hours.
 * Loads the workspace's official opening hours from Smartout and lets admins
 * edit them. On save, writes back to company_opening_hours (affects the whole
 * system) after explicit confirmation. Heading/description/specialNote are
 * website-local and do not affect other modules.
 */

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { type HoursContent } from "@smartout/website";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Info, AlertTriangle, Clock } from "lucide-react";
import { useCompanyHours } from "../../_hooks/use-company-hours";
import type { DayHours } from "../../_actions/bridge-actions";

type Props = {
  content: HoursContent;
  onChange: (content: HoursContent) => void;
  websiteId: string;
};

// Only heading/description/specialNote are website-local; schedule comes from the bridge
type LocalFields = Pick<HoursContent, "heading" | "description" | "specialNote">;

export default function HoursEditor({ content, onChange }: Props) {
  const { hours, isLoading, update } = useCompanyHours();
  const [localHours, setLocalHours] = useState<DayHours[]>(hours);
  const [showConfirm, setShowConfirm] = useState(false);

  const form = useForm<LocalFields>({
    defaultValues: {
      heading: content.heading,
      description: content.description,
      specialNote: content.specialNote,
    },
  });

  const formValues = form.watch();

  // Initialize local hours when hook data loads for the first time
  useEffect(() => {
    if (hours.length > 0) {
      setLocalHours(hours);
    }
  }, [JSON.stringify(hours)]);

  // Keep website section content in sync with local edits
  useEffect(() => {
    onChange({
      ...formValues,
      schedule: localHours,
    });
  }, [JSON.stringify(formValues), JSON.stringify(localHours)]);

  const updateHour = (
    index: number,
    field: "open" | "close" | "closed",
    value: string | boolean,
  ) => {
    setLocalHours((prev) => prev.map((h, i) => (i === index ? { ...h, [field]: value } : h)));
  };

  const handleSave = () => setShowConfirm(true);

  const handleConfirm = () => {
    update.mutate(localHours);
    setShowConfirm(false);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Info banner: makes it clear this is live Smartout data */}
      <div className="flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-400">
        <Info className="h-4 w-4 shrink-0" />
        Disse er firmaets offisielle åpningstider fra Smartout.
      </div>

      {/* Website-local fields — do not affect other modules */}
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

      {/* 7-day hours grid */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="text-muted-foreground h-4 w-4" />
          <Label className="text-sm font-medium">Åpningstider</Label>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="bg-muted h-10 animate-pulse rounded-md" />
            ))}
          </div>
        ) : localHours.length === 0 ? (
          <p className="text-muted-foreground text-sm">Ingen åpningstider registrert ennå.</p>
        ) : (
          <div className="space-y-2">
            {/* Header row */}
            <div className="text-muted-foreground grid grid-cols-[120px_1fr_1fr_auto] gap-3 px-1 text-xs">
              <span>Dag</span>
              <span>Åpner</span>
              <span>Stenger</span>
              <span>Stengt</span>
            </div>
            {localHours.map((h, i) => (
              <div
                key={i}
                className="grid grid-cols-[120px_1fr_1fr_auto] items-center gap-3 rounded-md border p-2"
              >
                <span className="text-sm font-medium">{h.day}</span>
                <Input
                  type="time"
                  value={h.open}
                  onChange={(e) => updateHour(i, "open", e.target.value)}
                  disabled={h.closed}
                  className="h-9"
                />
                <Input
                  type="time"
                  value={h.close}
                  onChange={(e) => updateHour(i, "close", e.target.value)}
                  disabled={h.closed}
                  className="h-9"
                />
                <Switch
                  checked={h.closed}
                  onCheckedChange={(checked) => updateHour(i, "closed", checked)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Warning: saving here affects the whole system */}
      <div className="flex items-center gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-sm text-yellow-400">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Endringer her oppdaterer firmaets offisielle åpningstider i hele Smartout.
      </div>

      <Button
        type="button"
        onClick={handleSave}
        disabled={update.isPending || isLoading || localHours.length === 0}
        className="w-full"
      >
        {update.isPending ? "Lagrer..." : "Lagre åpningstider"}
      </Button>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette oppdaterer firmaets offisielle åpningstider i hele Smartout. Endringen er synlig
              umiddelbart i alle systemer som bruker disse dataene.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Lagre åpningstider</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
