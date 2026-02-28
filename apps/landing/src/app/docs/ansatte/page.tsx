import { Users, Building2, MapPin, UserCheck, ShieldCheck, ArrowRightLeft } from "lucide-react";
import {
  DocsArticle,
  Heading,
  SubHeading,
  Paragraph,
  InfoBox,
  FeatureCard,
} from "../_components/docs-article";

export default function AnsattePage() {
  return (
    <DocsArticle
      prev={{ title: "Vaktplan", href: "/docs/vaktplan" }}
      next={{ title: "Oppgaver og rutiner", href: "/docs/oppgaver-rutiner" }}
    >
      <div className="mb-10">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10">
            <Users className="h-5 w-5 text-orange-400" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-white md:text-4xl">
            Ansatte og organisering
          </h1>
        </div>
        <Paragraph>
          SmartOut organiserer mennesker i en fleksibel struktur med avdelinger, team, stillinger og
          lokasjoner. Her er hvordan strukturen fungerer og hvordan du administrerer dine ansatte.
        </Paragraph>
      </div>

      <Heading id="organisasjonsstruktur">Organisasjonsstruktur</Heading>
      <Paragraph>SmartOut bruker fire kjernetyper for organisering:</Paragraph>

      <div className="my-6 grid gap-3">
        <FeatureCard icon={Building2} title="Avdeling — HVA gjør de?">
          Kjøkken, Servering, Bar, Renhold. Avdelinger er permanente — de eksisterer uavhengig av
          sesong. Hver avdeling har egne stillinger, driftsøkter, chat-kanal og operasjonsplan.
        </FeatureCard>
        <FeatureCard icon={MapPin} title="Lokasjon — HVOR jobber de?">
          Hovedbygning, Terrasse, Kjøkken, Lager. Kan utvides med soner (serveringsområder) og
          utstyr (kjøleskap, ovner med vedlikeholdsplan og HACCP-kobling).
        </FeatureCard>
        <FeatureCard icon={Users} title="Team — HVEM jobber sammen?">
          Fleksible grupper: operasjonelt, tilgang, tverrfaglig, sesong, eller egendefinert. Hvert
          team har en leder. Team kan være sesongbaserte.
        </FeatureCard>
        <FeatureCard icon={UserCheck} title="Stilling — HVA GJØR de akkurat nå?">
          Kokk, Servitør, Bartender, Oppvaskhjelp. Stilling er per VAKT, ikke per person — en ansatt
          kan jobbe som Servitør på mandag og Bartender på fredag.
        </FeatureCard>
      </div>

      <InfoBox type="warning">
        Teamleder er IKKE en rolle — det er en egenskap ved teamet. Rollen (ansatt, leder, admin,
        eier) bestemmer tilgangsnivå.
      </InfoBox>

      <Heading id="profil-status">Profil og status</Heading>
      <Paragraph>
        Hver ansatt har en profil per arbeidsplass med personlig informasjon, rolle, status,
        avdeling, team, nødkontakt og ansettelsesdata.
      </Paragraph>

      <SubHeading>Status-forklaring</SubHeading>
      <div className="my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Status</th>
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Hva det betyr</th>
              <th className="py-3 text-left font-semibold text-zinc-400">Hva de kan gjøre</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-amber-400">Trainee</td>
              <td className="py-3 pr-4">Ny ansatt i opplæring</td>
              <td className="py-3">Utforsker systemet i sandbox</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-emerald-400">Aktiv</td>
              <td className="py-3 pr-4">Fullt operativ ansatt</td>
              <td className="py-3">Alt — vakter, oppgaver, chat, stempling</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-zinc-500">Inaktiv</td>
              <td className="py-3 pr-4">Pausert eller permittert</td>
              <td className="py-3">Kan logge inn, ser historikk, kan ikke tildeles vakter</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-red-400">Offboarding</td>
              <td className="py-3 pr-4">Slutter</td>
              <td className="py-3">Tilgang fjernes gradvis, data bevares</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Heading id="roller">Roller og tilgang</Heading>
      <div className="my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Rolle</th>
              <th className="py-3 text-left font-semibold text-zinc-400">Tilgang</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Ansatt</td>
              <td className="py-3">Se egne vakter, utføre oppgaver, delta i chat</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Leder</td>
              <td className="py-3">+ godkjenne bytter, signere driftsøkter, se teamoversikt</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Admin</td>
              <td className="py-3">+ administrere ansatte, policyer, rapporter, innstillinger</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-white">Eier</td>
              <td className="py-3">+ fakturering, slette arbeidsplass, overføre eierskap</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Heading id="administrere">Administrere ansatte</Heading>
      <Paragraph>
        Gå til Ansatte i dashboardet for å legge til, endre eller fjerne ansatte. Endre rolle,
        avdeling, team eller status — endringer trer i kraft umiddelbart.
      </Paragraph>

      <SubHeading>Flytt mellom avdelinger</SubHeading>
      <Paragraph>
        Når en ansatt flyttes til en ny avdeling, utløses nye protokollopplæringer automatisk.
        Allerede fullførte prosedyrer beholdes, og Readiness Score beregnes på nytt for den nye
        avdelingen.
      </Paragraph>

      <SubHeading>Offboarding</SubHeading>
      <Paragraph>
        Når en ansatt slutter, sett status til &laquo;offboarding&raquo;. Systemet fjerner gradvis
        tilgang, persondata anonymiseres etter innstilt frist (GDPR), og lønns- og arbeidstidsdata
        bevares etter lovkrav.
      </Paragraph>

      <Heading id="kompetanse">Kompetansesporing</Heading>
      <div className="my-6 grid gap-3">
        <FeatureCard icon={ShieldCheck} title="Readiness Score">
          Fullførte prosedyrer per ansatt og per avdeling. Prosent av tildelte protokoller fullført.
        </FeatureCard>
        <FeatureCard icon={ArrowRightLeft} title="Sertifiseringer">
          Sertifiseringer med utløpsdato (hygienekurs, alkoholservering, førstehjelp). Automatisk
          varsel ved utløp.
        </FeatureCard>
      </div>

      <Heading id="flerarbeidsplass">Flerarbeidsplasstilgang</Heading>
      <Paragraph>
        En person kan ha tilgang til flere arbeidsplasser under samme bedrift. De har én global
        brukeridentitet og separate profiler per arbeidsplass. Arbeidsplass-bytteren i dashboardet
        lar dem navigere mellom sine arbeidsplasser.
      </Paragraph>
    </DocsArticle>
  );
}
