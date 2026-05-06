"use client";

/**
 * PrimitivesGallery — renders every helpdesk-orb primitive × every state.
 *
 * Client component so pulse animation runs and snapshot captures the animated
 * frame (mid-run flake mitigated by the Playwright waitForTimeout grace).
 */
import type { ReactNode } from "react";

import { Orb, LighthouseAvatar, StatusLabel, Pill } from "@/components/helpdesk-orb";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 48 }}>
      <h2
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--muted-foreground)",
          marginBottom: 16,
        }}
      >
        {title}
      </h2>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 24,
          alignItems: "center",
        }}
      >
        {children}
      </div>
    </section>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        marginTop: 4,
        color: "var(--muted-foreground)",
        fontFamily: "var(--font-mono)",
      }}
    >
      {children}
    </div>
  );
}

export function PrimitivesGallery() {
  return (
    <div>
      <Section title="Orb — size 48, 3 statuses">
        <div data-variant="waiting">
          <Orb status="waiting" aria-label="waiting" />
          <Label>waiting · 0.08</Label>
        </div>
        <div data-variant="active">
          <Orb status="active" aria-label="active" />
          <Label>active · 0.12</Label>
        </div>
        <div data-variant="complete">
          <Orb status="complete" withCheck aria-label="complete" />
          <Label>complete · 0.04 · check</Label>
        </div>
      </Section>

      <Section title="Orb — pulse animation (sizes 14 / 48 / 52)">
        <Orb size={14} status="waiting" pulse aria-label="pulse small" />
        <Orb size={48} status="waiting" pulse aria-label="pulse medium" />
        <Orb size={52} status="active" pulse aria-label="pulse large" />
      </Section>

      <Section title="LighthouseAvatar — 3 halo intensities">
        <div style={{ textAlign: "center" }}>
          <LighthouseAvatar name="Linn Andersen" halo="idle" />
          <Label>idle · 0.06</Label>
        </div>
        <div style={{ textAlign: "center" }}>
          <LighthouseAvatar name="Kari Holm" halo="waiting" />
          <Label>waiting · 0.10</Label>
        </div>
        <div style={{ textAlign: "center" }}>
          <LighthouseAvatar name="Ola Hansen" halo="active" />
          <Label>active · 0.12</Label>
        </div>
      </Section>

      <Section title="LighthouseAvatar — sizes 32 / 56 / 80">
        <LighthouseAvatar name="Linn" size={32} halo="idle" />
        <LighthouseAvatar name="Linn" size={56} halo="idle" />
        <LighthouseAvatar name="Linn" size={80} halo="idle" />
      </Section>

      <Section title="StatusLabel — 3 states">
        <StatusLabel status="waiting" />
        <StatusLabel status="active" />
        <StatusLabel status="complete" />
      </Section>

      <Section title="Pill — 3 tones">
        <Pill tone="muted">3</Pill>
        <Pill tone="brand">#lønn</Pill>
        <Pill tone="success">AKTIV</Pill>
      </Section>
    </div>
  );
}
