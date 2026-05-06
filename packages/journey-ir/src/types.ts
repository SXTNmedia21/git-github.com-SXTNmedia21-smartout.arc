/**
 * JourneyIR — canonical intermediate representation for the Journey Engine.
 *
 * One authoring source (markdown / TS file / authoring UI) → JourneyIR (this
 * type) → five artefacts (Playwright script via protocol-runner, mission
 * prompt, USER-GUIDE MDX, inference pattern, Fjernkontroll card).
 *
 * Per ADR-0171, this type lives in `packages/journey-ir` as the canonical
 * home. Consumers import from `@smartout/journey-ir` — the legacy
 * adjacent-to-capabilities path is forbidden; see ADR-0171 for the rule.
 *
 * M3.5 (ADR-0178) — schema version 2.0.0:
 *   - ADDITIVE ONLY. Every v2 field is optional. v1 IRs (`version: "1.0.0"`)
 *     still parse unchanged. The runner, M4 authoring UI, and M5 Fjernkontroll
 *     all consume this shape.
 *   - Introduces typed `JourneyAction` discriminated union mirroring
 *     `apps/e2e/protocols/schema.ts` so the runner can read the IR natively
 *     and the migration adapter is deleted in the same M3.5 sub-sortie
 *     (ADR-0174 C.11 closure).
 *   - Runtime state for the Fjernkontroll (`idle | running | paused | stuck |
 *     completed | failed`) lives at the runtime layer and is OWNED BY ADR-0177
 *     (`apps/web/src/components/journey/**`). It is deliberately NOT mirrored
 *     into the authoring IR here — IR describes authoring-time intent; the
 *     Fjernkontroll owns runtime execution state.
 */

/**
 * Package version string, bumped independently of schema version. Useful for
 * debug output and cross-package dependency diagnostics.
 */
import type { SpeedProfile } from "./speed-profile";

export const JOURNEY_IR_PACKAGE_VERSION = "0.0.1" as const;

/**
 * Currently supported schema versions. All parse; writes must use
 * `CURRENT_IR_VERSION`. Bumps require an ADR (ADR-0178 bumped 1.0.0 → 2.0.0;
 * ADR-0194 added "2.1.0" with optional publish-mission fields).
 */
export type JourneyIRSchemaVersion = "1.0.0" | "2.0.0" | "2.1.0";

/**
 * The version that new writes MUST use. Older versions are still accepted by
 * readers (additive compatibility) but must not be written post-ADR-0178.
 * Enforced by `assertCurrentIrVersion()` in `./compile.ts`.
 */
export const CURRENT_IR_VERSION: JourneyIRSchemaVersion = "2.0.0";

/**
 * Actor role authoring surface — optional on the IR (v2).
 * Mirrors `ProtocolDefinition.actor` so runner samples round-trip losslessly.
 * Used by:
 *   - protocol-runner to select auth/session setup.
 *   - M4 authoring UI for selector state.
 * Does NOT define runtime permission — that is owned by C4 (engine_authority_config).
 */
export type JourneyActor = "owner" | "admin" | "manager" | "employee";

/**
 * Target platform for a journey run — optional on the IR (v2).
 * Mirrors `ProtocolDefinition.platform`.
 */
export type JourneyPlatform = "web" | "mobile";

/**
 * Auth profile identifier used to bootstrap the run — optional on the IR (v2).
 * Mirrors `ProtocolDefinition.auth_profile`. Advisory only; real auth is
 * resolved server-side per ADR-0176 Invariant 3.
 */
export type JourneyAuthProfile = "admin" | "employee" | "godmode";

/**
 * Precondition assertions that must hold before a run starts — optional (v2).
 * Each entry describes a DB row shape the runner verifies / seeds.
 * Mirrors `ProtocolDefinition.preconditions`.
 */
export interface JourneyPreconditions {
  readonly db_state?: ReadonlyArray<{
    readonly table: string;
    readonly where: Readonly<Record<string, unknown>>;
    readonly expect: Readonly<Record<string, unknown>>;
  }>;
}

/**
 * Typed step action — discriminated union (v2).
 *
 * Mirrors the 7-variant union in `apps/e2e/protocols/schema.ts::ActionSchema`
 * so `protocol-runner.ts` reads this type directly. Authoring tools (M4 UI)
 * serialize to this shape; runtime tools (M5 Fjernkontroll) interpret it for
 * per-step UI cues.
 *
 * Coexists with the legacy `JourneyStep.action: string` summary so v1 IRs
 * continue to parse without modification. Runner consumers prefer
 * `JourneyStep.actions` when present; docs/mission/audit generators still
 * read `JourneyStep.action` for human-readable summaries.
 */
export type JourneyAction =
  | { readonly type: "navigate"; readonly url: string }
  | { readonly type: "fill"; readonly testid: string; readonly value: string }
  | { readonly type: "click"; readonly testid: string }
  | { readonly type: "click_text"; readonly text: string }
  | { readonly type: "wait_visible"; readonly testid: string }
  | { readonly type: "wait_hidden"; readonly testid: string }
  | { readonly type: "settle"; readonly ms: number };

