import { ClipboardList, Clock, Zap, AlertTriangle, CheckCircle2, ArrowDownUp } from "lucide-react";
import {
  DocsArticle,
  Heading,
  SubHeading,
  Paragraph,
  InfoBox,
  FeatureCard,
} from "../_components/docs-article";

export default function OppgaverRutinerPage() {
  return (
    <DocsArticle
      prev={{ title: "Ansatte", href: "/docs/ansatte" }}
      next={{ title: "HACCP og Mattilsynet", href: "/docs/haccp" }}
    >
      <div className="mb-10">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10">
            <ClipboardList className="h-5 w-5 text-orange-400" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-white md:text-4xl">
            Oppgaver og rutiner
          </h1>
        </div>
        <Paragraph>
          SmartOut organiserer daglige operasjoner i Driftsøkter — daglige containere per avdeling
          som inneholder alt som skal gjøres, fra morgenrutiner til kveldssignering.
        </Paragraph>
      </div>

      <Heading id="driftsokt">Driftsøkten</Heading>
      <Paragraph>
        En driftsøkt opprettes automatisk for hver aktiv avdeling, hver dag, basert på avdelingens
        driftsplan. Den er den daglige operasjonelle containeren.
      </Paragraph>

      <SubHeading>Livssyklus</SubHeading>
      <div className="my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Status</th>
              <th className="py-3 text-left font-semibold text-zinc-400">Hva det betyr</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-blue-400">Kommende</td>
              <td className="py-3">Dagen er planlagt, men har ikke startet enda</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-emerald-400">Aktiv</td>
              <td className="py-3">Driften er i gang — oppgaver utføres</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-amber-400">Venter på signering</td>
              <td className="py-3">Driften er over, noen må signere av</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-zinc-400">Lukket</td>
              <td className="py-3">Alt er signert og godkjent</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-red-400">Ubesvart</td>
              <td className="py-3">Ingen signerte — eskalert til leder</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Heading id="hooks">Hooks — tidsutløste triggere</Heading>
      <Paragraph>
        Hooks er tidsbaserte triggere som oppretter oppgaver i driftsøkten automatisk. De
        materialiserer prosedyrer og rutiner på riktig tidspunkt.
      </Paragraph>

      <div className="my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Hook</th>
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Når</th>
              <th className="py-3 text-left font-semibold text-zinc-400">Eksempel</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Før åpning</td>
              <td className="py-3 pr-4">Før avdelingen åpner</td>
              <td className="py-3">Prep kjøkken — rengjøring, forberedelser</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Åpning</td>
              <td className="py-3 pr-4">Når avdelingen åpner</td>
              <td className="py-3">Åpningsrutine — sjekkliste for klar-status</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Planlagt</td>
              <td className="py-3 pr-4">Fast tidspunkt</td>
              <td className="py-3">Temperatursjekk — annenhver time</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Før stenging</td>
              <td className="py-3 pr-4">Før avdelingen stenger</td>
              <td className="py-3">Siste bestilling — forbered stenging</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-white">Stenging</td>
              <td className="py-3 pr-4">Når avdelingen stenger</td>
              <td className="py-3">Stengingsrutine — opprydding og signering</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Heading id="oppgavetyper">Oppgavetyper</Heading>

      <div className="my-6 grid gap-3">
        <FeatureCard icon={Clock} title="Fra hooks (planlagte)">
          Oppgaver generert automatisk av hooks. &laquo;Temperaturmåling kl. 10:00&raquo; eller
          &laquo;Åpningssjekkliste&raquo;.
        </FeatureCard>
        <FeatureCard icon={ArrowDownUp} title="Rutiner (gjentakende)">
          Oppgaver som gjentar seg — daglig, ukentlig, eller med fast intervall.
          &laquo;Temperatursjekk hver 4. time&raquo;, &laquo;Rengjøring av kjølerom fredager&raquo;.
        </FeatureCard>
        <FeatureCard icon={Zap} title="Ad-hoc oppgaver (ASAP)">
          Opprettet i sanntid av ledere. &laquo;Varer levert — setter bort i kjølerom NÅ&raquo;. Kan
          tildeles person, stilling, team eller lokasjon.
        </FeatureCard>
        <FeatureCard icon={AlertTriangle} title="Arvede oppgaver">
          Når en ansatt er fraværende, arves oppgavene til neste tilgjengelige person. Samme team →
          samme avdeling → eskalering til leder.
        </FeatureCard>
      </div>

      <Heading id="livssyklus">Oppgavens livssyklus</Heading>
      <div className="my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Status</th>
              <th className="py-3 text-left font-semibold text-zinc-400">Beskrivelse</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-zinc-500">Ventende</td>
              <td className="py-3">Ikke tilgjengelig enda — hook har ikke fyrt</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-blue-400">Tilgjengelig</td>
              <td className="py-3">Klar til å tas — vises på oppgavetavlen</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-amber-400">Under arbeid</td>
              <td className="py-3">Noen jobber med den</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-emerald-400">Fullført</td>
              <td className="py-3">Gjennomført med tidsstempel, hvem, og eventuelle data</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-zinc-500">Hoppet over</td>
              <td className="py-3">Bevisst oversett — krever kommentar</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-red-400">Forfalt</td>
              <td className="py-3">Fristen er passert</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-orange-400">Eskalert</td>
              <td className="py-3">Overført til leder/admin</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Heading id="governance">Governance-kjeden</Heading>
      <Paragraph>
        Oppgaver i SmartOut er knyttet til governance-modellen — fra overordnet policy til konkret
        handling:
      </Paragraph>

      <div className="my-6 rounded-xl border border-white/5 bg-white/[0.02] p-5 font-mono text-sm leading-relaxed text-zinc-400">
        <div className="mb-2 font-bold text-white">Policy</div>
        <div className="border-l border-white/10 pl-4">
          <div className="mb-1 text-zinc-300">Protokoll</div>
          <div className="space-y-1 border-l border-white/10 pl-4">
            <div>Prosedyre — lær: ordnede steg</div>
            <div>Rutine — gjør: gjentakende driftsoppgave</div>
            <div>Runbook — gjør: flerstegsprosess</div>
            <div>Kontrolliste — verifiser: sjekkliste</div>
            <div>Kunnskapstest — bevis: quiz</div>
            <div>Bekreftelse — anerkjenn: signering</div>
          </div>
        </div>
      </div>

      <Heading id="signering">Signering av driftsøkt</Heading>
      <Paragraph>
        Ved dagens slutt skal driftsøkten signeres av den som stenger — vanligvis den med høyest
        ansiennitet. Systemet sjekker at alle påkrevde oppgaver er fullført. Ufullførte oppgaver
        krever kommentar.
      </Paragraph>

      <div className="my-6 grid gap-3">
        <FeatureCard icon={CheckCircle2} title="Overlevering">
          Signeringsnotatet leveres til neste dags driftsøkt som en overlevering. Lederen ser en
          kort oppsummering: hva skjedde i går, hva trenger oppmerksomhet i dag.
        </FeatureCard>
      </div>

      <InfoBox type="info">
        Lise kompilerer daglig oppsummering fra oppgaver, notat og avvik. &laquo;HACCP-sjekk forfalt
        for 15 min — varsle teamleder?&raquo;
      </InfoBox>
    </DocsArticle>
  );
}
