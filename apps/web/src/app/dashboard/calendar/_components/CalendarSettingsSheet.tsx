"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock, Mail, Save, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { type CalendarSettings } from "../_lib/types";
import { SheetShell } from "./SheetShell";
import { useCompanyHours } from "@/app/dashboard/website/_hooks/use-company-hours";
import type { DayHours } from "@/app/dashboard/website/_actions/bridge-actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: CalendarSettings;
  onChange: (next: CalendarSettings) => void;
};

const VISIBILITY_ROWS: { key: keyof CalendarSettings["show"]; label: string; hint: string }[] = [
  { key: "openingHours", label: "Åpningstider", hint: "Skygg stengte timer i kalendergrid" },
  { key: "events", label: "Eventer", hint: "Manuelle eventer du har lagt til" },
  { key: "bookings", label: "Bookinger", hint: "Reservasjoner og bordbookinger" },
  { key: "shifts", label: "Vakter", hint: "Vakter fra schedule_shift (D6)" },
  { key: "sessions", label: "Sesjoner", hint: "Department sessions (D6)" },
  { key: "holidays", label: "Helligdager", hint: "Norske helligdager (K1a)" },
  { key: "googleEvents", label: "Google-eventer", hint: "Synkronisert fra Google Kalender" },
];

export function CalendarSettingsSheet({ open, onOpenChange, settings, onChange }: Props) {
  const [connecting, setConnecting] = useState(false);

  const handleConnect = () => {
    setConnecting(true);
    // TODO(google-oauth): wire OAuth via Edge Function — needs ADR + scopes:
    // calendar.readonly. Token stored in 1Password vault, refresh handled
    // server-side. One-way pull only (Google → Smartout).
    setTimeout(() => {
      onChange({
        ...settings,
        google: {
          connected: true,
          email: "pontus@smartout.no",
          lastSyncAt: new Date().toISOString(),
        },
      });
      setConnecting(false);
      toast.success("Google Kalender koblet (placeholder)", {
        description: "OAuth-flow blir wiret når ADR er godkjent.",
      });
    }, 600);
  };

  const handleDisconnect = () => {
    onChange({
      ...settings,
      google: { connected: false },
    });
    toast.success("Frakoblet Google Kalender");
  };

  const toggleShow = (key: keyof CalendarSettings["show"], value: boolean) => {
    onChange({
      ...settings,
      show: { ...settings.show, [key]: value },
    });
  };

  const body = (
    <div className="flex flex-col gap-6">
      <OpeningHoursSection />

      <section className="border-border flex flex-col gap-3 rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-foreground text-sm font-semibold">Google Kalender</div>
            <div className="text-muted-foreground mt-0.5 text-xs">
              Synkroniserer én vei: Google → Smartout
            </div>
          </div>
          {settings.google.connected ? (
            <CheckCircle2 className="text-primary h-5 w-5" />
          ) : (
            <Mail className="text-muted-foreground h-5 w-5" />
          )}
        </div>

        {settings.google.connected ? (
          <>
            <div className="bg-muted/50 flex flex-col gap-1 rounded-lg p-3">
              <div className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
                Tilkoblet konto
              </div>
              <div className="text-foreground text-sm font-medium">{settings.google.email}</div>
              {settings.google.lastSyncAt ? (
                <div className="text-muted-foreground text-[11px]">
                  Siste sync: {new Date(settings.google.lastSyncAt).toLocaleString("nb-NO")}
                </div>
              ) : null}
            </div>
            <Button variant="outline" size="sm" onClick={handleDisconnect}>
              <Unplug className="mr-1 h-4 w-4" />
              Koble fra
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={handleConnect} disabled={connecting}>
            {connecting ? "Kobler til…" : "Koble til Google Kalender"}
          </Button>
        )}
      </section>

      <section className="border-border flex flex-col gap-3 rounded-xl border p-4">
        <div>
          <div className="text-foreground text-sm font-semibold">Hva skal vises</div>
          <div className="text-muted-foreground mt-0.5 text-xs">
            Velg hvilke kilder som skal dukke opp.
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {VISIBILITY_ROWS.map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <Label htmlFor={`show-${row.key}`} className="text-sm font-medium">
                  {row.label}
                </Label>
                <span className="text-muted-foreground text-[11px]">{row.hint}</span>
              </div>
              <Switch
                id={`show-${row.key}`}
                checked={settings.show[row.key]}
                onCheckedChange={(v) => toggleShow(row.key, v)}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  return (
    <SheetShell
      open={open}
      onOpenChange={onOpenChange}
      title="Kalenderinnstillinger"
      description="Koble til Google Kalender, rediger åpningstider, og velg hva som skal vises."
      body={body}
    />
  );
}

/**
 * Inline 7-day editor for company_opening_hours.
 * Reuses useCompanyHours from website module — same source of truth.
 */
const DAY_LABELS = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lordag", "Sondag"];

const DEFAULT_DAY: Omit<DayHours, "day"> = { open: "10:00", close: "22:00", closed: false };

/**
 * `getCompanyHours` always returns 7 rows; missing DB rows default to
 * `{open: "", close: "", closed: true}`. That looks "all stengt" in the
 * editor — confusing when reality is "user just hasn't filled it in yet".
 * Detect that state and pre-seed editable defaults.
 */
function isUnconfigured(rows: DayHours[]): boolean {
  return rows.length === 0 || rows.every((h) => h.closed && !h.open && !h.close);
}

function seedHours(): DayHours[] {
  return DAY_LABELS.map((day) => ({ day, ...DEFAULT_DAY }));
}

function OpeningHoursSection() {
  const { hours, isLoading, update } = useCompanyHours();
  const [local, setLocal] = useState<DayHours[]>([]);
  const [dirty, setDirty] = useState(false);
  const unconfigured = !isLoading && isUnconfigured(hours);

  useEffect(() => {
    if (dirty || isLoading) return;
    if (hours.length === 0) return;
    setLocal(isUnconfigured(hours) ? seedHours() : hours);
  }, [JSON.stringify(hours), dirty, isLoading]);

  const updateRow = (i: number, field: "open" | "close" | "closed", value: string | boolean) => {
    setLocal((prev) => prev.map((h, idx) => (idx === i ? { ...h, [field]: value } : h)));
    setDirty(true);
  };

  const handleSave = () => {
    update.mutate(local, {
      onSuccess: () => setDirty(false),
    });
  };

  return (
    <section className="border-border flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="text-muted-foreground h-4 w-4" />
          <div>
            <div className="text-foreground text-sm font-semibold">Åpningstider</div>
            <div className="text-muted-foreground mt-0.5 text-xs">
              {unconfigured && !dirty
                ? "Ikke konfigurert ennå — fyll inn og lagre."
                : "Bedriftens offisielle åpningstider — synkroniseres med nettside."}
            </div>
          </div>
        </div>
        {dirty || unconfigured ? (
          <Button size="sm" onClick={handleSave} disabled={update.isPending} className="gap-1.5">
            <Save className="h-3.5 w-3.5" />
            Lagre
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="bg-muted h-9 animate-pulse rounded-md" />
          ))}
        </div>
      ) : local.length === 0 ? (
        <p className="text-muted-foreground text-xs">Ingen åpningstider registrert.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {local.map((h, i) => (
            <div
              key={i}
              className="border-border grid grid-cols-[5rem_1fr_1fr_auto] items-center gap-2 rounded-md border p-1.5"
            >
              <span className="text-foreground text-xs font-medium">{h.day}</span>
              <Input
                type="time"
                value={h.open}
                onChange={(e) => updateRow(i, "open", e.target.value)}
                disabled={h.closed}
                className="h-8 text-xs"
              />
              <Input
                type="time"
                value={h.close}
                onChange={(e) => updateRow(i, "close", e.target.value)}
                disabled={h.closed}
                className="h-8 text-xs"
              />
              <Switch
                checked={h.closed}
                onCheckedChange={(v) => updateRow(i, "closed", v)}
                aria-label="Stengt"
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
