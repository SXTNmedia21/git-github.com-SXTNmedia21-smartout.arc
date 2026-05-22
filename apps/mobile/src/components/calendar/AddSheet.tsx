/**
 * AddSheet — Bottom sheet for creating new calendar entries.
 *
 * Presents 5 type-selector chips (vakt / oppgave / booking / avvik / notat)
 * followed by a type-specific form. Each form submits via the appropriate
 * BFF route per ADR-0132 (mobile thin client — never direct DB writes).
 *
 * BFF routes referenced (proposed ADRs — routes go live when wt-2/4/5/6 merge
 * to campaign/mobile):
 *   - Vakt      → POST /api/mobile/shifts            (wt-2, ADR-0270)
 *   - Oppgave   → POST /api/mobile/tasks/personal   (wt-8, ADR-0298)
 *   - Booking   → POST /api/mobile/bookings          (wt-4, ADR-0271)
 *   - Avvik     → POST /api/mobile/deviations        (wt-5, ADR-0273)
 *   - Notat     → POST /api/mobile/day-info          (wt-5, ADR-0273)
 *
 * Security:
 *   - Bearer auth via current Supabase session (ADR-0132, ADR-0151).
 *   - NO workspace_id / actor_id in request body — server derives from
 *     session (ADR-0151 Invariant 3).
 *   - Zod validates each form's inputs before submission.
 *
 * Accessibility: all interactive elements have accessibilityRole + label.
 * Telemetry: mutations emit via BFF server-side (ADR-0134).
 */

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import {
  Clock,
  CheckSquare,
  FileText,
  AlertTriangle,
  MessageSquare,
  ClipboardList,
  ChevronRight,
  X,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { getWebApiUrl } from "@/lib/web-api";
import { useTheme, withOpacity } from "@/theme";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Dropdown, type DropdownOption } from "@/components/ui/Dropdown";
import { DateField } from "@/components/ui/DateField";
import { TIME_OPTIONS_15 } from "@/lib/time-options";
import { useTeamStaff } from "@/hooks/queries/use-team-staff";

// ─── Type definitions ────────────────────────────────────────────────────────

type AddType = "shift" | "task" | "booking" | "deviation" | "note" | "routine";

/** YYYY-MM-DD in local time (no UTC shift). */
function toYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type AddSheetHandle = {
  open: () => void;
  close: () => void;
};

export type AddSheetProps = {
  /**
   * Full Date object representing the selected day context.
   * Replaces old `selectedDate: number` (day-of-month only) — that shape had no
   * month/year context, causing the hardcoded "Mandag X. mai" bug (HIGH-2).
   */
  selectedDate?: Date;
  onClose?: () => void;
  onCreated?: (type: AddType) => void;
};

// ─── Zod schemas per type ────────────────────────────────────────────────────
// These match the BFF route request schemas (minus workspace_id / actor_id
// which the BFF derives server-side per ADR-0151).

// Shift form is manager create-for-employee (POST /api/mobile/shifts → addShiftAction,
// min_role manager). date+times are converted to ISO-8601 UTC at submit; route
// wants profileId (target employee) + startAtISO/endAtISO + role + reason(min 8).
const shiftSchema = z.object({
  profileId: z.string().uuid("Velg en ansatt"),
  date: z.string().min(1, "Dato er påkrevd"),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "Format: HH:MM"),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, "Format: HH:MM"),
  position: z.string().min(1, "Stilling er påkrevd"),
  reason: z.string().min(8, "Minst 8 tegn (revisjonsspor)"),
});

const taskSchema = z.object({
  title: z.string().min(1, "Tittel er påkrevd"),
  due_at: z.string().min(1, "Dato er påkrevd"),
  priority: z.enum(["high", "normal", "low", "urgent"]),
});

// Matches POST /api/mobile/bookings requestSchema: shift_date (YYYY-MM-DD),
// booking_time, title, guest_count(int), contact?, notes?.
const bookingSchema = z.object({
  shift_date: z.string().min(1, "Dato er påkrevd"),
  title: z.string().min(1, "Tittel er påkrevd"),
  guest_count: z.coerce.number().int().min(1, "Minst 1 gjest"),
  booking_time: z.string().regex(/^\d{2}:\d{2}$/, "Format: HH:MM"),
  contact: z.string().optional(),
  notes: z.string().optional(),
});

