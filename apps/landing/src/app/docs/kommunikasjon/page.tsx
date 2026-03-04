import {
  MessageSquare,
  Megaphone,
  Clock,
  Settings,
  Users,
  Sparkles,
  Reply,
  Search,
  Bell,
  Shield,
} from "lucide-react";
import {
  DocsArticle,
  Heading,
  SubHeading,
  Paragraph,
  InfoBox,
  FeatureCard,
} from "../_components/docs-article";

export default function KommunikasjonPage() {
  return (
    <DocsArticle
      prev={{ title: "HACCP og Mattilsynet", href: "/docs/haccp" }}
      next={{ title: "Lise AI-assistent", href: "/docs/ai-assistent" }}
    >
      <div className="mb-10">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10">
            <MessageSquare className="h-5 w-5 text-orange-400" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-white md:text-4xl">
            Kommunikasjon
          </h1>
        </div>
        <Paragraph>
          Kommunikasjon i SmartOut er bygget for drift, ikke for sosialt. Hver samtale, varsel og
          melding eksisterer fordi den st&#248;tter skiftkoordinering, oppgaveoppdateringer,
          oppl&#230;ring eller ledelsesbeslutninger.
        </Paragraph>
      </div>

      <Heading id="kanaler">Kommunikasjonskanaler</Heading>
      <Paragraph>
        SmartOut bruker seks kanaler med ulik latens og bruk. Systemet velger kanal automatisk
        basert p&#229; hastegrad og brukerens preferanser.
      </Paragraph>

      <div className="my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Kanal</th>
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Bruk</th>
              <th className="py-3 text-left font-semibold text-zinc-400">Latens</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Chat i appen</td>
              <td className="py-3 pr-4">
                Teamkoordinering, raske sp&#248;rsm&#229;l, driftsoppdateringer
              </td>
              <td className="py-3">Sanntid</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Push-varsler</td>
              <td className="py-3 pr-4">
                Oppgavevarsler, skiftp&#229;minnelser, treningsp&#229;minnelser
              </td>
              <td className="py-3">Sekunder</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">SMS</td>
              <td className="py-3 pr-4">Kritiske varsler, invitasjoner, brukere uten appen</td>
              <td className="py-3">Sekunder</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">E-post</td>
              <td className="py-3 pr-4">
                Vaktplaner, kontrakter, invitasjoner, formelle meldinger
              </td>
              <td className="py-3">Minutter</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Stemme</td>
              <td className="py-3 pr-4">AI-overlevering, n&#248;dsituasjoner</td>
              <td className="py-3">Sanntid</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-white">Varsler i appen</td>
              <td className="py-3 pr-4">Statusoppdateringer, ikke-hastende informasjon</td>
              <td className="py-3">Ved neste &#229;pning</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Heading id="chat">Chat</Heading>
      <Paragraph>
        Chat i SmartOut er et sanntidssystem bygget p&#229; Supabase Realtime. N&#229;r en melding
        sendes, leveres den umiddelbart til alle deltakere i samtalen uten forsinkelse.
      </Paragraph>

      <SubHeading>Samtaletyper</SubHeading>
      <Paragraph>Du kan opprette tre typer samtaler:</Paragraph>

      <div className="my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Type</th>
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Eksempel</th>
              <th className="py-3 text-left font-semibold text-zinc-400">Opprettes</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Gruppe</td>
              <td className="py-3 pr-4">Kj&#248;kken, Sal, Vaktansvarlige, Sosialt</td>
              <td className="py-3">Manuelt &#8212; avdeling, team eller prosjekt</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Direktemelding</td>
              <td className="py-3 pr-4">Anna &#8596; Erik (1-til-1)</td>
              <td className="py-3">Manuelt av brukere</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-white">AI-assistent</td>
              <td className="py-3 pr-4">Samtale med Lise</td>
              <td className="py-3">&#201;tt klikk &#8212; opprettes umiddelbart</td>
            </tr>
          </tbody>
        </table>
      </div>

      <SubHeading>Meldingsfunksjoner</SubHeading>
      <div className="my-6 grid gap-3">
        <FeatureCard icon={Reply} title="Svar-p&#229;-melding">
          Klikk svar p&#229; en melding for &#229; referere til den. Originalmeldingen vises som en
          kompakt forh&#229;ndsvisning over svaret, slik at konteksten alltid er tydelig.
        </FeatureCard>
        <FeatureCard icon={Sparkles} title="Reaksjoner">
          Reager p&#229; meldinger med raske reaksjoner. Hold musepekeren over en melding for &#229;
          se reaksjonsfeltene. Klikk igjen for &#229; fjerne din reaksjon.
        </FeatureCard>
        <FeatureCard icon={Search} title="S&#248;k i samtaler">
          S&#248;k raskt p&#229; tvers av alle samtaler du er med i. Filtrer etter navn direkte i
          samtalelisten.
        </FeatureCard>
      </div>

      <SubHeading>Systemmeldinger</SubHeading>
      <Paragraph>
        Systemet poster automatiske meldinger i samtaler: dagsbriefing n&#229;r en drift&#248;kt
        starter, overleveringer fra forrige dag, og varsler om oppgaver og avvik. Disse vises som
        egne systemmeldinger med diskret formatering.
      </Paragraph>

      <InfoBox type="info">
        Alle meldinger leveres i sanntid via Supabase Realtime. Du trenger ikke oppdatere siden
        &#8212; nye meldinger, reaksjoner og deltakerendringer vises automatisk.
      </InfoBox>

      <SubHeading>Uleste meldinger</SubHeading>
      <Paragraph>
        Samtalelisten viser antall uleste meldinger for hver samtale. N&#229;r du &#229;pner en
        samtale, markeres den automatisk som lest. Sortering er alltid etter siste aktivitet.
      </Paragraph>

      <Heading id="kunngjoeringer">Kunngj&#248;ringer</Heading>
      <Paragraph>
        Kunngj&#248;ringer er formelle meldinger fra ledelsen til grupper av ansatte.
      </Paragraph>

      <div className="my-6 grid gap-3">
        <FeatureCard icon={Megaphone} title="Hvem kan sende">
          Admin og ledere. Kunngj&#248;ringer kan rettes mot hele arbeidsplassen, en avdeling eller
          et team. Kan settes til &#229; kreve lesebekreftelse fra mottakerne.
        </FeatureCard>
      </div>

      <SubHeading>Lesebekreftelse</SubHeading>
      <Paragraph>
        For viktige kunngj&#248;ringer (nye allergenprosedyrer, sikkerhetsoppdateringer,
        ruteendringer) kan du kreve at hver ansatt eksplisitt bekrefter at de har lest meldingen.
        Ledere ser hvem som har bekreftet og hvem som mangler. Automatiske p&#229;minnelser sendes
        etter 24 og 48 timer.
      </Paragraph>

      <Heading id="varsling">Varslingssystem</Heading>
      <Paragraph>
        Hvert varsel i SmartOut f&#248;lger en pipeline: hendelse oppst&#229;r, varsel opprettes,
        kanal velges basert p&#229; hastegrad og brukerens preferanser, stille timer sjekkes, og
        varsel leveres.
      </Paragraph>

      <SubHeading>Urgensbasert ruting</SubHeading>
      <div className="my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Urgensgrad</th>
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Kanaler</th>
              <th className="py-3 text-left font-semibold text-zinc-400">Eksempel</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-red-400">Kritisk</td>
              <td className="py-3 pr-4">Push + SMS + in-app</td>
              <td className="py-3">HACCP-avvik, n&#248;dsituasjon</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-amber-400">H&#248;y</td>
              <td className="py-3 pr-4">Push + in-app</td>
              <td className="py-3">Oppgave forfalt, vaktendring</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-blue-400">Normal</td>
              <td className="py-3 pr-4">Push eller in-app</td>
              <td className="py-3">Skiftp&#229;minnelse, ny direktemelding</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-zinc-500">Lav</td>
              <td className="py-3 pr-4">Bare in-app</td>
              <td className="py-3">Statusoppdatering, ny modulversjon</td>
            </tr>
          </tbody>
        </table>
      </div>

      <SubHeading>Varselkategorier</SubHeading>
      <div className="my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Kategori</th>
              <th className="py-3 text-left font-semibold text-zinc-400">Hendelser</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Vakt</td>
              <td className="py-3">Publisert, endring, p&#229;minnelse, bytteanmodning</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Oppgave</td>
              <td className="py-3">
                Tildelt, forfalt, eskalert, drift&#248;kt n&#230;rmer seg lukking
              </td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Oppl&#230;ring</td>
              <td className="py-3">
                Protokoll tildelt, frist n&#230;rmer seg, protokoll oppdatert
              </td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">HACCP</td>
              <td className="py-3">Temperaturavvik, oppgave forfalt, sertifisering utl&#248;per</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Chat</td>
              <td className="py-3">Direktemelding, @-nevnelse, festet melding</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-white">Kunngj&#248;ring</td>
              <td className="py-3">Ny kunngj&#248;ring, p&#229;minnelse om lesebekreftelse</td>
            </tr>
          </tbody>
        </table>
      </div>

      <InfoBox type="warning" title="Kritiske varsler bryter alltid igjennom">
        HACCP-avvik, n&#248;dsituasjoner og ubesvarte eskaleringer leveres alltid &#8212; uansett
        stille timer, preferanser eller mute-innstillinger. Dette er ikke konfigurerbart av
        sikkerhetsgrunner.
      </InfoBox>

      <Heading id="eskalering">Eskaleringsruting</Heading>
      <Paragraph>
        Varsler som krever handling og ikke besvares, eskaleres automatisk oppover i organisasjonen:
      </Paragraph>

      <div className="my-4 space-y-2 text-sm text-zinc-400">
        <div className="flex items-start gap-3">
          <span className="shrink-0 font-bold text-orange-400">1.</span>
          <span>
            <strong className="text-white">Teamleder</strong> &#8212; f&#229;r push + in-app
            umiddelbart
          </span>
        </div>
        <div className="flex items-start gap-3">
          <span className="shrink-0 font-bold text-orange-400">2.</span>
          <span>
            <strong className="text-white">Avdelingsleder</strong> &#8212; 20 min uten respons
            &#8594; push + SMS
          </span>
        </div>
        <div className="flex items-start gap-3">
          <span className="shrink-0 font-bold text-orange-400">3.</span>
          <span>
            <strong className="text-white">Admin / Eier</strong> &#8212; 20 min uten respons &#8594;
            push + SMS + telefonanrop (konfigurerbart)
          </span>
        </div>
      </div>

      <Paragraph>
        Hvert eskaleringsvarsler inneholder en lenke som g&#229;r direkte til oppgaven eller
        avviket. N&#229;r mottakeren &#229;pner lenken og handler, stoppes videre eskalering.
      </Paragraph>

      <Heading id="stille-timer">Stille timer og preferanser</Heading>
      <div className="my-6 grid gap-3">
        <FeatureCard icon={Clock} title="Stille timer">
          Standard: 22:00&#8211;07:00 (konfigurerbar per bruker). Varsler i stille timer samles og
          leveres som en morgendigest: &laquo;God morgen! Du har 2 nye vakter, 1
          treningsp&#229;minnelse og 3 chatmeldinger.&raquo;
        </FeatureCard>
        <FeatureCard icon={Bell} title="Frekvensbegrensning">
          Maks 20 varsler per time per bruker (konfigurerbart). Overskrides grensen, grupperes
          resten i en samlet melding. AI h&#229;ndterer grupperingen: &laquo;Du har 5
          oppgaveoppdateringer&raquo; i stedet for 5 enkeltvarsler.
        </FeatureCard>
        <FeatureCard icon={Settings} title="Individuelle preferanser">
          Hver ansatt styrer egne varslingspreferanser: push, SMS og e-post per kanal kan skrus av
          eller p&#229;. Per-kategori overstyring (f.eks. skru av push for chat). Midlertidig mute
          per samtale.
        </FeatureCard>
      </div>

      <Heading id="overlevering">Overlevering og dagsbriefing</Heading>
      <Paragraph>Kommunikasjonsmodulen leverer innhold fra driftssystemet:</Paragraph>

      <div className="my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Innhold</th>
              <th className="py-3 text-left font-semibold text-zinc-400">Levering</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Dagsbriefing</td>
              <td className="py-3">
                Postet som systemmelding i samtalen + push til f&#248;rstevakt-ansatte
              </td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Vaktbriefing</td>
              <td className="py-3">Push ved stempling + kort i appen</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Overlevering</td>
              <td className="py-3">Postet i samtalen + inkludert i neste dags briefing</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-white">Drift&#248;ktnotat</td>
              <td className="py-3">Sanntid i samtalen (synlighetsstyrt)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <InfoBox type="tip">
        Dagsbriefingen kompileres automatisk av AI og inneholder: hvem som er p&#229; vakt,
        planlagte oppgaver, oppsummering fra g&#229;rsdagens overlevering, og viktige notater.
        Ledere f&#229;r en kompakt oversikt f&#248;r dagen starter.
      </InfoBox>

      <Heading id="personvern">Personvern og sikkerhet</Heading>
      <div className="my-6 grid gap-3">
        <FeatureCard icon={Shield} title="Arbeidsplassisolasjon">
          Alle samtaler er isolert per arbeidsplass. Du ser bare samtaler der du er deltaker.
          Mediefiler (bilder, dokumenter) lagres med tilgangskontroll &#8212; bare deltakere kan
          &#229;pne dem.
        </FeatureCard>
        <FeatureCard icon={Users} title="Deltakerbasert tilgang">
          Tilgang til meldinger styres gjennom deltakerlisten. N&#229;r en deltaker forlater en
          samtale, mister de tilgang. Samtaleadministratorer kan legge til og fjerne deltakere.
        </FeatureCard>
      </div>
    </DocsArticle>
  );
}
