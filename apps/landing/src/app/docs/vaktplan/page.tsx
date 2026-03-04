import {
  CalendarDays,
  Clock,
  LayoutGrid,
  Sparkles,
  GripVertical,
  Calendar,
  FileText,
  UserPlus,
} from "lucide-react";
import {
  DocsArticle,
  Heading,
  SubHeading,
  Paragraph,
  InfoBox,
  FeatureCard,
} from "../_components/docs-article";

export default function VaktplanPage() {
  return (
    <DocsArticle
      prev={{ title: "Onboarding", href: "/docs/onboarding" }}
      next={{ title: "Ansatte", href: "/docs/ansatte" }}
    >
      <div className="mb-10">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10">
            <CalendarDays className="h-5 w-5 text-orange-400" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-white md:text-4xl">
            Vaktplan og bemanning
          </h1>
        </div>
        <Paragraph>
          Vaktplanlegging i SmartOut kobler sammen bemanning, kompetanse, arbeidsrett og
          &#248;konomi &#8212; og gir ledere sanntidsoversikt fra tre perspektiver.
        </Paragraph>
      </div>

      <Heading id="visningsmodi">Tre visningsmodi</Heading>
      <Paragraph>
        Vaktplanen kan vises p&#229; tre m&#229;ter. Alle viser det samme datasettet fra ulike
        perspektiver:
      </Paragraph>

      <div className="my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Modus</th>
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Perspektiv</th>
              <th className="py-3 text-left font-semibold text-zinc-400">Best for</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Stilling</td>
              <td className="py-3 pr-4">Rader = Stillinger, kolonner = dager</td>
              <td className="py-3">Se om alle roller er besatt</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Ansatt</td>
              <td className="py-3 pr-4">Rader = Ansatte, kolonner = dager</td>
              <td className="py-3">Se hvem som jobber n&#229;r</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-white">Lokasjon</td>
              <td className="py-3 pr-4">Rader = Lokasjoner/soner, kolonner = dager</td>
              <td className="py-3">Se bemanningen per sted</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Paragraph>
        I tillegg finnes en m&#229;nedsvisning som gir &#248;yeblikksbildet for en hel m&#229;ned
        med kompakt oversikt over bemanning per dag.
      </Paragraph>

      <Heading id="dra-og-slipp">Dra-og-slipp planlegging</Heading>
      <div className="my-6 grid gap-3">
        <FeatureCard icon={GripVertical} title="Visuell planlegging">
          Dra vakter mellom ansatte, stillinger og dager. Bytt tidspunkt, flytt vakter, eller kopier
          dem &#8212; alt med mus. Systemet validerer arbeidsrett i sanntid mens du drar.
        </FeatureCard>
        <FeatureCard icon={FileText} title="Batchhandlinger">
          Velg flere vakter og utf&#248;r handlinger p&#229; alle samtidig: slett, flytt, endre
          status, eller kopier til neste uke. Sparer tid ved store endringer.
        </FeatureCard>
      </div>

      <Heading id="vaktkort">Vaktkortet</Heading>
      <Paragraph>
        Hver vakt vises som et kort i vaktplanen med tidspunkt, stilling, navn, sted, status og
        fargekoding etter avdeling.
      </Paragraph>

      <SubHeading>Seks faner ved klikk</SubHeading>
      <Paragraph>
        Klikk p&#229; et vaktkort for &#229; &#229;pne det fullstendige vaktdetaljpanelet:
      </Paragraph>

      <div className="my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Fane</th>
              <th className="py-3 text-left font-semibold text-zinc-400">Innhold</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Oversikt</td>
              <td className="py-3">Tidspunkt, stilling, l&#248;nnsinformasjon, pauseberegning</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Oppgaver</td>
              <td className="py-3">Oppgaver knyttet til denne vakten</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Prosedyrer</td>
              <td className="py-3">Prosedyrer som skal gjennomg&#229;s denne vakten</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Notat</td>
              <td className="py-3">Interne notater for vakten</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Historikk</td>
              <td className="py-3">Endringslogg &#8212; hvem endret hva og n&#229;r</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-white">Bytte</td>
              <td className="py-3">Bytteanmodninger og godkjenninger</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Heading id="kontrollpanel">Dagskontrollpanel</Heading>
      <Paragraph>
        Klikk p&#229; en dag i vaktplanen for &#229; &#229;pne dagskontrollpanelet. Her ser du all
        informasjon for den valgte dagen: dagsbriefing, bemanningsoversikt, &#229;pne vakter,
        frav&#230;r, og muligheten til &#229; sende meldinger eller kringkaste til alle p&#229;
        vakt.
      </Paragraph>

      <Heading id="apne-vakter">&#197;pne vakter</Heading>
      <div className="my-6 grid gap-3">
        <FeatureCard icon={UserPlus} title="Publiser &#229;pne vakter">
          N&#229;r du mangler bemanning, opprett en &#229;pen vakt med stilling, tidspunkt og
          eventuelle kompetansekrav. Ansatte kan melde interesse, og du velger hvem som f&#229;r
          vakten.
        </FeatureCard>
      </div>

      <Heading id="ukeperiode">Ukesvisning og publisering</Heading>
      <Paragraph>
        Vaktplanen opererer i ukeperioder. Leder jobber med &laquo;neste uke&raquo; mens
        &laquo;denne uken&raquo; er publisert og l&#229;st.
      </Paragraph>

      <div className="my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Status</th>
              <th className="py-3 text-left font-semibold text-zinc-400">Betydning</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Utkast</td>
              <td className="py-3">Under arbeid &#8212; ikke synlig for ansatte</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Publisert</td>
              <td className="py-3">L&#229;st og synlig &#8212; ansatte ser sine vakter</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-white">Endret</td>
              <td className="py-3">
                Publisert med ettertrinn &#8212; ansatte varsles om endringer
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <InfoBox type="info">
        N&#229;r du publiserer, kan du se en fullstendig publiseringsoversikt med sammenligning av
        planlagt vs forrige uke, bemanningsantall, og kostnadsestimat f&#248;r du bekrefter.
      </InfoBox>

      <Heading id="maler">Vaktmaler</Heading>
      <Paragraph>
        SmartOut st&#248;tter lagring og gjenbruk av vaktmaler for &#229; akselerere planleggingen.
      </Paragraph>
      <div className="my-6 grid gap-3">
        <FeatureCard icon={LayoutGrid} title="Lagre maler">
          Lagre den n&#229;v&#230;rende uken som en mal med navn og beskrivelse. Malen inkluderer
          alle vakter med stillinger, tidspunkter og avdelingskobling.
        </FeatureCard>
        <FeatureCard icon={Calendar} title="Last inn maler">
          Last inn en lagret mal p&#229; en ny uke. Velg fra listen over tilgjengelige maler. Du kan
          redigere maler og slette de du ikke trenger lenger.
        </FeatureCard>
        <FeatureCard icon={Clock} title="Sesongmaler">
          Standardoppsett for hele sesonger &#8212; sommersesong, vintersesong. Bygger p&#229;
          sesongbudsjettets dagsfaktorer for &#229; tilpasse bemanning.
        </FeatureCard>
      </div>

      <Heading id="tilgjengelighet">Tilgjengelighet</Heading>
      <Paragraph>
        Ansatte registrerer sin tilgjengelighet. Lederen ser dette n&#229;r de planlegger:
        Tilgjengelig, Ikke tilgjengelig, Foretrekker (&#248;nsker vakten), eller Foretrekker ikke
        (helst ikke, men kan om n&#248;dvendig).
      </Paragraph>

      <Heading id="vaktbytte">Vaktbytte</Heading>
      <Paragraph>SmartOut har en innebygd bytteprosess i fem steg:</Paragraph>
      <div className="my-4 space-y-2 text-sm text-zinc-400">
        <div className="flex items-start gap-3">
          <span className="shrink-0 font-bold text-orange-400">1.</span>
          <span>Ansatt foresl&#229;r bytte med en annen person</span>
        </div>
        <div className="flex items-start gap-3">
          <span className="shrink-0 font-bold text-orange-400">2.</span>
          <span>Den andre aksepterer eller avsl&#229;r</span>
        </div>
        <div className="flex items-start gap-3">
          <span className="shrink-0 font-bold text-orange-400">3.</span>
          <span>Leder godkjenner byttet (om p&#229;krevd)</span>
        </div>
        <div className="flex items-start gap-3">
          <span className="shrink-0 font-bold text-orange-400">4.</span>
          <span>Systemet sjekker: arbeidstidsregler, kompetanse, overtid</span>
        </div>
        <div className="flex items-start gap-3">
          <span className="shrink-0 font-bold text-orange-400">5.</span>
          <span>Vakten byttes og begge varsles</span>
        </div>
      </div>

      <Heading id="stemplingsur">Stemplingsur</Heading>
      <Paragraph>
        SmartOut har innebygd stemplingsur med inn- og utstempling, pauseregistrering, og mulighet
        for leder-korreksjoner. GPS-posisjonering kan kreves for stempling.
      </Paragraph>

      <div className="my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Regel</th>
              <th className="py-3 text-left font-semibold text-zinc-400">Oppf&#248;rsel</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Tidlig stempling</td>
              <td className="py-3">Konfigurerbar buffer (f.eks. maks 15 min f&#248;r vaktstart)</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Sen ankomst</td>
              <td className="py-3">Automatisk flagging etter konfigurerbart antall minutter</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-white">Manglende utstempling</td>
              <td className="py-3">P&#229;minnelse + eskalering til leder</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Heading id="arbeidsrett">Arbeidsrett og validering</Heading>
      <Paragraph>
        Vaktplanen validerer mot norske arbeidstidsregler. Systemet advarer lederen ved brudd
        f&#248;r publisering, og kritiske brudd blokkerer publisering.
      </Paragraph>

      <div className="my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Regel</th>
              <th className="py-3 text-left font-semibold text-zinc-400">Grense</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Daglig arbeidstid</td>
              <td className="py-3">Maks 9 timer (10 med avtale)</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Ukentlig arbeidstid</td>
              <td className="py-3">Maks 40 timer (37,5 med tariff)</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Daglig hvile</td>
              <td className="py-3">Minst 11 timer mellom vakter</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Ukentlig hvile</td>
              <td className="py-3">Minst 35 timer sammenhengende per 7 dager</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-white">Overtid</td>
              <td className="py-3">Maks 10t/7d, 25t/4u, 200t/52u</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Heading id="ai-planlegging">AI-assistert planlegging</Heading>
      <div className="my-6 grid gap-3">
        <FeatureCard icon={Sparkles} title="Smart forslag">
          Lise foresl&#229;r vaktplaner basert p&#229; historisk bemanningsbehov, ansattes
          tilgjengelighet og preferanser, kompetansekrav, budsjettm&#229;l fra sesongplanlegging, og
          overtids-/hviletidskrav.
        </FeatureCard>
      </div>
    </DocsArticle>
  );
}
