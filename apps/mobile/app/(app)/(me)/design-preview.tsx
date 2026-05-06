/**
 * /me/design-preview — dev-only visual QA screen for helpdesk-orb primitives.
 *
 * Twin of the web route at /platform-admin/helpdesk-preview. Not wired into
 * the tab navigation; reach it via direct Expo Router push from a dev menu
 * when needed. Renders every primitive × every state for fidelity checks
 * against docs/design/smartout-design-helpdesk/project/prototype/shared.jsx.
 */
import type { ReactNode } from "react";
import { ScrollView, View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Orb, LighthouseAvatar, StatusLabel, Pill } from "@/components/orb";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ marginBottom: 32 }}>
      <Text
        style={{
          fontFamily: "GeistMono",
          fontSize: 10,
          fontWeight: "600",
          letterSpacing: 1.3,
          textTransform: "uppercase",
          color: "#7a756e",
          marginBottom: 12,
        }}
      >
        {title}
      </Text>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "center",
        }}
      >
        {children}
      </View>
    </View>
  );
}

export default function DesignPreviewScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fdfcfa" }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text
          style={{
            fontFamily: "InstrumentSerif",
            fontSize: 28,
            fontWeight: "700",
            marginBottom: 24,
            color: "#1c1814",
          }}
        >
          Helpdesk Primitives
        </Text>

        <Section title="Orb — 3 statuses">
          <Orb status="waiting" accessibilityLabel="waiting" />
          <Orb status="active" accessibilityLabel="active" />
          <Orb status="complete" withCheck accessibilityLabel="complete" />
        </Section>

        <Section title="Orb — pulse">
          <Orb size={14} status="waiting" pulse accessibilityLabel="small pulse" />
          <Orb size={48} status="waiting" pulse accessibilityLabel="medium pulse" />
        </Section>

        <Section title="LighthouseAvatar — 3 halos">
          <LighthouseAvatar name="Linn Andersen" halo="idle" />
          <LighthouseAvatar name="Kari Holm" halo="waiting" />
          <LighthouseAvatar name="Ola Hansen" halo="active" />
        </Section>

        <Section title="StatusLabel">
          <StatusLabel status="waiting" />
          <StatusLabel status="active" />
          <StatusLabel status="complete" />
        </Section>

        <Section title="Pill — 3 tones">
          <Pill tone="muted">3</Pill>
          <Pill tone="brand">#lønn</Pill>
          <Pill tone="success">AKTIV</Pill>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}