// Matches DeviationPayloadSchema (via reportDeviationAction): title, domain (req),
// severity, description?. domain enum mirrors public.deviation_domain.
const deviationSchema = z.object({
  title: z.string().min(1, "Tittel er påkrevd"),
  domain: z.enum(["safety", "customer", "procedure", "system", "material"]),
  description: z.string().min(1, "Beskrivelse er påkrevd"),
  severity: z.enum(["low", "medium", "high"]),
});

// Matches createDayInfoAction InputSchema: date, title (req), content?.
const noteSchema = z.object({
  date: z.string().min(1, "Dato er påkrevd"),
  title: z.string().min(1, "Tittel er påkrevd"),
  content: z.string().optional(),
});

// ─── Type options (selector chips) ──────────────────────────────────────────

type TypeOption = {
  k: AddType;
  label: string;
  sub: string;
  bffRoute: string;
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
};

function useTypeOptions(): TypeOption[] {
  const webApiUrl = getWebApiUrl();
  return useMemo<TypeOption[]>(
    () => [
      {
        k: "shift",
        label: "Ny vakt",
        sub: "Tildel en ansatt en vakt (leder)",
        bffRoute: `${webApiUrl}/api/mobile/shifts`,
        Icon: Clock,
      },
      {
        k: "task",
        label: "Ny oppgave",
        sub: "Til deg eller skiftet",
        bffRoute: `${webApiUrl}/api/mobile/tasks/personal`,
        Icon: CheckSquare,
      },
      {
        k: "booking",
        label: "Booking",
        sub: "Reserver bord eller selskap",
        bffRoute: `${webApiUrl}/api/mobile/bookings`,
        Icon: FileText,
      },
      {
        k: "deviation",
        label: "Rapporter avvik",
        sub: "Hygiene · sikkerhet · skade",
        bffRoute: `${webApiUrl}/api/mobile/deviations`,
        Icon: AlertTriangle,
      },
      {
        k: "note",
        label: "Notat / påminnelse",
        sub: "Privat · til deg selv",
        bffRoute: `${webApiUrl}/api/mobile/day-info`,
        Icon: MessageSquare,
      },
      {
        k: "routine",
        label: "Ny rutine",
        sub: "Fra bilde eller manuelt",
        bffRoute: "", // navigates to the create form instead of inline submit
        Icon: ClipboardList,
      },
    ],
    [webApiUrl],
  );
}

// ─── BFF fetch helper ────────────────────────────────────────────────────────
// Per ADR-0132: Bearer auth from Supabase session.
// Per ADR-0151: no workspace_id in body — BFF derives from session.

