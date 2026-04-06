import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Navigation from "../../components/navigation";
import Footer from "../../components/footer";
import { FullTracker } from "../../components/tracking";

export const metadata: Metadata = {
  title: "Brukervilkår — SmartOut",
  description: "Vilkår for bruk av SmartOut-plattformen.",
};

export default function VilkarPage() {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <FullTracker />
      <Navigation />

      <main className="mx-auto max-w-3xl px-6 pt-28 pb-20">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground mb-10 inline-flex items-center gap-2 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Tilbake til forside
        </Link>

        <h1 className="text-foreground mb-3 text-4xl font-black tracking-tight">Brukervilkår</h1>
        <p className="text-muted-foreground mb-12 text-sm">Sist oppdatert: 29. mars 2026</p>

        <div className="text-muted-foreground space-y-10 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-foreground mb-3 text-lg font-bold">1. Om tjenesten</h2>
            <p>
              SmartOut er en digital plattform for ansattklargjøring i skiftbaserte virksomheter.
              Tjenesten hjelper arbeidsgivere med onboarding, opplæring, daglig støtte og
              kontinuerlig kompetanseutvikling av ansatte. SmartOut leveres av SmartOut AS (org.nr.
              under registrering).
            </p>
          </section>

          <section>
            <h2 className="text-foreground mb-3 text-lg font-bold">2. Bruk av tjenesten</h2>
            <p>Ved å bruke SmartOut aksepterer du disse vilkårene. For å bruke tjenesten må du:</p>
            <ul className="mt-2 list-inside list-disc space-y-2">
              <li>Være invitert av en arbeidsgiver som har en aktiv SmartOut-konto.</li>
              <li>Være minst 18 år gammel, eller ha samtykke fra foresatte.</li>
              <li>Oppgi korrekt informasjon ved registrering og holde denne oppdatert.</li>
            </ul>
            <p className="mt-2">
              Hvis du bruker tjenesten på vegne av en bedrift, bekrefter du at du har fullmakt til å
              binde bedriften til disse vilkårene.
            </p>
          </section>

          <section>
            <h2 className="text-foreground mb-3 text-lg font-bold">3. Brukerkontoer</h2>
            <ul className="list-inside list-disc space-y-2">
              <li>Du er ansvarlig for å holde påloggingsinformasjonen din konfidensiell.</li>
              <li>Du skal ikke dele tilgang til kontoen din med andre.</li>
              <li>Du må varsle oss umiddelbart ved mistanke om uautorisert tilgang.</li>
              <li>Én bruker per konto — deling av kontoer er ikke tillatt.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-foreground mb-3 text-lg font-bold">4. Innhold og data</h2>
            <p>
              Du eier alt innhold du legger inn i SmartOut. Ved å bruke tjenesten gir du SmartOut en
              begrenset lisens til å behandle innholdet ditt utelukkende for å levere og forbedre
              tjenesten. Ved oppsigelse kan du be om eksport av dine data innen 30 dager.
            </p>
          </section>

          <section>
            <h2 className="text-foreground mb-3 text-lg font-bold">5. Akseptabel bruk</h2>
            <p>Du forplikter deg til å ikke:</p>
            <ul className="mt-2 list-inside list-disc space-y-2">
              <li>Bruke tjenesten til ulovlige eller skadelige formål.</li>
              <li>
                Forsøke å få uautorisert tilgang til systemer, data eller andre brukerkontoer.
              </li>
              <li>Distribuere skadelig programvare eller forsøke å omgå sikkerhetsmekanismer.</li>
              <li>Laste opp innhold som krenker tredjeparts rettigheter.</li>
              <li>Bruke tjenesten på en måte som kan skade eller overbelaste plattformen.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-foreground mb-3 text-lg font-bold">6. Personvern</h2>
            <p>
              Behandling av personopplysninger er beskrevet i vår{" "}
              <Link
                href="/personvern"
                className="text-brand-orange underline underline-offset-4 transition-colors hover:opacity-80"
              >
                personvernerklæring
              </Link>
              . Personvernerklæringen er en del av disse vilkårene. Ved å bruke SmartOut aksepterer
              du også behandlingen som er beskrevet der.
            </p>
          </section>

          <section>
            <h2 className="text-foreground mb-3 text-lg font-bold">7. Tilgjengelighet</h2>
            <p>
              Tjenesten leveres &laquo;som den er&raquo; (&ldquo;as is&rdquo;). Vi tilstreber høy
              oppetid og stabilitet, men gir ingen garanti for uavbrutt tilgang. Planlagt
              vedlikehold varsles på forhånd når det er mulig. SmartOut er ikke ansvarlig for tap
              som følge av midlertidig utilgjengelighet.
            </p>
          </section>

          <section>
            <h2 className="text-foreground mb-3 text-lg font-bold">8. Endringer i vilkårene</h2>
            <p>
              Vi kan oppdatere disse vilkårene ved behov. Ved vesentlige endringer varsler vi
              brukere via e-post eller melding i tjenesten minimum 30 dager før endringene trer i
              kraft. Fortsatt bruk av tjenesten etter at endringene er varslet, utgjør aksept av de
              nye vilkårene.
            </p>
          </section>

          <section>
            <h2 className="text-foreground mb-3 text-lg font-bold">9. Oppsigelse</h2>
            <ul className="list-inside list-disc space-y-2">
              <li>Du kan når som helst be om å få kontoen din slettet.</li>
              <li>Din arbeidsgiver kan fjerne din tilgang til arbeidsplassens SmartOut-konto.</li>
              <li>
                SmartOut kan suspendere eller avslutte kontoer ved brudd på vilkårene, med rimelig
                varsel.
              </li>
              <li>Ved oppsigelse beholdes data i 30 dager for eventuell eksport.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-foreground mb-3 text-lg font-bold">10. Ansvarsbegrensning</h2>
            <p>
              SmartOut er ikke ansvarlig for indirekte tap, følgeskader, tapt fortjeneste eller tap
              av data. Vårt samlede erstatningsansvar er begrenset til beløpet du eller din
              arbeidsgiver har betalt for tjenesten de siste 12 månedene. Denne begrensningen
              gjelder ikke ved grov uaktsomhet eller forsett.
            </p>
          </section>

          <section>
            <h2 className="text-foreground mb-3 text-lg font-bold">
              11. Gjeldende lov og verneting
            </h2>
            <p>
              Disse vilkårene er underlagt norsk lov. Tvister forsøkes løst i minnelighet. Dersom
              dette ikke lykkes, avgjøres tvisten av Oslo tingrett som verneting.
            </p>
          </section>

          <section>
            <h2 className="text-foreground mb-3 text-lg font-bold">12. Kontakt</h2>
            <p>
              Spørsmål om vilkårene kan rettes til{" "}
              <a
                href="mailto:support@smartout.ai"
                className="text-brand-orange underline underline-offset-4 transition-colors hover:opacity-80"
              >
                support@smartout.ai
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
