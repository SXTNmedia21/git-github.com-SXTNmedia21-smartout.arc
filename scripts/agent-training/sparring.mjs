/**
 * Agent Training: Sparring Session
 *
 * Runs a simulated conversation between Botsson (onboarding agent)
 * and a test customer persona. Logs the full transcript with tool calls.
 *
 * Usage:
 *   node scripts/agent-training/sparring.mjs
 *
 * Environment:
 *   OPENROUTER_API_KEY — required (from .env.local)
 */

import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync, writeFileSync, readFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env from root .env.local (no dotenv dependency)
const envPath = resolve(__dirname, "../../.env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    const value = trimmed.slice(eqIdx + 1);
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
} catch {
  // ignore if missing
}

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  console.error("Missing OPENROUTER_API_KEY in .env.local");
  process.exit(1);
}

const MODEL = "anthropic/claude-sonnet-4";
const MAX_TURNS = 20;

// ─── Botsson System Prompt (from missions/registry.ts) ───

const BOTSSON_SYSTEM_PROMPT = `Du er Botsson. Du jobber i Smartout. Du hjelper folk sette opp arbeidsplassen sin.

DIN PERSONLIGHET:
Du er den kollegaen alle liker — skarp, varm, lett å snakke med. Du har jobbet i servicebransjen selv. Du skjønner stress, turnover, sesongvariasjoner og alt det innebærer. Du snakker som en som har stått bak en bar, ikke som en som har lest en manual.

Du er aldri formell. Du sier "kult" og "nice" og "det gir mening". Du er direkte uten å være brå. Du stiller spørsmål fordi du er genuint nysgjerrig, ikke fordi du har en sjekkliste.

HVORDAN DU SNAKKER:
- Kort. Maks 1-2 setninger, så venter du. Samtale, ikke monolog.
- Reager på det du hører. "Restaurant i Trondheim? Kult. Sesong nå eller helårs?"
- Koble informasjon sammen. Ikke spør ting du allerede kan utlede.
- Norsk. Forstå svensk og dansk. Svar alltid på norsk.
- Aldri repeter deg selv. Aldri oppsummer uten grunn. Aldri spør "er det noe mer?"

ÅPNING:
Si: "Hei! Jeg er Botsson. Jeg setter opp Smartout for deg. Hva heter du?"
Vent. Når du har navnet: "Kult, [navn]. Hva heter stedet du jobber på, og hvor ligger det?"
Når du har navn + sted: kall triggerScrape(companyName, city). Kall advanceToNextSection.
Si: "Fint — jeg søker opp [bedrift] nå."

VERKTØY:
Du har verktøy som oppdaterer skjermen i sanntid. Bruk dem mens du snakker — aldri nevn verktøynavnene til brukeren.
- triggerScrape — søk opp bedriften (bruk companyName + city, IKKE url/org)
- getOnboardingState — se hva systemet allerede vet
- updateBusiness — fyll inn bedriftsinfo
- updateSeason — sett sesong
- addDepartments — legg til avdelinger
- addLocations — legg til lokasjoner
- addZones — legg til soner i en lokasjon
- addProcedures — legg til prosedyrer
- advanceToNextSection — scroll videre
- addKeyFact — vis fakta i panelet (bruk aktivt: namn, bedrift, by, bransje, ansatte, sesong)
- saveMemory — lagre viktig info for fremtidige samtaler
- finalizeOnboarding — aktiver arbeidsplassen og gå til dashboardet. Kall denne NÅR alt er klart og brukeren bekrefter.

SAMTALEN:
Det finnes ingen steg. Det er en samtale. Du har ting du må vite, og du finner dem ut naturlig.

1. NAMN + BEDRIFT → triggerScrape. Ferdig. Gå videre.

2. NÅR SKANNINGEN ER FERDIG: Du får en systemmelding med hva som ble funnet.
   Les opp høydepunktene: "[Bedrift], [ansatte] ansatte, [bransje]. [Rating] på Google. Stemmer det?"
   Fiks det som er feil med updateBusiness.

3. SESONG: "Hvordan ser året ut hos dere? Kjører dere sesong eller helårs?"
   Fyll inn med updateSeason. Ikke forklar hva en sesong er med mindre de spør.

4. AVDELINGER: "Hvilke avdelinger har dere?"
   Legg til med addDepartments. Ikke spør om leder og teamstruktur med mindre det er naturlig.

5. LOKASJONER: "Holder dere til ett sted, eller har dere flere?"
   addLocations. Spør om soner bare hvis det er en restaurant/hotell.

6. PROSEDYRER: Anbefal basert på bransje: "Dere trenger sikkert temperaturkontroll og åpningsrutine. Skal jeg legge dem til?"
   addProcedures. Ferdig.

7. AVSLUTT: "Da er vi i mål, [namn]. Velkommen til Smartout." Kall finalizeOnboarding for å aktivere arbeidsplassen.

VIKTIG:
- Du driver. Aldri "hva vil du gjøre nå?" — du vet hva som gjenstår.
- Hvis brukeren hopper til et annet tema, følg dem. Kom tilbake til det du trenger senere.
- Bekreft med brukeren FØR du lagrer minner (saveMemory). Si "Skal jeg notere det?"
- Bruk addKeyFact for alt viktig du lærer — panelet bygger seg opp visuelt.
- Aldri si "steg", "seksjon", "prosess". Det er en samtale mellom to mennesker.

VIKTIG FOR SIMULERING:
I denne treningsøkten simulerer du samtalen via tekst (ikke stemme). Når du vil bruke et verktøy, skriv det slik:
[TOOL: toolName(param1, param2)]
Skriv tool-kallet FØRST, deretter din respons til brukeren på neste linje.`;

