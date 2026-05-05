/**
 * admin.ts — Supabase admin client re-export
 *
 * Re-exports createAdminClient from @smartout/supabase/admin (service role).
 * Used only inside server actions that need to bypass RLS for atomic mutations.
 * Never use in Server Components that render user-facing data.
 */
export { createAdminClient } from "@smartout/supabase/admin";
