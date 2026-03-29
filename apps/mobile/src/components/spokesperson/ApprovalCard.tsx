/**
 * ApprovalCard — Full-screen card for an employee to accept or decline
 * a spokesperson assignment. Shows what becomes publicly visible and
 * what recurring tasks they'll be responsible for.
 *
 * RLS allows employees to read + update their own website_spokesperson row,
 * so we query the websites schema directly from the mobile Supabase client.
 */
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import { User, Eye, ListChecks, Clock, CheckCircle2 } from "lucide-react-native";
import { Button } from "@/components/ui";
import { createStyles, useTheme } from "@/theme";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────

type ContentTask = {
  type: "upload_photo" | "write_post" | "update_quote" | "custom";
  frequency: "weekly" | "biweekly" | "monthly";
  deadlineDay: number;
  instructions: string;
  enabled: boolean;
};

export type SpokespersonApprovalData = {
  website_spokesperson_id: string;
  role_title: string;
  quote: string;
  bio: string;
  status: "pending" | "approved" | "declined" | "revoked";
  assigned_at: string;
  content_schedule: ContentTask[];
  /** Workspace/restaurant name */
  workspace_name: string;
  /** Employee's own display name */
  employee_name: string;
  /** Employee's avatar URL if available */
  avatar_url?: string | null;
};

type ApprovalCardProps = {
  data: SpokespersonApprovalData;
  onResponded: () => void;
};

// ─── Labels ───────────────────────────────────────────────────────

const TASK_TYPE_LABELS: Record<ContentTask["type"], string> = {
  upload_photo: "Last opp bilde",
  write_post: "Skriv innlegg",
  update_quote: "Oppdater sitat",
  custom: "Egendefinert oppgave",
};

const FREQUENCY_LABELS: Record<ContentTask["frequency"], string> = {
  weekly: "Ukentlig",
  biweekly: "Annenhver uke",
  monthly: "Månedlig",
};

const DEADLINE_DAYS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

const PUBLIC_VISIBILITY_ITEMS = [
  "Navn",
  "Bilde",
  "Stilling på nettstedet",
  "Sitat",
  "Kort beskrivelse",
];

// ─── Component ────────────────────────────────────────────────────

