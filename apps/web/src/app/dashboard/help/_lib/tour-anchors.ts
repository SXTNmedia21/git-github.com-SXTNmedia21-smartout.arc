/**
 * Tour anchor allow-list for /dashboard/help page-scoped UI tools.
 * G-ANCHORS invariant: every const value here MUST have a matching id="..." in
 * apps/web/src/app/dashboard/help/page.tsx. Enforced at audit time (T15).
 */
export const TOUR_ANCHORS = {
  panic_bar: "panic-bar",
  chat_hero: "chat-hero",
  active_ticket_badge: "active-ticket-badge",
  quick_paths: "quick-paths",
  curated_articles: "curated-articles",
  kontakt_footer: "kontakt-footer",
} as const;

export type TourAnchor = keyof typeof TOUR_ANCHORS;

export function isValidAnchor(id: string): id is TourAnchor {
  return id in TOUR_ANCHORS;
}

export function resolveAnchorId(anchor: TourAnchor): string {
  return TOUR_ANCHORS[anchor];
}
