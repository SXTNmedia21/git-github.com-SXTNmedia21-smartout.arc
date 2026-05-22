/**
 * RoutineReviewForm — the "Ny rutine" create form (mobile, dark-aware).
 *
 * Self-contained: starts empty, filled MANUALLY or via "Fyll fra bilde"
 * (photo → vision extract → prefill). This screen IS the C4 review/confirm
 * surface (ADR-0394). Built from token-based primitives (Input, Button, Dropdown)
 * + chip multi-select — no hardcoded colors, works in light + dark.
 *
 * Fields: name, location (Dropdown or new), teams (multi-select), Fra/Til time
 * (HH:MM validated), steps (add/edit/remove). onSubmit fires a CommitInput;
 * source_reference is the photo storage path when a photo was used, else "manual".
 */

import React, { useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { X, Camera, Plus } from "lucide-react-native";
import { createStyles, useTheme } from "@/theme";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import type { CommitInput } from "@/hooks/use-routine-extract";
import { useRoutineExtract } from "@/hooks/use-routine-extract";
import { pickRoutineImage } from "@/lib/pick-routine-image";
import { uploadRoutineSource } from "@/lib/upload-routine-source";
import { getProfileContext } from "@/lib/profile-context";
import { TIME_OPTIONS_15 } from "@/lib/time-options";

export type LocationOption = { location_id: string; name: string };
export type TeamOption = { team_id: string; name: string };
type Step = CommitInput["steps"][number];

const EMPTY_STEP: Step = { title: "", description: "", is_required: true, estimated_minutes: null };

export function RoutineReviewForm(props: {
  locations: LocationOption[];
  teams: TeamOption[];
  isWorking: boolean;
  onSubmit: (input: CommitInput) => void;
}) {
  const styles = useStyles();
  const theme = useTheme();
  const { locations, teams } = props;
  const { extract } = useRoutineExtract();

  const [name, setName] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [newLocationName, setNewLocationName] = useState("");
  const [creatingLocation, setCreatingLocation] = useState(false);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  const updateStep = (i: number, patch: Partial<Step>) =>
    setSteps((s) => s.map((step, idx) => (idx === i ? { ...step, ...patch } : step)));
  const removeStep = (i: number) => setSteps((s) => s.filter((_, idx) => idx !== i));
  const addStep = () => setSteps((s) => [...s, { ...EMPTY_STEP }]);
  const toggleTeam = (id: string) =>
    setTeamIds((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));

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
      setStoragePath(path);
      setName(draft.routine_name);
      setSteps(draft.steps);
      const cfg = draft.trigger_guess.trigger_config as { start_time?: string; times?: string[] };
      if (typeof cfg.start_time === "string") setStartTime(cfg.start_time);
      else if (Array.isArray(cfg.times) && typeof cfg.times[0] === "string")
        setStartTime(cfg.times[0]);
      const hintMatch = draft.location_hint
        ? locations.find((l) => l.name.toLowerCase().includes(draft.location_hint!.toLowerCase()))
        : undefined;
      if (hintMatch) {
        setLocationId(hintMatch.location_id);
        setCreatingLocation(false);
        setNewLocationName("");
      }
    } catch (e) {
      setExtractError((e as Error).message);
    } finally {
      setIsExtracting(false);
    }
  }, [extract, locations]);

  const submit = () => {
    const trigger_config: Record<string, unknown> = {};
    if (startTime) trigger_config.start_time = startTime;
    if (endTime) trigger_config.end_time = endTime;
    props.onSubmit({
      routine_name: name.trim(),
      trigger_type: "scheduled",
      trigger_config,
      location_id: locationId,
      new_location: !locationId && newLocationName.trim() ? { name: newLocationName.trim() } : null,
      team_ids: teamIds,
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

  const locationOptions = locations.map((l) => ({ value: l.location_id, label: l.name }));

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Fill from photo ─────────────────────────────────────── */}
      <Button
        title={isExtracting ? "Leser bilde…" : "Fyll fra bilde"}
        variant="secondary"
        loading={isExtracting}
        fullWidth
        onPress={handleFillFromImage}
        accessibilityLabel="Fyll rutinen fra et bilde av en sjekkliste"
      />
      {!isExtracting ? (
        <View style={styles.fillHint}>
          <Camera size={14} color={theme.colors.mutedForeground} />
          <Text style={styles.fillHintText}>Ta bilde av en sjekkliste, så fylles feltene ut.</Text>
        </View>
      ) : null}
      {extractError ? <Text style={styles.errorText}>{extractError}</Text> : null}

      {/* ── Name ─────────────────────────────────────────────────── */}
      <Input
        label="Navn"
        value={name}
        onChangeText={setName}
        placeholder="F.eks. Åpningsrutine"
        returnKeyType="done"
      />

      {/* ── Location (dropdown, with inline "+ Ny lokasjon") ─────── */}
      <Dropdown
        label="Lokasjon"
        options={locationOptions}
        value={locationId}
        onChange={(v) => {
          setLocationId(v);
          setCreatingLocation(false);
          setNewLocationName("");
        }}
        placeholder="Velg lokasjon"
        creatable
        creating={creatingLocation}
        createValue={newLocationName}
        createOptionLabel="+ Ny lokasjon"
        createPlaceholder="Navn på ny lokasjon"
        onStartCreate={() => {
          setCreatingLocation(true);
          setLocationId(null);
        }}
        onCreateValueChange={setNewLocationName}
        onCancelCreate={() => {
          setCreatingLocation(false);
          setNewLocationName("");
        }}
      />

      {/* ── Teams (multi-select) ─────────────────────────────────── */}
      <Text
        style={styles.label}
      >{`Team ${teamIds.length > 0 ? `(${teamIds.length})` : "(valgfritt)"}`}</Text>
      <View style={styles.chipRow}>
        {teams.length === 0 ? (
          <Text style={styles.muted}>Ingen team</Text>
        ) : (
          teams.map((t) => {
            const sel = teamIds.includes(t.team_id);
            return (
              <Pressable
                key={t.team_id}
                onPress={() => toggleTeam(t.team_id)}
                style={[styles.chip, sel && styles.chipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: sel }}
                accessibilityLabel={t.name}
              >
                <Text style={[styles.chipText, sel && styles.chipTextActive]}>{t.name}</Text>
              </Pressable>
            );
          })
        )}
      </View>

      {/* ── Time window (valid-by-construction dropdowns) ────────── */}
      <View style={styles.timeRow}>
        <View style={styles.timeCol}>
          <Dropdown
            label="Fra"
            options={TIME_OPTIONS_15}
            value={startTime || null}
            onChange={setStartTime}
            placeholder="Velg tid"
          />
        </View>
        <View style={styles.timeCol}>
          <Dropdown
            label="Til"
            options={TIME_OPTIONS_15}
            value={endTime || null}
            onChange={setEndTime}
            placeholder="Velg tid"
          />
        </View>
      </View>

      {/* ── Steps ────────────────────────────────────────────────── */}
      <Text style={styles.label}>{`Steg (${steps.length})`}</Text>
      {steps.map((s, i) => (
        <View key={i} style={styles.stepRow}>
          <View style={styles.stepInput}>
            <Input
              value={s.title}
              onChangeText={(t) => updateStep(i, { title: t })}
              placeholder={`Steg ${i + 1}`}
              returnKeyType="done"
            />
          </View>
          <Pressable
            onPress={() => removeStep(i)}
            accessibilityLabel={`Fjern steg ${i + 1}`}
            accessibilityRole="button"
            hitSlop={8}
            style={styles.removeBtn}
          >
            <X size={18} color={theme.colors.destructive} />
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

      {/* ── Submit ───────────────────────────────────────────────── */}
      <Button
        title={props.isWorking ? "Oppretter…" : "Opprett rutine"}
        variant="primary"
        loading={props.isWorking}
        disabled={!canSubmit}
        fullWidth
        onPress={submit}
        style={styles.submit}
        accessibilityLabel="Opprett rutine"
      />
    </ScrollView>
  );
}

const useStyles = createStyles((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.card, gap: theme.spacing.element },
  fillHint: { flexDirection: "row", alignItems: "center", gap: theme.spacing.tight },
  fillHintText: { ...theme.typography.caption, color: theme.colors.mutedForeground, flex: 1 },
  errorText: { ...theme.typography.caption, color: theme.colors.destructive },
  label: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.foreground,
  },
  muted: { ...theme.typography.caption, color: theme.colors.mutedForeground },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.tight },
  chip: {
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.tight,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.secondary,
  },
  chipActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.muted },
  chipText: { ...theme.typography.caption, color: theme.colors.mutedForeground },
  chipTextActive: { color: theme.colors.primary, fontWeight: theme.fontWeights.medium },
  timeRow: { flexDirection: "row", gap: theme.spacing.element },
  timeCol: { flex: 1 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.tight },
  stepInput: { flex: 1 },
  removeBtn: { padding: theme.spacing.tight },
  addStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.tight,
    paddingVertical: theme.spacing.tight,
  },
  addStepText: {
    ...theme.typography.body,
    color: theme.colors.primary,
    fontWeight: theme.fontWeights.medium,
  },
  submit: { marginTop: theme.spacing.element },
}));