export function ApprovalCard({ data, onResponded }: ApprovalCardProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const enabledTasks = data.content_schedule.filter((t) => t.enabled);

  const assignedDate = new Date(data.assigned_at).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const handleAccept = useCallback(() => {
    Alert.alert(
      "Godta talsperson-rollen?",
      `Du bekrefter at du ønsker å representere ${data.workspace_name} som talsperson på nettstedet.`,
      [
        { text: "Avbryt", style: "cancel" },
        {
          text: "Godta",
          style: "default",
          onPress: async () => {
            setSubmitting(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const { error } = await (supabase as any)
                .schema("websites")
                .from("website_spokesperson")
                .update({
                  status: "approved",
                  responded_at: new Date().toISOString(),
                })
                .eq("website_spokesperson_id", data.website_spokesperson_id);

              if (error) throw error;
              onResponded();
            } catch {
              Alert.alert("Feil", "Kunne ikke sende svar. Prøv igjen.");
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  }, [data, onResponded]);

  const handleDeclineConfirm = useCallback(async () => {
    setSubmitting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .schema("websites")
        .from("website_spokesperson")
        .update({
          status: "declined",
          decline_reason: declineReason.trim() || null,
          responded_at: new Date().toISOString(),
        })
        .eq("website_spokesperson_id", data.website_spokesperson_id);

      if (error) throw error;
      onResponded();
    } catch {
      Alert.alert("Feil", "Kunne ikke sende svar. Prøv igjen.");
    } finally {
      setSubmitting(false);
    }
  }, [data.website_spokesperson_id, declineReason, onResponded]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header — workspace name + role */}
        <View style={styles.header}>
          <Text style={styles.workspaceName}>{data.workspace_name}</Text>
          <Text style={styles.requestTitle}>Talsperson-forespørsel</Text>
          <Text style={styles.assignedDate}>Mottatt {assignedDate}</Text>
        </View>

        {/* Employee identity card */}
        <View style={styles.personCard}>
          <View style={styles.avatarCircle}>
            <User size={32} color={colors.primaryForeground} strokeWidth={1.5} />
          </View>
          <View style={styles.personInfo}>
            <Text style={styles.personName}>{data.employee_name}</Text>
            <Text style={styles.personRole}>{data.role_title || "Stilling ikke satt"}</Text>
          </View>
        </View>

        {/* What becomes publicly visible */}
        <SectionCard
          icon={<Eye size={16} color={colors.info} strokeWidth={2} />}
          title="Hva blir synlig offentlig"
          color={colors.info}
        >
          {PUBLIC_VISIBILITY_ITEMS.map((item) => (
            <InfoRow key={item} label={item} />
          ))}
        </SectionCard>

        {/* Recurring content tasks */}
        {enabledTasks.length > 0 && (
          <SectionCard
            icon={<ListChecks size={16} color={colors.warning} strokeWidth={2} />}
            title="Dine oppgaver"
            color={colors.warning}
          >
            {enabledTasks.map((task, i) => (
              <View key={i} style={styles.taskRow}>
                <Text style={styles.taskType}>{TASK_TYPE_LABELS[task.type]}</Text>
                <Text style={styles.taskMeta}>
                  {FREQUENCY_LABELS[task.frequency]} · Frist {DEADLINE_DAYS[task.deadlineDay]}
                </Text>
                {task.instructions ? (
                  <Text style={styles.taskInstructions}>{task.instructions}</Text>
                ) : null}
              </View>
            ))}
          </SectionCard>
        )}

        {/* Response deadline note */}
        <View style={styles.deadlineNote}>
          <Clock size={14} color={colors.mutedForeground} strokeWidth={2} />
          <Text style={styles.deadlineText}>Svar innen 7 dager fra mottak</Text>
        </View>

        {/* Decline form — shown when user taps "Avslå" */}
        {showDeclineForm && (
          <View style={styles.declineForm}>
            <Text style={styles.declineLabel}>Grunn (valgfritt)</Text>
            <TextInput
              style={styles.declineInput}
              placeholder="Beskriv hvorfor du avslår..."
              placeholderTextColor={colors.mutedForeground}
              value={declineReason}
              onChangeText={setDeclineReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              autoFocus
            />
            <View style={styles.declineActions}>
              <Button
                title="Avbryt"
                variant="secondary"
                style={styles.halfButton}
                onPress={() => {
                  setShowDeclineForm(false);
                  setDeclineReason("");
                }}
              />
              <Button
                title="Send avslag"
                variant="destructive"
                style={styles.halfButton}
                loading={submitting}
                onPress={handleDeclineConfirm}
              />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Action buttons — fixed at bottom */}
      {!showDeclineForm && (
        <View style={styles.actions}>
          <Button
            title="Avslå"
            variant="secondary"
            style={styles.declineButton}
            disabled={submitting}
            onPress={() => {
              Haptics.selectionAsync();
              setShowDeclineForm(true);
            }}
          />
          <Button
            title="Godta"
            variant="primary"
            style={styles.acceptButton}
            loading={submitting}
            onPress={handleAccept}
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Section card helper ───────────────────────────────────────────

function SectionCard({
  icon,
  title,
  color,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  const styles = useSectionStyles();
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        {icon}
        <Text style={[styles.cardTitle, { color }]}>{title}</Text>
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

function InfoRow({ label }: { label: string }) {
  const styles = useSectionStyles();
  return (
    <View style={styles.infoRow}>
      <CheckCircle2 size={13} color={styles.successColor.color} strokeWidth={2} />
      <Text style={styles.infoLabel}>{label}</Text>
    </View>
  );
}

const useSectionStyles = createStyles((theme) => ({
  card: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)",
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.tight,
    paddingHorizontal: theme.spacing.card,
    paddingVertical: theme.spacing.element,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  cardTitle: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.semibold,
  },
  cardBody: {
    padding: theme.spacing.card,
    gap: theme.spacing.tight,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.tight,
  },
  infoLabel: {
    ...theme.typography.body,
    color: theme.colors.foreground,
  },
  successColor: {
    color: theme.colors.success,
  },
}));

// ─── Main styles ───────────────────────────────────────────────────

const useStyles = createStyles((theme) => ({
  flex: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.card,
    gap: theme.spacing.section,
    paddingBottom: theme.spacing.xl,
  },

  header: {
    gap: theme.spacing.xs,
  },
  workspaceName: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  requestTitle: {
    ...theme.typography.title,
    color: theme.colors.foreground,
  },
  assignedDate: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },

  personCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
    padding: theme.spacing.card,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  personInfo: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  personName: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
  },
  personRole: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },

  taskRow: {
    gap: 2,
    paddingVertical: theme.spacing.tight,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  taskType: {
    ...theme.typography.bodyBold,
    color: theme.colors.foreground,
  },
  taskMeta: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  taskInstructions: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    fontStyle: "italic",
    marginTop: 2,
  },

  deadlineNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.tight,
    justifyContent: "center",
  },
  deadlineText: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },

  declineForm: {
    gap: theme.spacing.element,
  },
  declineLabel: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.foreground,
  },
  declineInput: {
    ...theme.typography.body,
    color: theme.colors.foreground,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    minHeight: 90,
  },
  declineActions: {
    flexDirection: "row",
    gap: theme.spacing.element,
  },
  halfButton: {
    flex: 1,
  },

  actions: {
    flexDirection: "row",
    gap: theme.spacing.element,
    paddingHorizontal: theme.spacing.card,
    paddingVertical: theme.spacing.element,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  declineButton: {
    flex: 1,
  },
  acceptButton: {
    flex: 2,
    backgroundColor: theme.colors.success,
  },
}));
