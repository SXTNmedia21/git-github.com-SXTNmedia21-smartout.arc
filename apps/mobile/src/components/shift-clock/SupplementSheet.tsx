/**
 * SupplementSheet — Bottom sheet for claiming manual wage supplements.
 *
 * Uses @gorhom/bottom-sheet for the slide-up panel. Lists available supplement
 * rules, allows claiming with optional comment. Already-claimed supplements
 * show a green checkmark.
 *
 * Mirrors the web SupplementSheet but adapted for native bottom sheet pattern.
 */

import React, { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from "@gorhom/bottom-sheet";
import * as Haptics from "expo-haptics";
import { Coins, Check, AlertCircle, ChevronLeft } from "lucide-react-native";

import { createStyles } from "@/theme";

type SupplementOption = {
  id: string;
  name: string;
  description: string;
  amount: number;
  rateType: "per_hour" | "per_shift";
  salaryCode?: string | null;
  commentRequired?: boolean;
};

type SupplementSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  availableSupplements: SupplementOption[];
  claimedSupplementRuleIds: Set<string>;
  onClaim: (supplementRuleId: string, comment?: string) => Promise<unknown>;
  isLoading?: boolean;
};

export function SupplementSheet({
  isOpen,
  onClose,
  availableSupplements,
  claimedSupplementRuleIds,
  onClaim,
  isLoading = false,
}: SupplementSheetProps) {
  const styles = useStyles();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  const snapPoints = useMemo(() => ["55%", "80%"], []);

  const selectedSupplement = availableSupplements.find((s) => s.id === selectedId);

  const handleSheetChanges = useCallback(
    (index: number) => {
      if (index === -1) {
        onClose();
        setSelectedId(null);
        setComment("");
      }
    },
    [onClose],
  );

  const handleClaim = useCallback(async () => {
    if (!selectedId) return;
    try {
      await onClaim(selectedId, comment.trim() || undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelectedId(null);
      setComment("");
    } catch {
      // Error handled by hook
    }
  }, [selectedId, comment, onClaim]);

  const handleBack = useCallback(() => {
    setSelectedId(null);
    setComment("");
  }, []);

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
    ),
    [],
  );

  if (!isOpen) return null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose
      onChange={handleSheetChanges}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.sheetContent}
      >
        {/* Header */}
        <View style={styles.header}>
          {selectedId && (
            <Pressable onPress={handleBack} hitSlop={12} style={styles.backBtn}>
              <ChevronLeft size={20} color={styles.iconColor.color} strokeWidth={2} />
            </Pressable>
          )}
          <Text style={styles.headerTitle}>
            {selectedSupplement ? selectedSupplement.name : "Tillegg"}
          </Text>
        </View>
        <Text style={styles.headerDescription}>
          {selectedSupplement
            ? "Bekreft registrering av tillegget"
            : "Velg tillegget du vil registrere"}
        </Text>

        <BottomSheetScrollView contentContainerStyle={styles.listContent}>
          {/* List view */}
          {!selectedId && (
            <>
              {availableSupplements.length === 0 && (
                <View style={styles.emptyState}>
                  <AlertCircle size={32} color={styles.mutedColor.color} strokeWidth={1.5} />
                  <Text style={styles.emptyText}>Ingen tillegg tilgjengelig</Text>
                </View>
              )}

              {availableSupplements.map((supplement) => {
                const isClaimed = claimedSupplementRuleIds.has(supplement.id);

                return (
                  <Pressable
                    key={supplement.id}
                    onPress={() => {
                      if (!isClaimed) {
                        Haptics.selectionAsync();
                        setSelectedId(supplement.id);
                      }
                    }}
                    disabled={isClaimed || isLoading}
                    style={({ pressed }) => [
                      styles.supplementItem,
                      pressed && !isClaimed && styles.supplementItemPressed,
                      (isClaimed || isLoading) && styles.supplementItemDisabled,
                    ]}
                  >
                    <View style={styles.supplementLeft}>
                      <View style={styles.supplementNameRow}>
                        <Text style={styles.supplementName}>{supplement.name}</Text>
                        {isClaimed && <Check size={16} color="#34d399" strokeWidth={2.5} />}
                      </View>
                      <Text style={styles.supplementDesc}>{supplement.description}</Text>
                    </View>
                    <View style={styles.supplementRight}>
                      <Text style={styles.supplementAmount}>{supplement.amount} kr</Text>
                      <Text style={styles.supplementRate}>
                        {supplement.rateType === "per_hour" ? "/time" : "/vakt"}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </>
          )}

          {/* Confirmation view */}
          {selectedId && selectedSupplement && (
            <View style={styles.confirmView}>
              <View style={styles.confirmCard}>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmName}>{selectedSupplement.name}</Text>
                  <Text style={styles.confirmAmount}>
                    {selectedSupplement.amount} kr
                    {selectedSupplement.rateType === "per_hour" ? "/time" : "/vakt"}
                  </Text>
                </View>
                {selectedSupplement.salaryCode && (
                  <Text style={styles.confirmSalaryCode}>
                    Lonnart: {selectedSupplement.salaryCode}
                  </Text>
                )}
              </View>

              <Text style={styles.commentLabel}>
                Kommentar {selectedSupplement.commentRequired ? "(obligatorisk)" : "(valgfritt)"}
              </Text>
              <TextInput
                style={styles.commentInput}
                value={comment}
                onChangeText={setComment}
                placeholder="Beskriv kort hvorfor..."
                placeholderTextColor="#666"
                multiline
                editable={!isLoading}
              />

              <View style={styles.confirmButtons}>
                <Pressable
                  onPress={handleBack}
                  disabled={isLoading}
                  style={({ pressed }) => [styles.cancelButton, pressed && styles.buttonPressed]}
                >
                  <Text style={styles.cancelButtonText}>Tilbake</Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleClaim()}
                  disabled={
                    isLoading || (selectedSupplement.commentRequired === true && !comment.trim())
                  }
                  style={({ pressed }) => [
                    styles.claimButton,
                    pressed && styles.buttonPressed,
                    (isLoading ||
                      (selectedSupplement.commentRequired === true && !comment.trim())) &&
                      styles.buttonDisabled,
                  ]}
                >
                  <Text style={styles.claimButtonText}>Registrer tillegg</Text>
                </Pressable>
              </View>
            </View>
          )}
        </BottomSheetScrollView>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

const useStyles = createStyles((theme) => ({
  sheetBackground: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },

  handleIndicator: {
    backgroundColor: theme.isDark ? "#333" : "#ccc",
    width: 40,
  },

  sheetContent: {
    flex: 1,
    paddingHorizontal: 20,
  },

  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    marginTop: 8,
  },

  backBtn: {
    width: 32,
    height: 32,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: theme.colors.foreground,
  },

  headerDescription: {
    fontSize: 13,
    color: theme.colors.mutedForeground,
    marginTop: 4,
    marginBottom: 16,
  },

  iconColor: {
    color: theme.colors.foreground,
  },

  mutedColor: {
    color: theme.colors.mutedForeground,
  },

  listContent: {
    paddingBottom: 40,
    gap: 10,
  },

  /* Empty state */
  emptyState: {
    alignItems: "center" as const,
    paddingVertical: 40,
    gap: 8,
  },

  emptyText: {
    fontSize: 14,
    color: theme.colors.mutedForeground,
  },

  /* Supplement list items */
  supplementItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
    padding: 16,
  },

  supplementItemPressed: {
    opacity: 0.7,
  },

  supplementItemDisabled: {
    opacity: 0.5,
  },

  supplementLeft: {
    flex: 1,
  },

  supplementNameRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
  },

  supplementName: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: theme.colors.foreground,
  },

  supplementDesc: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },

  supplementRight: {
    alignItems: "flex-end" as const,
    marginLeft: 12,
  },

  supplementAmount: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: theme.colors.foreground,
    fontVariant: ["tabular-nums" as const],
  },

  supplementRate: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
  },

  /* Confirmation view */
  confirmView: {
    gap: 16,
  },

  confirmCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
    padding: 16,
  },

  confirmRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },

  confirmName: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: theme.colors.foreground,
  },

  confirmAmount: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: theme.colors.foreground,
    fontVariant: ["tabular-nums" as const],
  },

  confirmSalaryCode: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
    marginTop: 4,
  },

  commentLabel: {
    fontSize: 13,
    color: theme.colors.mutedForeground,
  },

  commentInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
    padding: 12,
    minHeight: 80,
    fontSize: 14,
    color: theme.colors.foreground,
    textAlignVertical: "top" as const,
  },

  confirmButtons: {
    flexDirection: "row" as const,
    gap: 12,
  },

  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center" as const,
    borderWidth: 1,
    borderColor: theme.isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
  },

  cancelButtonText: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: theme.colors.foreground,
  },

  claimButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center" as const,
    backgroundColor: "#e85c0d",
  },

  claimButtonText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#ffffff",
  },

  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },

  buttonDisabled: {
    opacity: 0.5,
  },
}));
