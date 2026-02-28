import { BarChart3, Camera, TrendingUp, AlertTriangle, FileBarChart, Sparkles } from "lucide-react";
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
          SmartOut sitt rapporteringssystem gjør rå driftsdata om til verifisert forretningssannhet.
          Fra driftsøkt-signering til daglig avstemming til sesongavslutning.
        </Paragraph>
      </div>

      <Heading id="tre-nivaer">Tre nivåer av avstemming</Heading>
      <div className="my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Nivå</th>
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Hvem</th>
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Når</th>
              <th className="py-3 text-left font-semibold text-zinc-400">Hva</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Driftsøkt-signering</td>
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
              <td className="py-3">Budsjett vs faktisk, lærdommer</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Heading id="daglig">Daglig avstemming</Heading>

      <SubHeading>Fase 1: Avslutning</SubHeading>
      <Paragraph>
        Ansatt med høyest ansiennitet som stenger avdelingen utfører avslutningen.
      </Paragraph>

      <div className="my-6 grid gap-3">
        <FeatureCard icon={Camera} title="Bildeopplasting">
          Minimum 2 bilder: kassarapport (POS daglig oppsummering) og betalingsterminal-rapport.
          Valgfritt: Z-rapport og kassetelling.
        </FeatureCard>
      </div>

      <Paragraph>
        Systemet kjører OCR automatisk på bildene og trekker ut: total omsetning, kort vs kontant,
        MVA-beløp, og antall transaksjoner. Deretter kryssvalideres kassatotal mot terminaltotal.
        Avvik over terskel (f.eks. 50 kr eller 0,5%) oppretter automatisk et avvik.
      </Paragraph>

      <SubHeading>Fase 2: Godkjenning</SubHeading>
      <Paragraph>
        Neste virkedag godkjenner admin ved å gjennomgå bilder, bekrefte arbeidstimer, og håndtere
        avvik fra alle domener.
      </Paragraph>

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
              <td className="py-3 pr-4 font-medium text-white">Økonomi</td>
              <td className="py-3">Kassadifferanse, manglende kvittering</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Drift</td>
              <td className="py-3">Ufullførte oppgaver, signering med unntak</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Bemanning</td>
              <td className="py-3">Manglende stempling, overtid, uplanlagt fravær</td>
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
          Omsetning per åpen time (hva trenger vi å selge?), budsjettbrennrate, og bemanningskostnad
          fremover.
        </FeatureCard>
        <FeatureCard icon={BarChart3} title="Reaktive KPI-er">
          Omsetning per arbeidet time, lønnskostnadsprosent, avviksfrekvens, oppgavefullføring, og
          HACCP-samsvar.
        </FeatureCard>
      </div>

      <Heading id="varsler">Varsler og terskler</Heading>
      <Paragraph>
        Admin setter terskelverdier for KPI-er. Advarsel ved overskridelse, kritisk varsel (push +
        SMS) ved alvorlige brudd, og positiv melding ved gode resultater.
      </Paragraph>

      <Heading id="sesong">Sesongavstemming</Heading>
      <Paragraph>
        Når en sesong avsluttes: alle daglige avstemminger må være lukket, budsjett vs faktisk
        sammenlignes, faktor-nøyaktighet evalueres, lærdommer dokumenteres, og faktiske data brukes
        til å justere fremtidige prognoser.
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
              <td className="py-3 pr-4">Timer, fravær, kompetanse per ansatt</td>
              <td className="py-3">Valgfri</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-white">Lønnsrapport</td>
              <td className="py-3 pr-4">Timer, tillegg, total per ansatt</td>
              <td className="py-3">Lønnsperiode</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Heading id="ai-rapporter">AI i rapporter</Heading>
      <div className="my-6 grid gap-3">
        <FeatureCard icon={Sparkles} title="Lise hjelper med rapportering">
          Automatisk kompilering av daglige og ukentlige rapporter. Anomalideteksjon. Trendanalyse.
          Naturligspråk-oppsummeringer: &laquo;Denne uken hadde vi 12% høyere omsetning enn forrige
          uke, drevet av lørdag.&raquo;
        </FeatureCard>
      </div>
    </DocsArticle>
  );
}
