/**
 * /platform-admin/helpdesk-preview
 *
 * Visual QA surface for the helpdesk-orb primitives. Renders every primitive
 * in every state so we can eyeball fidelity against
 * docs/design/smartout-design-helpdesk/project/prototype/shared.jsx and catch
 * visual regressions via the Playwright snapshot baseline.
 *
 * Scope: Phase 1 (primitives) only. Phase 2+ consumers are not imported here.
 */
import { PrimitivesGallery } from "./_components/PrimitivesGallery";

export const metadata = {
  title: "Helpdesk Primitives Preview",
};

export default function HelpdeskPreviewPage() {
  return (
    <div
      className="bg-background text-foreground"
      style={{ padding: 32, maxWidth: 1280, margin: "0 auto", minHeight: "100vh" }}
    >
      <h1
        className="font-heading"
        style={{
          fontSize: 32,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          marginBottom: 8,
        }}
      >
        Helpdesk Primitives
      </h1>
      <p
        style={{
          color: "var(--muted-foreground)",
          fontSize: 15,
          marginBottom: 40,
        }}
      >
        Visual QA surface. Orb, LighthouseAvatar, StatusLabel, Pill.
      </p>
      <PrimitivesGallery />
    </div>
  );
}
