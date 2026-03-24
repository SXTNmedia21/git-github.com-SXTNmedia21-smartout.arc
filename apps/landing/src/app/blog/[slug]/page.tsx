import { notFound } from "next/navigation";
import Navigation from "../../../components/navigation";
import Footer from "../../../components/footer";
import Link from "next/link";
import { ArrowLeft, Calendar, Clock, User } from "lucide-react";

// Mock data for the two ready stories
const STORIES = {
  "torget-kuttet-lonnskjoring": {
    title: "Hvordan Torget kuttet lønnskjøringen fra dager til timer",
    author: "Peder Aas",
    role: "Daglig Leder",
    date: "12. Mars 2026",
    readTime: "4 min lesetid",
    category: "Lønn & Administrasjon",
    content: `
      Som daglig leder ved Torget Restaurant opplevde jeg stadig at lønnskjøringen tok uforholdsmessig mye tid. Det var et evig puslespill med regneark, timelister, og ulike tillegg for helg, kveld og overtid.
      
      Vi hadde prøvd flere systemer tidligere, men ingen av dem klarte å fange opp de spesifikke tariffene og lokale avtalene vi opererte med. Hver måned var det feil, og hver måned måtte jeg bruke dager på å rette opp og manuelt sjekke alt.

      Med Smartout sin nye "Cascade"-arkitektur endret alt seg. Systemet forstår ikke bare vaktplanen, men det vet nøyaktig hvilke regler som gjelder til enhver tid. Det "drypper" ned fra tariffavtalene, gjennom de lokale avtalene, rett ned på den enkelte ansattes timeliste.
      
      Det som pleide å ta meg tre hele dager, gjør jeg nå på under to timer. Alt stemmer. Systemet fanger opp avvik, sjekker at lovpålagte pauser er holdt, og genererer et ferdig grunnlag som vi bare sender rett til regnskap.
      
      Dette handler ikke bare om tidsbesparelse. Det handler om ro i sjelen. Jeg vet at de ansatte får riktig lønn til riktig tid, og jeg kan bruke tiden min ute i restauranten der jeg faktisk skaper verdi for gjestene våre.
    `,
  },
  "bryggekanten-overlevde-mattilsynet": {
    title: "Bryggekanten overlevde Mattilsynet takket være Lise",
    author: "Lars Larsson",
    role: "Driftsjef",
    date: "05. Mars 2026",
    readTime: "3 min lesetid",
    category: "IK-Mat & HMS",
    content: `
      Mattilsynet kom uanmeldt klokken 11:30 på en travel fredag. Før ville dette betydd panikk. Hvor er permen? Hvem tok temperaturen i morges? Har vi signert avviket på kjølerom 2?
      
      Men vi hadde Lise. Lise er ikke en person, det er Smartout-assistenten vår. Da inspektøren ba om å få se IK-Mat dokumentasjonen for den siste måneden, trengte jeg ikke forlate gulvet.
      
      Jeg tok frem telefonen, åpnet Smartout, og hentet opp den digitale HMS-protokollen. Inspektøren kunne se nøyaktig hvem som hadde sjekket temperaturene, når de var sjekket, og viktigst av alt: Hvordan vi hadde håndtert et temperaturavvik for to uker siden, komplett med bilder og tiltak.
      
      Smartout minner oss på oppgavene våre via "Session Hooks" – systemet vet når vi åpner, og legger automatisk morgensjekken i oppgavelisten til den som er på vakt. Hvis den ikke blir gjort, får jeg et varsel.
      
      Inspektøren var ferdig på 20 minutter. Ingen anmerkninger. Det smilefjeset på døra har aldri føltes mer fortjent. Med Smartout er ikke IK-Mat lenger noe vi gjør rett før Mattilsynet kommer, det er en integrert, naturlig del av den daglige driften.
    `,
  },
};

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const story = STORIES[slug as keyof typeof STORIES];

  if (!story) {
    notFound();
  }

  return (
    <div className="bg-background text-foreground selection:bg-brand-orange/30 relative min-h-screen overflow-x-hidden font-sans">
      <Navigation />

      <main className="relative z-10 mx-auto min-h-screen max-w-3xl px-6 pt-32 pb-20 sm:pt-40">
        {/* Back link */}
        <Link
          href="/blog"
          className="group text-muted-foreground hover:text-foreground mb-12 inline-flex items-center gap-2 text-sm font-semibold transition-colors"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Tilbake til oversikten
        </Link>

        {/* Article Header */}
        <header className="mb-12">
          <div className="text-muted-foreground mb-6 flex flex-wrap items-center gap-4 text-sm font-semibold">
            <span className="bg-foreground/5 text-brand-orange rounded-full px-3 py-1">
              {story.category}
            </span>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {story.date}
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {story.readTime}
            </div>
          </div>

          <h1 className="mb-8 text-4xl leading-tight font-black tracking-tighter md:text-5xl lg:text-6xl">
            {story.title}
          </h1>

          <div className="border-border/50 flex items-center gap-4 border-t pt-8">
            <div className="bg-foreground/5 flex h-12 w-12 items-center justify-center rounded-full">
              <User className="text-muted-foreground h-6 w-6" />
            </div>
            <div>
              <p className="text-foreground font-bold">{story.author}</p>
              <p className="text-muted-foreground text-sm font-medium">{story.role}</p>
            </div>
          </div>
        </header>

        {/* Article Content */}
        <article className="prose prose-zinc prose-invert max-w-none">
          {story.content.split("\n\n").map((paragraph, index) => (
            <p key={index} className="text-muted-foreground/90 text-lg leading-relaxed">
              {paragraph.trim()}
            </p>
          ))}
        </article>

        {/* CTA */}
        <div className="border-brand-orange/20 bg-brand-orange/5 mt-24 rounded-3xl border p-8 text-center sm:p-12">
          <h3 className="mb-4 text-2xl font-bold">Klar for å skrive din egen historie?</h3>
          <p className="text-muted-foreground mb-8">
            Opprett en gratis konto i dag og se hvorfor de beste i bransjen velger Smartout.
          </p>
          <Link
            href="/pricing"
            className="bg-brand-orange hover:bg-brand-orange/90 inline-flex items-center justify-center rounded-full px-8 py-3 text-sm font-bold text-white transition-all"
          >
            Se våre priser
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
