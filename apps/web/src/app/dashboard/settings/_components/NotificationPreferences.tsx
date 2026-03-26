"use client";

/**
 * NotificationPreferences.tsx — Per-user notification preference settings.
 *
 * Keyed by auth user_id (not profile_id) so preferences apply across all
 * workspaces. On first toggle the row is created via upsert. Until then,
 * displayed values are the server-side defaults.
 *
 * Three sections:
 *   1. Channels — push, email, SMS, browser
 *   2. Categories — work, training, community
 *   3. Quiet hours — start/end time + timezone
 */

import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@smartout/notifications/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Preferences = {
  push_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  browser_enabled: boolean;
  work_enabled: boolean;
  training_enabled: boolean;
  community_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  quiet_hours_timezone: string;
};

// Server-side column defaults — displayed when the user has no saved row yet.
const DEFAULTS: Preferences = {
  push_enabled: true,
  email_enabled: true,
  sms_enabled: false,
  browser_enabled: false,
  work_enabled: true,
  training_enabled: true,
  community_enabled: true,
  quiet_hours_start: "22:00",
  quiet_hours_end: "07:00",
  quiet_hours_timezone: "Europe/Oslo",
};

const TIMEZONES = [
  "Europe/Oslo",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Australia/Sydney",
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-foreground text-base font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>
    </div>
  );
}

function PreferenceRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-foreground text-sm font-medium">{label}</p>
        {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={label}
      />
    </div>
  );
}

function PreferenceSkeleton() {
  return (
    <div className="space-y-8">
      {[0, 1, 2].map((i) => (
        <div key={i}>
          <Skeleton className="mb-4 h-5 w-36" />
          <div className="divide-border divide-y">
            {[0, 1, 2].map((j) => (
              <div key={j} className="flex items-center justify-between py-3">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-5 w-9 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function NotificationPreferences({ userId }: { userId: string | undefined }) {
  const { data: preferences, isLoading } = useNotificationPreferences(userId);
  const updatePreferences = useUpdateNotificationPreferences(userId);

  // Merge saved preferences with defaults — handles the null (first-time) case.
  const prefs: Preferences = preferences
    ? {
        push_enabled: preferences.push_enabled ?? DEFAULTS.push_enabled,
        email_enabled: preferences.email_enabled ?? DEFAULTS.email_enabled,
        sms_enabled: preferences.sms_enabled ?? DEFAULTS.sms_enabled,
        browser_enabled: preferences.browser_enabled ?? DEFAULTS.browser_enabled,
        work_enabled: preferences.work_enabled ?? DEFAULTS.work_enabled,
        training_enabled: preferences.training_enabled ?? DEFAULTS.training_enabled,
        community_enabled: preferences.community_enabled ?? DEFAULTS.community_enabled,
        quiet_hours_start: preferences.quiet_hours_start ?? DEFAULTS.quiet_hours_start,
        quiet_hours_end: preferences.quiet_hours_end ?? DEFAULTS.quiet_hours_end,
        quiet_hours_timezone: preferences.quiet_hours_timezone ?? DEFAULTS.quiet_hours_timezone,
      }
    : DEFAULTS;

  function toggle(field: keyof Preferences, value: boolean) {
    // Request browser notification permission when enabling browser_enabled.
    if (field === "browser_enabled" && value && typeof window !== "undefined") {
      void Notification.requestPermission();
    }
    updatePreferences.mutate({ [field]: value });
  }

  function setField(field: keyof Preferences, value: string) {
    updatePreferences.mutate({ [field]: value });
  }

  const isMutating = updatePreferences.isPending;

  if (isLoading) {
    return <PreferenceSkeleton />;
  }

  return (
    <div className="space-y-8 pb-8">
      {/* ------------------------------------------------------------------ */}
      {/* Section 1: Channels                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <SectionHeading
          title="Kanaler"
          description="Velg hvilke kanaler du vil motta varsler på."
        />
        <div className="divide-border divide-y">
          <PreferenceRow
            label="Push-varsler"
            description="Varsler til mobilen via Expo."
            checked={prefs.push_enabled}
            onCheckedChange={(v) => toggle("push_enabled", v)}
            disabled={isMutating}
          />
          <PreferenceRow
            label="E-post"
            description="Transaksjonsbaserte varsler på e-post."
            checked={prefs.email_enabled}
            onCheckedChange={(v) => toggle("email_enabled", v)}
            disabled={isMutating}
          />
          <PreferenceRow
            label="SMS"
            description="Kun kritiske varsler. Merk: SMS medfører kostnad."
            checked={prefs.sms_enabled}
            onCheckedChange={(v) => toggle("sms_enabled", v)}
            disabled={isMutating}
          />
          <PreferenceRow
            label="Browser-varsler"
            description="Push-varsler i nettleseren på denne enheten."
            checked={prefs.browser_enabled}
            onCheckedChange={(v) => toggle("browser_enabled", v)}
            disabled={isMutating}
          />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2: Categories                                               */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <SectionHeading title="Kategorier" description="Velg hvilke typer varsler du vil motta." />
        <div className="divide-border divide-y">
          <PreferenceRow
            label="Arbeid"
            description="Vakter, oppgaver, avvik og godkjenninger."
            checked={prefs.work_enabled}
            onCheckedChange={(v) => toggle("work_enabled", v)}
            disabled={isMutating}
          />
          <PreferenceRow
            label="Opplæring"
            description="Protokoller, tester og frister."
            checked={prefs.training_enabled}
            onCheckedChange={(v) => toggle("training_enabled", v)}
            disabled={isMutating}
          />
          <PreferenceRow
            label="Fellesskap"
            description="Chat, meldinger og kunngjøringer."
            checked={prefs.community_enabled}
            onCheckedChange={(v) => toggle("community_enabled", v)}
            disabled={isMutating}
          />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 3: Quiet hours                                              */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <SectionHeading
          title="Stilletid"
          description="I stilletiden holdes varsler tilbake til stilletiden er over."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="quiet-start" className="text-foreground text-sm font-medium">
              Starter
            </label>
            <input
              id="quiet-start"
              type="time"
              value={prefs.quiet_hours_start}
              onChange={(e) => setField("quiet_hours_start", e.target.value)}
              disabled={isMutating}
              className="border-border bg-background text-foreground focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none disabled:opacity-50"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="quiet-end" className="text-foreground text-sm font-medium">
              Slutter
            </label>
            <input
              id="quiet-end"
              type="time"
              value={prefs.quiet_hours_end}
              onChange={(e) => setField("quiet_hours_end", e.target.value)}
              disabled={isMutating}
              className="border-border bg-background text-foreground focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none disabled:opacity-50"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="quiet-tz" className="text-foreground text-sm font-medium">
              Tidssone
            </label>
            <select
              id="quiet-tz"
              value={prefs.quiet_hours_timezone}
              onChange={(e) => setField("quiet_hours_timezone", e.target.value)}
              disabled={isMutating}
              className="border-border bg-background text-foreground focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none disabled:opacity-50"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-muted-foreground mt-3 text-xs">
          Kritiske varsler (avvik o.l.) leveres alltid, uavhengig av stilletid.
        </p>
      </section>
    </div>
  );
}
