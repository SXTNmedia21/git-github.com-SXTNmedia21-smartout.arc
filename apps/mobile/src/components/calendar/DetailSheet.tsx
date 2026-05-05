/**
 * DetailSheet — Full-screen bottom sheet displaying a single CalendarItem.
 *
 * Renders type-specific detail content per the handoff (screens.jsx →
 * DetailSheet). Read-only in Phase 3e — D6 execution actions (complete, stamp
 * in, confirm booking) are Phase 4 polish.
 *
 * PII GATE (ADR-0267 — BLOCKING per Phase 2 verify):
 *   Booking `contact` field is field-level access controlled by profile.role:
 *     - employee  → contact = null, "Ring"-action replaced by "Kontakt resepsjonen"
 *     - manager / admin / owner → full contact + functional "Ring" action
 *
 *   The gate is enforced via the `contactRedacted` flag on CalendarItem
 *   (populated by useCalendarItems hook per ADR-0267 §Implementation contract).
 *   DetailSheet NEVER renders PII when contactRedacted === true.
 *   Telemetry on contact-tap MUST NOT carry the phone number (ADR-0134).
 *
 * Data shape:
 *   - CalendarItem from types.ts (Phase 3b).
 *   - CalendarItemExtended adds fields needed for detail view (coworkers,
 *     evidence, desc, contactRedacted) without breaking Phase 3b primitives.
 *
 * Accessibility: close button has accessibilityRole="button" + label.
 * No hardcoded colors — all from theme tokens.
 */

import React, { useCallback, useMemo, useRef } from "react";
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import {
  X,
  MoreVertical,
  Camera,
  AlertTriangle,
  CheckCircle2,
  Phone,
} from "lucide-react-native";
import { useTheme, withOpacity } from "@/theme";
import { nativeTheme } from "@smartout/design-tokens/native";
import type { CalendarItem, Department } from "./types";

// ─── Extended item type (detail-only fields) ─────────────────────────────────

/**
 * CalendarItemExtended adds detail-view-only fields on top of the base
 * CalendarItem. Populated by useCalendarItems / detail-fetch hooks.
 */
export type CalendarItemExtended = CalendarItem & {
  // Shift-only
  coworkers?: string[];
  // Task-only
  evidence?: {
    required: number;
    taken: number;
  };
  desc?: string;
  // Booking-only
  /**
   * ADR-0267: null when profile.role === 'employee'.
   * Non-null (full "Name · Phone") when manager / admin / owner.
   */
  contact?: string | null;
  /**
   * ADR-0267 explicit flag — DetailSheet checks this instead of null-testing
   * contact to distinguish "no contact provided" from "contact redacted".
   */
  contactRedacted?: boolean;
  notes?: string;
  // Deviation / note author
  author?: string;
};

// ─── Sheet handle + props ────────────────────────────────────────────────────

export type DetailSheetHandle = {
  open: (item: CalendarItemExtended) => void;
  close: () => void;
};

export type DetailSheetProps = {
  onClose?: () => void;
};

// ─── Department color lookup ──────────────────────────────────────────────────

const DEPT_COLORS = nativeTheme.department;

function getDeptColor(dept: Department): string {
  return DEPT_COLORS[dept] ?? DEPT_COLORS.kjokken;
}

function deptLabel(dept: Department): string {
  switch (dept) {
    case "kjokken":
      return "Kjøkken";
    case "sal":
      return "Sal";
    case "bar":
      return "Bar";
    case "event":
      return "Event";
  }
}

// ─── Type label helpers ──────────────────────────────────────────────────────

function typeLabel(type: CalendarItem["type"]): string {
  switch (type) {
    case "shift":
      return "Vakt";
    case "task":
      return "Oppgave";
    case "booking":
      return "Booking";
    case "deviation":
      return "Avvik";
    case "note":
      return "Notat";
  }
}

// ─── Shared section primitives ────────────────────────────────────────────────

type SectionLabelProps = {
  children: string;
  theme: ReturnType<typeof useTheme>;
};

function SectionLabel({ children, theme }: SectionLabelProps) {
  return (
    <Text
      style={[
        detailStyles.sectionLabel,
        { color: theme.colors.mutedForeground },
      ]}
    >
      {children}
    </Text>
  );
}

