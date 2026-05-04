/**
 * AddSheet — Bottom sheet for creating new calendar entries.
 *
 * Presents 5 type-selector chips (vakt / oppgave / booking / avvik / notat)
 * followed by a type-specific form. Each form submits via the appropriate
 * BFF route per ADR-0132 (mobile thin client — never direct DB writes).
 *
 * BFF routes referenced (proposed ADRs — routes go live when wt-2/4/5/6 merge
 * to campaign/mobile):
 *   - Vakt      → POST /api/mobile/shifts       (wt-2, ADR-0270)
 *   - Oppgave   → POST /api/mobile/tasks        (wt-6, ADR-0272)
 *   - Booking   → POST /api/mobile/bookings     (wt-4, ADR-0271)
 *   - Avvik     → POST /api/mobile/deviations   (wt-5, ADR-0273)
 *   - Notat     → POST /api/mobile/day-info     (wt-5, ADR-0273)
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
  TextInput,
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
  ChevronRight,
  X,
} from "lucide-react-native";
import { z } from "zod";
import { nativeTheme } from "@smartout/design-tokens/native";
import { supabase } from "@/lib/supabase";
import { getWebApiUrl } from "@/lib/web-api";
import { useTheme, withOpacity } from "@/theme";

// ─── Type definitions ────────────────────────────────────────────────────────

type AddType = "shift" | "task" | "booking" | "deviation" | "note";

export type AddSheetHandle = {
  open: () => void;
  close: () => void;
};

export type AddSheetProps = {
  /** Selected date context (ISO string or day-of-month number). */
  selectedDate?: number;
  onClose?: () => void;
  onCreated?: (type: AddType) => void;
};

// ─── Zod schemas per type ────────────────────────────────────────────────────
// These match the BFF route request schemas (minus workspace_id / actor_id
// which the BFF derives server-side per ADR-0151).

const shiftSchema = z.object({
  date: z.string().min(1, "Dato er påkrevd"),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "Format: HH:MM"),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, "Format: HH:MM"),
  position: z.string().min(1, "Stilling er påkrevd"),
});

const taskSchema = z.object({
  title: z.string().min(1, "Tittel er påkrevd"),
  due_date: z.string().min(1, "Dato er påkrevd"),
  priority: z.enum(["high", "normal", "low"]),
});

const bookingSchema = z.object({
  title: z.string().min(1, "Tittel er påkrevd"),
  guest_count: z.coerce.number().int().min(1, "Minst 1 gjest"),
  booking_time: z.string().regex(/^\d{2}:\d{2}$/, "Format: HH:MM"),
  tables: z.string().optional(),
  notes: z.string().optional(),
});

const deviationSchema = z.object({
  title: z.string().min(1, "Tittel er påkrevd"),
  description: z.string().min(1, "Beskrivelse er påkrevd"),
  severity: z.enum(["low", "medium", "high"]),
});

