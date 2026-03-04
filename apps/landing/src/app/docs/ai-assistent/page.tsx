import { Bot, Cpu, Mic, Eye, Shield, SlidersHorizontal } from "lucide-react";
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
            Lise &#8212; AI-assistent
          </h1>
        </div>
        <Paragraph>
          Lise er SmartOut sin AI-assistent. Hun opererer p&#229; tvers av alle moduler med full
          kontekstbevissthet &#8212; hvem du er, hva du jobber med, og hva som skjer p&#229;
          arbeidsplassen akkurat n&#229;.
        </Paragraph>
      </div>

      <Heading id="hvem-er-lise">Hvem er Lise?</Heading>
      <Paragraph>
        Lise er ikke en generell chatbot. Hun kjenner din arbeidsplass, dine rutiner, dine ansatte
        og din sesong. Hun snakker norsk, forst&#229;r konteksten (din rolle, ditt skift, din
        avdeling), og tilpasser dybde og tone etter behov.
      </Paragraph>
      <Paragraph>
        Du kan snakke med Lise via chat i appen eller via stemme. Lise har tilgang til alle moduler
        i SmartOut, men hva hun kan gj&#248;re styres av autorisasjonsniv&#229;er som din
        administrator konfigurerer.
      </Paragraph>

      <Heading id="kapabiliteter">8 kapabiliteter</Heading>
      <Paragraph>Lise har spesialiserte kapabiliteter for hvert omr&#229;de i SmartOut:</Paragraph>

      <div className="my-6 grid gap-3">
        <FeatureCard icon={Cpu} title="Kunnskap">
          Sl&#229;r opp i arbeidsplassens innhold: policyer, prosedyrer, personalh&#229;ndbok,
          HACCP-dokumentasjon og sesongplaner. Alltid med kilde og referanse.
        </FeatureCard>
        <FeatureCard icon={Cpu} title="Vaktplan">
          Svarer p&#229; vaktsp&#248;rsm&#229;l, h&#229;ndterer bytteforesp&#248;rsler, sjekker
          tilgjengelighet, og kan foresl&#229; vaktplaner basert p&#229; historikk og kompetanse.
        </FeatureCard>
        <FeatureCard icon={Cpu} title="Oppl&#230;ring">
          Styrer onboarding og karriereveier: trainee-modus, modulreiser, protokollstatus, readiness
          score, og kunnskapstester.
        </FeatureCard>
        <FeatureCard icon={Cpu} title="Drift">
          Daglig drift: kompilerer oppsummeringer, proaktive varsler, avviksh&#229;ndtering, daglig
          brief til ledere, og drifts&#248;ktstatus.
        </FeatureCard>
        <FeatureCard icon={Cpu} title="Profil">
          Ansattinformasjon, teamtilh&#248;righet, kontraktstatus og personaldata innenfor
          tilgangsniv&#229;et ditt.
        </FeatureCard>
        <FeatureCard icon={Cpu} title="Kommunikasjon">
          Formaterer meldinger, velger kanal (SMS, e-post, push), og h&#229;ndterer
          flerkanalslevering med sporbarhet.
        </FeatureCard>
        <FeatureCard icon={Cpu} title="Hukommelse">
          Husker samtalehistorikk og brukerpreferanser p&#229; tvers av &#248;kter. Gj&#248;r
          oppf&#248;lgingssamtaler mer relevante uten at du m&#229; gjenta deg.
        </FeatureCard>
        <FeatureCard icon={Cpu} title="L&#248;nn">
          L&#248;nnsberegning, overtidssjekk, tilleggsberegning (kveld, natt, helg), og
          anomalideteksjon i timedata.
        </FeatureCard>
      </div>

      <Heading id="autorisasjon">Autorisasjonsniv&#229;er</Heading>
      <Paragraph>
        Hver kapabilitet konfigureres med ett av fem autorisasjonsniv&#229;er. Standard er
        &laquo;Kun lesing&raquo; &#8212; Lise kan svare p&#229; sp&#248;rsm&#229;l, men ikke
        utf&#248;re handlinger. Administratorer justerer niv&#229;ene i Innstillinger &gt;
        AI-konfigurasjon.
      </Paragraph>

      <div className="my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Niv&#229;</th>
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Oppf&#248;rsel</th>
              <th className="py-3 text-left font-semibold text-zinc-400">Eksempel</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-emerald-400">Autonom</td>
              <td className="py-3 pr-4">Handler uten bekreftelse</td>
              <td className="py-3">Opprett ad-hoc-oppgave fra notat</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-blue-400">Bekreft</td>
              <td className="py-3 pr-4">Foresl&#229;r, bruker bekrefter</td>
              <td className="py-3">Foresl&#229;r vaktendring, du godkjenner</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-amber-400">Foresl&#229;</td>
              <td className="py-3 pr-4">Foresl&#229;r til leder-k&#248;</td>
              <td className="py-3">Lise foresl&#229;r bytteforesporsler</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-zinc-400">Kun lesing</td>
              <td className="py-3 pr-4">Kan bare sl&#229; opp informasjon</td>
              <td className="py-3">Svar p&#229; sp&#248;rsm&#229;l om prosedyrer</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-zinc-600">Deaktivert</td>
              <td className="py-3 pr-4">Helt avsl&#229;tt for denne kapabiliteten</td>
              <td className="py-3">Lise kan ikke hjelpe med l&#248;nn</td>
            </tr>
          </tbody>
        </table>
      </div>

      <InfoBox type="info">
        Autorisasjonsniv&#229;ene gir full kontroll over hva AI-en kan gj&#248;re. Du kan for
        eksempel la Lise v&#230;re autonom p&#229; kunnskapsoppslag, men kreve bekreftelse for
        vaktendringer og deaktivere l&#248;nnskapabiliteten helt.
      </InfoBox>

      <Heading id="konfigurasjon">AI-konfigurasjon</Heading>
      <div className="my-6 grid gap-3">
        <FeatureCard icon={SlidersHorizontal} title="Per-kapabilitet kontroll">
          G&#229; til AI-konfigurasjon i dashboardet for &#229; se alle 8 kapabiliteter med
          gjeldende autorisasjonsniv&#229;. Velg niv&#229; fra en rullegardinmeny per kapabilitet.
          Endringer trer i kraft umiddelbart.
        </FeatureCard>
      </div>

      <Heading id="stemme">Stemmegrensesnitt</Heading>
      <div className="my-6 grid gap-3">
        <FeatureCard icon={Mic} title="Chat og stemme">
          Klikk mikrofonikonet for &#229; snakke med Lise i appen, eller ring inn via telefon. Full
          norskst&#248;tte med gjenkjenning og talesyntese. Du kan avbryte Lise midt i en setning
          for &#229; korrigere eller stille nytt sp&#248;rsm&#229;l.
        </FeatureCard>
      </div>

      <SubHeading>Stemmescenarier</SubHeading>
      <Paragraph>
        Ring inn og sjekk vaktplan, rapporter et problem hands-free fra kj&#248;kkenet, be om hjelp
        med en prosedyre mens hendene er opptatt, eller gjennomg&#229; dagsoppsummeringen p&#229;
        vei hjem.
      </Paragraph>

      <Heading id="hendelseslogg">AI-hendelseslogg</Heading>
      <div className="my-6 grid gap-3">
        <FeatureCard icon={Eye} title="Full gjennomsiktighet">
          All AI-aktivitet logges: hva Lise bestemte, hvilket autorisasjonsniv&#229;, hvilke data
          som ble vurdert, og hvilken handling som ble utf&#248;rt eller foresl&#229;tt.
          Gjennomg&#229;bar av admin. Ingen svart boks.
        </FeatureCard>
      </div>

      <Heading id="personvern">Personvern</Heading>
      <div className="my-6 grid gap-3">
        <FeatureCard icon={Shield} title="Datasikkerhet">
          Lise ser bare data innenfor din arbeidsplass. Aldri deling mellom arbeidsplasser.
          AI-interaksjoner kan slettes av brukeren. Full GDPR-kompatibilitet.
        </FeatureCard>
      </div>
    </DocsArticle>
  );
}