/**
 * Typed step gate — discriminated union (v2).
 *
 * Mirrors `apps/e2e/protocols/schema.ts::GateSchema` so the Playwright
 * `protocol-runner` verifies step completion directly from the IR. The
 * legacy `JourneyStep.assertion: string` summary remains for docs/audit
 * output; runner consumers prefer the typed `gate` when present.
 *
 * ADR-0178 additive extension — originally only actions were typed, but
 * the runner retarget in M3.5 commit 4 requires the gate shape too. Adding
 * it here (optional, versioned under `"2.0.0"`) keeps the adapter deletable
 * in commit 5 without losing verification fidelity.
 */
export type JourneyGate =
  | {
      readonly type: "db_record";
      readonly table: string;
      readonly where: Readonly<Record<string, unknown>>;
      readonly expect: Readonly<Record<string, unknown>>;
      readonly timeout_ms?: number;
      readonly retry_interval_ms?: number;
    }
  | {
      readonly type: "ui_state";
      readonly testid: string;
      readonly visible?: boolean;
      readonly timeout_ms?: number;
    }
  | {
      readonly type: "url_match";
      readonly pattern: string;
      readonly timeout_ms?: number;
    }
  | {
      readonly type: "telemetry_event";
      readonly event_name: string;
      readonly actor_id?: string;
      readonly since?: string;
      readonly timeout_ms?: number;
      readonly retry_interval_ms?: number;
    };

/**
 * A single deterministic step in a journey.
 *
 * v1 fields (unchanged):
 *   - `key`  — stable identifier; matches `journey_step.slug` in DB and what
 *              `emit()` sends as `step_id` in the telemetry payload.
 *   - `title` — human-readable label; renders in Fjernkontroll + USER-GUIDE.
 *   - `action` — free-form short imperative summary string
 *                ("Click Login", "Fill email field"). Drives docs/mission/audit
 *                output.
 *   - `assertion` — what must be true after the action before the step counts
 *                   as complete. Drives Playwright expects + inference-pattern
 *                   completion detection.
 *   - `timeoutMs` — optional per-step stuck threshold.
 *
 * v2 additions (ADR-0178, optional):
 *   - `actions` — typed action list the runner executes. When present, runner
 *                 ignores the legacy `action` string. When absent, runner
 *                 falls back to reading `action` (not yet implemented — runner
 *                 retarget in M3.5 commit 4 requires `actions` for live runs).
 *   - `gate`    — typed verification gate. Runner uses this to drive
 *                 `checkGate(step.gate, ...)`. Legacy `assertion` string
 *                 remains for docs/audit human-readable output.
 *   - `order`   — 1-based display order. Optional; runner uses array index
 *                 when omitted (matches legacy `ProtocolStep.order` semantics).
 *   - `screenshot` — capture flag for the runner. Optional; defaults to true
 *                 in the runner.
 */
export interface JourneyStep {
  readonly key: string;
  readonly title: string;
  readonly action: string;
  readonly assertion: string;
  readonly timeoutMs?: number;
  // --- v2 additions (ADR-0178) ---
  readonly actions?: readonly JourneyAction[];
  readonly gate?: JourneyGate;
  readonly order?: number;
  readonly screenshot?: boolean;
  /**
   * Optional human-readable description. When present, used by mission/docs
   * generators in preference to the `action` summary. Carried through by the
   * adapter to preserve `ProtocolStep.description`.
   */
  readonly description?: string;
}

/**
 * A full JourneyIR document.
 *
 * v1 fields (unchanged):
 *   - `version` — JourneyIR schema version. v1 IRs carry `"1.0.0"`; new writes
 *                 MUST use `CURRENT_IR_VERSION` (= `"2.0.0"` post-ADR-0178).
 *   - `slug` — stable journey identifier; matches `journey.slug` in DB and
 *              `engine_process.id` post-compile.
 *   - `title` — human-readable journey title.
 *   - `module` — top-level feature area (e.g. `schedule`, `onboarding`).
 *   - `steps` — ordered step list; index implies `step_order`.
 *
 * v2 additions (ADR-0178, all optional):
 *   - `actor` — role authoring surface. Advisory; runtime auth is server-derived.
 *   - `platform` — run target.
 *   - `auth_profile` — bootstrap auth profile.
 *   - `preconditions` — DB fixture assertions checked before a run starts.
 *   - `entry_url` — URL the runner navigates to at the start of the run.
 *   - `success_gate` — terminal verification the runner applies after the
 *                      last step (typed mirror of legacy `ProtocolDefinition.success_gate`).
 */
export interface JourneyIR {
  readonly version: JourneyIRSchemaVersion;
  readonly slug: string;
  readonly title: string;
  readonly module: string;
  readonly steps: readonly JourneyStep[];
  // --- v2 additions (ADR-0178) ---
  readonly actor?: JourneyActor;
  readonly platform?: JourneyPlatform;
  readonly auth_profile?: JourneyAuthProfile;
  readonly preconditions?: JourneyPreconditions;
  readonly entry_url?: string;
  readonly success_gate?: JourneyGate;
  /**
   * Speed profile for the runner. Default `full` (CI speed).
   * Runtime override via JOURNEY_SPEED_PROFILE env var takes precedence.
   */
  readonly speed_profile?: SpeedProfile;
}
