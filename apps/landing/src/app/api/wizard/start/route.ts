import { NextRequest, NextResponse } from 'next/server';

const ULTRAVOX_BASE = 'https://api.ultravox.ai/api';

export async function POST(request: NextRequest) {
  const ULTRAVOX_API_KEY = process.env.ULTRAVOX_API_KEY;

  if (!ULTRAVOX_API_KEY) {
    return NextResponse.json(
      { error: 'ULTRAVOX_API_KEY not configured in environment parameters' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { mission_id } = body;

    // Contact the MCP Server to get the session and stage
    const INTERVJU_MCP_URL = 'https://intervju-mcp.vercel.app';
    let mcpSessionId = null;

    try {
      const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (process.env.INTERVJU_MCP_WEBHOOK_SECRET) {
        authHeaders['x-webhook-secret'] = process.env.INTERVJU_MCP_WEBHOOK_SECRET;
      }

      const mcpRes = await fetch(`${INTERVJU_MCP_URL}/api/interview/start`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          mission_id: mission_id || 'chat-agent',
          channel: 'web'
        }),
      });
      
      if (mcpRes.ok) {
        const mcpData = await mcpRes.json();
        mcpSessionId = mcpData.session_id;
      } else {
        console.warn("MCP Server returned error:", await mcpRes.text());
      }
    } catch (e) {
      console.warn("Could not connect to MCP server", e);
    }

    const agentId = '7af2da8a-e9cc-4475-8e5f-a763b7209d7a';

    const response = await fetch(`${ULTRAVOX_BASE}/agents/${agentId}/calls`, {
      method: 'POST',
      headers: {
        'X-API-Key': ULTRAVOX_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        medium: { webRtc: {} },
        metadata: { 
          mission_id: mission_id || 'chat-agent',
          session_id: mcpSessionId || undefined
        }
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Ultravox API error:', errText);
      return NextResponse.json(
        { error: `Ultravox API error: ${response.status}`, details: errText },
        { status: 502 }
      );
    }

    const uvData = await response.json();

    return NextResponse.json({
      joinUrl: uvData.joinUrl,
      callId: uvData.callId,
    });
  } catch (error) {
    console.error('Failed to start wizard session:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
