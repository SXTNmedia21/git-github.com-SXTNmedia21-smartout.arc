/**
 * NoteSheet — Bottom-drawer for adding a shift note.
 *
 * Triggered from the in-shift 2x2 action grid ("Notat"). Wraps the shared
 * BottomSheet primitive with a multiline TextInput and Save/Cancel actions.
 * Submits via useSubmitNote (offline-queue + emit). Closes on success.
 */

import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, Keyboard } from "react-native";
import type GorhomBottomSheet from "@gorhom/bottom-sheet";
import * as Haptics from "expo-haptics";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { useSubmitNote } from "@/hooks/mutations/use-submit-note";

export type NoteSheetRef = {
  open: () => void;
  close: () => void;
};

type NoteSheetProps = {
  /** department_session_id the note attaches to */
  sessionId: string | null;
};

export const NoteSheet = forwardRef<NoteSheetRef, NoteSheetProps>(function NoteSheet(
  { sessionId },
  ref,
) {
  const styles = useStyles();
  const theme = useTheme();
  const sheetRef = useRef<GorhomBottomSheet>(null);
  const { submitNote, isSubmitting } = useSubmitNote();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      open: () => {
        setError(null);
        sheetRef.current?.snapToIndex(0);
      },
      close: () => sheetRef.current?.close(),
    }),
    [],
  );

  const handleSave = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!sessionId) {
      setError("Ingen aktiv vakt — kan ikke lagre notat.");
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await submitNote({ department_session_id: sessionId, content: trimmed });
      Keyboard.dismiss();
      setText("");
      sheetRef.current?.close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke lagre notat.");
    }
  }, [text, sessionId, submitNote]);

  const handleCancel = useCallback(() => {
    Keyboard.dismiss();
    setText("");
    sheetRef.current?.close();
  }, []);

  return (
    <BottomSheet ref={sheetRef} snapPoints={["50%"]} index={-1} keyboardBehavior="interactive">
      <View style={styles.container}>
        <Text style={styles.title}>Nytt notat</Text>
        <Text style={styles.subtitle}>Synlig for leder + neste skift.</Text>

        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Hva skjedde? Hva må neste skift vite?"
          placeholderTextColor={withOpacity(theme.colors.mutedForeground, 0.5)}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          autoFocus
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          <Pressable
            onPress={handleCancel}
            style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Avbryt"
          >
            <Text style={styles.btnGhostText}>Avbryt</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={!text.trim() || isSubmitting}
            style={({ pressed }) => [
              styles.btnPrimary,
              { backgroundColor: theme.colors.brandOrange },
              pressed && styles.pressed,
              (!text.trim() || isSubmitting) && styles.btnDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Lagre notat"
          >
            <Text style={styles.btnPrimaryText}>{isSubmitting ? "Lagrer..." : "Lagre"}</Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
});

const useStyles = createStyles((theme) => ({
  container: {
    padding: 4,
    gap: 8,
  },
  title: {
    fontFamily: "InstrumentSerif-Regular",
    fontSize: 24,
    letterSpacing: -0.4,
    color: theme.colors.foreground,
  },
  subtitle: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
    marginBottom: 8,
  },
  input: {
    fontSize: 15,
    color: theme.colors.foreground,
    backgroundColor: theme.colors.secondary,
    borderRadius: 12,
    padding: 14,
    minHeight: 120,
    lineHeight: 22,
  },
  error: {
    fontSize: 12,
    color: theme.colors.destructive,
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  btnGhost: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.6),
    alignItems: "center",
    justifyContent: "center",
  },
  btnGhostText: { fontSize: 14, fontWeight: "600", color: theme.colors.foreground },
  btnPrimary: {
    flex: 2,
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: { fontSize: 15, fontWeight: "700", letterSpacing: 0.4, color: "#ffffff" },
  btnDisabled: { opacity: 0.5 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
}));
