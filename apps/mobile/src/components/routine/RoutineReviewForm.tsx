/**
 * RoutineReviewForm — the "Ny rutine" create form (mobile).
 *
 * Self-contained: starts empty and is filled either MANUALLY or via the
 * "Fyll fra bilde" button (photo → vision extract → prefilled fields).
 * The human always edits/confirms here before committing — this screen IS the
 * C4 review surface (ADR-0394). No separate capture step, no composer button.
 *
 * Fields: name, location (existing or new), steps (add/edit/remove).
 * onSubmit fires a CommitInput; source_reference is the photo storage path when
 * a photo was used, else "manual".
 */

import React, { useState, useCallback } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { X, Camera, Plus } from "lucide-react-native";
import { createStyles, useTheme } from "@/theme";
import type { CommitInput } from "@/hooks/use-routine-extract";
import { useRoutineExtract } from "@/hooks/use-routine-extract";
import { pickRoutineImage } from "@/lib/pick-routine-image";
import { uploadRoutineSource } from "@/lib/upload-routine-source";
import { getProfileContext } from "@/lib/profile-context";

type LocationOption = { location_id: string; name: string };
type Step = CommitInput["steps"][number];

const EMPTY_STEP: Step = { title: "", description: "", is_required: true, estimated_minutes: null };

