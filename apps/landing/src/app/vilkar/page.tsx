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
        <p className="text-muted-foreground mb-12 text-sm">Sist oppdatert: 28. februar 2026</p>

        <div className="text-muted-foreground space-y-10 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-foreground mb-3 text-lg font-bold">1. Aksept av vilkår</h2>
            <p>
              Ved å opprette en konto eller bruke SmartOut-plattformen aksepterer du disse
              brukervilkårene. Hvis du bruker tjenesten på vegne av en bedrift, bekrefter du at du
              har fullmakt til å binde bedriften til vilkårene.
            </p>
          </section>

          <section>
            <h2 className="text-foreground mb-3 text-lg font-bold">2. Tjenestebeskrivelse</h2>
            <p>
              SmartOut er en skybasert plattform for workforce management, rettet mot den norske
              serveringsbransjen. Tjenesten inkluderer vaktplanlegging, timeføring, opplæring,
              internkontroll og kommunikasjon.
            </p>
          </section>

          <section>
            <h2 className="text-foreground mb-3 text-lg font-bold">3. Brukerkonto</h2>
            <ul className="list-inside list-disc space-y-2">
              <li>Du er ansvarlig for å holde påloggingsinformasjon konfidensiell.</li>
              <li>Du må varsle oss umiddelbart ved uautorisert tilgang.</li>
              <li>Én bruker per konto — deling av kontoer er ikke tillatt.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-foreground mb-3 text-lg font-bold">4. Akseptabel bruk</h2>
            <p>Du forplikter deg til å ikke:</p>
            <ul className="mt-2 list-inside list-disc space-y-2">
              <li>Bruke tjenesten til ulovlige formål.</li>
              <li>Forsøke å omgå sikkerhetsmekanismer.</li>
              <li>Distribuere skadelig programvare gjennom plattformen.</li>
              <li>Laste opp innhold som krenker tredjeparts rettigheter.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-foreground mb-3 text-lg font-bold">5. Betaling og abonnement</h2>
            <ul className="list-inside list-disc space-y-2">
              <li>Priser er oppgitt eks. mva. med mindre annet er spesifisert.</li>
              <li>Abonnement faktureres månedlig eller årlig, avhengig av valgt plan.</li>
              <li>Prisendringer varsles minimum 30 dager i forveien.</li>
              <li>Refusjon gis ikke for delvis brukte perioder ved kansellering.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-foreground mb-3 text-lg font-bold">6. Data og eierskap</h2>
            <p>
              Du eier all data du legger inn i SmartOut. Vi har en begrenset lisens til å prosessere
              data utelukkende for å levere tjenesten. Ved oppsigelse kan du eksportere dataene dine
              innen 30 dager.
            </p>
          </section>

          <section>
            <h2 className="text-foreground mb-3 text-lg font-bold">7. Tilgjengelighet og SLA</h2>
            <p>
              Vi tilstreber 99,9% oppetid, men garanterer ikke uavbrutt tilgang. Planlagt
              vedlikehold varsles minimum 24 timer i forveien. Vi er ikke ansvarlige for tap som
              følge av nedetid.
            </p>
          </section>

          <section>
            <h2 className="text-foreground mb-3 text-lg font-bold">8. Ansvarsbegrensning</h2>
            <p>
              SmartOut er ikke ansvarlig for indirekte tap, følgeskader eller tapt fortjeneste. Vårt
              samlede ansvar er begrenset til beløpet du har betalt for tjenesten de siste 12
              månedene.
            </p>
          </section>

          <section>
            <h2 className="text-foreground mb-3 text-lg font-bold">9. Oppsigelse</h2>
            <ul className="list-inside list-disc space-y-2">
              <li>Du kan si opp abonnementet når som helst fra kontoinnstillingene.</li>
              <li>Vi kan suspendere kontoer ved brudd på vilkårene, med 14 dagers varsel.</li>
              <li>Ved oppsigelse beholdes data i 30 dager for eksport.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-foreground mb-3 text-lg font-bold">10. Endringer i vilkårene</h2>
            <p>
              Vi kan oppdatere disse vilkårene. Vesentlige endringer varsles via e-post minimum 30
              dager før de trer i kraft. Fortsatt bruk etter endring utgjør aksept.
            </p>
          </section>

          <section>
            <h2 className="text-foreground mb-3 text-lg font-bold">11. Lovvalg og tvisteløsning</h2>
            <p>
              Disse vilkårene er underlagt norsk lov. Tvister forsøkes løst i minnelighet. Dersom
              dette ikke lykkes, avgjøres tvisten av Oslo tingrett.
            </p>
          </section>

          <section>
            <h2 className="text-foreground mb-3 text-lg font-bold">12. Kontakt</h2>
            <p>
              Spørsmål om vilkårene kan rettes til{" "}
              <a
                href="mailto:support@smartout.no"
                className="text-brand-orange underline underline-offset-4 transition-colors hover:opacity-80"
              >
                support@smartout.no
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