// ─── Customer Persona ───

const CUSTOMER_SYSTEM_PROMPT = `Du er Magnus, 42 år, kock och krögare i Trondheim. Du äger "Sjøbris" — en restaurang med 18 anställda vid vattnet. Du har drivit stället i 6 år.

DIN PERSONLIGHET:
- Halvdistraherad. Du svarar på frågor men hoppar ibland till andra ämnen.
- Pratglad men inte fokuserad. Du berättar anekdoter mitt i samtalet.
- Lite skeptisk men inte negativt — mer "ja men hur funkar det egentligen?"
- Du pratar svenska (du är egentligen uppvuxen i Göteborg, flyttade till Norge).
- Du blandar svenska och norska naturligt.

DITT SCENARIO:
- Restaurangen heter "Sjøbris" och ligger i Trondheim vid Nidelva
- 18 anställda: 6 i köket, 4 i baren, 6 i salen, 2 diskare
- Avdelningar: Kjøkken, Bar, Sal
- Ni kör säsongsbaserat: sommarsäsong (uteservering april-september) + vintersäsong (oktober-mars)
- Just nu i vintersäsong, men planerar redan sommaren
- Du har en uteservering som öppnar i april med 40 platser
- Huvudlokal: inomhus med 60 platser + bar med 15 barkrukker
- Rutiner ni behöver: temperaturkontroll, åpningsrutine, stängningsrutin, varemottak, allergenhåndtering

DITT BETEENDE I SAMTALET:
1. Svara på Botssons frågor, men inte alltid rakt på.
2. Hoppa ibland till sidospår: "Förresten, vi hade en incident med kylskåpet förra veckan..."
3. Ställ motfrågor: "Men hur funkar det med säsongsanställda då?"
4. Glöm ibland att svara på en del av frågan — Botsson behöver följa upp.
5. Var positiv men realistisk: "Det låter bra, men vi har provat massa system förut..."
6. Nämn ibland problem: "Vi har hög turnover på somrarna, typ 60%"
7. Du är INTE svår — du är realistisk. Du vill att det ska funka.

REGLER:
- Svara med 1-3 meningar. Ibland kortare. Aldrig långa monologer.
- Blanda svenska och norska naturligt.
- Om Botsson frågar ditt namn: "Magnus. Magnus Lindberg."
- Om Botsson frågar om restaurangen: berätta om Sjøbris, men ta omvägar.
- Reagera på det Botsson gör med skärmen: "Åh, jag ser att ni hittade oss. Stämmer det där?"`;

// ─── Tool Response Mocks ───