export function RoutineReviewForm(props: {
  locations: LocationOption[];
  isWorking: boolean;
  onSubmit: (input: CommitInput) => void;
}) {
  const styles = useStyles();
  const theme = useTheme();
  const { locations } = props;
  const { extract } = useRoutineExtract();

  const [name, setName] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [newLocationName, setNewLocationName] = useState("");
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [triggerType, setTriggerType] = useState<"scheduled" | "event">("scheduled");
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>({});
  const [extractError, setExtractError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  const updateStep = (i: number, patch: Partial<Step>) =>
    setSteps((s) => s.map((step, idx) => (idx === i ? { ...step, ...patch } : step)));
  const removeStep = (i: number) => setSteps((s) => s.filter((_, idx) => idx !== i));
  const addStep = () => setSteps((s) => [...s, { ...EMPTY_STEP }]);

  // ── Photo → vision prefill ─────────────────────────────────────────────
  const handleFillFromImage = useCallback(async () => {
    setExtractError(null);
    const source = await pickRoutineImage();
    if (!source) return;
    setIsExtracting(true);
    try {
      const { workspaceId, profileId } = await getProfileContext();
      const path = await uploadRoutineSource(workspaceId, profileId, source);
      const draft = await extract(path);
      if (!draft) {
        setExtractError("Fant ingen oppgaver i bildet. Prøv et tydeligere bilde.");
        return;
      }
      // Prefill — operator can still edit everything.
      setStoragePath(path);
      setName(draft.routine_name);
      setSteps(draft.steps);
      setTriggerType(draft.trigger_guess.trigger_type);
      setTriggerConfig(draft.trigger_guess.trigger_config);
      const hintMatch = draft.location_hint
        ? locations.find((l) => l.name.toLowerCase().includes(draft.location_hint!.toLowerCase()))
        : undefined;
      if (hintMatch) {
        setLocationId(hintMatch.location_id);
        setNewLocationName("");
      }
    } catch (e) {
      setExtractError((e as Error).message);
    } finally {
      setIsExtracting(false);
    }
  }, [extract, locations]);

  const submit = () => {
    props.onSubmit({
      routine_name: name.trim(),
      trigger_type: triggerType,
      trigger_config: triggerConfig,
      location_id: locationId,
      new_location: !locationId && newLocationName.trim() ? { name: newLocationName.trim() } : null,
      team_ids: [],
      protocol_id: null,
      steps,
      source_reference: storagePath ?? "manual",
    });
  };

  const canSubmit =
    name.trim().length > 0 &&
    steps.length > 0 &&
    steps.every((s) => s.title.trim().length > 0) &&
    (locationId !== null || newLocationName.trim().length > 0) &&
    !isExtracting;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Fill from photo (the one button, top of the form) ───────── */}
      <Pressable
        onPress={handleFillFromImage}
        disabled={isExtracting}
        style={({ pressed }) => [styles.fillButton, pressed && styles.fillButtonPressed]}
        accessibilityRole="button"
        accessibilityLabel="Fyll rutinen fra et bilde av en sjekkliste"
      >
        {isExtracting ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : (
          <>
            <Camera size={18} color={theme.colors.primary} />
            <Text style={styles.fillButtonText}>Fyll fra bilde</Text>
          </>
        )}
      </Pressable>
      {extractError ? <Text style={styles.errorText}>{extractError}</Text> : null}

      {/* ── Name ────────────────────────────────────────────────── */}
      <Text style={styles.label}>Navn</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="F.eks. Åpningsrutine"
        placeholderTextColor={theme.colors.mutedForeground}
        accessibilityLabel="Rutinenavn"
        returnKeyType="done"
      />

      {/* ── Location picker ─────────────────────────────────────── */}
      <Text style={styles.label}>Lokasjon</Text>
      {locations.map((l) => (
        <Pressable
          key={l.location_id}
          onPress={() => {
            setLocationId(l.location_id);
            setNewLocationName("");
          }}
          style={[styles.option, locationId === l.location_id && styles.optionActive]}
          accessibilityRole="radio"
          accessibilityLabel={l.name}
          accessibilityState={{ selected: locationId === l.location_id }}
        >
          <Text style={styles.optionText}>{l.name}</Text>
        </Pressable>
      ))}
      <TextInput
        style={styles.input}
        value={newLocationName}
        onChangeText={(t) => {
          setNewLocationName(t);
          setLocationId(null);
        }}
        placeholder="+ Ny lokasjon"
        placeholderTextColor={theme.colors.mutedForeground}
        accessibilityLabel="Ny lokasjon"
        returnKeyType="done"
      />

      {/* ── Steps ───────────────────────────────────────────────── */}
      <Text style={styles.label}>{`Steg (${steps.length})`}</Text>
      {steps.map((s, i) => (
        <View key={i} style={styles.stepRow}>
          <TextInput
            style={styles.stepInput}
            value={s.title}
            onChangeText={(t) => updateStep(i, { title: t })}
            placeholder={`Steg ${i + 1}`}
            placeholderTextColor={theme.colors.mutedForeground}
            accessibilityLabel={`Steg ${i + 1} tittel`}
            returnKeyType="done"
          />
          <Pressable
            onPress={() => removeStep(i)}
            accessibilityLabel={`Fjern steg ${i + 1}`}
            accessibilityRole="button"
            hitSlop={8}
          >
            <X size={18} color={styles.removeColor.color} />
          </Pressable>
        </View>
      ))}
      <Pressable
        onPress={addStep}
        style={styles.addStep}
        accessibilityRole="button"
        accessibilityLabel="Legg til steg"
      >
        <Plus size={16} color={theme.colors.primary} />
        <Text style={styles.addStepText}>Legg til steg</Text>
      </Pressable>

      {/* ── Submit ──────────────────────────────────────────────── */}
      <Pressable
        disabled={!canSubmit || props.isWorking}
        onPress={submit}
        style={[styles.submit, (!canSubmit || props.isWorking) && styles.submitDisabled]}
        accessibilityRole="button"
        accessibilityLabel="Opprett rutine"
      >
        <Text style={styles.submitText}>{props.isWorking ? "Oppretter…" : "Opprett rutine"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const useStyles = createStyles((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, gap: 8 },
  fillButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.muted,
    minHeight: 48,
  },
  fillButtonPressed: { opacity: 0.7 },
  fillButtonText: { color: theme.colors.primary, fontWeight: "600" },
  errorText: { color: theme.colors.destructive, fontSize: 13 },
  label: { fontSize: 13, color: theme.colors.mutedForeground, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    color: theme.colors.foreground,
  },
  option: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border },
  optionActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.muted },
  optionText: { color: theme.colors.foreground },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 10,
    color: theme.colors.foreground,
  },
  addStep: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10 },
  addStepText: { color: theme.colors.primary, fontWeight: "500" },
  removeColor: { color: theme.colors.destructive },
  submit: {
    marginTop: 24,
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: theme.colors.primaryForeground, fontWeight: "600" },
}));