const noteSchema = z.object({
  content: z.string().min(1, "Notat kan ikke være tomt"),
  date: z.string().min(1, "Dato er påkrevd"),
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
        label: "Vaktforespørsel",
        sub: "Be om bytte eller registrer ekstra",
        bffRoute: `${webApiUrl}/api/mobile/shifts`,
        Icon: Clock,
      },
      {
        k: "task",
        label: "Ny oppgave",
        sub: "Til deg eller skiftet",
        bffRoute: `${webApiUrl}/api/mobile/tasks`,
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
};

function ShiftForm({ theme, onSubmit, pending }: FormProps) {
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [position, setPosition] = useState("");

  const handleSubmit = async () => {
    const result = shiftSchema.safeParse({
      date,
      start_time: startTime,
      end_time: endTime,
      position,
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
        label="Dato (YYYY-MM-DD)"
        value={date}
        onChangeText={setDate}
        placeholder="2026-05-04"
        theme={theme}
      />
      <View style={formStyles.row}>
        <View style={formStyles.half}>
          <FormField
            label="Fra"
            value={startTime}
            onChangeText={setStartTime}
            placeholder="15:00"
            theme={theme}
          />
        </View>
        <View style={formStyles.half}>
          <FormField
            label="Til"
            value={endTime}
            onChangeText={setEndTime}
            placeholder="23:00"
            theme={theme}
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
      <SubmitButton
        label="Send forespørsel"
        pending={pending}
        onPress={handleSubmit}
        color={theme.colors.brandOrange}
      />
    </View>
  );
}

function TaskForm({ theme, onSubmit, pending }: FormProps) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<"high" | "normal" | "low">("normal");

  const handleSubmit = async () => {
    const result = taskSchema.safeParse({ title, due_date: dueDate, priority });
    if (!result.success) {
      Alert.alert("Valideringsfeil", result.error.errors[0]?.message ?? "Ugyldig input");
      return;
    }
    await onSubmit(result.data);
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
      <FormField
        label="Forfallsdato (YYYY-MM-DD)"
        value={dueDate}
        onChangeText={setDueDate}
        placeholder="2026-05-04"
        theme={theme}
      />
      <Text style={[formStyles.label, { color: theme.colors.mutedForeground }]}>Prioritet</Text>
      <View style={formStyles.row}>
        {(["high", "normal", "low"] as const).map((p) => (
          <Pressable
            key={p}
            onPress={() => setPriority(p)}
            style={[
              formStyles.priorityChip,
              {
                backgroundColor:
                  priority === p ? theme.colors.calendarTaskAccent : theme.colors.secondary,
                borderColor:
                  priority === p ? theme.colors.calendarTaskAccent : theme.colors.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: priority === p }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: priority === p ? theme.colors.primaryForeground : theme.colors.mutedForeground,
              }}
            >
              {p === "high" ? "Høy" : p === "normal" ? "Normal" : "Lav"}
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

function BookingForm({ theme, onSubmit, pending }: FormProps) {
  const [title, setTitle] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [tables, setTables] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async () => {
    const result = bookingSchema.safeParse({
      title,
      guest_count: guestCount,
      booking_time: bookingTime,
      tables: tables || undefined,
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
      <View style={formStyles.row}>
        <View style={formStyles.half}>
          <FormField
            label="Tid"
            value={bookingTime}
            onChangeText={setBookingTime}
            placeholder="18:30"
            theme={theme}
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
        label="Bord (valgfritt)"
        value={tables}
        onChangeText={setTables}
        placeholder="8 · 9"
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

function DeviationForm({ theme, onSubmit, pending }: FormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high">("medium");

  const handleSubmit = async () => {
    const result = deviationSchema.safeParse({ title, description, severity });
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
      <FormField
        label="Beskrivelse"
        value={description}
        onChangeText={setDescription}
        placeholder="Hva skjedde, hvor, og hvilke tiltak er gjort?"
        theme={theme}
        multiline
      />
      <Text style={[formStyles.label, { color: theme.colors.mutedForeground }]}>Alvorlighetsgrad</Text>
      <View style={formStyles.row}>
        {(["low", "medium", "high"] as const).map((s) => (
          <Pressable
            key={s}
            onPress={() => setSeverity(s)}
            style={[
              formStyles.priorityChip,
              {
                backgroundColor:
                  severity === s ? theme.colors.destructive : theme.colors.secondary,
                borderColor:
                  severity === s ? theme.colors.destructive : theme.colors.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: severity === s }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: severity === s ? theme.colors.primaryForeground : theme.colors.mutedForeground,
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

function NoteForm({ theme, onSubmit, pending }: FormProps) {
  const [content, setContent] = useState("");
  const [date, setDate] = useState("");

  const handleSubmit = async () => {
    const result = noteSchema.safeParse({ content, date });
    if (!result.success) {
      Alert.alert("Valideringsfeil", result.error.errors[0]?.message ?? "Ugyldig input");
      return;
    }
    await onSubmit(result.data);
  };

  return (
    <View style={formStyles.container}>
      <FormField
        label="Dato (YYYY-MM-DD)"
        value={date}
        onChangeText={setDate}
        placeholder="2026-05-04"
        theme={theme}
      />
      <FormField
        label="Notat"
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

type FormFieldProps = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  theme: ReturnType<typeof useTheme>;
  multiline?: boolean;
};

function FormField({ label, value, onChangeText, placeholder, theme, multiline }: FormFieldProps) {
  return (
    <View style={formStyles.fieldWrapper}>
      <Text style={[formStyles.label, { color: theme.colors.mutedForeground }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.mutedForeground}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        style={[
          formStyles.input,
          {
            color: theme.colors.foreground,
            backgroundColor: theme.colors.secondary,
            borderColor: theme.colors.border,
            minHeight: multiline ? 72 : undefined,
            textAlignVertical: multiline ? "top" : "center",
          },
        ]}
        accessibilityLabel={label}
      />
    </View>
  );
}

type SubmitButtonProps = {
  label: string;
  pending: boolean;
  onPress: () => void;
  color: string;
};

function SubmitButton({ label, pending, onPress, color }: SubmitButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={pending}
      style={[
        formStyles.submitBtn,
        { backgroundColor: color, opacity: pending ? 0.6 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={formStyles.submitBtnLabel}>{pending ? "Lagrer..." : label}</Text>
    </Pressable>
  );
}

// ─── Main AddSheet component ─────────────────────────────────────────────────

export const AddSheet = React.forwardRef<AddSheetHandle, AddSheetProps>(
  function AddSheet({ selectedDate, onClose, onCreated }, ref) {
    const theme = useTheme();
    const sheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ["50%", "85%"], []);
    const typeOptions = useTypeOptions();

    const [activeType, setActiveType] = useState<AddType | null>(null);
    const [pending, setPending] = useState(false);

    React.useImperativeHandle(ref, () => ({
      open: () => sheetRef.current?.snapToIndex(0),
      close: () => sheetRef.current?.close(),
    }));

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.4}
        />
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

    const selectedDay = selectedDate
      ? `Mandag ${selectedDate}. mai`
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
          contentContainerStyle={[
            sheetStyles.content,
            { paddingBottom: 40 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={sheetStyles.headerRow}>
            <Text style={[sheetStyles.title, { color: theme.colors.foreground }]}>
              Ny oppføring
            </Text>
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
                    onPress={() => setActiveType(opt.k)}
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
                      <Text
                        style={[sheetStyles.optionLabel, { color: theme.colors.foreground }]}
                      >
                        {opt.label}
                      </Text>
                      <Text
                        style={[sheetStyles.optionSub, { color: theme.colors.mutedForeground }]}
                      >
                        {opt.sub}
                      </Text>
                    </View>

                    <ChevronRight
                      size={14}
                      color={theme.colors.mutedForeground}
                      strokeWidth={2}
                    />
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              {activeType === "shift" && (
                <ShiftForm
                  theme={theme}
                  pending={pending}
                  onSubmit={(body) => handleSubmit("shift", body)}
                />
              )}
              {activeType === "task" && (
                <TaskForm
                  theme={theme}
                  pending={pending}
                  onSubmit={(body) => handleSubmit("task", body)}
                />
              )}
              {activeType === "booking" && (
                <BookingForm
                  theme={theme}
                  pending={pending}
                  onSubmit={(body) => handleSubmit("booking", body)}
                />
              )}
              {activeType === "deviation" && (
                <DeviationForm
                  theme={theme}
                  pending={pending}
                  onSubmit={(body) => handleSubmit("deviation", body)}
                />
              )}
              {activeType === "note" && (
                <NoteForm
                  theme={theme}
                  pending={pending}
                  onSubmit={(body) => handleSubmit("note", body)}
                />
              )}
            </KeyboardAvoidingView>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    );
  },
);

// Stateless color helper (plain function, not a hook — safe inside .map())
function getTypeAccentColor(
  type: AddType,
  theme: ReturnType<typeof useTheme>,
): string {
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
  fieldWrapper: {
    gap: 6,
  },
  label: {
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
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
  submitBtn: {
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitBtnLabel: {
    // Use light theme primaryForeground — submit buttons always have colored bg.
    color: nativeTheme.light.primaryForeground,
    fontSize: 14,
    fontWeight: "700",
  },
});
