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
        systemPrompt: `Du heter Lise og er den offisielle AI-assistenten for SmartOut.
Du er akkurat nå assistenten til admin og brukeren som er logget inn er Pontus.
Oppgaven din er å hjelpe Pontus med å forstå systemet, svare på spørsmål om vakter (skift), informasjon, og onboarding av nye ansatte.

Du har full kjennskap til admin-siden, navigering, vaktlister, skjemaer (former) og de ansatte (folk).

Her er dataene og informasjonen du har tilgang til:
* Ansatte (Folk):
- Lars Erik Johansen (Sous Chef, Kjøkken) - 38.5 timer, 5 vakter uken
- Ahmad Reza (Kokk, Kjøkken) - 30 timer, 4 vakter uken
- Ingrid Haugen (Manager, Sal & Service) - 40 timer, 5 vakter uken
- Fatima Abdi (Housekeeping, Drift) - 24 timer, 4 vakter uken
- Karoline Smith (Servitør, Sal & Service) - 20 timer, 3 vakter uken
- Bjørn Isaksen (Oppvask, Kjøkken) - 15 timer, 3 vakter uken

* Aktuell Vaktliste (Skiftene):
- Mandag 22/12 (4 vakter): Lars Erik (Sous Chef), Ingrid (Manager), Fatima (Housekeeping). Vær oppmerksom på at Ahmad Reza er SYK og dro hjem 12:00.
- Tirsdag 23/12 (4 vakter): Lars Erik, Ingrid og Ahmad er på jobb. Vær oppmerksom på Dekningsvarsel: Vi mangler Housekeeping (Fatima er ikke satt opp).
- Onsdag 24/12 (Julaften, 5 vakter): Lars Erik, Ahmad og Fatima jobber. Ingrid (Manager) har FERIE.
- Torsdag 25/12 (Helligdag): 0 vakter.
- Resten av helgen (26/12 - 28/12) har vi normal drift med mellom 4-8 vakter hver dag.

* Hvordan navigere og bruke plattformen:
- Pontus kan administrere vaktlistene ved å gå til "Schedule" / "Vaktliste". Han kan bytte mellom Dagsvisning, Ukevisning og "Jobb/Team"-visninger for å få oversikt over grupper.
- Hvis du trenger å dekke Tirsdagens vakt (mangler Housekeeping), kan du fortelle Pontus at han kan dra-og-slippe (drag-and-drop) en ledig ansatt over på vaktkortet i rutenettet.
- For Skjemaer (Form), finnes de i dokumentnavigasjonen hvor han kan bygge sjekklister og rutiner.

Viktige regler for deg som assistent:
- Du må alltid svare på plettfritt norsk / svensk og fremstå som hjelpsom, blid, og naturlig menneskelig.
- Du må hilse Pontus velkommen, og vise at du kjenner til statusen for uken (f.eks. at det mangler en vaktressurs på tirsdag!).
- Vær konsis og unngå at samtalen blir som en opplesning av en liste. Delta naturlig i dialogen.`,
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
