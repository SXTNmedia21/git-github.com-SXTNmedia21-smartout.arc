/**
 * HandoffForm — Structured handoff note submission at end of shift.
 *
 * Non-blocking: if the employee skips handoff, a "Ej innlevert" label is shown
 * and the leader gets notified. Handoff does NOT gate hours confirmation.
 *
 * The form is intentionally simple: a text input and a send button.
 * Handoff content is stored as a session_note with note_type = 'handoff'.
 */
import React, { useCallback, useState } from "react";
import { View, Text, Keyboard } from "react-native";
import * as Haptics from "expo-haptics";

import { Button, Input } from "@/components/ui";
import { createStyles, withOpacity } from "@/theme";
import { strings } from "@/constants/strings";
import { useSubmitHandoff, type HandoffPayload } from "@/hooks/mutations/use-submit-handoff";

type HandoffFormProps = {
  sessionId: string;
  profileId: string;
  workspaceId: string;
  /** Whether a handoff has already been submitted for this shift */
  isSubmitted?: boolean;
  onComplete: () => void;
};

export function HandoffForm({
  sessionId,
  profileId,
  workspaceId,
  isSubmitted = false,
  onComplete,
}: HandoffFormProps) {
  const styles = useStyles();
  const { submitHandoff, isSubmitting } = useSubmitHandoff();

  const [content, setContent] = useState("");

  const canSubmit = content.trim().length > 0;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || isSubmitting) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Keyboard.dismiss();

    const payload: HandoffPayload = {
      department_session_id: sessionId,
      content: content.trim(),
      // created_by and workspace_id resolved server-side via getProfileContext()
      // inside useSubmitHandoff — ADR-0134, not supplied by caller
    };

    await submitHandoff(payload);
    onComplete();
  }, [canSubmit, isSubmitting, content, sessionId, submitHandoff, onComplete]);

  /* Already submitted — show confirmation */
  if (isSubmitted) {
    return (
      <View style={styles.container}>
        <View style={styles.submittedBanner}>
          <Text style={styles.submittedText}>{strings.tasks.completed}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{strings.handoff.title}</Text>

      <Input
        value={content}
        onChangeText={setContent}
        placeholder={strings.handoff.placeholder}
        multiline
        numberOfLines={5}
        textAlignVertical="top"
        autoFocus
      />

      <View style={styles.actions}>
        <Button
          title={strings.handoff.send}
          variant="primary"
          size="lg"
          fullWidth
          loading={isSubmitting}
          disabled={!canSubmit}
          onPress={handleSubmit}
        />
      </View>

      <Text style={styles.hint}>
        Overlevering er valgfritt, men sterkt anbefalt. Hopp over om du ikke har noe å melde.
      </Text>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    gap: theme.spacing.md,
  },
  title: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
  },
  actions: {
    marginTop: theme.spacing.tight,
  },
  hint: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    textAlign: "center",
  },
  submittedBanner: {
    backgroundColor: withOpacity(theme.colors.success, 0.1),
    borderRadius: theme.radius.md,
    padding: theme.spacing.card,
    alignItems: "center",
  },
  submittedText: {
    ...theme.typography.bodyBold,
    color: theme.colors.success,
  },
}));
