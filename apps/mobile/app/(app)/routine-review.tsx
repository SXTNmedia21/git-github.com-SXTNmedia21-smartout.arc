/**
 * "Ny rutine" screen — create a routine, optionally filled from a photo.
 *
 * Self-contained: opens empty. The operator fills it manually OR taps
 * "Fyll fra bilde" inside the form (photo → vision extract → prefill). This screen
 * IS the C4 review/confirm surface (ADR-0394). Reached from the AddSheet "Ny rutine"
 * action; registered as a hidden screen (router.push only — not a tab, ADR-0268).
 */

import React, { useEffect, useState, useCallback } from "react";
import { View, Text, Pressable, SafeAreaView, StyleSheet } from "react-native";
import { X } from "lucide-react-native";
import { useRouter } from "expo-router";
import { createStyles, useTheme } from "@/theme";
import { RoutineReviewForm } from "@/components/routine/RoutineReviewForm";
import { useRoutineExtract, type CommitInput } from "@/hooks/use-routine-extract";
import { supabase } from "@/lib/supabase";

type LocationRow = { location_id: string; name: string };
type TeamRow = { team_id: string; name: string };

export default function RoutineReviewScreen() {
  const router = useRouter();
  const styles = useStyles();
  const theme = useTheme();
  const { commit, isWorking, error } = useRoutineExtract();
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);

  useEffect(() => {
    supabase
      .from("location")
      .select("location_id, name")
      .eq("is_active", true)
      .then(({ data }) => setLocations(data ?? []));
    supabase
      .from("team")
      .select("team_id, name")
      .then(({ data }) => setTeams(data ?? []));
  }, []);

  const onSubmit = useCallback(
    async (input: CommitInput) => {
      const routineId = await commit(input);
      if (routineId) router.back();
    },
    [commit, router],
  );

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Ny rutine</Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Lukk"
        >
          <X size={22} color={theme.colors.foreground} />
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <RoutineReviewForm
        locations={locations}
        teams={teams}
        isWorking={isWorking}
        onSubmit={onSubmit}
      />
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  title: { ...theme.typography.headline, color: theme.colors.foreground },
  error: { color: theme.colors.destructive, paddingHorizontal: 16, paddingTop: 8, fontSize: 13 },
}));
