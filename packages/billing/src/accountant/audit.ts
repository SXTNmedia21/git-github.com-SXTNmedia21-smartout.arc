// accountant/audit.ts — accountant-side telemetry emit helpers.
//
// Thin wrappers around emit() from @smartout/telemetry for the three
// most frequent accountant read events. Callers (route handlers,
// page loaders in apps/admin) use these instead of calling emit()
// directly to keep event shapes consistent.
//
// actor_id NOTE (blueprint §7): accountants do not have workspace-scoped
// profiles. actor_id = user_identity.user_id (UUID from auth.getUser()).
// Blueprint §7 grants an exception for "billing" category events from
// accountant origin — documented inline below.
//
// workspace_id NOTE: `order list_viewed` events where no company filter
// is active are platform-scoped — pass null per registry comment
// "Nullable when an event is genuinely platform-scoped".

import { emit } from "@smartout/telemetry";
import type { NonEmptyString } from "@smartout/telemetry";

type EmitBaseArgs = {
  /**
   * actor_id — for accountant events this is user_identity.user_id,
   * NOT a profile_id. Blueprint §7 documents this exception for
   * category "billing" events from accountant origin.
   */
  actorId: NonEmptyString;
};

/** Emit `order detail_viewed` — fires when accountant opens an order detail page. */
export async function emitAccountantOrderViewed({
  actorId,
  invoiceId,
  workspaceId,
  source,
}: EmitBaseArgs & {
  invoiceId: string;
  workspaceId: NonEmptyString;
  source: "list_row" | "kartotek" | "deeplink";
}): Promise<void> {
  await emit({
    event: "order detail_viewed",
    workspace_id: workspaceId,
    actor_id: actorId,
    properties: {
      entity: { entity_type: "invoice", entity_id: invoiceId },
      data: { invoice_id: invoiceId, source },
    },
  });
}

/**
 * Emit `order downloaded` (PDF) — fires when accountant downloads a PDF.
 * For CSV use emitAccountantOrderExported.
 */
export async function emitAccountantOrderDownloaded({
  actorId,
  invoiceId,
  workspaceId,
}: EmitBaseArgs & {
  invoiceId: string;
  workspaceId: NonEmptyString;
}): Promise<void> {
  await emit({
    event: "order downloaded",
    workspace_id: workspaceId,
    actor_id: actorId,
    properties: {
      entity: { entity_type: "invoice", entity_id: invoiceId },
      data: { invoice_id: invoiceId, format: "pdf" as const, trigger: "manual" as const },
    },
  });
}

/**
 * Emit `order exported` (CSV) — fires when accountant downloads a CSV.
 * For PDF use emitAccountantOrderDownloaded.
 */
export async function emitAccountantOrderExported({
  actorId,
  invoiceId,
  workspaceId,
}: EmitBaseArgs & {
  invoiceId: string;
  workspaceId: NonEmptyString;
}): Promise<void> {
  await emit({
    event: "order exported",
    workspace_id: workspaceId,
    actor_id: actorId,
    properties: {
      entity: { entity_type: "invoice", entity_id: invoiceId },
      data: { invoice_id: invoiceId, format: "csv" as const, trigger: "manual" as const },
    },
  });
}

/** Emit `kartotek viewed` — fires when accountant opens a workspace kartotek page. */
export async function emitKartotekViewed({
  actorId,
  workspaceId,
  companyId,
  sectionsLoaded,
}: EmitBaseArgs & {
  workspaceId: NonEmptyString;
  companyId: string;
  sectionsLoaded: number;
}): Promise<void> {
  await emit({
    event: "kartotek viewed",
    workspace_id: workspaceId,
    actor_id: actorId,
    properties: {
      entity: { entity_type: "workspace", entity_id: workspaceId },
      data: { workspace_id: workspaceId, company_id: companyId, sections_loaded: sectionsLoaded },
    },
  });
}
