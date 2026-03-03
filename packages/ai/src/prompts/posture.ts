import type {
  Personality,
  ResolvedPosture,
  Situation,
  AuthorityLevel,
  ProfileRole,
  PostureAdaptFlags,
} from "../capabilities/types.js";

type PostureAdjustment = Partial<Personality>;

const ROLE_ADJUSTMENTS: Record<string, PostureAdjustment> = {
  trainee: { formality: -0.15, warmth: 0.15, verbosity: 0.2 },
  employee: {},
  manager: { formality: 0.05 },
  admin: { formality: 0.05, assertiveness: -0.05 },
  owner: { formality: 0.1, assertiveness: -0.1 },
};

const SITUATION_ADJUSTMENTS: Record<Situation, PostureAdjustment> = {
  onboarding: { warmth: 0.2, verbosity: 0.1 },
  haccp: { assertiveness: 0.2, warmth: -0.1, humor: -0.2 },
  scheduling: { assertiveness: 0.1, verbosity: -0.1 },
  training: { warmth: 0.1, verbosity: 0.1 },
  operations: { assertiveness: 0.1 },
  guardian: { formality: 0.1, assertiveness: 0.1 },
  general: {},
};

const AUTHORITY_ADJUSTMENTS: Record<string, PostureAdjustment> = {
  autonomous: { assertiveness: 0.1 },
  confirm: {},
  suggest: { assertiveness: -0.2 },
  read_only: { formality: 0.1, assertiveness: -0.3, verbosity: -0.1 },
  disabled: {},
};

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function applyAdjustment(base: Personality, adj: PostureAdjustment): Personality {
  return {
    formality: clamp(base.formality + (adj.formality ?? 0)),
    assertiveness: clamp(base.assertiveness + (adj.assertiveness ?? 0)),
    warmth: clamp(base.warmth + (adj.warmth ?? 0)),
    humor: clamp(base.humor + (adj.humor ?? 0)),
    verbosity: clamp(base.verbosity + (adj.verbosity ?? 0)),
  };
}

export function resolvePosture(
  base: Personality,
  role: ProfileRole,
  situation: Situation,
  authority: AuthorityLevel,
  relationshipScore: number,
  adaptFlags: PostureAdaptFlags,
): ResolvedPosture {
  let posture = { ...base };

  // Adapt to role
  if (adaptFlags.role) {
    posture = applyAdjustment(posture, ROLE_ADJUSTMENTS[role] ?? {});
  }

  // Adapt to situation
  if (adaptFlags.situation) {
    posture = applyAdjustment(posture, SITUATION_ADJUSTMENTS[situation]);
  }

  // Adapt to authority
  if (adaptFlags.authority) {
    posture = applyAdjustment(posture, AUTHORITY_ADJUSTMENTS[authority] ?? {});
  }

  // Adapt to relationship (always applied)
  if (relationshipScore > 0.6) {
    posture = applyAdjustment(posture, { formality: -0.1, humor: 0.1, verbosity: -0.05 });
  } else if (relationshipScore < 0.2) {
    posture = applyAdjustment(posture, { formality: 0.1, humor: -0.05, verbosity: 0.1 });
  }

  return posture;
}
