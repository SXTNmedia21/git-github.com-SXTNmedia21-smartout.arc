/**
 * Edit Profile Screen — Change avatar and display name.
 *
 * - Tap avatar to pick image from library (expo-image-picker)
 * - Upload to Supabase Storage (avatars bucket, user folder)
 * - Update profile.avatar_url and profile.display_name
 * - Optimistic update on the my-profile query cache
 */

import React, { useState, useCallback } from "react";
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { ChevronLeft, Camera, Check } from "lucide-react-native";
import { createStyles } from "@/theme";
import { Avatar } from "@/components/common/Avatar";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { supabase } from "@/lib/supabase";
import type { Database } from "@smartout/supabase/database.types";

type Profile = Database["public"]["Tables"]["profile"]["Row"];

export default function EditProfileScreen() {
  const styles = useStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: profile } = useMyProfile();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const currentAvatarUrl = avatarUri ?? profile?.avatar_url ?? null;
  const hasChanges = displayName !== (profile?.display_name ?? "") || avatarUri !== null;

  const pickImage = useCallback(async () => {
    Haptics.selectionAsync();

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Tilgang nektet",
        "Vi trenger tilgang til bildegalleriet for a endre profilbild.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!profile || !hasChanges) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let newAvatarUrl = profile.avatar_url;

      // Upload new avatar if selected
      if (avatarUri) {
        const ext = avatarUri.split(".").pop()?.toLowerCase() ?? "jpg";
        const fileName = `${user.id}/avatar.${ext}`;

        // Fetch the image as a blob
        const response = await fetch(avatarUri);
        const blob = await response.blob();

        // Convert blob to ArrayBuffer for Supabase upload
        const arrayBuffer = await new Response(blob).arrayBuffer();

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(fileName, arrayBuffer, {
            contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
            upsert: true,
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(fileName);

        newAvatarUrl = urlData.publicUrl;
      }

      // Update profile
      const updates: Partial<Profile> = {};
      if (displayName !== profile.display_name) {
        updates.display_name = displayName.trim();
      }
      if (newAvatarUrl !== profile.avatar_url) {
        updates.avatar_url = newAvatarUrl;
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from("profile")
          .update(updates)
          .eq("profile_id", profile.profile_id);

        if (updateError) throw updateError;

        // Optimistic cache update
        queryClient.setQueryData<Profile>(["my-profile"], (old) =>
          old ? { ...old, ...updates } : old,
        );
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ukjent feil";
      Alert.alert("Feil", `Kunne ikke lagre: ${message}`);
    } finally {
      setSaving(false);
    }
  }, [profile, hasChanges, avatarUri, displayName, queryClient, router]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          hitSlop={12}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Tilbake"
        >
          <ChevronLeft size={28} color={styles.foregroundColor.color} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>Rediger profil</Text>
        <View style={styles.headerRight}>
          {saving ? (
            <ActivityIndicator size="small" color={styles.brandColor.color} />
          ) : hasChanges ? (
            <Pressable
              onPress={handleSave}
              style={styles.saveButton}
              accessibilityRole="button"
              accessibilityLabel="Lagre"
            >
              <Check size={22} color={styles.brandColor.color} strokeWidth={2.5} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Avatar picker */}
      <Animated.View
        entering={FadeInDown.delay(100).duration(400).springify()}
        style={styles.avatarSection}
      >
        <Pressable
          onPress={pickImage}
          style={styles.avatarPressable}
          accessibilityRole="button"
          accessibilityLabel="Endre profilbilde"
        >
          <View style={styles.avatarRing}>
            <Avatar
              name={displayName || profile?.display_name || "?"}
              imageUrl={currentAvatarUrl}
              size="xl"
            />
          </View>
          <View style={styles.cameraOverlay}>
            <Camera size={16} color={styles.primaryForegroundColor.color} strokeWidth={2} />
          </View>
        </Pressable>
        <Text style={styles.changePhotoText}>Trykk for a endre bilde</Text>
      </Animated.View>

      {/* Name input */}
      <Animated.View
        entering={FadeInUp.delay(200).duration(400).springify()}
        style={styles.fieldSection}
      >
        <Text style={styles.fieldLabel}>Navn</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Ditt navn"
          placeholderTextColor={styles.placeholderColor.color}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
        />
      </Animated.View>

      {/* Info fields (read-only) */}
      <Animated.View
        entering={FadeInUp.delay(300).duration(400).springify()}
        style={styles.fieldSection}
      >
        <Text style={styles.fieldLabel}>Rolle</Text>
        <View style={styles.readOnlyField}>
          <Text style={styles.readOnlyText}>{profile?.role ?? "—"}</Text>
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(400).duration(400).springify()}
        style={styles.fieldSection}
      >
        <Text style={styles.fieldLabel}>Avdeling</Text>
        {/* TODO: profile has department_id but no department name — needs a join to the
            department table (department.name) to show the actual department name here.
            Showing job_title as a placeholder until that join is added. */}
        <View style={styles.readOnlyField}>
          <Text style={styles.readOnlyText}>{profile?.job_title ?? "—"}</Text>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.tight,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
    flex: 1,
  },
  headerRight: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  foregroundColor: {
    color: theme.colors.foreground,
  },
  brandColor: {
    color: theme.colors.brandOrange,
  },
  placeholderColor: {
    color: theme.colors.mutedForeground,
  },
  primaryForegroundColor: {
    color: theme.colors.primaryForeground,
  },

  /* Avatar */
  avatarSection: {
    alignItems: "center",
    paddingVertical: theme.spacing.section,
    gap: theme.spacing.element,
  },
  avatarPressable: {
    position: "relative",
  },
  avatarRing: {
    padding: 3,
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: theme.colors.brandOrange,
  },
  cameraOverlay: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.brandOrange,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  changePhotoText: {
    ...theme.typography.caption,
    color: theme.colors.brandOrange,
    fontWeight: theme.fontWeights.medium,
  },

  /* Fields */
  fieldSection: {
    paddingHorizontal: theme.spacing.card,
    marginBottom: theme.spacing.section,
  },
  fieldLabel: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    fontWeight: theme.fontWeights.medium,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: theme.spacing.tight,
  },
  input: {
    ...theme.typography.body,
    color: theme.colors.foreground,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.element,
    minHeight: 48,
  },
  readOnlyField: {
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.element,
    minHeight: 48,
    justifyContent: "center",
    opacity: 0.6,
  },
  readOnlyText: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
  },
}));
