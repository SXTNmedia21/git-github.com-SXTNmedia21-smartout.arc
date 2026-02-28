import { ShieldCheck, Thermometer, AlertTriangle, Award, QrCode, Sparkles } from "lucide-react";
import {
  DocsArticle,
  Heading,
  SubHeading,
  Paragraph,
  FeatureCard,
} from "../_components/docs-article";

export default function HACCPPage() {
  return (
    <DocsArticle
      prev={{ title: "Oppgaver og rutiner", href: "/docs/oppgaver-rutiner" }}
      next={{ title: "Kommunikasjon", href: "/docs/kommunikasjon" }}
    >
      <div className="mb-10">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10">
            <ShieldCheck className="h-5 w-5 text-orange-400" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-white md:text-4xl">
            HACCP og Mattilsynet
          </h1>
        </div>
        <Paragraph>
          SmartOut bygger HACCP-samsvar inn i de vanlige driftsrutinene. I stedet for et separat
          system, bruker SmartOut den eksisterende governance-modellen for matsikkerhet.
        </Paragraph>
      </div>

      <Heading id="hva-er-haccp">Hva er HACCP?</Heading>
      <Paragraph>
        HACCP (Hazard Analysis and Critical Control Points) er et internasjonalt system for å sikre
        mattrygghet. Det er lovpålagt for alle som håndterer mat i Norge, og Mattilsynet
        kontrollerer at virksomheter følger det.
      </Paragraph>

      <SubHeading>De 7 prinsippene i SmartOut</SubHeading>
      <div className="my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Prinsipp</th>
              <th className="py-3 text-left font-semibold text-zinc-400">SmartOut sin løsning</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">1. Fareanalyse</td>
              <td className="py-3">Admin oppretter HACCP-policyer</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">2. Kritiske kontrollpunkter</td>
              <td className="py-3">Utstyr markeres som CCP med terskelverdier</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">3. Kritiske grenser</td>
              <td className="py-3">Minimum- og maksimumsverdier per kontrollpunkt</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">4. Overvåking</td>
              <td className="py-3">Planlagte rutiner via hooks</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">5. Korrigerende tiltak</td>
              <td className="py-3">Runbook med eskaleringskjede</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">6. Verifisering</td>
              <td className="py-3">Kontrolliste for oppfølging</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-white">7. Dokumentasjon</td>
              <td className="py-3">Automatisk sporing i driftsøkter</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Heading id="haccp-kjede">HACCP-governance i SmartOut</Heading>
      <Paragraph>En full HACCP-kjede i SmartOut ser slik ut:</Paragraph>

      <div className="my-6 rounded-xl border border-white/5 bg-white/[0.02] p-5 font-mono text-sm leading-relaxed text-zinc-400">
        <div className="mb-2 font-bold text-white">
          Policy: &laquo;Alle kjøleenheter 0–4°C&raquo;
        </div>
        <div className="border-l border-white/10 pl-4">
          <div className="mb-1 text-zinc-300">Protokoll: Temperaturkontroll</div>
          <div className="space-y-1 border-l border-white/10 pl-4">
            <div>Prosedyre: Temperaturmåling (6 steg)</div>
            <div>Rutine: 4-timers sjekk (via hook)</div>
            <div>Kontrolliste: Temperaturverifisering</div>
            <div>Kunnskapstest: Temperatursikkerhet-quiz (80%)</div>
            <div>Bekreftelse: Protokoll-signering</div>
          </div>
        </div>
      </div>

      <Heading id="temperaturlogging">Temperaturlogging</Heading>
      <Paragraph>
        Temperaturregistrering skjer gjennom driftsøktens oppgaver. Når en hook fyrer av, opprettes
        en HACCP-oppgave.
      </Paragraph>

      <div className="my-6 grid gap-3">
        <FeatureCard icon={Thermometer} title="Slik fungerer det">
          Åpne oppgaven, registrer temperatur per kjøleenhet. Systemet sammenligner automatisk mot
          grenseverdier. Innenfor grensene = fullført. Utenfor = avvik flagges.
        </FeatureCard>
      </div>

      <Heading id="avvik">Avvik og korrigerende tiltak</Heading>
      <Paragraph>
        Når et avvik oppdages — enten av en ansatt eller systemet — kjører en automatisk prosess:
      </Paragraph>

      <div className="my-4 space-y-2 text-sm text-zinc-400">
        <div className="flex items-start gap-3">
          <span className="shrink-0 font-bold text-orange-400">1.</span>
          <span>
            <strong className="text-white">Flagging</strong> — Avviket registreres med type,
            tidspunkt, hvem, og verdi
          </span>
        </div>
        <div className="flex items-start gap-3">
          <span className="shrink-0 font-bold text-orange-400">2.</span>
          <span>
            <strong className="text-white">Runbook utløses</strong> — Forhåndsdefinert prosedyre for
            korrigerende tiltak
          </span>
        </div>
        <div className="flex items-start gap-3">
          <span className="shrink-0 font-bold text-orange-400">3.</span>
          <span>
            <strong className="text-white">Eskalering</strong> — Teamleder → kjøkkensjef → admin
          </span>
        </div>
        <div className="flex items-start gap-3">
          <span className="shrink-0 font-bold text-orange-400">4.</span>
          <span>
            <strong className="text-white">Korrigerende tiltak</strong> — Ansvarlig utfører handling
            og dokumenterer
          </span>
        </div>
        <div className="flex items-start gap-3">
          <span className="shrink-0 font-bold text-orange-400">5.</span>
          <span>
            <strong className="text-white">Kontrolliste</strong> — Oppfølgingskontroll utføres
          </span>
        </div>
        <div className="flex items-start gap-3">
          <span className="shrink-0 font-bold text-orange-400">6.</span>
          <span>
            <strong className="text-white">Lukking</strong> — Avviket lukkes med kommentar og
            signatur
          </span>
        </div>
      </div>

      <SubHeading>Avvikskategorier</SubHeading>
      <Paragraph>
        Temperatur utenfor grenseverdier, hygieneavvik, allergenforveksling, holdbarhetsproblemer,
        renholdsavvik, og utstyrsfeil.
      </Paragraph>

      <Heading id="sertifiseringer">Sertifiseringer</Heading>
      <div className="my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Sertifisering</th>
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Varighet</th>
              <th className="py-3 text-left font-semibold text-zinc-400">Varsel</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Hygienesertifikat</td>
              <td className="py-3 pr-4">3–5 år</td>
              <td className="py-3">90 dager før utløp</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Allergenhåndtering</td>
              <td className="py-3 pr-4">Årlig</td>
              <td className="py-3">60 dager før utløp</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Alkoholservering</td>
              <td className="py-3 pr-4">Ingen utløp</td>
              <td className="py-3">Ved ansettelse</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-white">Førstehjelp</td>
              <td className="py-3 pr-4">2 år</td>
              <td className="py-3">90 dager før utløp</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Heading id="inspeksjon">Inspeksjonsklar</Heading>
      <Paragraph>SmartOut gir Mattilsynet-inspektøren alt de trenger:</Paragraph>

      <div className="my-6 grid gap-3">
        <FeatureCard icon={Thermometer} title="Temperaturlogg">
          Filtrert visning av alle temperaturregistreringer med tidspunkt, hvem, og verdier.
        </FeatureCard>
        <FeatureCard icon={AlertTriangle} title="Avvikslogg">
          Alle avvik med korrigerende tiltak og oppfølging.
        </FeatureCard>
        <FeatureCard icon={Award} title="Sertifiseringer">
          Status per ansatt — gyldige, utløpte, manglende.
        </FeatureCard>
        <FeatureCard icon={QrCode} title="QR-koder">
          QR-koder for rask tilgang til dokumentasjon. Inspektøren skanner og ser relevante data
          direkte.
        </FeatureCard>
      </div>

      <Heading id="ai-haccp">AI-assistert HACCP</Heading>
      <div className="my-6 grid gap-3">
        <FeatureCard icon={Sparkles} title="Lise hjelper med HACCP">
          Foreslår HACCP-policyer basert på bedriftstype, varsler ved manglende registreringer,
          kompilerer inspeksjonsrapporter, oppdager mønstre i avvik, og foreslår korrigerende
          tiltak.
        </FeatureCard>
      </div>
    </DocsArticle>
  );
}