function mockToolResponse(toolCall) {
  const match = toolCall.match(/\[TOOL:\s*(\w+)\(([^)]*)\)\]/);
  if (!match) return null;

  const toolName = match[1];
  const args = match[2];

  switch (toolName) {
    case "triggerScrape":
      return `[SYSTEM: Skanningsresultat for Sjøbris]
Bedrift: Sjøbris AS
Org.nr: 912 345 678
Adresse: Kjøpmannsgata 44, 7012 Trondheim
Bransje: Restaurant / Servering
Ansatte: 18
Google Rating: 4.4 (312 anmeldelser)
Nettside: sjobris.no
Beskrivelse: "Sjømat og norsk kjøkken ved Nidelva. Uteservering i sommerhalvåret."
Åpningstider: Man-Lør 11:00-23:00, Søn 12:00-22:00`;

    case "getOnboardingState":
      return `[SYSTEM: Current onboarding state]
section: business
business: { name: "", orgNumber: "", website: "" }
season: { name: "", startDate: "", endDate: "" }
departments: []
locations: []
procedures: []`;

    case "updateBusiness":
      return `[SYSTEM: Business updated successfully]`;
    case "updateSeason":
      return `[SYSTEM: Season updated successfully]`;
    case "addDepartments":
      return `[SYSTEM: Departments added: ${args}]`;
    case "addLocations":
      return `[SYSTEM: Locations added: ${args}]`;
    case "addZones":
      return `[SYSTEM: Zones added: ${args}]`;
    case "addProcedures":
      return `[SYSTEM: Procedures added: ${args}]`;
    case "advanceToNextSection":
      return `[SYSTEM: Scrolled to next section]`;
    case "addKeyFact":
      return `[SYSTEM: Key fact added: ${args}]`;
    case "saveMemory":
      return `[SYSTEM: Memory saved: ${args}]`;
    case "finalizeOnboarding":
      return `[SYSTEM: Workspace "Sjøbris" activated! Redirecting to dashboard. slug: sjobris]`;
    default:
      return `[SYSTEM: Unknown tool: ${toolName}]`;
  }
}

// ─── API Call ───

async function chat(messages) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://smartout.ai",
      "X-Title": "Smartout Agent Training",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.6,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content ?? "";
}

// ─── Conversation Loop ───

async function runSparring() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  AGENT TRAINING: Botsson vs Magnus (halvdistraherad kund)");
  console.log("═══════════════════════════════════════════════════════════\n");

  const transcript = [];
  const botssonHistory = [{ role: "system", content: BOTSSON_SYSTEM_PROMPT }];
  const customerHistory = [{ role: "system", content: CUSTOMER_SYSTEM_PROMPT }];

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    // ── Botsson's turn ──
    const botssonResponse = await chat(botssonHistory);

    // Extract tool calls
    const toolCalls = [];
    const toolRegex = /\[TOOL:\s*\w+\([^)]*\)\]/g;
    let toolMatch;
    while ((toolMatch = toolRegex.exec(botssonResponse)) !== null) {
      toolCalls.push(toolMatch[0]);
    }

    // Remove tool calls from the visible text
    const botssonText = botssonResponse
      .replace(toolRegex, "")
      .trim()
      .replace(/\n{3,}/g, "\n\n");

    console.log(`── Turn ${turn} ──`);

    // Log tool calls
    if (toolCalls.length > 0) {
      for (const tc of toolCalls) {
        console.log(`  🔧 ${tc}`);
        const mockResponse = mockToolResponse(tc);
        if (mockResponse) {
          console.log(`     → ${mockResponse.split("\n")[0]}`);
          // Feed tool response back to Botsson
          botssonHistory.push({ role: "assistant", content: botssonResponse });
          botssonHistory.push({ role: "user", content: mockResponse });
          transcript.push({ turn, speaker: "system", text: mockResponse });
        }
      }
    }

    console.log(`  🤖 Botsson: ${botssonText}`);
    transcript.push({ turn, speaker: "botsson", text: botssonText, toolCalls });

    // Check if finalized
    if (toolCalls.some((tc) => tc.includes("finalizeOnboarding"))) {
      console.log("\n✅ Onboarding complete! Session finalized.\n");
      break;
    }

    // Add Botsson's message to histories
    if (toolCalls.length === 0) {
      botssonHistory.push({ role: "assistant", content: botssonResponse });
    }
    // Customer sees only the human-readable text
    customerHistory.push({ role: "user", content: botssonText });

    // ── Magnus's turn ──
    const customerResponse = await chat(customerHistory);
    console.log(`  👤 Magnus: ${customerResponse}`);
    transcript.push({ turn, speaker: "magnus", text: customerResponse });

    // Add to histories
    customerHistory.push({ role: "assistant", content: customerResponse });
    botssonHistory.push({ role: "user", content: customerResponse });

    console.log();
  }

  // ── Write transcript ──
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outputPath = resolve(__dirname, `../../docs/training/sparring-${timestamp}.md`);

  const md = generateMarkdown(transcript);
  mkdirSync(resolve(__dirname, "../../docs/training"), { recursive: true });
  writeFileSync(outputPath, md);

  console.log(`\n📄 Transcript saved to: ${outputPath}`);
  console.log("\n═══════════════════════════════════════════════════════════");
  printAnalysis(transcript);
}

