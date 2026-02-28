import { Settings, Building2 } from "lucide-react";
import {
  DocsArticle,
  Heading,
  SubHeading,
  Paragraph,
  InfoBox,
  FeatureCard,
} from "../_components/docs-article";

export default function InnstillingerPage() {
  return (
    <DocsArticle prev={{ title: "Rapporter", href: "/docs/rapporter" }}>
      <div className="mb-10">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10">
            <Settings className="h-5 w-5 text-orange-400" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-white md:text-4xl">
            Innstillinger
          </h1>
        </div>
        <Paragraph>
          Innstillinger i SmartOut dekker alt fra arbeidsplassens konfigurasjon til abonnement,
          personvern og flerspråklighet.
        </Paragraph>
      </div>

      <Heading id="arbeidsplass">Arbeidsplassinnstillinger</Heading>

      <SubHeading>Generelt</SubHeading>
      <Paragraph>
        Navn og logo, fysisk adresse (brukes for GPS-stempling), bransje, tidssone (standard:
        Europe/Oslo), og valuta (standard: NOK).
      </Paragraph>

      <SubHeading>Driftsinnstillinger</SubHeading>
      <Paragraph>
        Stemplingsregler (buffer for tidlig stempling, GPS-krav, pauseberegning),
        varslingsstandarder (stille timer, eskaleringtider), signering (krav, hvem kan signere,
        unntak), og avviksgrenser (kassadifferanse, temperatur).
      </Paragraph>

      <Heading id="abonnement">Abonnement og fakturering</Heading>
      <Paragraph>
        SmartOut bruker Stripe for fakturering. Abonnementsinformasjon administreres i
        innstillinger.
      </Paragraph>

      <div className="my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Plan</th>
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Innhold</th>
              <th className="py-3 text-left font-semibold text-zinc-400">Pris</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Gratis prøveperiode</td>
              <td className="py-3 pr-4">Full tilgang i 14 dager</td>
              <td className="py-3">0 kr</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Standard</td>
              <td className="py-3 pr-4">Alle kjernemoduler</td>
              <td className="py-3">Per ansatt/mnd</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-white">Premium</td>
              <td className="py-3 pr-4">Alle moduler + prioritert support + AI-utvidet</td>
              <td className="py-3">Per ansatt/mnd</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Heading id="flerarbeidsplass">Flerarbeidsplass</Heading>
      <div className="my-6 grid gap-3">
        <FeatureCard icon={Building2} title="En bedrift → mange arbeidsplasser">
          Hvert fysisk sted er en arbeidsplass. Felles brukeridentitet for ansatte. Separate
          profiler per arbeidsplass. Sentralisert rapportering for eier.
        </FeatureCard>
      </div>

      <InfoBox type="info">
        Bare eier eller admin på bedriftsnivå kan opprette nye arbeidsplasser. Ansatte navigerer
        mellom arbeidsplasser via arbeidsplass-bytteren i dashboardet.
      </InfoBox>

      <Heading id="gdpr">Personvern og GDPR</Heading>
      <Paragraph>
        SmartOut følger GDPR og norsk personvernlovgivning med tydelig formål for alle data,
        minimering, sletting, eksport (GDPR Art. 20), og innsyn (GDPR Art. 15).
      </Paragraph>

      <SubHeading>Dataoppbevaring</SubHeading>
      <div className="my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Datatype</th>
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Oppbevaring</th>
              <th className="py-3 text-left font-semibold text-zinc-400">Lovkrav</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Arbeidstidsdata</td>
              <td className="py-3 pr-4">3 år etter avsluttet arbeidsforhold</td>
              <td className="py-3">Arbeidsmiljøloven</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Lønnsdata</td>
              <td className="py-3 pr-4">5 år</td>
              <td className="py-3">Bokføringsloven</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">HACCP-data</td>
              <td className="py-3 pr-4">2 år</td>
              <td className="py-3">Mattilsynet</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Persondata</td>
              <td className="py-3 pr-4">Slettes ved forespørsel (maks 30 dager)</td>
              <td className="py-3">GDPR</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-white">Kommunikasjonsdata</td>
              <td className="py-3 pr-4">1 år etter avsluttet arbeidsforhold</td>
              <td className="py-3">Intern policy</td>
            </tr>
          </tbody>
        </table>
      </div>

      <SubHeading>Samtykke</SubHeading>
      <Paragraph>
        Profildata: berettiget interesse. Biometrisk stempling (GPS): eksplisitt samtykke.
        AI-interaksjoner: informert samtykke + mulighet for fravalg. Markedsføring: opt-in.
      </Paragraph>

      <Heading id="sprak">Språk og oversettelse</Heading>
      <div className="my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Språk</th>
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Kode</th>
              <th className="py-3 text-left font-semibold text-zinc-400">Status</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Norsk (bokmål)</td>
              <td className="py-3 pr-4">no</td>
              <td className="py-3 text-emerald-400">Primærspråk</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Svensk</td>
              <td className="py-3 pr-4">sv</td>
              <td className="py-3 text-emerald-400">Støttet</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Engelsk</td>
              <td className="py-3 pr-4">en</td>
              <td className="py-3 text-emerald-400">Støttet</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Dansk</td>
              <td className="py-3 pr-4">da</td>
              <td className="py-3 text-emerald-400">Støttet</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-white">Finsk</td>
              <td className="py-3 pr-4">fi</td>
              <td className="py-3 text-zinc-500">Planlagt</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Paragraph>
        Grensesnittet vises på brukerens valgte språk. Systemgenererte meldinger oversettes
        automatisk. Brukerinnhold forblir på originalspråk. Policyer og prosedyrer kan ha versjoner
        per språk. Lise tilpasser seg brukerens foretrukne språk.
      </Paragraph>

      <Heading id="integrasjoner">Integrasjoner</Heading>
      <div className="my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Tjeneste</th>
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Formål</th>
              <th className="py-3 text-left font-semibold text-zinc-400">Status</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Stripe</td>
              <td className="py-3 pr-4">Abonnement og fakturering</td>
              <td className="py-3 text-emerald-400">Aktiv</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">DocuSign</td>
              <td className="py-3 pr-4">Digitale kontrakter og signaturer</td>
              <td className="py-3 text-emerald-400">Aktiv</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">SendGrid</td>
              <td className="py-3 pr-4">Transaksjonell e-post</td>
              <td className="py-3 text-emerald-400">Aktiv</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Twilio</td>
              <td className="py-3 pr-4">SMS-varsler og stemmegrensesnitt</td>
              <td className="py-3 text-emerald-400">Aktiv</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">PostHog</td>
              <td className="py-3 pr-4">Produktanalyse</td>
              <td className="py-3 text-emerald-400">Aktiv</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-white">Google/Microsoft SSO</td>
              <td className="py-3 pr-4">Innlogging</td>
              <td className="py-3 text-emerald-400">Aktiv</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Heading id="rolletilgang">Tilgang per rolle</Heading>
      <div className="my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Innstilling</th>
              <th className="py-3 pr-4 text-center font-semibold text-zinc-400">Ansatt</th>
              <th className="py-3 pr-4 text-center font-semibold text-zinc-400">Leder</th>
              <th className="py-3 pr-4 text-center font-semibold text-zinc-400">Admin</th>
              <th className="py-3 text-center font-semibold text-zinc-400">Eier</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4">Se egne innstillinger</td>
              <td className="py-3 pr-4 text-center text-emerald-400">✓</td>
              <td className="py-3 pr-4 text-center text-emerald-400">✓</td>
              <td className="py-3 pr-4 text-center text-emerald-400">✓</td>
              <td className="py-3 text-center text-emerald-400">✓</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4">Arbeidsplassinnstillinger</td>
              <td className="py-3 pr-4 text-center text-zinc-600">—</td>
              <td className="py-3 pr-4 text-center text-amber-400">Begrenset</td>
              <td className="py-3 pr-4 text-center text-emerald-400">✓</td>
              <td className="py-3 text-center text-emerald-400">✓</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4">Abonnement og fakturering</td>
              <td className="py-3 pr-4 text-center text-zinc-600">—</td>
              <td className="py-3 pr-4 text-center text-zinc-600">—</td>
              <td className="py-3 pr-4 text-center text-zinc-600">—</td>
              <td className="py-3 text-center text-emerald-400">✓</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4">Opprette arbeidsplass</td>
              <td className="py-3 pr-4 text-center text-zinc-600">—</td>
              <td className="py-3 pr-4 text-center text-zinc-600">—</td>
              <td className="py-3 pr-4 text-center text-emerald-400">✓</td>
              <td className="py-3 text-center text-emerald-400">✓</td>
            </tr>
            <tr>
              <td className="py-3 pr-4">Slette arbeidsplass</td>
              <td className="py-3 pr-4 text-center text-zinc-600">—</td>
              <td className="py-3 pr-4 text-center text-zinc-600">—</td>
              <td className="py-3 pr-4 text-center text-zinc-600">—</td>
              <td className="py-3 text-center text-emerald-400">✓</td>
            </tr>
          </tbody>
        </table>
      </div>
    </DocsArticle>
  );
}