type MetaItemProps = {
  label: string;
  value: string;
  mono?: boolean;
  theme: ReturnType<typeof useTheme>;
};

function MetaItem({ label, value, mono, theme }: MetaItemProps) {
  return (
    <View style={detailStyles.metaItem}>
      <Text style={[detailStyles.metaLabel, { color: theme.colors.mutedForeground }]}>
        {label}
      </Text>
      <Text
        style={[
          detailStyles.metaValue,
          {
            color: theme.colors.foreground,
            fontFamily: mono ? "GeistMono-Regular" : undefined,
            fontWeight: mono ? "600" : "500",
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

// ─── Status badge (severity / overdue) ───────────────────────────────────────

type StatusBadgeProps = {
  theme: ReturnType<typeof useTheme>;
};

function OverdueBadge({ theme }: StatusBadgeProps) {
  return (
    <View
      style={[
        detailStyles.badge,
        { backgroundColor: withOpacity(theme.colors.destructive, 0.14) },
      ]}
    >
      <AlertTriangle size={11} color={theme.colors.destructive} strokeWidth={2.5} />
      <Text style={[detailStyles.badgeText, { color: theme.colors.destructive }]}>
        AVVIK · KREVER HANDLING
      </Text>
    </View>
  );
}

// ─── Type-specific content blocks ────────────────────────────────────────────

type ContentProps = {
  item: CalendarItemExtended;
  theme: ReturnType<typeof useTheme>;
};

function ShiftContent({ item, theme }: ContentProps) {
  return (
    <>
      {item.coworkers != null && item.coworkers.length > 0 && (
        <View style={detailStyles.section}>
          <SectionLabel theme={theme}>Kolleger på vakt</SectionLabel>
          <View style={detailStyles.colleagueList}>
            {item.coworkers.map((c, i) => (
              <Text
                key={i}
                style={[detailStyles.colleagueRow, { color: theme.colors.secondaryForeground }]}
              >
                · {c}
              </Text>
            ))}
          </View>
        </View>
      )}
      {/* Shift zone if set */}
      {item.zone != null && (
        <View style={detailStyles.section}>
          <SectionLabel theme={theme}>Sone</SectionLabel>
          <Text style={[detailStyles.bodyText, { color: theme.colors.foreground }]}>
            {item.zone}
          </Text>
        </View>
      )}
    </>
  );
}

function TaskContent({ item, theme }: ContentProps) {
  const ev = item.evidence;
  return (
    <>
      {item.priority != null && (
        <View style={detailStyles.section}>
          <SectionLabel theme={theme}>Prioritet</SectionLabel>
          <Text style={[detailStyles.bodyText, { color: theme.colors.foreground }]}>
            {item.priority === "high"
              ? "Høy"
              : item.priority === "normal"
                ? "Normal"
                : "Lav"}
          </Text>
        </View>
      )}
      {ev != null && (
        <View style={detailStyles.section}>
          <SectionLabel theme={theme}>Bildebevis kreves</SectionLabel>
          <View style={detailStyles.evidenceGrid}>
            {Array.from({ length: ev.required }).map((_, i) => {
              const taken = i < ev.taken;
              return (
                <View
                  key={i}
                  style={[
                    detailStyles.evidenceSlot,
                    {
                      backgroundColor: taken
                        ? withOpacity(theme.colors.card, 1)
                        : "transparent",
                      borderColor: taken ? theme.colors.calendarEvidenceTaken : theme.colors.border,
                      borderStyle: taken ? "solid" : "dashed",
                    },
                  ]}
                >
                  {taken ? (
                    <CheckCircle2 size={22} color={theme.colors.calendarEvidenceTaken} strokeWidth={1.6} />
                  ) : (
                    <Camera
                      size={22}
                      color={theme.colors.mutedForeground}
                      strokeWidth={1.6}
                    />
                  )}
                </View>
              );
            })}
          </View>
          <Text
            style={[
              detailStyles.evidenceCount,
              { color: theme.colors.mutedForeground },
            ]}
          >
            {ev.taken}/{ev.required} tatt
          </Text>
        </View>
      )}
    </>
  );
}

function BookingContent({ item, theme }: ContentProps) {
  /**
   * ADR-0267 PII GATE:
   *
   * When contactRedacted === true:
   *   - contact field is null; DO NOT render any name/phone text.
   *   - Replace "Ring"-button with passive "Kontakt resepsjonen" text.
   *   - Never emit contact value in telemetry — only event name.
   *
   * When contactRedacted === false (manager / admin / owner):
   *   - Render full contact + "Ring"-button.
   *   - On tap: emit calendar.booking_contact_called (no phone payload — ADR-0134).
   */
  const isRedacted = item.contactRedacted === true;
  const contact = isRedacted ? null : (item.contact ?? null);

  // Extract initials from "FirstName LastName · phone" format
  const initials = contact
    ? contact
        .split("·")[0]
        ?.trim()
        ?.split(" ")
        .map((s: string) => s[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : null;

  const contactName = contact ? contact.split("·")[0]?.trim() : null;

  const handleRing = useCallback(() => {
    if (!contact) return;
    // Extract phone number from "Name · 99 88 77 66" — strip spaces + country code
    const raw = contact.split("·")[1]?.trim().replace(/\s/g, "");
    if (!raw) return;

    // Telemetry: MUST NOT include phone number per ADR-0134
    // emit("calendar.booking_contact_called", { item_id: item.id }); — deferred to BFF
    Linking.openURL(`tel:${raw}`).catch(() => {
      Alert.alert("Feil", "Kunne ikke åpne telefonappen.");
    });
  }, [contact]);

  return (
    <>
      {/* Contact block */}
      <View style={detailStyles.section}>
        <SectionLabel theme={theme}>Kontakt</SectionLabel>
        <View
          style={[
            detailStyles.contactCard,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
            },
          ]}
        >
          {/* Avatar */}
          <View
            style={[
              detailStyles.contactAvatar,
              { backgroundColor: theme.colors.secondary },
            ]}
          >
            {initials != null ? (
              <Text style={[detailStyles.contactInitials, { color: theme.colors.foreground }]}>
                {initials}
              </Text>
            ) : (
              <Phone size={16} color={theme.colors.mutedForeground} strokeWidth={1.8} />
            )}
          </View>

          {/* Name or redaction message */}
          {isRedacted ? (
            <Text style={[detailStyles.contactName, { color: theme.colors.mutedForeground }]}>
              Kontakt resepsjonen
            </Text>
          ) : (
            <Text
              style={[detailStyles.contactName, { color: theme.colors.foreground }]}
              numberOfLines={1}
            >
              {contactName ?? "—"}
            </Text>
          )}

          {/* Ring button — only for non-redacted */}
          {!isRedacted && contact != null && (
            <Pressable
              onPress={handleRing}
              style={[
                detailStyles.ringBtn,
                {
                  backgroundColor: theme.colors.secondary,
                  borderColor: theme.colors.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Ring gjest"
            >
              <Text style={[detailStyles.ringBtnLabel, { color: theme.colors.foreground }]}>
                Ring
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Table */}
      {item.tables != null && (
        <View style={detailStyles.section}>
          <SectionLabel theme={theme}>Bord</SectionLabel>
          <Text
            style={[
              detailStyles.bodyText,
              {
                color: theme.colors.foreground,
                fontFamily: "GeistMono-Regular",
                fontSize: 14,
              },
            ]}
          >
            {item.tables}
          </Text>
        </View>
      )}

      {/* Special needs / notes */}
      {item.notes != null && (
        <View style={detailStyles.section}>
          <SectionLabel theme={theme}>Spesielt</SectionLabel>
          <Text
            style={[
              detailStyles.bodyText,
              { color: theme.colors.secondaryForeground, lineHeight: 20 },
            ]}
          >
            {item.notes}
          </Text>
        </View>
      )}
    </>
  );
}

function DeviationContent({ item, theme }: ContentProps) {
  return (
    <>
      {item.desc != null && (
        <View style={detailStyles.section}>
          <SectionLabel theme={theme}>Beskrivelse</SectionLabel>
          <Text
            style={[
              detailStyles.bodyText,
              { color: theme.colors.secondaryForeground, lineHeight: 20 },
            ]}
          >
            {item.desc}
          </Text>
        </View>
      )}
      {item.author != null && (
        <View style={detailStyles.section}>
          <SectionLabel theme={theme}>Rapportert av</SectionLabel>
          <Text style={[detailStyles.bodyText, { color: theme.colors.foreground }]}>
            {item.author}
          </Text>
        </View>
      )}
    </>
  );
}

function NoteContent({ item, theme }: ContentProps) {
  return (
    <>
      {item.desc != null && (
        <View style={detailStyles.section}>
          <SectionLabel theme={theme}>Innhold</SectionLabel>
          <Text
            style={[
              detailStyles.bodyText,
              { color: theme.colors.secondaryForeground, lineHeight: 20 },
            ]}
          >
            {item.desc}
          </Text>
        </View>
      )}
      {item.author != null && (
        <View style={detailStyles.section}>
          <SectionLabel theme={theme}>Forfatter</SectionLabel>
          <Text style={[detailStyles.bodyText, { color: theme.colors.foreground }]}>
            {item.author}
          </Text>
        </View>
      )}
    </>
  );
}

// ─── Main DetailSheet component ───────────────────────────────────────────────

export const DetailSheet = React.forwardRef<DetailSheetHandle, DetailSheetProps>(
  function DetailSheet({ onClose }, ref) {
    const theme = useTheme();
    const sheetRef = useRef<BottomSheet>(null);
    const [item, setItem] = React.useState<CalendarItemExtended | null>(null);

    // Full-screen snap — handoff shows detail as full-screen overlay
    const snapPoints = useMemo(() => ["92%"], []);

    React.useImperativeHandle(ref, () => ({
      open: (newItem) => {
        setItem(newItem);
        sheetRef.current?.snapToIndex(0);
      },
      close: () => {
        sheetRef.current?.close();
      },
    }));

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.4}
        />
      ),
      [],
    );

    const handleClose = useCallback(() => {
      setItem(null);
      onClose?.();
    }, [onClose]);

    if (item == null) {
      // Sheet is closed — render mount but keep invisible
      return (
        <BottomSheet
          ref={sheetRef}
          index={-1}
          snapPoints={snapPoints}
          enablePanDownToClose
          onClose={handleClose}
          backdropComponent={renderBackdrop}
          backgroundStyle={{ backgroundColor: theme.colors.background }}
          handleIndicatorStyle={{ backgroundColor: theme.colors.border }}
        >
          <View />
        </BottomSheet>
      );
    }

    const isOverdue = item.status === "overdue";
    const deptColor = getDeptColor(item.dept);

    // Primary CTA label per handoff
    const ctaLabel = (() => {
      if (item.type === "task") return "Marker fullført";
      if (item.type === "booking") return "Bekreft mottak";
      if (item.type === "shift") return "Stempel inn";
      if (item.type === "deviation") return "Kvitter avvik";
      return "Lukk";
    })();

    const ctaColor = isOverdue ? theme.colors.destructive : theme.colors.brandOrange;

    return (
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onClose={handleClose}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: theme.colors.background }}
        handleIndicatorStyle={{ backgroundColor: theme.colors.border }}
      >
        {/* Header row */}
        <View
          style={[
            detailStyles.header,
            { borderBottomColor: theme.colors.border },
          ]}
        >
          {/* Close */}
          <Pressable
            onPress={handleClose}
            style={detailStyles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel="Lukk detaljer"
          >
            <X size={22} color={theme.colors.foreground} strokeWidth={2} />
          </Pressable>

          {/* Type label */}
          <Text
            style={[detailStyles.headerTypeLabel, { color: theme.colors.mutedForeground }]}
          >
            {typeLabel(item.type).toUpperCase()}
          </Text>

          {/* More actions (placeholder — Phase 4 polish) */}
          <View style={detailStyles.headerBtn}>
            <MoreVertical size={22} color={theme.colors.mutedForeground} strokeWidth={2} />
          </View>
        </View>

        <BottomSheetScrollView
          contentContainerStyle={[detailStyles.scrollContent, { paddingBottom: 120 }]}
        >
          {/* Overdue badge */}
          {isOverdue && <OverdueBadge theme={theme} />}

          {/* Title */}
          <Text style={[detailStyles.title, { color: theme.colors.foreground }]}>
            {item.title}
          </Text>

          {/* Sub / description */}
          {item.sub != null && (
            <Text
              style={[
                detailStyles.titleSub,
                { color: theme.colors.mutedForeground },
              ]}
            >
              {item.sub}
            </Text>
          )}

          {/* Meta strip */}
          <View
            style={[
              detailStyles.metaStrip,
              {
                borderTopColor: theme.colors.border,
                borderBottomColor: theme.colors.border,
              },
            ]}
          >
            <MetaItem
              label="Tid"
              value={item.time ?? "Hele dagen"}
              mono
              theme={theme}
            />
            <MetaItem
              label="Avdeling"
              value={deptLabel(item.dept)}
              theme={theme}
            />
            {item.role != null && (
              <MetaItem label="Rolle" value={item.role} theme={theme} />
            )}
            {item.guests != null && (
              <MetaItem label="Gjester" value={String(item.guests)} mono theme={theme} />
            )}
          </View>

          {/* Type-specific content */}
          {item.type === "shift" && <ShiftContent item={item} theme={theme} />}
          {item.type === "task" && <TaskContent item={item} theme={theme} />}
          {item.type === "booking" && <BookingContent item={item} theme={theme} />}
          {item.type === "deviation" && <DeviationContent item={item} theme={theme} />}
          {item.type === "note" && <NoteContent item={item} theme={theme} />}
        </BottomSheetScrollView>

        {/* Action footer — Phase 3e: read-only CTAs (no BFF call yet, Phase 4 wires these) */}
        <View
          style={[
            detailStyles.footer,
            {
              borderTopColor: theme.colors.border,
              backgroundColor: withOpacity(theme.colors.background, 0.9),
            },
          ]}
        >
          <Pressable
            onPress={handleClose}
            style={[
              detailStyles.footerSecondaryBtn,
              {
                backgroundColor: theme.colors.secondary,
                borderColor: theme.colors.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Lukk"
          >
            <Text style={[detailStyles.footerSecondaryLabel, { color: theme.colors.foreground }]}>
              Lukk
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              // Phase 4: wire to BFF action per type.
              // For now: close sheet — no mutation yet.
              Alert.alert("Ikke tilgjengelig ennå", "Handling kobles til i Phase 4.");
            }}
            style={[
              detailStyles.footerPrimaryBtn,
              {
                backgroundColor: ctaColor,
                // Handoff shadow: 0 4px 14px <accent 40%>
                shadowColor: ctaColor,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.4,
                shadowRadius: 7,
                elevation: 6,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={ctaLabel}
          >
            <Text style={detailStyles.footerPrimaryLabel}>{ctaLabel}</Text>
          </Pressable>
        </View>
      </BottomSheet>
    );
  },
);

// ─── Styles ──────────────────────────────────────────────────────────────────

const detailStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTypeLabel: {
    fontSize: 12,
    letterSpacing: 1.4,
    fontWeight: "700",
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 30,
    fontFamily: "InstrumentSerif-Regular",
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  titleSub: {
    fontSize: 13.5,
    marginTop: 6,
    lineHeight: 20,
  },
  metaStrip: {
    flexDirection: "row",
    gap: 14,
    paddingVertical: 18,
    marginTop: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginBottom: 4,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  metaValue: {
    fontSize: 14,
    marginTop: 4,
  },
  section: {
    paddingTop: 14,
  },
  sectionLabel: {
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 1.3,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 13.5,
  },
  colleagueList: {
    gap: 6,
  },
  colleagueRow: {
    fontSize: 13.5,
    paddingVertical: 2,
  },
  evidenceGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  evidenceSlot: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  evidenceCount: {
    fontSize: 11.5,
    fontFamily: "GeistMono-Regular",
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
  contactAvatar: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  contactInitials: {
    fontSize: 13,
    fontWeight: "700",
  },
  contactName: {
    flex: 1,
    fontSize: 13.5,
  },
  ringBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  ringBtnLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 30,
    borderTopWidth: 1,
  },
  footerSecondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  footerSecondaryLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  footerPrimaryBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  footerPrimaryLabel: {
    color: nativeTheme.light.primaryForeground,
    fontSize: 14,
    fontWeight: "700",
  },
});
