/**
 * ResolveSheet — bottom sheet with resolution note form (Spec §3.4).
 *
 * Phase 4 polish: typography aligned with the prototype — Instrument Serif
 * title, Geist body, Geist Mono for the max-length hint. Behaviour and
 * props unchanged.
 */

import * as React from "react";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import * as Haptics from "expo-haptics";
import { createStyles, useTheme } from "@/theme";
import { useTranslation } from "@smartout/i18n";

export type ResolveSheetHandle = {
  open: () => void;
  close: () => void;
};

export type ResolveSheetProps = {
  requesterName: string;
  pending: boolean;
  onSubmit: (resolutionNote: string) => void;
  onDismiss?: () => void;
};

export const ResolveSheet = React.forwardRef<ResolveSheetHandle, ResolveSheetProps>(
  function ResolveSheet({ requesterName, pending, onSubmit, onDismiss }, ref) {
    const { t } = useTranslation("helpdesk");
    const theme = useTheme();
    const styles = useStyles();
    const sheetRef = React.useRef<BottomSheet>(null);
    const [note, setNote] = useState("");

    React.useImperativeHandle(ref, () => ({
      open: () => sheetRef.current?.snapToIndex(0),
      close: () => sheetRef.current?.close(),
    }));

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.35} />
      ),
      [],
    );

    return (
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={["40%", "70%"]}
        enablePanDownToClose
        onClose={onDismiss}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: theme.colors.background }}
        handleIndicatorStyle={{ backgroundColor: theme.colors.border }}
      >
        <BottomSheetView style={styles.content}>
          <Text style={styles.title}>{t("ticket_resolve_dialog.title")}</Text>
          <Text style={styles.lede}>
            {t("ticket_resolve_dialog.lede", { name: "Du", requester: requesterName })}
          </Text>

          <Text style={styles.fieldLabel}>{t("ticket_resolve_dialog.field_label")}</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={t("ticket_resolve_dialog.field_placeholder")}
            placeholderTextColor={theme.colors.mutedForeground}
            multiline
            numberOfLines={4}
            maxLength={280}
            style={styles.input}
            editable={!pending}
            textAlignVertical="top"
          />

          <Pressable
            onPress={() => {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onSubmit(note.trim());
            }}
            disabled={pending}
            accessibilityRole="button"
            accessibilityLabel={t("ticket_resolve_dialog.submit")}
            style={[styles.submit, pending && styles.submitDisabled]}
          >
            <Text style={styles.submitLabel}>
              {pending ? t("ticket_action.resolve_pending") : t("ticket_resolve_dialog.submit")}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => sheetRef.current?.close()}
            disabled={pending}
            style={styles.cancel}
          >
            <Text style={styles.cancelLabel}>{t("desk_dialog.cancel")}</Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheet>
    );
  },
);

const useStyles = createStyles((theme) => ({
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
  },
  title: {
    fontFamily: "InstrumentSerif-Regular",
    fontSize: 22,
    lineHeight: 26,
    color: theme.colors.foreground,
  },
  lede: {
    fontFamily: "Geist-Regular",
    fontSize: 14,
    color: theme.colors.mutedForeground,
    marginTop: 6,
  },
  fieldLabel: {
    fontFamily: "Geist-Medium",
    fontSize: 13,
    color: theme.colors.foreground,
    marginTop: 20,
    marginBottom: 8,
  },
  input: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    fontFamily: "Geist-Regular",
    fontSize: 15,
    color: theme.colors.foreground,
    backgroundColor: theme.colors.card,
  },
  submit: {
    marginTop: 20,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.foreground,
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitLabel: {
    fontFamily: "Geist-Medium",
    fontSize: 15,
    color: theme.colors.background,
  },
  cancel: {
    marginTop: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  cancelLabel: {
    fontFamily: "Geist-Regular",
    fontSize: 14,
    color: theme.colors.mutedForeground,
  },
}));