// ─── Markdown Output ───

function generateMarkdown(transcript) {
  const lines = [
    "---",
    "title: Agent Training — Sparring Session",
    `date: ${new Date().toISOString().split("T")[0]}`,
    "persona: Magnus (halvdistraherad kund)",
    "agent: Botsson (onboarding-interview)",
    "model: " + MODEL,
    `turns: ${transcript.filter((t) => t.speaker !== "system").length}`,
    "---",
    "",
    "# Agent Training — Sparring Session",
    "",
    `**Date:** ${new Date().toISOString()}`,
    `**Persona:** Magnus, 42, kock och krögare i Trondheim (halvdistraherad)`,
    `**Agent:** Botsson (onboarding-interview mission)`,
    `**Model:** ${MODEL}`,
    "",
    "---",
    "",
  ];

  let currentTurn = 0;
  for (const entry of transcript) {
    if (entry.turn !== currentTurn) {
      currentTurn = entry.turn;
      lines.push(`## Turn ${entry.turn}`, "");
    }

    if (entry.speaker === "botsson") {
      if (entry.toolCalls && entry.toolCalls.length > 0) {
        for (const tc of entry.toolCalls) {
          lines.push(`> 🔧 \`${tc}\``);
        }
        lines.push("");
      }
      lines.push(`**🤖 Botsson:** ${entry.text}`, "");
    } else if (entry.speaker === "magnus") {
      lines.push(`**👤 Magnus:** ${entry.text}`, "");
    } else if (entry.speaker === "system") {
      lines.push(`> _${entry.text.split("\n")[0]}_`, "");
    }
  }

  return lines.join("\n");
}

// ─── Analysis ───

function printAnalysis(transcript) {
  const botssonTurns = transcript.filter((t) => t.speaker === "botsson");
  const customerTurns = transcript.filter((t) => t.speaker === "magnus");
  const allToolCalls = botssonTurns.flatMap((t) => t.toolCalls ?? []);

  const toolNames = allToolCalls.map((tc) => {
    const match = tc.match(/\[TOOL:\s*(\w+)/);
    return match?.[1] ?? "unknown";
  });

  const toolCounts = {};
  for (const name of toolNames) {
    toolCounts[name] = (toolCounts[name] ?? 0) + 1;
  }

  console.log("\n📊 ANALYSIS");
  console.log("───────────");
  console.log(`Total turns: ${botssonTurns.length + customerTurns.length}`);
  console.log(`Botsson turns: ${botssonTurns.length}`);
  console.log(`Magnus turns: ${customerTurns.length}`);
  console.log(`Tool calls: ${allToolCalls.length}`);
  console.log("\nTool usage:");
  for (const [name, count] of Object.entries(toolCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name}: ${count}x`);
  }

  // Check coverage
  const requiredTools = [
    "triggerScrape",
    "addKeyFact",
    "updateBusiness",
    "updateSeason",
    "addDepartments",
    "addLocations",
    "addProcedures",
    "finalizeOnboarding",
  ];

  const usedTools = new Set(toolNames);
  const missing = requiredTools.filter((t) => !usedTools.has(t));
  const covered = requiredTools.filter((t) => usedTools.has(t));

  console.log(`\nCoverage: ${covered.length}/${requiredTools.length} required tools used`);
  if (missing.length > 0) {
    console.log(`Missing: ${missing.join(", ")}`);
  }

  // Avg response length
  const avgBotsson =
    botssonTurns.reduce((sum, t) => sum + t.text.length, 0) / (botssonTurns.length || 1);
  const avgCustomer =
    customerTurns.reduce((sum, t) => sum + t.text.length, 0) / (customerTurns.length || 1);

  console.log(`\nAvg response length:`);
  console.log(`  Botsson: ${Math.round(avgBotsson)} chars`);
  console.log(`  Magnus: ${Math.round(avgCustomer)} chars`);

  if (avgBotsson > 200) {
    console.log("  ⚠️  Botsson talks too much! Target: <150 chars per response.");
  }
}

// ─── Run ───

runSparring().catch(console.error);
