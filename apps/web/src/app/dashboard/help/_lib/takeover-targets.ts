/**
 * Page-takeover allow-list for /dashboard/help.
 *
 * G-ANCHORS-class invariant (M3.2): every target_id here MUST resolve to
 * exactly one DOM element via `data-takeover` attribute on the page. Each
 * also requires a matching authority seed row in engine_authority_config
 * (level='disabled' default per ADR-0228).
 *
 * Adding a new target = new ADR + new seed migration + audit pass. Cannot
 * be sneaked in.
 */

export type TakeoverTarget = "panic_bar_human_button";

export type TakeoverActionType = "click" | "submit_form" | "wait_for_state";

export type TakeoverTargetSpec = {
  target_id: TakeoverTarget;
  selector: string; // CSS selector — single match required
  label: string; // Norwegian label shown in preview overlay
  capability: string; // engine_authority_config.capability slug
  action_type: TakeoverActionType;
};

export const TAKEOVER_TARGETS: Record<TakeoverTarget, TakeoverTargetSpec> = {
  panic_bar_human_button: {
    target_id: "panic_bar_human_button",
    selector: '[data-takeover="panic_bar_human"]',
    label: 'Klikk på "Jeg trenger et menneske"',
    capability: "page_takeover.help.panic_bar_human_button",
    action_type: "click",
  },
};

export function isValidTakeoverTarget(id: string): id is TakeoverTarget {
  return id in TAKEOVER_TARGETS;
}

export function resolveTakeoverTarget(id: TakeoverTarget): TakeoverTargetSpec {
  return TAKEOVER_TARGETS[id];
}

export type WaitForStatePredicate = "panic_bar_drawer_open";

export const WAIT_PREDICATES: Record<
  WaitForStatePredicate,
  { selector: string; description: string }
> = {
  panic_bar_drawer_open: {
    selector: '[data-state="open"][role="dialog"]',
    description: "Panic-bar konfirmasjonsdrawer er åpnet",
  },
};

export function isValidWaitPredicate(p: string): p is WaitForStatePredicate {
  return p in WAIT_PREDICATES;
}
