import { GraduationCap, ShieldCheck, BookOpen } from "lucide-react";
import {
  DocsArticle,
  Heading,
  SubHeading,
  Paragraph,
  InfoBox,
  FeatureCard,
} from "../_components/docs-article";

export default function OnboardingPage() {
  return (
    <DocsArticle
      prev={{ title: "Kom i gang", href: "/docs/kom-i-gang" }}
      next={{ title: "Vaktplan", href: "/docs/vaktplan" }}
    >
      <div className="mb-10">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10">
            <GraduationCap className="h-5 w-5 text-orange-400" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-white md:text-4xl">
            Onboarding
          </h1>
        </div>
        <Paragraph>
          SmartOut sin onboarding gjør nye ansatte klare for jobb fra dag én. Strukturert
          opplæringsplan, digital signering, og en trainee-periode der de lærer rutinene — alt i
          ett.
        </Paragraph>
      </div>

      <Heading id="tre-systemer">Tre onboarding-systemer</Heading>
      <Paragraph>
        SmartOut bruker tre systemer som jobber sammen for å gjøre den ansatte klar:
      </Paragraph>

      <div className="my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">System</th>
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Hva det lærer</th>
              <th className="py-3 text-left font-semibold text-zinc-400">Tidslinje</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Trainee-modus</td>
              <td className="py-3 pr-4">
                SmartOut som programvare — navigasjon, funksjoner, moduler
              </td>
              <td className="py-3">Før første ekte vakt</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Modulreiser</td>
              <td className="py-3 pr-4">Per-modul hurtigopplæring med sjekkpunkter</td>
              <td className="py-3">Del av trainee + ved nye moduler</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-white">Protokollopplæring</td>
              <td className="py-3 pr-4">Selve jobben — HACCP, prosedyrer, sikkerhet</td>
              <td className="py-3">Lengre, styrt av governance</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Heading id="trainee-modus">Trainee-modus</Heading>
      <Paragraph>
        Perioden mellom å akseptere en SmartOut-invitasjon og din første ekte vakt. Du lærer
        SYSTEMET, ikke jobben. Profilen din har status &laquo;trainee&raquo;.
      </Paragraph>

      <SubHeading>Hva du gjennomgår</SubHeading>
      <Paragraph>
        Profiloppsettet (personlig informasjon, bilde, nødkontakt), navigasjon og layout (bli kjent
        med dashboardet), kjernekonsepter (vakter, oppgaver, chat, sesonger), og modulreiser per
        aktivert modul.
      </Paragraph>

      <SubHeading>Sandbox-regler</SubHeading>
      <Paragraph>
        Under trainee-modus er noen aktiviteter i sandbox (øvelse) og noen er ekte:
      </Paragraph>

      <div className="my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Aktivitet</th>
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Modus</th>
              <th className="py-3 text-left font-semibold text-zinc-400">Grunn</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4">Stemplingsur</td>
              <td className="py-3 pr-4 text-amber-400">Sandbox</td>
              <td className="py-3">Simulert — lager ikke ekte lønnsdata</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4">Oppgaver</td>
              <td className="py-3 pr-4 text-amber-400">Sandbox</td>
              <td className="py-3">Testoppgaver — påvirker ikke driftssignering</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4">Temperaturlogging</td>
              <td className="py-3 pr-4 text-amber-400">Sandbox</td>
              <td className="py-3">Øvingsregistreringer — teller ikke for HACCP</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4">Chat og meldinger</td>
              <td className="py-3 pr-4 text-emerald-400">Ekte</td>
              <td className="py-3">Sosial integrasjon er viktig fra dag én</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4">Profiloppsettet</td>
              <td className="py-3 pr-4 text-emerald-400">Ekte</td>
              <td className="py-3">Faktisk profildata — navn, bilde, innstillinger</td>
            </tr>
            <tr>
              <td className="py-3 pr-4">Lese prosedyrer</td>
              <td className="py-3 pr-4 text-emerald-400">Ekte</td>
              <td className="py-3">Faktisk innhold, fremgang spores</td>
            </tr>
          </tbody>
        </table>
      </div>

      <InfoBox type="warning" title="48-timersregelen">
        Hvis en trainee ikke er klar 48 timer før sin første planlagte ekte vakt, eskalerer systemet
        automatisk til lederen. Lederen bestemmer: forleng, overstyr, eller flytt vakten.
      </InfoBox>

      <SubHeading>Overgang til aktiv</SubHeading>
      <Paragraph>
        For å gå fra trainee til aktiv kreves BEGGE: alle påkrevde modulreiser fullført, og leder
        eller admin godkjenner eksplisitt.
      </Paragraph>

      <Heading id="modulreiser">Modulreiser</Heading>
      <Paragraph>
        Hver modul i SmartOut har sin egen korte reise med sjekkpunkter. AI-assistenten Lise
        tilpasser rekkefølgen basert på den ansattes første vakt.
      </Paragraph>

      <SubHeading>Eksempel: Vaktplan-reise</SubHeading>
      <div className="my-4 space-y-2 text-sm text-zinc-400">
        <div className="flex items-center gap-3">
          <div className="flex h-5 w-5 items-center justify-center rounded-full border border-white/10 text-xs text-zinc-500">
            ✓
          </div>
          <span>Besøkt vaktplan-siden</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-5 w-5 items-center justify-center rounded-full border border-white/10 text-xs text-zinc-500">
            ✓
          </div>
          <span>Funnet egen vakt</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-5 w-5 items-center justify-center rounded-full border border-white/10 text-xs text-zinc-500">
            ✓
          </div>
          <span>Gjennomført test-stempling</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-5 w-5 items-center justify-center rounded-full border border-white/10 text-xs text-zinc-500">
            ✓
          </div>
          <span>Registrert tilgjengelighet</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-5 w-5 items-center justify-center rounded-full border border-white/10 text-xs text-zinc-500">
            ✓
          </div>
          <span>Forstått vaktbytte-konseptet</span>
        </div>
      </div>

      <SubHeading>Sjekkpunkt-typer</SubHeading>
      <div className="my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Type</th>
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Eksempel</th>
              <th className="py-3 text-left font-semibold text-zinc-400">Sporing</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Skjermbesøk</td>
              <td className="py-3 pr-4">Brukeren besøkte vaktplanen</td>
              <td className="py-3">Navigasjonshendelse</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Handling</td>
              <td className="py-3 pr-4">Brukeren fullførte test-stempling</td>
              <td className="py-3">Systemhendelse</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-white">AI-verifisert</td>
              <td className="py-3 pr-4">Brukeren forstår vaktbytte</td>
              <td className="py-3">AI stiller kontrollspørsmål</td>
            </tr>
          </tbody>
        </table>
      </div>

      <InfoBox type="info">
        Når en ny modul aktiveres i arbeidsplassen, får ALLE brukere modulreisen — ikke bare
        trainees. AI-en tilpasser dybden: erfarne brukere får en rask gjennomgang, mens nye brukere
        får full veiledning.
      </InfoBox>

      <Heading id="readiness">Protokollopplæring og Readiness Score</Heading>
      <Paragraph>
        Protokollopplæring er det tredje systemet — det som lærer den ansatte selve jobben. Når du
        kobles til et team eller en avdeling, finner systemet alle policyer for det teamet. Hver
        aktiv policy har en protokoll med prosedyrer, kunnskapstester og bekreftelser.
      </Paragraph>

      <div className="my-6 grid gap-3">
        <FeatureCard icon={ShieldCheck} title="Readiness Score">
          Fullførte protokoller delt på tildelte protokoller gir din Readiness Score. Eksempel: 5 av
          8 protokoller fullført = 62,5%. Når alle 8 er gjort = 100% klar.
        </FeatureCard>
        <FeatureCard icon={BookOpen} title="Dokumentsignering">
          SmartOut er integrert med DocuSign for digital signering av arbeidsavtaler,
          taushetserklæringer, HACCP-opplæring og andre dokumenter.
        </FeatureCard>
      </div>

      <Heading id="ai-veiledning">AI-veiledning under onboarding</Heading>
      <Paragraph>
        Lise tilpasser seg den ansattes stilling, erfaring, læringstempo, språk og første vakt. En
        kokk får kjøkkenrelevante moduler først. Har du brukt vaktplanlegging før? Ja: komprimert
        gjennomgang. Nei: utvidet.
      </Paragraph>

      <Heading id="krysstrening">Krysstrening</Heading>
      <Paragraph>
        Når en ansatt bytter avdeling, utløses nye protokolltildelinger automatisk. Fullførte
        prosedyrer fra forrige avdeling beholdes — kun avdelingsspesifikke nye ting trengs.
      </Paragraph>

      <Heading id="gamifisering">Gamifisering</Heading>
      <Paragraph>
        Poeng opptjent under trainee-perioden overføres til den ansattes første sesong. Du får poeng
        for å fullføre sjekkpunkter, bestå kunnskapstester, signere bekreftelser, og fullføre
        prosedyrer raskt.
      </Paragraph>
    </DocsArticle>
  );
}
