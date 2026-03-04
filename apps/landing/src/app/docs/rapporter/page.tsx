import {
  BarChart3,
  Camera,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  XCircle,
  FileText,
} from "lucide-react";
import {
  DocsArticle,
  Heading,
  SubHeading,
  Paragraph,
  InfoBox,
  FeatureCard,
} from "../_components/docs-article";

export default function RapporterPage() {
  return (
    <DocsArticle
      prev={{ title: "Lise AI-assistent", href: "/docs/ai-assistent" }}
      next={{ title: "Innstillinger", href: "/docs/innstillinger" }}
    >
      <div className="mb-10">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10">
            <BarChart3 className="h-5 w-5 text-orange-400" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-white md:text-4xl">
            Rapporter og avstemming
          </h1>
        </div>
        <Paragraph>
          SmartOut sitt rapporteringssystem gj&#248;r r&#229; driftsdata om til verifisert
          forretningssannhet. Fra drift&#248;kt-signering til daglig avstemming til
          sesongavslutning.
        </Paragraph>
      </div>

      <Heading id="tre-nivaer">Tre niv&#229;er av avstemming</Heading>
      <div className="my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Niv&#229;</th>
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Hvem</th>
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">N&#229;r</th>
              <th className="py-3 text-left font-semibold text-zinc-400">Hva</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Drift&#248;kt-signering</td>
              <td className="py-3 pr-4">Ansatt</td>
              <td className="py-3 pr-4">Slutten av dagen</td>
              <td className="py-3">Driften er ferdig, oppgavene er gjort</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Daglig avstemming</td>
              <td className="py-3 pr-4">Admin/leder</td>
              <td className="py-3 pr-4">Neste virkedag</td>
              <td className="py-3">Inntekt, timer, avvik og kostnader verifisert</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-white">Sesongavstemming</td>
              <td className="py-3 pr-4">Admin</td>
              <td className="py-3 pr-4">Sesong slutt</td>
              <td className="py-3">Budsjett vs faktisk, l&#230;rdommer</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Heading id="daglig">Daglig avstemming</Heading>
      <Paragraph>
        Den daglige avstemmingen er organisert som et to-panel-grensesnitt. Til venstre en dagliste
        med alle dager som trenger gjennomgang. Til h&#248;yre en detaljvisning med tre faner:
        Omsetning, Vakter og Avvik.
      </Paragraph>

      <SubHeading>Fase 1: Avslutning</SubHeading>
      <Paragraph>
        Ansatt med h&#248;yest ansiennitet som stenger avdelingen utf&#248;rer avslutningen.
      </Paragraph>

      <div className="my-6 grid gap-3">
        <FeatureCard icon={Camera} title="Bildeopplasting">
          Minimum 2 bilder: kassarapport (POS daglig oppsummering) og betalingsterminal-rapport.
          Valgfritt: Z-rapport og kassetelling. Systemet kj&#248;rer OCR automatisk p&#229; bildene.
        </FeatureCard>
      </div>

      <Paragraph>
        OCR trekker ut: total omsetning, kort vs kontant, MVA-bel&#248;p og antall transaksjoner.
        Kasse- og terminaltotaler kryssvalideres. Avvik over terskel (f.eks. 50 kr eller 0,5%)
        oppretter automatisk et avvik.
      </Paragraph>

      <SubHeading>Fase 2: Godkjenning</SubHeading>
      <Paragraph>
        Neste virkedag godkjenner admin dagen. Godkjenningspanelet har tre faner:
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
              <td className="py-3 pr-4 font-medium text-white">Omsetning</td>
              <td className="py-3">
                Totalt, kort vs kontant, MVA, transaksjoner, OCR-bilder med konfidens
              </td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Vakter</td>
              <td className="py-3">
                Per vakt: planlagt vs faktisk tid, stempling inn/ut, beregnede timer, godkjenning
              </td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-white">Avvik</td>
              <td className="py-3">
                Alle avvik med alvorlighetsgrad, domene, kostnadsp&#229;virkning og
                l&#248;sningsnotater
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="my-6 grid gap-3">
        <FeatureCard icon={CheckCircle2} title="Godkjenning">
          Admin godkjenner n&#229;r alle blokkerende avvik er l&#248;st og alle ventende vakter er
          godkjent. Valgfrie godkjenningsnotater kan legges til.
        </FeatureCard>
        <FeatureCard icon={XCircle} title="Avvisning">
          Admin kan avvise med begrunnelse. Avvist dag g&#229;r tilbake i k&#248;en for gjennomgang.
        </FeatureCard>
      </div>

      <InfoBox type="warning" title="Blokkerende avvik">
        Noen avvik blokkerer dagsgodkjenning. Disse m&#229; l&#248;ses f&#248;r admin kan godkjenne.
        Eksempel: kassadifferanse over terskel, manglende kvittering, eller ubesvart HACCP-avvik.
      </InfoBox>

      <SubHeading>Avviksdomener</SubHeading>
      <div className="my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Domene</th>
              <th className="py-3 text-left font-semibold text-zinc-400">Eksempler</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">&#216;konomi</td>
              <td className="py-3">Kassadifferanse, manglende kvittering</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Drift</td>
              <td className="py-3">Ufullf&#248;rte oppgaver, signering med unntak</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Bemanning</td>
              <td className="py-3">Manglende stempling, overtid, uplanlagt frav&#230;r</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">HACCP</td>
              <td className="py-3">Temperaturavvik, hygienebrudd</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-white">System</td>
              <td className="py-3">OCR-mismatch, integrasjonsfeil</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Heading id="kpi">KPI-dashboardet</Heading>
      <Paragraph>
        SmartOut sitt KPI-dashboard er todelt: proaktivt (fremoverrettet) og reaktivt
        (bakoverrettet).
      </Paragraph>

      <div className="my-6 grid gap-3">
        <FeatureCard icon={TrendingUp} title="Proaktive KPI-er">
          Omsetning per &#229;pen time (hva trenger vi &#229; selge?), budsjettbrennrate, og
          bemanningskostnad fremover.
        </FeatureCard>
        <FeatureCard icon={BarChart3} title="Reaktive KPI-er">
          Omsetning per arbeidet time, l&#248;nnskostnadsprosent, avviksfrekvens,
          oppgavefullf&#248;ring, og HACCP-samsvar.
        </FeatureCard>
      </div>

      <Heading id="varsler">Varsler og terskler</Heading>
      <Paragraph>
        Admin setter terskelverdier for KPI-er. Advarsel ved overskridelse, kritisk varsel (push +
        SMS) ved alvorlige brudd, og positiv melding ved gode resultater.
      </Paragraph>

      <Heading id="sesong">Sesongavstemming</Heading>
      <Paragraph>
        N&#229;r en sesong avsluttes: alle daglige avstemminger m&#229; v&#230;re lukket, budsjett
        vs faktisk sammenlignes, faktor-n&#248;yaktighet evalueres, l&#230;rdommer dokumenteres, og
        faktiske data brukes til &#229; justere fremtidige prognoser.
      </Paragraph>

      <Heading id="rapporttyper">Rapporttyper</Heading>
      <div className="my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Rapport</th>
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Innhold</th>
              <th className="py-3 text-left font-semibold text-zinc-400">Periode</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Dagrapport</td>
              <td className="py-3 pr-4">Omsetning, timer, avvik, oppgaver</td>
              <td className="py-3">1 dag</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Ukerapport</td>
              <td className="py-3 pr-4">Aggregert per avdeling</td>
              <td className="py-3">1 uke</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Sesongrapport</td>
              <td className="py-3 pr-4">Budsjett vs faktisk, KPI-er, trender</td>
              <td className="py-3">Hel sesong</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">HACCP-rapport</td>
              <td className="py-3 pr-4">Temperatur, avvik, sertifiseringer</td>
              <td className="py-3">Valgfri</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Personalrapport</td>
              <td className="py-3 pr-4">Timer, frav&#230;r, kompetanse per ansatt</td>
              <td className="py-3">Valgfri</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-white">L&#248;nnsrapport</td>
              <td className="py-3 pr-4">Timer, tillegg, total per ansatt</td>
              <td className="py-3">L&#248;nnsperiode</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Heading id="ai-rapporter">AI i rapporter</Heading>
      <div className="my-6 grid gap-3">
        <FeatureCard icon={Sparkles} title="Lise hjelper med rapportering">
          Automatisk kompilering av daglige og ukentlige rapporter. Anomalideteksjon. Trendanalyse.
          Naturligspr&#229;k-oppsummeringer: &laquo;Denne uken hadde vi 12% h&#248;yere omsetning
          enn forrige uke, drevet av l&#248;rdag.&raquo;
        </FeatureCard>
      </div>
    </DocsArticle>
  );
}
