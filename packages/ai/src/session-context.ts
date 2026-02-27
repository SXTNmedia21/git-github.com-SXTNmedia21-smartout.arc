// packages/ai/src/session-context.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@smartout/supabase";

type TranscriptEntry = {
  speaker: string;
  text: string;
  timestamp: string;
};

type AnalysisEntry = {
  content: string;
  updated_at: string;
};

/**
 * Supabase-backed session memory for AI agents.
 * Wraps read/write operations on the onboarding_session table.
 * Works with any SupabaseClient (cookie-based in Next.js, service-role in LiveKit).
 */
export class SessionContext {
  constructor(
    private supabase: SupabaseClient<Database>,
    public readonly sessionId: string,
  ) {}

  async getSession() {
    const { data, error } = await this.supabase
      .from("onboarding_session")
      .select("*")
      .eq("id", this.sessionId)
      .single();

    if (error) throw new Error(`Failed to load session: ${error.message}`);
    return data;
  }

  async appendTranscript(speaker: string, text: string) {
    const session = await this.getSession();
    const scraped =
      (session.scraped_data as Record<string, unknown> | null) ?? {};
    const transcripts = (scraped.transcripts as TranscriptEntry[]) ?? [];

    transcripts.push({
      speaker,
      text,
      timestamp: new Date().toISOString(),
    });

    const { error } = await this.supabase
      .from("onboarding_session")
      .update({
        scraped_data: { ...scraped, transcripts } as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", this.sessionId);

    if (error) throw new Error(`Failed to save transcript: ${error.message}`);
  }

  async saveAnalysis(topic: string, content: string) {
    const session = await this.getSession();
    const analysis =
      (session.ai_analysis as Record<string, AnalysisEntry> | null) ?? {};

    analysis[topic] = {
      content,
      updated_at: new Date().toISOString(),
    };

    const { error } = await this.supabase
      .from("onboarding_session")
      .update({
        ai_analysis: analysis as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", this.sessionId);

    if (error) throw new Error(`Failed to save analysis: ${error.message}`);
  }

  async updateSuggestions(data: {
    departments?: string[];
    teams?: string[];
    locations?: string[];
    positions?: string[];
  }) {
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (data.departments)
      updates.suggested_departments = data.departments as unknown as Json;
    if (data.teams) updates.suggested_teams = data.teams as unknown as Json;
    if (data.locations)
      updates.suggested_locations = data.locations as unknown as Json;
    if (data.positions)
      updates.suggested_positions = data.positions as unknown as Json;

    const { error } = await this.supabase
      .from("onboarding_session")
      .update(updates)
      .eq("id", this.sessionId);

    if (error)
      throw new Error(`Failed to update suggestions: ${error.message}`);
  }
}
