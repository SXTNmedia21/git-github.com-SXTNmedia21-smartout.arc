/**
 * GET /api/platform-admin/communications/channels
 *
 * Lists channels across workspaces for the admin channel browser.
 * Supports filtering by workspace, channel type, and name search.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireGodmode } from "@/lib/platform-admin";

const VALID_TYPES = new Set(["department", "team", "news", "custom"]);
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(request: NextRequest) {
  const result = await requireGodmode();
  if (result.error) return result.error;
  const { admin } = result;

  const { searchParams } = request.nextUrl;
  const workspaceId = searchParams.get("workspace_id");
  const type = searchParams.get("type");
  const q = searchParams.get("q");
  const limitParam = Number(searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit = Math.min(Math.max(1, limitParam), MAX_LIMIT);

  if (type && !VALID_TYPES.has(type)) {
    return NextResponse.json(
      { error: `Invalid type. Must be one of: ${[...VALID_TYPES].join(", ")}` },
      { status: 400 },
    );
  }

  // Build query for channels with workspace name join
  let query = admin
    .from("channel")
    .select(
      `
      id,
      name,
      channel_type,
      workspace_id,
      department_id,
      is_archived,
      workspace!inner ( name )
    `,
    )
    .order("name", { ascending: true })
    .limit(limit);

  if (workspaceId) {
    query = query.eq("workspace_id", workspaceId);
  }

  if (type) {
    query = query.eq("channel_type", type as "department" | "team" | "news" | "custom");
  }

  if (q) {
    query = query.ilike("name", `%${q}%`);
  }

  // Exclude direct and session channels — not useful for broadcasting
  if (!type) {
    query = query.in("channel_type", ["department", "team", "news", "custom"]);
  }

  const { data: channels, error: channelError } = await query;

  if (channelError) {
    return NextResponse.json(
      { error: `Failed to fetch channels: ${channelError.message}` },
      { status: 500 },
    );
  }

  if (!channels || channels.length === 0) {
    return NextResponse.json({ data: [] });
  }

  // Fetch member counts for all channels in one query
  const channelIds = channels.map((c) => c.id);
  const { data: memberCounts } = await admin
    .from("channel_member")
    .select("channel_id")
    .in("channel_id", channelIds);

  const countMap = new Map<string, number>();
  for (const row of memberCounts ?? []) {
    countMap.set(row.channel_id, (countMap.get(row.channel_id) ?? 0) + 1);
  }

  const data = channels.map((c) => {
    const ws = c.workspace as unknown as { name: string } | null;
    return {
      channel_id: c.id,
      name: c.name,
      channel_type: c.channel_type,
      workspace_id: c.workspace_id,
      workspace_name: ws?.name ?? "Unknown",
      department_id: c.department_id,
      member_count: countMap.get(c.id) ?? 0,
      is_archived: c.is_archived,
    };
  });

  return NextResponse.json({ data });
}
