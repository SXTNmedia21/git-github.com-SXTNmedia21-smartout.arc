/**
 * /dashboard/help — Multi-Tier Help Hub (ADR-0219)
 *
 * Five-tier server-rendered shell. Panic-first: Tier 0 is sticky and renders
 * before any AI or content surface.
 *
 * Tier 0: PanicBar         — sticky 56px, 3 buttons, routes to helpdesk_query.openTicket
 * Tier 1: BotssonChatHero  — chat hero capped 480px, Runtime A only
 * Tier 2: QuickPathCards   — 4 role-personalized navigation cards
 * Tier 3: CuratedArticlesList — 5 hand-curated KB articles, no RAG (v1)
 * Tier 4: Removed for v1   — tour-takeover deferred to v1.5
 * Tier 5: KontaktFooter    — svartider per kanal + status badge
 *
 * Component stubs (Tasks 9–14): all five tier components return null until
 * their tasks land. Page shell is stable — stubs avoid merge conflicts.
 *
 * Design spec: docs/superpowers/specs/2026-04-28-dashboard-help-design.md
 * ADR-0219, ADR-0220, ADR-0221
 */

import { redirect } from "next/navigation";
import { emit, nonEmpty } from "@smartout/telemetry";
import { PanicBar } from "./_components/PanicBar";
import { ActiveTicketBadge } from "./_components/ActiveTicketBadge";
import { BotssonChatHero } from "./_components/BotssonChatHero";
import { QuickPathCards } from "./_components/QuickPathCards";
import { CuratedArticlesList } from "./_components/CuratedArticlesList";
import { KontaktFooter } from "./_components/KontaktFooter";
import { HelpVoiceToolsBridge } from "@/app/Botsson/_components/help-voice-tools-bridge";
import { HelpTourToolsBridge } from "@/app/Botsson/_components/help-tour-tools-bridge";
import {
  getHelpProfileContext,
  getHelpdeskChannel,
  getActiveHelpdeskThreadsForProfile,
} from "./_data/queries";
import { CURATED_ARTICLES } from "./_data/curated-articles";

export const dynamic = "force-dynamic";

export default async function HelpPage() {
  // ── Auth + profile context ───────────────────────────────────────────────
  // Layout has already verified the user is authenticated and has an active
  // profile. This re-derives the same data (cached → zero extra DB hits) so
  // the page has typed access to firstName + role for personalization.
  const ctx = await getHelpProfileContext();
  if (!ctx) {
    // Belt-and-braces: layout should have caught this. Redirect is safe
    // because we never reach here in normal flow (layout redirects first).
    redirect("/login");
  }

  // ── Helpdesk channel resolution ──────────────────────────────────────────
  // PanicBar needs the desk_channel_id to route the openTicket Server Action.
  // Null = no helpdesk configured in this workspace → PanicBar degrades to
  // a mailto link (implemented in Task 9).
  const helpdeskChannel = await getHelpdeskChannel(ctx.workspaceId);

  // ── Active helpdesk threads (Tier 0.5 badge, T3–T6) ──────────────────────
  // role defaults to 'employee' if missing — safest visibility level.
  const resolvedRole = ctx.role ?? "employee";
  const activeThreads = await getActiveHelpdeskThreadsForProfile(
    ctx.profileId,
    ctx.workspaceId,
    resolvedRole,
  );

  // T6: emit view event ONLY when there is at least one active ticket.
  // Empty state must NOT emit (Journey 2).
  if (activeThreads.length >= 1) {
    const telemetryRole: "employee" | "admin" | "manager" =
      resolvedRole === "owner" ? "admin" : (resolvedRole as "employee" | "admin" | "manager");
    await emit({
      event: "help.active_ticket_badge_viewed",
      workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
      actor_id: nonEmpty(ctx.profileId, "actor_id"),
      properties: {
        ticket_count: activeThreads.length,
        role: telemetryRole,
      },
    });
  }

  return (
    <>
      {/* Tier 0: Panic Bar — sticky, always visible. G3 merge-blocker wired here. */}
      {/* TODO Task 9: replace stub with full PanicBar implementation */}
      <section id="panic-bar">
        <PanicBar
          helpdeskChannelId={helpdeskChannel?.id ?? null}
          helpdeskChannelName={helpdeskChannel?.name ?? null}
        />
      </section>

      {/* Page content — single column, max-w-3xl centered per design spec §Page Layout. */}
      <main className="mx-auto w-full max-w-3xl space-y-10 px-4 pt-20 pb-16">
        {/* Tier 0.5: Active Ticket Badge — renders only when profile has ≥1 open ticket.
            Empty state returns null (zero DOM). Wired in T3–T6 (m2-thread-continuation). */}
        {activeThreads.length >= 1 && (
          <section id="active-ticket-badge">
            <ActiveTicketBadge
              threads={activeThreads}
              role={resolvedRole as "employee" | "admin" | "manager" | "owner"}
              workspaceId={ctx.workspaceId}
              actorId={ctx.profileId}
            />
          </section>
        )}

        {/* Tier 1: Botsson Chat Hero — Runtime A only (chat → stage-engine).
            Corner orb (Runtime B) docked when hero is visible per design spec §Botsson dual-surface. */}
        {/* TODO Task 10: replace stub with full BotssonChatHero implementation */}
        <section id="chat-hero">
          <BotssonChatHero firstName={ctx.firstName ?? "deg"} workspaceId={ctx.workspaceId} />
        </section>

        {/* Tier 2: Quick-Path Cards — 4 role-personalized navigation cards.
            Click → KB section, NOT Botsson chat (Hunters skip Botsson entirely). */}
        {/* TODO Task 11: replace stub with full QuickPathCards implementation */}
        <section id="quick-paths">
          <QuickPathCards role={ctx.role} />
        </section>

        {/* Tier 3: Mest brukt nå — 5 hand-curated KB articles.
            Plain link list, no card chrome (40% chrome reduction principle).
            v2: replace CURATED_ARTICLES with RAG query against workspace_doc_chunk. */}
        {/* TODO Task 12: replace stub with full CuratedArticlesList implementation */}
        <section id="curated-articles">
          <CuratedArticlesList articles={CURATED_ARTICLES} />
        </section>

        {/* Tier 4: Removed for v1. Tour-takeover deferred to v1.5.
            Q4 (RAG-journeys), Q10 (emergency self-serve), Q11.d (cross-page takeover)
            are explicitly OUT-OF-SCOPE for v1 per G4 merge-blocker. */}

        {/* Tier 5: Kontakt footer — honest svartider per kanal + status badge. */}
        {/* TODO Task 13: replace stub with full KontaktFooter implementation */}
        <section id="kontakt-footer">
          <KontaktFooter />
        </section>
      </main>

      {/* G2 merge-blocker bridge: voice → chat handoff for KB queries.
          Runtime B (Ultravox) intercepts KB-query intent and returns "bytt til chat".
          Renders no UI — mounts as a client component to register the tool override. */}
      {/* TODO Task 14: replace stub with full HelpVoiceToolsBridge implementation */}
      <HelpVoiceToolsBridge />

      {/* Tour harness bridge: registers ui.navigate_to + ui.highlight_element with
          the Botsson dynamic tool registry. Renders TourHighlight overlay when
          an element highlight is active. workspaceId + actorId are safe to pass
          from the server-rendered page — they are non-secret profile identifiers. */}
      <HelpTourToolsBridge workspaceId={ctx.workspaceId} actorId={ctx.profileId} />
    </>
  );
}
