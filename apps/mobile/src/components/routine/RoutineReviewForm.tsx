/**
 * RoutineReviewForm — editable form for reviewing an extracted routine draft.
 *
 * Lets the operator verify/edit the AI-extracted name, steps, and location
 * before committing the routine. Supports picking an existing location or
 * entering a new one. Remove-step control uses the X icon from lucide-react-native.
 *
 * Receives: draft (RoutineDraft), storagePath, locations, isWorking, onSubmit.
 * Calls onSubmit with a CommitInput when the operator confirms.
 */

import React, { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { X } from "lucide-react-native";
import { createStyles } from "@/theme";
import type { RoutineDraft, CommitInput } from "@/hooks/use-routine-extract";

type LocationOption = { location_id: string; name: string };

export function RoutineReviewForm(props: {
  draft: RoutineDraft;
  storagePath: string;
  locations: LocationOption[];
  isWorking: boolean;
  onSubmit: (input: CommitInput) => void;
}) {
  const styles = useStyles();
  const { draft, storagePath, locations } = props;
  const [name, setName] = useState(draft.routine_name);
  const [steps, setSteps] = useState(draft.steps);

  // Pre-select a location if the draft's location_hint fuzzy-matches an existing one.
  const prefill = locations.find((l) =>
    draft.location_hint ? l.name.toLowerCase().includes(draft.location_hint.toLowerCase()) : false,
  );
  const [locationId, setLocationId] = useState<string | null>(prefill?.location_id ?? null);
  const [newLocationName, setNewLocationName] = useState("");

  const updateStep = (i: number, patch: Partial<RoutineDraft["steps"][number]>) =>
    setSteps((s) => s.map((step, idx) => (idx === i ? { ...step, ...patch } : step)));

  const removeStep = (i: number) => setSteps((s) => s.filter((_, idx) => idx !== i));

  const submit = () => {
    props.onSubmit({
      routine_name: name,
      trigger_type: draft.trigger_guess.trigger_type,
      trigger_config: draft.trigger_guess.trigger_config,
      location_id: locationId,
      new_location: !locationId && newLocationName.trim() ? { name: newLocationName.trim() } : null,
      team_ids: [],
      protocol_id: null,
      steps,
      source_reference: storagePath,
    });
  };

  const canSubmit =
    name.trim().length > 0 &&
    steps.length > 0 &&
    (locationId !== null || newLocationName.trim().length > 0);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Name ────────────────────────────────────────────────── */}
      <Text style={styles.label}>Navn</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
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
  label: {
    fontSize: 13,
    color: theme.colors.mutedForeground,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    color: theme.colors.foreground,
  },
  option: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  optionActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.muted,
  },
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
  // Used only to extract the destructive color for the X icon prop.
  removeColor: { color: theme.colors.destructive },
  submit: {
    marginTop: 24,
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
  },
  submitDisabled: { opacity: 0.5 },
  submitText: {
    color: theme.colors.primaryForeground,
    fontWeight: "600",
  },
}));
