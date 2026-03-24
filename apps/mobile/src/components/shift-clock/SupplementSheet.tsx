/**
 * SupplementSheet — Bottom sheet to register manual wage supplements during a shift.
 * Opened from ShiftClock actions; requires BottomSheetModalProvider (see app (app) layout).
 */
import React, { useCallback, forwardRef } from "react";
import type { ComponentProps } from "react";
import { View, Text } from "react-native";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { createStyles } from "@/theme";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type BottomSheetBackdropProps = ComponentProps<typeof BottomSheetBackdrop>;

export const SupplementSheet = forwardRef<BottomSheetModal>((_props, ref) => {
  const styles = useStyles();

  const snapPoints = ["50%", "80%"];

  const renderBackdrop = useCallback(
    (backdropProps: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...backdropProps}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.4}
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Registrer Tillegg</Text>
        <Text style={styles.subtitle}>
          Velg manuelt tillegg fra listen. Kommentar er påkrevd for godkjenning av leder.
        </Text>

        {/* Dummy list for UI demonstration */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Smusstillegg</Text>
            <Text style={styles.cardAmount}>+ 50 kr</Text>
          </View>
          <Text style={styles.cardDesc}>Opprydding av spesielt grisete områder</Text>

          <View style={styles.inputContainer}>
            <Input placeholder="Beskriv hendelsen (påkrevd)..." multiline numberOfLines={3} />
          </View>

          <Button title="Registrer" variant="primary" style={styles.submitBtn} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Ubekvem arbeidstid</Text>
            <Text style={styles.cardAmount}>+ 120 kr/t</Text>
          </View>
          <Text style={styles.cardDesc}>Vaktforlengelse over natten</Text>

          <View style={styles.inputContainer}>
            <Input placeholder="Beskriv hendelsen (påkrevd)..." multiline numberOfLines={3} />
          </View>

          <Button title="Registrer" variant="primary" style={styles.submitBtn} />
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

SupplementSheet.displayName = "SupplementSheet";

const useStyles = createStyles((theme) => ({
  sheetBackground: {
    backgroundColor: theme.colors.background,
  },
  handleIndicator: {
    backgroundColor: theme.colors.mutedForeground,
    width: 40,
  },
  content: {
    padding: theme.spacing.page,
    paddingBottom: theme.spacing.xl * 2,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.foreground,
    marginBottom: theme.spacing.xxs,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
    marginBottom: theme.spacing.section,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.element,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.xxs,
  },
  cardTitle: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
  },
  cardAmount: {
    ...theme.typography.headline,
    color: theme.colors.success,
  },
  cardDesc: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    marginBottom: theme.spacing.element,
  },
  inputContainer: {
    marginBottom: theme.spacing.element,
  },
  submitBtn: {
    marginTop: theme.spacing.xs,
  },
}));
