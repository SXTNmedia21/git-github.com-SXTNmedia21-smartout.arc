-- M1: 3 new enum types for announcement classification.
-- Verified absent from database.types.ts (Phase 2.5 §15 of V2 spec).
-- ADR-0369, ADR-0370, ADR-0371.

CREATE TYPE public.announcement_kind AS ENUM (
  'general',
  'new_menu',
  'new_hire',
  'staff_event',
  'schedule_change',
  'policy_update',
  'external'
);

COMMENT ON TYPE public.announcement_kind IS
  'Classification of announcement intent. Drives default tier, audience, and allowed link types. See DEFAULT_TIER_FOR_KIND constant in packages/ai/src/capabilities/communication/constants.ts. ADR-0371.';

CREATE TYPE public.announcement_tier AS ENUM (
  'social',
  'work',
  'external'
);

COMMENT ON TYPE public.announcement_tier IS
  'Tier drives notification priority and UI styling. social=community/0/push, work=work/1/push, external=work/2/push+email. Uses only existing notification_mode values (no new values added). ADR-0369 §4.1.';

CREATE TYPE public.announcement_link_type AS ENUM (
  'staff_event',
  'schedule_shift',
  'policy',
  'protocol',
  'profile',
  'menu_document',
  'external_url'
);

COMMENT ON TYPE public.announcement_link_type IS
  'Polymorphic entity link type for announcement_meta sidecar. Determines which table linked_entity_id references. policy_update kind requires policy link (CHECK enforced). ADR-0371.';
