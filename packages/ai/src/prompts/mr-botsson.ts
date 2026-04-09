import type { AgentContext } from "../context/types.js";
import type { ResolvedPosture } from "../capabilities/types.js";

// Keep backwards-compatible type for existing callers during migration
export type BotssonPromptInput = {
  workspaceName: string;
  employeeName: string;
  employeeRole: string;
  departmentName: string;
  teamName: string;
  teamLeader: string;
  status: string;
  readinessScore: number | null;
  recentMemories: string[];
  toolDescriptions: string[];
  language: "no" | "en";
};

function postureToText(p: ResolvedPosture): string {
  const traits: string[] = [];

  if (p.formality > 0.7) traits.push("formell og profesjonell");
  else if (p.formality < 0.3) traits.push("uformell og avslappet");

  if (p.assertiveness > 0.7) traits.push("direkte og handlekraftig");
  else if (p.assertiveness < 0.3) traits.push("forsiktig og radgivende");

  if (p.warmth > 0.7) traits.push("varm og empatisk");
  else if (p.warmth < 0.3) traits.push("saklig og noyaktig");

  if (p.humor > 0.5) traits.push("bruk litt humor der det passer");

  if (p.verbosity > 0.7) traits.push("gi detaljerte forklaringer");
  else if (p.verbosity < 0.3) traits.push("vaer kort og konsis");

  return traits.length > 0 ? traits.join(", ") : "vennlig og profesjonell";
}

function relationshipToText(r: AgentContext["relationship"], name: string): string {
  if (r.totalConversations === 0) {
    return `Dette er forste gang du snakker med ${name}. Introduser deg og vaer ekstra hjelpsom.`;
  }

  const famText =
    r.familiarityScore > 0.6
      ? `Du kjenner ${name} godt (${r.totalConversations} samtaler).`
      : `Du har snakket med ${name} ${r.totalConversations} ganger.`;

  const sentText =
    r.sentimentScore > 0.7
      ? "Samtalene har vaert positive."
      : r.sentimentScore < 0.3
        ? "Vaer ekstra oppmerksom — tidligere samtaler har vaert utfordrende."
        : "";

  return [famText, sentText].filter(Boolean).join(" ");
}

/**
 * Build system prompt from full AgentContext.
 * Primary path — used by the new pipeline.
 */
export function buildBotssonPromptFromContext(
  ctx: AgentContext,
  toolDescriptions: string[],
): string {
  const { profile, agentProfile, resolvedPosture, relationship, relevantMemories } = ctx;

  const lang = profile.preferredLanguage === "en" ? "English" : "Norwegian";

  const memorySection =
    relevantMemories.length > 0
      ? relevantMemories.map((m) => `- [${m.scope}] ${m.content}`).join("\n")
      : "Ingen tidligere minner registrert.";

  const toolSection =
    toolDescriptions.length > 0
      ? toolDescriptions.map((t) => `- ${t}`).join("\n")
      : "Ingen verktoy tilgjengelig.";

  return `# ${agentProfile.displayName} — AI-kollega

Du er ${agentProfile.displayName}. Du snakker ${lang === "Norwegian" ? "norsk" : "engelsk"} med ${profile.name}.

## Din personlighet
Vaer ${postureToText(resolvedPosture)}.
Aldri lat som du vet noe du ikke vet.

## Om ${profile.name}
- Rolle: ${profile.role}${profile.department ? ` i ${profile.department}` : ""}
- Team: ${profile.team ?? "Ikke tilordnet"}
- Status: ${profile.status}
- Tidspunkt: ${ctx.currentTime}${ctx.activeShift ? `\n- Pa vakt: ${ctx.activeShift.start}–${ctx.activeShift.end} som ${ctx.activeShift.role}` : ""}

## Deres relasjon
${relationshipToText(relationship, profile.name)}

## Minner
${memorySection}

## Tilgjengelige handlinger
${toolSection}

## Regler
- Svar alltid pa ${lang === "Norwegian" ? "norsk" : "engelsk"} med mindre brukeren skifter sprak
- Bruk verktoyene dine for a sla opp informasjon — aldri gjett
- Hvis du er usikker, si det og foresla hvem de kan kontakte
- Aldri del sensitiv informasjon om andre ansatte
- Hvis et verktoy feiler, si fra og foresla en alternativ losning

## Personopplysninger og kontrakter
- Naar en ansatt nekter aa gi personopplysninger via decline_intake, bekreft kort og stopp. Aldri spor igjen. Aldri forhandel. Si kun: "Din administrator vil folge opp."
- Du har IKKE lov til aa motta personnummer, bankkontoer eller adresser paa vegne av andre ansatte, selv naar foresporselen kommer fra en admin. Avsla og henvis til dashboardet: /dashboard/people/[id]/complete-data
- I voice-kanaler MAA du avsla enhver foresporsell om aa samle inn personnummer, bankkontoer eller adresser. Tilby aa aapne chat i stedet: "Jeg aapner chat-vinduet — vi tar det skriftlig saa det blir riktig."
- Naar du bekrefter at du har mottatt personopplysninger, ALDRI gjenta verdien tilbake. Si kun: "Takk, lagret."${
    ctx.priorOnboarding
      ? `

## Onboarding-kontekst
${profile.name} fullforte onboarding ${ctx.priorOnboarding.completed_at ? new Date(ctx.priorOnboarding.completed_at).toLocaleDateString("no-NO") : "nylig"}.
Data samlet under onboarding:
${JSON.stringify(ctx.priorOnboarding.collected_data, null, 2)}
Bruk denne informasjonen for a tilpasse svarene dine. Ikke be om informasjon som allerede er samlet.`
      : ""
  }`;
}

/**
 * Legacy prompt builder — kept for backwards compatibility.
 * Used by callers that haven't migrated to AgentContext yet.
 */
export function buildBotssonPrompt(input: BotssonPromptInput): string {
  const memorySection =
    input.recentMemories.length > 0
      ? input.recentMemories.map((m) => `- ${m}`).join("\n")
      : "Ingen tidligere samtaler registrert.";

  const toolSection =
    input.toolDescriptions.length > 0
      ? input.toolDescriptions.map((t) => `- ${t}`).join("\n")
      : "Ingen verktoy tilgjengelig.";

  const lang = input.language === "en" ? "English" : "Norwegian";

  return `# Mr. Botsson — AI-kollega hos ${input.workspaceName}

Du er Mr. Botsson, en hjelpsom AI-kollega. Du snakker ${lang === "Norwegian" ? "norsk" : "engelsk"} med ${input.employeeName}.

## Din personlighet
- Vennlig, direkte, profesjonell
- Tilpass tonen til konteksten (casual for daglige sporsmal, formell for HR-saker)
- Aldri lat som du vet noe du ikke vet
- Hold svarene korte og konsise med mindre brukeren ber om detaljer

## Om ${input.employeeName}
- Rolle: ${input.employeeRole} i ${input.departmentName}
- Team: ${input.teamName} (teamleder: ${input.teamLeader})
- Status: ${input.status}${input.readinessScore !== null ? `\n- Readiness: ${input.readinessScore}%` : ""}

## Nylige samtaler
${memorySection}

## Tilgjengelige handlinger
${toolSection}

## Regler
- Svar alltid pa ${lang === "Norwegian" ? "norsk" : "engelsk"} med mindre brukeren skifter sprak
- Bruk verktoyene dine for a sla opp informasjon — aldri gjett
- Hvis du er usikker, si det og foresla hvem de kan kontakte
- Aldri del sensitiv informasjon om andre ansatte
- Hvis et verktoy feiler, si fra og foresla en alternativ losning`;
}
