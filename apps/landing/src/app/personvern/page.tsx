import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Navigation from "../../components/navigation";
import Footer from "../../components/footer";

export const metadata: Metadata = {
  title: "Personvernerklæring — SmartOut",
  description: "Slik behandler SmartOut dine personopplysninger.",
};

export default function PersonvernPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <Navigation />

      <main className="mx-auto max-w-3xl px-6 pt-28 pb-20">
        <Link
          href="/"
          className="mb-10 inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Tilbake til forside
        </Link>

        <h1 className="mb-3 text-4xl font-black tracking-tight text-white">Personvernerklæring</h1>
        <p className="mb-12 text-sm text-zinc-500">Sist oppdatert: 28. februar 2026</p>

        <div className="space-y-10 text-[15px] leading-relaxed text-zinc-400">
          <section>
            <h2 className="mb-3 text-lg font-bold text-white">1. Behandlingsansvarlig</h2>
            <p>
              SmartOut AS (org.nr. under registrering) er behandlingsansvarlig for
              personopplysninger som samles inn via SmartOut-plattformen og nettsiden smartout.no.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">
              2. Hvilke opplysninger vi samler inn
            </h2>
            <ul className="list-inside list-disc space-y-2">
              <li>
                <strong className="text-zinc-300">Kontoinformasjon:</strong> Navn, e-postadresse,
                telefonnummer og rolle i bedriften.
              </li>
              <li>
                <strong className="text-zinc-300">Bedriftsdata:</strong> Organisasjonsnummer,
                bedriftsnavn, lokasjoner og avdelinger.
              </li>
              <li>
                <strong className="text-zinc-300">Bruksdata:</strong> Innloggingstidspunkt,
                handlinger i appen og enhetsinformasjon.
              </li>
              <li>
                <strong className="text-zinc-300">Stemplingsdata:</strong>{" "}
                Inn-/utstemplings-tidspunkt og GPS-posisjon (kun ved stempling).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">3. Formål med behandlingen</h2>
            <ul className="list-inside list-disc space-y-2">
              <li>Levere og forbedre SmartOut-plattformen.</li>
              <li>Administrere brukerkontoer og tilganger.</li>
              <li>Sende viktige varsler om tjenesten.</li>
              <li>Overholde lovpålagte krav (regnskap, arbeidsmiljøloven).</li>
              <li>Produktanalyse og feilretting (anonymisert).</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">4. Rettslig grunnlag</h2>
            <p>
              Vi behandler personopplysninger basert på avtale (GDPR art. 6(1)(b)) for å levere
              tjenesten, berettiget interesse (art. 6(1)(f)) for analyse og forbedring, og rettslig
              forpliktelse (art. 6(1)(c)) for regnskapsmessige krav.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">5. Deling av opplysninger</h2>
            <p>Vi deler kun opplysninger med:</p>
            <ul className="mt-2 list-inside list-disc space-y-2">
              <li>
                <strong className="text-zinc-300">Underleverandører:</strong> Supabase (database),
                Vercel (hosting), PostHog (analyse, EU-instans), Stripe (betaling).
              </li>
              <li>
                <strong className="text-zinc-300">Myndigheter:</strong> Når vi er rettslig
                forpliktet.
              </li>
            </ul>
            <p className="mt-2">Vi selger aldri personopplysninger til tredjeparter.</p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">6. Lagring og sletting</h2>
            <p>
              Personopplysninger lagres så lenge kontoen er aktiv. Ved sletting av konto fjernes
              data innen 30 dager, med unntak av opplysninger vi er pålagt å oppbevare
              (regnskapsdata: 5 år).
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">7. Dine rettigheter</h2>
            <p>Du har rett til å:</p>
            <ul className="mt-2 list-inside list-disc space-y-2">
              <li>Be om innsyn i dine personopplysninger.</li>
              <li>Kreve retting eller sletting.</li>
              <li>Begrense eller protestere mot behandling.</li>
              <li>Motta data i maskinlesbart format (dataportabilitet).</li>
              <li>Klage til Datatilsynet.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">8. Sikkerhet</h2>
            <p>
              Vi bruker kryptering (TLS), tilgangskontroll med Row Level Security, og regelmessig
              sikkerhetsgjennomgang for å beskytte dine opplysninger.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">9. Kontakt oss</h2>
            <p>
              Spørsmål om personvern kan rettes til{" "}
              <a
                href="mailto:personvern@smartout.no"
                className="text-orange-400 underline underline-offset-4 transition-colors hover:text-orange-300"
              >
                personvern@smartout.no
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
