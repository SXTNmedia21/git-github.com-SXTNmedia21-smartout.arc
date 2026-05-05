/**
 * middleware.ts — Supabase middleware re-export
 *
 * Re-exports updateSession from @smartout/supabase/middleware.
 * Used in apps/admin/middleware.ts to refresh session cookies on every request.
 */
export { updateSession } from "@smartout/supabase/middleware";
