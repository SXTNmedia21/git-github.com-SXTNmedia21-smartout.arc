import { Rocket, Building2, MapPin, Users, Globe, Search, Brain, FileText } from "lucide-react";
import {
  DocsArticle,
  Heading,
  SubHeading,
  Paragraph,
  Step,
  StepList,
  InfoBox,
  FeatureCard,
} from "../_components/docs-article";

export default function KomIGangPage() {
  return (
    <DocsArticle next={{ title: "Onboarding", href: "/docs/onboarding" }}>
      <div className="mb-10">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10">
            <Rocket className="h-5 w-5 text-orange-400" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-white md:text-4xl">
            Kom i gang
          </h1>
        </div>
        <Paragraph>
          Denne guiden tar deg gjennom oppsettet av SmartOut steg for steg. Du vil opprette en
          konto, registrere bedriften din, sette opp din første arbeidsplass, og invitere de
          ansatte.
        </Paragraph>
      </div>

      <Heading id="opprett-konto">1. Opprett konto</Heading>
      <Paragraph>
        Gå til smartout.ai og klikk &laquo;Kom i gang&raquo;. Du kan registrere deg med e-post og
        passord, eller logge inn med Google eller Microsoft.
      </Paragraph>

      <StepList>
        <Step number={1} title="Besøk registreringssiden">
          Klikk &laquo;Start gratis prøveperiode&raquo; på smartout.ai.
        </Step>
        <Step number={2} title="Fyll inn informasjonen din">
          Oppgi fullt navn, e-postadresse, og velg et sikkert passord (minst 8 tegn). Alternativt:
          logg inn med Google eller Microsoft SSO.
        </Step>
        <Step number={3} title="Bekreft e-posten din">
          Du mottar en bekreftelses-e-post. Klikk på lenken for å aktivere kontoen.
        </Step>
      </StepList>

      <InfoBox type="tip">
        Bruker du Google Workspace eller Microsoft 365 på arbeidsplassen? Da kan du logge inn med
        SSO — det gjør det lettere for de ansatte også.
      </InfoBox>

      <Heading id="konfigurer-bedrift">2. Konfigurer bedriften</Heading>
      <Paragraph>
        Etter registrering blir du tatt gjennom en 5-trinns veileder som setter opp bedriften din.
        SmartOut bruker fire intelligenskilder for å gjøre oppsettet så raskt som mulig:
      </Paragraph>

      <div className="my-6 grid gap-3">
        <FeatureCard icon={Globe} title="Nettside-skraping">
          Henter bedriftsnavn, bilder, meny, åpningstider og annen informasjon fra nettsiden din.
        </FeatureCard>
        <FeatureCard icon={Building2} title="Brønnøysundregistrene">
          Slår opp org.nr. og henter juridisk navn, adresse, daglig leder, antall ansatte og
          bransje.
        </FeatureCard>
        <FeatureCard icon={Search} title="Nettsøk">
          Finner anmeldelser, sesongmønstre, stillingsannonser og mediemeldinger om bedriften din.
        </FeatureCard>
        <FeatureCard icon={Brain} title="AI-analyse">
          Kombinerer alt og foreslår avdelinger, stillinger, team og rutiner basert på din type
          bedrift.
        </FeatureCard>
      </div>

      <SubHeading id="fem-akter">De fem aktene</SubHeading>
      <Paragraph>SmartOut sin oppstartsveileder er organisert som en reise i fem akter:</Paragraph>

      <StepList>
        <Step number={1} title="Hvem er dere?">
          Bekreft bedriftsinformasjon — navn, org.nr., bransje, adresse. Systemet har allerede
          hentet det meste, du bare bekrefter.
        </Step>
        <Step number={2} title="Hvordan ser dere ut?">
          Velg logo, farger, og profiltekst for bedriften. Kontrakt genereres og sendes automatisk.
        </Step>
        <Step number={3} title="Velkommen til SmartOut">
          Lær hva en Sesong er og hvordan SmartOut fungerer. Interaktiv introduksjon til
          kjernekonseptene.
        </Step>
        <Step number={4} title="Bygg din første sesong">
          Sett opp avdelinger (Kjøkken, Sal, Bar), definer stillinger per avdeling, opprett team og
          lokasjoner. AI-en foreslår basert på informasjonen den har samlet.
        </Step>
        <Step number={5} title="Trykk Play">
          Se en oppsummering av alt du har bygget. Aktiver sesongen, gå til dashboardet, og inviter
          din første ansatt.
        </Step>
      </StepList>

      <InfoBox type="info">
        AI-assistenten Lise kan guide deg gjennom hele oppsettet via chat. &laquo;Jeg ser dere er en
        restaurant. De fleste restauranter starter med Kjøkken, Sal og Bar som avdelinger. Stemmer
        det for dere?&raquo;
      </InfoBox>

      <Heading id="opprett-arbeidsplass">3. Opprett arbeidsplassen</Heading>
      <Paragraph>
        En arbeidsplass i SmartOut representerer ett fysisk sted — for eksempel én restaurant, ett
        hotell, eller én kafé. Har du flere lokasjoner, kan du opprette flere arbeidsplasser under
        samme bedrift.
      </Paragraph>

      <div className="my-6 grid gap-3">
        <FeatureCard icon={MapPin} title="Lokasjoner">
          Fysiske soner som kjøkken, bar, terrasse, eller lager. Brukes til å organisere oppgaver og
          stemplingsur.
        </FeatureCard>
        <FeatureCard icon={Building2} title="Avdelinger">
          Funksjonelle enheter som Kjøkken, Servering, eller Bar. Ansatte tilhører én eller flere
          avdelinger. Avdelinger er permanente og sesonguavhengige.
        </FeatureCard>
        <FeatureCard icon={Users} title="Team">
          Fleksible grupper for tilgangsstyring, sesongarbeidere, eller tverrfaglige grupper. Team
          kan være sesongbaserte.
        </FeatureCard>
        <FeatureCard icon={FileText} title="Stillinger">
          Jobbtyper per avdeling — Kokk, Servitør, Bartender. Stillinger tildeles per vakt, ikke per
          person: en ansatt kan jobbe som Servitør på mandag og Bartender på fredag.
        </FeatureCard>
      </div>

      <InfoBox type="warning">
        Avdelinger og lokasjoner er permanent infrastruktur. Team, stillinger, soner og utstyr kan
        tilpasses per sesong.
      </InfoBox>

      <Heading id="inviter-ansatte">4. Inviter ansatte</Heading>
      <Paragraph>
        Når arbeidsplassen er satt opp, er det tid for å invitere teamet ditt. SmartOut tilbyr fire
        invitasjonsmetoder:
      </Paragraph>

      <div className="my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Metode</th>
              <th className="py-3 pr-4 text-left font-semibold text-zinc-400">Beskrivelse</th>
              <th className="py-3 text-left font-semibold text-zinc-400">Best for</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">E-post</td>
              <td className="py-3 pr-4">Send invitasjonslenke via e-post</td>
              <td className="py-3">Standard — de fleste ansatte</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">SMS</td>
              <td className="py-3 pr-4">Send invitasjonslenke via SMS</td>
              <td className="py-3">Ansatte uten fast e-post</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-3 pr-4 font-medium text-white">Delbar lenke</td>
              <td className="py-3 pr-4">Generer en åpen invitasjonslenke med utløpsdato</td>
              <td className="py-3">Jobbmesser, gruppeansettelser</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-white">Bulk CSV</td>
              <td className="py-3 pr-4">
                Last opp en CSV-fil med navn, e-post, avdeling og stilling
              </td>
              <td className="py-3">Sesongansettelser (10+ ansatte)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <SubHeading>Hva du fyller inn per invitasjon</SubHeading>
      <Paragraph>
        Navn og e-post eller telefon er påkrevd. I tillegg kan du sette avdeling (påkrevd),
        stilling, rolle (standard: ansatt), og forventet startdato.
      </Paragraph>

      <SubHeading>Hva skjer etter invitasjonen?</SubHeading>
      <Paragraph>
        Når en ansatt aksepterer invitasjonen, opprettes en profil med status &laquo;trainee&raquo;.
        De starter i Trainee-modus der de kan utforske systemet uten å påvirke live data.
        Invitasjoner er gyldige i 14 dager og kan sendes på nytt, kanselleres, eller spores fra
        dashboardet.
      </Paragraph>
      <Paragraph>
        Eksisterende SmartOut-brukere (fra en annen arbeidsplass) logger bare inn og kobles til den
        nye arbeidsplassen automatisk. Les mer om onboarding-prosessen i neste seksjon.
      </Paragraph>
    </DocsArticle>
  );
}
