/**
 * RoutineReviewScreen — full-screen review and editing of an AI-extracted routine draft.
 *
 * Navigated to from BotssonSheet when a routineDraft is staged in BotssonProvider.
 * Loads active locations from Supabase, renders RoutineReviewForm, then calls
 * useRoutineExtract().commit on confirmation and navigates back on success.
 *
 * Registered as a hidden Tabs.Screen (href: null) — reachable via router.push only.
 */

import React, { useEffect, useState } from "react";
import { View, Text, SafeAreaView } from "react-native";
import { useRouter } from "expo-router";
import { RoutineReviewForm } from "@/components/routine/RoutineReviewForm";
import { useBotsson } from "@/providers/botsson-provider";
import { useRoutineExtract, type CommitInput } from "@/hooks/use-routine-extract";
import { supabase } from "@/lib/supabase";

type LocationRow = { location_id: string; name: string };

export default function RoutineReviewScreen() {
  const router = useRouter();
  const { routineDraft, setRoutineDraft } = useBotsson();
  const { commit, isWorking } = useRoutineExtract();
  const [locations, setLocations] = useState<LocationRow[]>([]);

  useEffect(() => {
    supabase
      .from("location")
      .select("location_id, name")
      .eq("is_active", true)
      .then(({ data }) => setLocations(data ?? []));
  }, []);

  if (!routineDraft) {
    return (
      <SafeAreaView>
        <View style={{ padding: 24 }}>
          <Text>Ingen utkast.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const onSubmit = async (input: CommitInput) => {
    const routineId = await commit(input);
    if (routineId) {
      setRoutineDraft(null);
      router.back();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <RoutineReviewForm
        draft={routineDraft.draft}
        storagePath={routineDraft.storagePath}
        locations={locations}
        isWorking={isWorking}
        onSubmit={onSubmit}
      />
    </SafeAreaView>
  );
}
