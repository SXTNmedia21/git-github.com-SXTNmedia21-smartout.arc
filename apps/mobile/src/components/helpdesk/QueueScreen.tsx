/**
 * QueueScreen — "Min kø" mobile assembler (Phase 4).
 *
 * Implements the MobileQueue layout from the Claude Design prototype
 *   docs/design/smartout-design-helpdesk/project/prototype/mobile-screens.jsx:226-321
 *
 * Layout (top → bottom):
 *   1. Header  — "Min kø" in Instrument Serif 34, subtitle in Geist Mono
 *                13.5 ("3 åpne · 1 venter") + filter icon on the right
 *   2. Sectioned list — groups by desk tag (e.g. "#lønn · privat skranke"),
 *                closed with a muted "Løst i dag" group (opacity 0.7)
 *   3. Rows via `QueueRow` with `highlighted` on the first waiting row and
 *      `dim` on resolved rows
 *
 * Wiring status (Phase 4):
 *   The helpdesk hooks (`useMyQueue`) only return open tickets and have no
 *   desk-tag metadata yet. This component therefore renders either
 *     (a) a supplied `sections` prop — preferred, for Phase 4.1 wiring, or
 *     (b) a placeholder sample list (the prototype data) when `sections`
 *         is omitted. The placeholder lets design review the layout on the
 *         device before the backend shape lands.
 *
 * The screen is intentionally self-contained: no segmented tabs, no
 * channel list. Existing `app/(app)/(komm)/index.tsx` still serves the
 * segmented Komm inbox and is untouched by this Phase.
 */

import * as React from "react";
import { useCallback, useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View, type ListRenderItem } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LifeBuoy, SlidersHorizontal } from "lucide-react-native";
import { useTranslation } from "@smartout/i18n";
import { createStyles, useTheme } from "@/theme";
import { QueueRow, type QueueRowTicket } from "@/components/helpdesk/QueueRow";
import type { QueueTicket } from "@/hooks/queries/use-my-queue";

export type QueueSection = {
  /** Unique key — e.g. `"lonn"`, `"hms"`, `"resolved"`. */
  id: string;
  /** Display tag — e.g. `"#lønn · privat skranke"`. */
  label: string;
  /** `true` for the "Løst i dag" group → rows render dimmed. */
  dimmed?: boolean;
  /** When set, the first waiting row in this section is highlighted. */
  highlightFirstWaiting?: boolean;
  tickets: QueueRowTicket[];
};

export type QueueScreenProps = {
  sections?: QueueSection[];
  /** Rows in the "Løst i dag" group also fire this — callers can ignore
   *  by narrowing on `ticket.status !== "complete"`. */
  onTicketPress: (ticket: QueueTicket) => void;
  onFilterPress?: () => void;
};

// Flat-list items: a section header, or a ticket row.
type Row =
  | { kind: "section"; section: QueueSection; count: number }
  | {
      kind: "ticket";
      sectionId: string;
      ticket: QueueRowTicket;
      highlighted: boolean;
      dim: boolean;
    };

function buildRows(sections: QueueSection[]): Row[] {
  const rows: Row[] = [];
  for (const section of sections) {
    if (section.tickets.length === 0) continue;
    rows.push({ kind: "section", section, count: section.tickets.length });
    let firstWaitingHighlighted = false;
    for (const ticket of section.tickets) {
      const shouldHighlight =
        !!section.highlightFirstWaiting && !firstWaitingHighlighted && ticket.status === "waiting";
      if (shouldHighlight) firstWaitingHighlighted = true;
      rows.push({
        kind: "ticket",
        sectionId: section.id,
        ticket,
        highlighted: shouldHighlight,
        dim: !!section.dimmed,
      });
    }
  }
  return rows;
}

export function QueueScreen({ sections, onTicketPress, onFilterPress }: QueueScreenProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation("helpdesk");

  // No mock fallback — render real sections or an empty queue.
  const effectiveSections = sections ?? [];
  const rows = useMemo(() => buildRows(effectiveSections), [effectiveSections]);

  const openCount = useMemo(
    () => effectiveSections.filter((s) => !s.dimmed).reduce((sum, s) => sum + s.tickets.length, 0),
    [effectiveSections],
  );
  const waitingCount = useMemo(
    () =>
      effectiveSections
        .filter((s) => !s.dimmed)
        .reduce((sum, s) => sum + s.tickets.filter((x) => x.status === "waiting").length, 0),
    [effectiveSections],
  );

  const subtitle =
    openCount === 0
      ? t("mobile_queue.empty_title")
      : waitingCount > 0
        ? t("mobile_queue.subcount_with_waiting", {
            open: openCount,
            waiting: waitingCount,
          })
        : t("mobile_queue.subcount_no_waiting", { count: openCount });

  const renderItem: ListRenderItem<Row> = useCallback(
    ({ item }) => {
      if (item.kind === "section") {
        return (
          <View style={[styles.sectionHeader, item.section.dimmed && styles.sectionHeaderDim]}>
            {item.section.dimmed ? null : <LifeBuoy size={11} color={theme.colors.brandOrange} />}
            <Text style={styles.sectionLabel}>{item.section.label}</Text>
            <Text style={styles.sectionCount}>{item.count}</Text>
          </View>
        );
      }
      return (
        <QueueRow
          ticket={item.ticket}
          onPress={onTicketPress}
          highlighted={item.highlighted}
          dim={item.dim}
        />
      );
    },
    [onTicketPress, styles, theme],
  );

  const keyExtractor = useCallback((item: Row) => {
    if (item.kind === "section") return `section:${item.section.id}`;
    return `ticket:${item.sectionId}:${item.ticket.ticket_id}`;
  }, []);

  return (
    <SafeAreaView edges={["top"]} style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>{t("mobile_tab.queue")}</Text>
          {onFilterPress ? (
            <Pressable
              onPress={onFilterPress}
              accessibilityRole="button"
              accessibilityLabel="Filtrer kø"
              style={styles.filterButton}
              hitSlop={8}
            >
              <SlidersHorizontal size={16} color={theme.colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <FlatList
        data={rows}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontFamily: "InstrumentSerif-Regular",
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.7,
    color: theme.colors.foreground,
  },
  filterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  subtitle: {
    fontFamily: "GeistMono-Regular",
    fontSize: 13.5,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },
  listContent: {
    paddingBottom: 32,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 6,
  },
  sectionHeaderDim: {
    opacity: 0.7,
  },
  sectionLabel: {
    fontFamily: "GeistMono-Regular",
    fontSize: 10.5,
    fontWeight: "500",
    color: theme.colors.mutedForeground,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    flex: 1,
  },
  sectionCount: {
    fontFamily: "GeistMono-Regular",
    fontSize: 10.5,
    color: theme.colors.mutedForeground,
    opacity: 0.7,
  },
}));