async function submitToBff(route: string, body: Record<string, unknown>): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("Ikke innlogget");
  }

  const response = await fetch(route, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Serverfeil (${response.status})`);
  }
}

// ─── Individual form components ──────────────────────────────────────────────

type FormProps = {
  theme: ReturnType<typeof useTheme>;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
  pending: boolean;
  /** Day the sheet was opened on — anchors DateField default + window. */
  anchorDate?: Date;
};

function ShiftForm({ theme, onSubmit, pending, anchorDate }: FormProps) {
  const { data: staff, isLoading: staffLoading } = useTeamStaff();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [date, setDate] = useState(anchorDate ? toYmdLocal(anchorDate) : "");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [position, setPosition] = useState("");
  const [reason, setReason] = useState("");

  const staffOptions = useMemo<DropdownOption[]>(
    () => (staff ?? []).map((s) => ({ value: s.id, label: s.name })),
    [staff],
  );

  const handleSubmit = async () => {
    const result = shiftSchema.safeParse({
      profileId,
      date,
      start_time: startTime,
      end_time: endTime,
      position,
      reason,
    });
    if (!result.success) {
      Alert.alert("Valideringsfeil", result.error.errors[0]?.message ?? "Ugyldig input");
      return;
    }
    // Build ISO-8601 UTC from local date + HH:MM (route derives workspace-local).
    const startAtISO = new Date(`${result.data.date}T${result.data.start_time}:00`).toISOString();
    const endAtISO = new Date(`${result.data.date}T${result.data.end_time}:00`).toISOString();
    await onSubmit({
      profileId: result.data.profileId,
      startAtISO,
      endAtISO,
      role: result.data.position,
      reason: result.data.reason,
    });
  };

  return (
    <View style={formStyles.container}>
      <Dropdown
        label="Ansatt"
        options={staffOptions}
        value={profileId}
        onChange={setProfileId}
        placeholder={staffLoading ? "Laster ansatte…" : "Velg ansatt"}
      />
      <DateField label="Dato" value={date || null} onChange={setDate} anchor={anchorDate} />
      <View style={formStyles.row}>
        <View style={formStyles.half}>
          <Dropdown
            label="Fra"
            options={TIME_OPTIONS_15}
            value={startTime || null}
            onChange={setStartTime}
            placeholder="Velg tid"
          />
        </View>
        <View style={formStyles.half}>
          <Dropdown
            label="Til"
            options={TIME_OPTIONS_15}
            value={endTime || null}
            onChange={setEndTime}
            placeholder="Velg tid"
          />
        </View>
      </View>
      <FormField
        label="Stilling"
        value={position}
        onChangeText={setPosition}
        placeholder="Sous-chef"
        theme={theme}
      />
      <FormField
        label="Begrunnelse (revisjonsspor)"
        value={reason}
        onChangeText={setReason}
        placeholder="F.eks. ekstravakt grunnet sykdom"
        theme={theme}
      />
      <SubmitButton
        label="Opprett vakt"
        pending={pending}
        onPress={handleSubmit}
        color={theme.colors.brandOrange}
      />
    </View>
  );
}

function TaskForm({ theme, onSubmit, pending, anchorDate }: FormProps) {
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState(anchorDate ? toYmdLocal(anchorDate) : "");
  const [priority, setPriority] = useState<"high" | "normal" | "low" | "urgent">("normal");

  const handleSubmit = async () => {
    const result = taskSchema.safeParse({ title, due_at: dueAt, priority });
    if (!result.success) {
      Alert.alert("Valideringsfeil", result.error.errors[0]?.message ?? "Ugyldig input");
      return;
    }
    // BFF route expects ISO-8601 datetime. Date picker produces YYYY-MM-DD —
    // convert to full ISO string (midnight UTC) before submit.
    const due_at = result.data.due_at ? new Date(result.data.due_at).toISOString() : undefined;
    await onSubmit({ title: result.data.title, due_at, priority: result.data.priority });
  };

  return (
    <View style={formStyles.container}>
      <FormField
        label="Tittel"
        value={title}
        onChangeText={setTitle}
        placeholder="Oppgavetittel"
        theme={theme}
      />
      <DateField
        label="Forfallsdato"
        value={dueAt || null}
        onChange={setDueAt}
        anchor={anchorDate}
      />
      <Text style={[formStyles.label, { color: theme.colors.mutedForeground }]}>Prioritet</Text>
      <View style={formStyles.row}>
        {(["high", "normal", "low", "urgent"] as const).map((p) => (
          <Pressable
            key={p}
            onPress={() => setPriority(p)}
            style={[
              formStyles.priorityChip,
              {
                backgroundColor:
                  priority === p ? theme.colors.calendarTaskAccent : theme.colors.secondary,
                borderColor: priority === p ? theme.colors.calendarTaskAccent : theme.colors.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: priority === p }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color:
                  priority === p ? theme.colors.primaryForeground : theme.colors.mutedForeground,
              }}
            >
              {p === "urgent" ? "Haster" : p === "high" ? "Høy" : p === "normal" ? "Normal" : "Lav"}
            </Text>
          </Pressable>
        ))}
      </View>
      <SubmitButton
        label="Opprett oppgave"
        pending={pending}
        onPress={handleSubmit}
        color={theme.colors.calendarTaskAccent}
      />
    </View>
  );
}

function BookingForm({ theme, onSubmit, pending, anchorDate }: FormProps) {
  const [title, setTitle] = useState("");
  const [shiftDate, setShiftDate] = useState(anchorDate ? toYmdLocal(anchorDate) : "");
  const [guestCount, setGuestCount] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [contact, setContact] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async () => {
    const result = bookingSchema.safeParse({
      shift_date: shiftDate,
      title,
      guest_count: guestCount,
      booking_time: bookingTime,
      contact: contact || undefined,
      notes: notes || undefined,
    });
    if (!result.success) {
      Alert.alert("Valideringsfeil", result.error.errors[0]?.message ?? "Ugyldig input");
      return;
    }
    await onSubmit(result.data);
  };

  return (
    <View style={formStyles.container}>
      <FormField
        label="Gjest / selskap"
        value={title}
        onChangeText={setTitle}
        placeholder="Familie Andersen"
        theme={theme}
      />
      <DateField
        label="Dato"
        value={shiftDate || null}
        onChange={setShiftDate}
        anchor={anchorDate}
      />
      <View style={formStyles.row}>
        <View style={formStyles.half}>
          <Dropdown
            label="Tid"
            options={TIME_OPTIONS_15}
            value={bookingTime || null}
            onChange={setBookingTime}
            placeholder="Velg tid"
          />
        </View>
        <View style={formStyles.half}>
          <FormField
            label="Antall gjester"
            value={guestCount}
            onChangeText={setGuestCount}
            placeholder="4"
            theme={theme}
          />
        </View>
      </View>
      <FormField
        label="Kontakt (valgfritt)"
        value={contact}
        onChangeText={setContact}
        placeholder="Telefon eller navn"
        theme={theme}
      />
      <FormField
        label="Spesielle behov (valgfritt)"
        value={notes}
        onChangeText={setNotes}
        placeholder="Allergi, spesiell anledning..."
        theme={theme}
        multiline
      />
      <SubmitButton
        label="Opprett booking"
        pending={pending}
        onPress={handleSubmit}
        color={theme.colors.calendarBookingAccent}
      />
    </View>
  );
}

const DEVIATION_DOMAINS: DropdownOption[] = [
  { value: "safety", label: "Sikkerhet" },
  { value: "customer", label: "Kunde" },
  { value: "procedure", label: "Prosedyre" },
  { value: "system", label: "System" },
  { value: "material", label: "Materiell" },
];

function DeviationForm({ theme, onSubmit, pending }: FormProps) {
  const [title, setTitle] = useState("");
  const [domain, setDomain] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high">("medium");

  const handleSubmit = async () => {
    const result = deviationSchema.safeParse({ title, domain, description, severity });
    if (!result.success) {
      Alert.alert("Valideringsfeil", result.error.errors[0]?.message ?? "Ugyldig input");
      return;
    }
    await onSubmit(result.data);
  };

  return (
    <View style={formStyles.container}>
      <FormField
        label="Avvikstittel"
        value={title}
        onChangeText={setTitle}
        placeholder="Sølt kjemikalie på kjøkken"
        theme={theme}
      />
      <Dropdown
        label="Kategori"
        options={DEVIATION_DOMAINS}
        value={domain}
        onChange={setDomain}
        placeholder="Velg kategori"
      />
      <FormField
        label="Beskrivelse"
        value={description}
        onChangeText={setDescription}
        placeholder="Hva skjedde, hvor, og hvilke tiltak er gjort?"
        theme={theme}
        multiline
      />
      <Text style={[formStyles.label, { color: theme.colors.mutedForeground }]}>
        Alvorlighetsgrad
      </Text>
      <View style={formStyles.row}>
        {(["low", "medium", "high"] as const).map((s) => (
          <Pressable
            key={s}
            onPress={() => setSeverity(s)}
            style={[
              formStyles.priorityChip,
              {
                backgroundColor: severity === s ? theme.colors.destructive : theme.colors.secondary,
                borderColor: severity === s ? theme.colors.destructive : theme.colors.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: severity === s }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color:
                  severity === s ? theme.colors.primaryForeground : theme.colors.mutedForeground,
              }}
            >
              {s === "low" ? "Lav" : s === "medium" ? "Middels" : "Høy"}
            </Text>
          </Pressable>
        ))}
      </View>
      <SubmitButton
        label="Rapporter avvik"
        pending={pending}
        onPress={handleSubmit}
        color={theme.colors.destructive}
      />
    </View>
  );
}

function NoteForm({ theme, onSubmit, pending, anchorDate }: FormProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [date, setDate] = useState(anchorDate ? toYmdLocal(anchorDate) : "");

  const handleSubmit = async () => {
    const result = noteSchema.safeParse({
      date,
      title,
      content: content || undefined,
    });
    if (!result.success) {
      Alert.alert("Valideringsfeil", result.error.errors[0]?.message ?? "Ugyldig input");
      return;
    }
    // createDayInfoAction requires scopeType + category. A private mobile note
    // is a workspace-scoped "note" (scopeId omitted → whole workspace).
    await onSubmit({ ...result.data, scopeType: "workspace", category: "note" });
  };

  return (
    <View style={formStyles.container}>
      <DateField label="Dato" value={date || null} onChange={setDate} anchor={anchorDate} />
      <FormField
        label="Tittel"
        value={title}
        onChangeText={setTitle}
        placeholder="F.eks. Husk leveranse kl 14"
        theme={theme}
      />
      <FormField
        label="Notat (valgfritt)"
        value={content}
        onChangeText={setContent}
        placeholder="Skriv notat eller påminnelse her..."
        theme={theme}
        multiline
      />
      <SubmitButton
        label="Lagre notat"
        pending={pending}
        onPress={handleSubmit}
        color={theme.colors.mutedForeground}
      />
    </View>
  );
}

// ─── Shared form primitives ──────────────────────────────────────────────────

// Shared field/button — unified on the ui/* primitives so every form uses the
// SAME input type (token-based, dark-aware). `theme`/`color` props kept for
// call-site compatibility but no longer drive styling.
type FormFieldProps = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  theme?: ReturnType<typeof useTheme>;
  multiline?: boolean;
};

function FormField({ label, value, onChangeText, placeholder, multiline }: FormFieldProps) {
  return (
    <Input
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
      returnKeyType="done"
    />
  );
}

type SubmitButtonProps = {
  label: string;
  pending: boolean;
  onPress: () => void;
  color?: string;
};

function SubmitButton({ label, pending, onPress }: SubmitButtonProps) {
  return (
    <Button
      title={pending ? "Lagrer…" : label}
      variant="primary"
      loading={pending}
      fullWidth
      onPress={onPress}
      accessibilityLabel={label}
    />
  );
}

// ─── Main AddSheet component ─────────────────────────────────────────────────

export const AddSheet = React.forwardRef<AddSheetHandle, AddSheetProps>(function AddSheet(
  { selectedDate, onClose, onCreated },
  ref,
) {
  const theme = useTheme();
  const router = useRouter();
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["50%", "85%"], []);
  const typeOptions = useTypeOptions();

  // "Ny rutine" navigates to its own create form (steps editor + photo prefill)
  // instead of an inline sheet form. All other types open an inline form.
  const handleSelectType = useCallback(
    (k: AddType) => {
      if (k === "routine") {
        sheetRef.current?.close();
        router.push("/routine-review");
        return;
      }
      setActiveType(k);
    },
    [router],
  );

  const [activeType, setActiveType] = useState<AddType | null>(null);
  const [pending, setPending] = useState(false);

  React.useImperativeHandle(ref, () => ({
    open: () => sheetRef.current?.snapToIndex(0),
    close: () => sheetRef.current?.close(),
  }));

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} />
    ),
    [],
  );

  const handleClose = useCallback(() => {
    setActiveType(null);
    setPending(false);
    onClose?.();
  }, [onClose]);

  const handleSubmit = useCallback(
    async (type: AddType, body: Record<string, unknown>) => {
      const option = typeOptions.find((o) => o.k === type);
      if (!option) return;

      setPending(true);
      try {
        await submitToBff(option.bffRoute, body);
        sheetRef.current?.close();
        onCreated?.(type);
        Alert.alert("Lagret", `${option.label} ble opprettet.`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Ukjent feil";
        Alert.alert("Feil", msg);
      } finally {
        setPending(false);
      }
    },
    [typeOptions, onCreated],
  );

  // HIGH-2: was `Mandag ${selectedDate}. mai` — hardcoded weekday + month.
  // Now derives correct weekday + month from the Date object via Intl/nb-NO.
  const selectedDay = selectedDate
    ? selectedDate.toLocaleDateString("nb-NO", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "valgt dag";

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={handleClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: theme.colors.background }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.border }}
      keyboardBehavior="extend"
    >
      <BottomSheetScrollView
        contentContainerStyle={[sheetStyles.content, { paddingBottom: 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={sheetStyles.headerRow}>
          <Text style={[sheetStyles.title, { color: theme.colors.foreground }]}>Ny oppføring</Text>
          {activeType != null && (
            <Pressable
              onPress={() => setActiveType(null)}
              style={sheetStyles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Tilbake til type-valg"
            >
              <X size={18} color={theme.colors.mutedForeground} strokeWidth={2} />
            </Pressable>
          )}
        </View>
        <Text style={[sheetStyles.subtitle, { color: theme.colors.mutedForeground }]}>
          Hva vil du legge til på {selectedDay}?
        </Text>

        {/* Type selector OR form */}
        {activeType == null ? (
          <View style={sheetStyles.optionList}>
            {typeOptions.map((opt) => {
              const accentColor = getTypeAccentColor(opt.k, theme);
              return (
                <Pressable
                  key={opt.k}
                  onPress={() => handleSelectType(opt.k)}
                  style={[
                    sheetStyles.optionRow,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                >
                  {/* Icon frame */}
                  <View
                    style={[
                      sheetStyles.iconFrame,
                      { backgroundColor: withOpacity(accentColor, 0.16) },
                    ]}
                  >
                    <opt.Icon size={20} color={accentColor} strokeWidth={2} />
                  </View>

                  {/* Text */}
                  <View style={sheetStyles.optionText}>
                    <Text style={[sheetStyles.optionLabel, { color: theme.colors.foreground }]}>
                      {opt.label}
                    </Text>
                    <Text style={[sheetStyles.optionSub, { color: theme.colors.mutedForeground }]}>
                      {opt.sub}
                    </Text>
                  </View>

                  <ChevronRight size={14} color={theme.colors.mutedForeground} strokeWidth={2} />
                </Pressable>
              );
            })}
          </View>
        ) : (
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            {activeType === "shift" && (
              <ShiftForm
                theme={theme}
                pending={pending}
                anchorDate={selectedDate}
                onSubmit={(body) => handleSubmit("shift", body)}
              />
            )}
            {activeType === "task" && (
              <TaskForm
                theme={theme}
                pending={pending}
                anchorDate={selectedDate}
                onSubmit={(body) => handleSubmit("task", body)}
              />
            )}
            {activeType === "booking" && (
              <BookingForm
                theme={theme}
                pending={pending}
                anchorDate={selectedDate}
                onSubmit={(body) => handleSubmit("booking", body)}
              />
            )}
            {activeType === "deviation" && (
              <DeviationForm
                theme={theme}
                pending={pending}
                anchorDate={selectedDate}
                onSubmit={(body) => handleSubmit("deviation", body)}
              />
            )}
            {activeType === "note" && (
              <NoteForm
                theme={theme}
                pending={pending}
                anchorDate={selectedDate}
                onSubmit={(body) => handleSubmit("note", body)}
              />
            )}
          </KeyboardAvoidingView>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
});

// Stateless color helper (plain function, not a hook — safe inside .map())
function getTypeAccentColor(type: AddType, theme: ReturnType<typeof useTheme>): string {
  switch (type) {
    case "shift":
      return theme.colors.brandOrange;
    case "task":
      return theme.colors.calendarTaskAccent;
    case "booking":
      return theme.colors.calendarBookingAccent;
    case "deviation":
      return theme.colors.destructive;
    case "note":
      return theme.colors.mutedForeground;
    case "routine":
      return theme.colors.primary;
  }
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const sheetStyles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 22,
    fontFamily: "InstrumentSerif-Regular",
    letterSpacing: -0.22,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  subtitle: {
    fontSize: 13,
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  optionList: {
    gap: 8,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  iconFrame: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 14.5,
    fontWeight: "600",
  },
  optionSub: {
    fontSize: 12,
    marginTop: 2,
  },
});

const formStyles = StyleSheet.create({
  container: {
    gap: 12,
    paddingTop: 4,
  },
  label: {
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  half: {
    flex: 1,
  },
  priorityChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
});
