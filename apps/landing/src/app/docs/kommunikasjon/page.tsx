import { MessageSquare, Bell, Megaphone, Clock, Volume2, Settings } from "lucide-react";
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
          Kommunikasjon i SmartOut er bygget for å tjene driften — ikke for å være enda en
          meldingsapp. Hver kanal, varsel og melding eksisterer fordi den støtter skiftkoordinering,
          oppgaveoppdateringer, opplæring eller ledelsesbeslutninger.
        </Paragraph>
      </div>

      <Heading id="kanaler">Kommunikasjonskanaler</Heading>
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
              <td className="py-3 pr-4">Teamkoordinering, raske spørsmål, skift-chat</td>
              <td className="py-3">Sanntid</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Push-varsler</td>
              <td className="py-3 pr-4">Oppgavevarsler, skiftpåminnelser</td>
              <td className="py-3">Sekunder</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">SMS</td>
              <td className="py-3 pr-4">Kritiske varsler, sjeldne app-brukere</td>
              <td className="py-3">Sekunder</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">E-post</td>
              <td className="py-3 pr-4">Vaktplaner, lønnsslipper, invitasjoner</td>
              <td className="py-3">Minutter</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Stemme</td>
              <td className="py-3 pr-4">AI-overlevering, nødsituasjoner</td>
              <td className="py-3">Sanntid</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-white">Varsler i appen</td>
              <td className="py-3 pr-4">Statusoppdateringer, ikke-hastende</td>
              <td className="py-3">Ved neste åpning</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Heading id="chat">Chat</Heading>
      <Paragraph>Chat i SmartOut er organisert rundt operasjonelle grupper:</Paragraph>

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
              <td className="py-3 pr-4 font-medium text-white">Avdeling</td>
              <td className="py-3 pr-4">#kjøkken, #sal, #bar</td>
              <td className="py-3">Automatisk per avdeling</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Team</td>
              <td className="py-3 pr-4">#lunsj-kjøkken, #a-la-carte</td>
              <td className="py-3">Automatisk per team</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Driftsøkt</td>
              <td className="py-3 pr-4">#kjøkken-24feb</td>
              <td className="py-3">Automatisk per aktiv driftsøkt</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Egendefinert</td>
              <td className="py-3 pr-4">#ledelse, #sosialt</td>
              <td className="py-3">Manuelt av admin</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-white">Direktemelding</td>
              <td className="py-3 pr-4">Anna ↔ Erik</td>
              <td className="py-3">Manuelt av brukere</td>
            </tr>
          </tbody>
        </table>
      </div>

      <InfoBox type="info">
        Driftsøkt-kanaler opprettes automatisk når en driftsøkt starter. Bare de som er på vakt den
        dagen er med. Arkiveres automatisk når driftsøkten lukkes.
      </InfoBox>

      <SubHeading>Meldingstyper</SubHeading>
      <Paragraph>
        Tekst (med markdown-støtte), bilder og filer, systemmeldinger, dagsoppsummeringer,
        overleveringer fra forrige dag, og kunngjøringer. Alle kanaler støtter tråder for å holde
        samtaler organisert.
      </Paragraph>

      <Heading id="kunngjøringer">Kunngjøringer</Heading>
      <div className="my-6 grid gap-3">
        <FeatureCard icon={Megaphone} title="Hvem kan sende">
          Admin og ledere. Sendes til hele arbeidsplassen, avdeling, eller team. Systemet sporer
          hvem som har lest, og viktige kunngjøringer kan pinnes.
        </FeatureCard>
      </div>

      <Heading id="varsling">Varslingssystem</Heading>
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
              <td className="py-3">HACCP-avvik, nødsituasjon</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-amber-400">Høy</td>
              <td className="py-3 pr-4">Push + in-app</td>
              <td className="py-3">Oppgave forfalt, vaktendring</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-blue-400">Normal</td>
              <td className="py-3 pr-4">Push eller in-app</td>
              <td className="py-3">Skiftpåminnelse, ny melding</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-zinc-500">Lav</td>
              <td className="py-3 pr-4">Bare in-app</td>
              <td className="py-3">Statusoppdatering</td>
            </tr>
          </tbody>
        </table>
      </div>

      <SubHeading>Eskaleringsruting</SubHeading>
      <Paragraph>
        Varsler som krever handling og ikke besvares, eskaleres oppover: Ansatt (umiddelbart) →
        Teamleder (10 min) → Avdelingsleder (30 min) → Admin (60 min). Tidene er konfigurerbare per
        varslingstype.
      </Paragraph>

      <Heading id="stille-timer">Stille timer</Heading>
      <div className="my-6 grid gap-3">
        <FeatureCard icon={Clock} title="Respekterer fritid">
          Standard stille timer: 22:00–07:00 (konfigurerbar). HACCP-avvik og nødsituasjoner bryter
          gjennom. Ansatte kan justere sine egne stille timer.
        </FeatureCard>
        <FeatureCard icon={Settings} title="Preferanser">
          Hver ansatt styrer egne varslingspreferanser: per kanal, per kanaltype, midlertidig mute,
          og formatpreferanser.
        </FeatureCard>
      </div>
    </DocsArticle>
  );
}
