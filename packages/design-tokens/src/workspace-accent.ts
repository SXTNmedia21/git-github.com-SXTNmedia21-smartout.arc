// packages/design-tokens/src/workspace-accent.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Workspace Accent — per-workspace OKLCH color derivation.
// Deterministic: same slug → same color, every time, everywhere.
//
// Used by InvitationContextHeader, WorkspaceCard, and any surface
// that visually attributes a workspace.
//
// Design intent: stay within the Nordic Split warm envelope.
// Fixed chroma (0.14) + fixed lightness (0.62) keep all workspace
// colors perceptually calm and readable against the cream/dark surfaces.
// Only hue rotates — full 0-360 wheel for maximum distinction.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Derive a deterministic OKLCH color string from a workspace slug.
 *
 * Hashes slug → hue (0-360), with fixed chroma 0.14 + lightness 0.62
 * to keep the color within the Nordic Split warm envelope.
 *
 * Same slug always yields the same color (pure, side-effect free).
 *
 * @example
 *   workspaceAccentOklch("cafe-skuta") // "oklch(0.62 0.14 217)"
 *   workspaceAccentOklch("peppes")     // "oklch(0.62 0.14 104)"
 */
export function workspaceAccentOklch(slug: string): string {
  return `oklch(0.62 0.14 ${workspaceAccentHue(slug)})`;
}

/**
 * Raw hue value (0-360) derived from slug. Exposed for callers that
 * want to compose their own OKLCH string (e.g. lighter/darker variants
 * for hover or active states).
 */
export function workspaceAccentHue(slug: string): number {
  // djb2-ish hash: good distribution, no imports, deterministic.
  let h = 5381;
  for (let i = 0; i < slug.length; i++) {
    h = (h * 33 + slug.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}
