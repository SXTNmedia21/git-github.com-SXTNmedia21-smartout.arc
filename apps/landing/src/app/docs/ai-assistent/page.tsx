import { Bot, Cpu, Mic, Eye, Shield, Sparkles } from "lucide-react";
import {
  DocsArticle,
  Heading,
  SubHeading,
  Paragraph,
  InfoBox,
  FeatureCard,
} from "../_components/docs-article";

export default function AIAssistentPage() {
  return (
    <DocsArticle
      prev={{ title: "Kommunikasjon", href: "/docs/kommunikasjon" }}
      next={{ title: "Rapporter", href: "/docs/rapporter" }}
    >
      <div className="mb-10">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10">
            <Bot className="h-5 w-5 text-orange-400" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-white md:text-4xl">
            Lise — AI-assistent
          </h1>
        </div>
        <Paragraph>
          Lise er SmartOut sin AI-assistent som opererer på tvers av alle moduler. Chat-først med
          stemmestøtte. Norsk språk. Full gjennomsiktighet i en AI-hendelseslogg.
        </Paragraph>
      </div>

      <Heading id="hvem-er-lise">Hvem er Lise?</Heading>
      <Paragraph>
        Lise er ikke en generell chatbot — hun kjenner din arbeidsplass, dine rutiner, dine ansatte,
        og din sesong. Hun snakker norsk, kjenner konteksten (hvem du er, din rolle, ditt skift, din
        avdeling), og tilpasser dybden etter behov.
      </Paragraph>

      <Heading id="motorer">8 AI-motorer</Heading>
      <Paragraph>Lise drives av 8 spesialiserte motorer:</Paragraph>

      <div className="my-6 grid gap-3">
        <FeatureCard icon={Cpu} title="1. Kontekstmotor">
          Forstår hvem du er og hva du trenger akkurat nå. Din profil, rolle, om du er på vakt eller
          fri, din opplæringsfremgang, og om det er morgen-rush eller rolig kveld.
        </FeatureCard>
        <FeatureCard icon={Cpu} title="2. Kunnskapsmotor">
          Søker i arbeidsplassens innhold: policyer, prosedyrer, personalhåndbok,
          HACCP-dokumentasjon, sesongplaner. Alltid med kilde og referanse.
        </FeatureCard>
        <FeatureCard icon={Cpu} title="3. Reisemotor">
          Styrer onboarding og karriereveier: trainee-modus, modulreiser, avansement,
          48-timersregelen, offboarding.
        </FeatureCard>
        <FeatureCard icon={Cpu} title="4. Lønnsmotor">
          Hjelper med lønnsberegning: timeberegning, tilleggsberegning (kveld, natt, helg), norsk
          arbeidsrett-validering, anomalideteksjon.
        </FeatureCard>
        <FeatureCard icon={Cpu} title="5. Kommunikasjonsmotor">
          Formaterer meldinger, velger kanal (SMS, e-post, push), flerkanalslevering med sporbarhet.
        </FeatureCard>
        <FeatureCard icon={Cpu} title="6. Driftsmotor">
          Daglig drift: kompilerer oppsummeringer, proaktive varsler, avvikshåndtering, daglig brief
          til ledere.
        </FeatureCard>
        <FeatureCard icon={Cpu} title="7. Læringsmotor">
          Genererer quizer, sporer kunnskapshull, anbefaler opplæring basert på rolle og avdeling.
        </FeatureCard>
        <FeatureCard icon={Cpu} title="8. Forretningsmotor">
          KPI-tracking, trendanalyse, økonomisk oversikt, sesongsammenligning, rapportgenerering.
        </FeatureCard>
      </div>

      <Heading id="autorisasjon">Autorisasjonsnivåer</Heading>
      <Paragraph>
        Lise opererer med fem nivåer av selvstendighet, konfigurerbare per handling:
      </Paragraph>

      <div className="my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Nivå</th>
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Oppførsel</th>
              <th className="py-3 text-left font-semibold text-zinc-400">Eksempel</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-emerald-400">Autonom</td>
              <td className="py-3 pr-4">Handler uten å spørre</td>
              <td className="py-3">Opprett ad-hoc-oppgave fra notat</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-blue-400">Varsle og foreslå</td>
              <td className="py-3 pr-4">Varsler og foreslår</td>
              <td className="py-3">HACCP-sjekk forfalt — sende påminnelse?</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-amber-400">Varsle</td>
              <td className="py-3 pr-4">Bare varsler</td>
              <td className="py-3">Overtidsgrensen nærmer seg</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-orange-400">Eskalere</td>
              <td className="py-3 pr-4">Eskalerer til menneske</td>
              <td className="py-3">Avvik krever ledergjennomgang</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-zinc-500">Aldri</td>
              <td className="py-3 pr-4">AI deltar ikke</td>
              <td className="py-3">Manuelle operasjoner</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Heading id="stemme">Stemmegrensesnitt</Heading>
      <div className="my-6 grid gap-3">
        <FeatureCard icon={Mic} title="Chat og stemme">
          Klikk mikrofonikonet for å snakke med Lise i appen, eller ring inn via telefon. Full
          norskstøtte med gjenkjenning og talesyntese. Du kan avbryte Lise midt i en setning for å
          korrigere eller stille nytt spørsmål.
        </FeatureCard>
      </div>

      <SubHeading>Stemmescenarier</SubHeading>
      <Paragraph>
        Ring inn og sjekk vaktplan, rapporter et problem hands-free fra kjøkkenet, be om hjelp med
        en prosedyre mens hendene er opptatt, eller gjennomgå dagsoppsummeringen på vei hjem.
      </Paragraph>

      <Heading id="hendelseslogg">AI-hendelseslogg</Heading>
      <div className="my-6 grid gap-3">
        <FeatureCard icon={Eye} title="Full gjennomsiktighet">
          All AI-aktivitet logges: hva Lise bestemte, hvilket autorisasjonsnivå, hvilke data som ble
          vurdert, hvilken handling som ble utført eller foreslått. Gjennomgåbar av admin. Ingen
          svart boks.
        </FeatureCard>
      </div>

      <Heading id="personvern">Personvern</Heading>
      <div className="my-6 grid gap-3">
        <FeatureCard icon={Shield} title="Data-sikkerhet">
          Lise ser bare data innenfor din arbeidsplass. Aldri deling mellom arbeidsplasser.
          AI-interaksjoner kan slettes av brukeren. Full GDPR-kompatibilitet.
        </FeatureCard>
      </div>
    </DocsArticle>
  );
}
