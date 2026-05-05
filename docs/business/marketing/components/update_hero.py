import re

filepath = '/home/sxtnl/dev/smartout.ai/apps/landing/src/app/compare/page.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Modify countSmartoutWins to use smartout_free
content = content.replace('const sv = feat.values.smartout;', 'const sv = feat.values.smartout_free;')
content = content.replace('if (id === "smartout")', 'if (id === "smartout_free" || id === "smartout_premium")')
content = content.replace('c.id === "smartout"', '(c.id === "smartout_free" || c.id === "smartout_premium")')
content = content.replace('isSmartout={c.id === "smartout"}', 'isSmartout={(c.id === "smartout_free" || c.id === "smartout_premium")}')

# Add our custom default state to useState
default_state = '''  // Default to showing Smartout + Planday + Timegrip + Tidsbanken to keep it impactful and readable
  const [visibleCompetitors, setVisibleCompetitors] = useState<CompetitorId[]>([
    "smartout_free",
    "smartout_premium",
    "planday",
    "tidsbanken",
    "timegrip"
  ]);'''
content = re.sub(r'const \[visibleCompetitors, setVisibleCompetitors\] = useState<CompetitorId\[\]>\(allCompetitorIds\);', default_state, content)

# Change the hero
old_hero = '''          <section className="mx-auto max-w-7xl px-6 pt-16 pb-12 sm:pt-24">
            <div className="border-brand-orange/20 bg-brand-orange/10 text-brand-orange inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium">
              <Sparkles className="h-4 w-4" />
              {totalFeatures} funksjoner sammenlignet
            </div>

            <h1
              className={`${instrumentSerif.className} text-foreground mt-6 max-w-4xl text-4xl leading-[0.95] tracking-tight sm:text-5xl lg:text-7xl`}
            >
              Se hva andre tar betalt for. Og hva Smartout gir deg gratis.
            </h1>

            <p className="text-muted-foreground mt-6 max-w-2xl text-lg leading-8">
              Smartout Free inkluderer alt du trenger for å drive restaurang — vaktplan,
              stemplingsur, kontrakter, onboarding, compliance, kommunikasjon og en egen nettside. 
              Funksjoner som konkurrentene tar betalt for fra dag én.
            </p>
          </section>'''

new_hero = '''          <section className="mx-auto max-w-7xl px-6 pt-16 pb-12 sm:pt-24">
            <div className="border-emerald-500/20 bg-emerald-500/10 text-emerald-500 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium">
              <Sparkles className="h-4 w-4" />
              Beviset er i matrisen
            </div>

            <h1
              className={`${instrumentSerif.className} text-foreground mt-6 max-w-5xl text-4xl leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl xl:text-8xl`}
            >
              Du betaler for funksjoner du bør få gratis.
            </h1>

            <p className="text-muted-foreground mt-6 max-w-2xl text-lg leading-8 sm:text-xl">
              Bransjestandarden er å kreve betalt per ansatt for basisfunksjoner som vaktplan, stemplingsur og onboarding. 
              <strong className="text-foreground"> Smartout Core er 100% gratis. </strong>
              Du betaler kun når du velger å slå på AI og tidsbesparende automasjon i Premium.
            </p>
            
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <TrackedCta
                label="Compare start free"
                href={WEB_APP_LINKS.login}
                className="bg-primary text-primary-foreground inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 py-3 text-base font-semibold transition hover:opacity-95"
              >
                Opprett gratis konto
                <ArrowRight className="h-4 w-4" />
              </TrackedCta>
            </div>
          </section>'''

content = content.replace(old_hero, new_hero)


# Refactor cost cards
old_cards = '''          <section className="mx-auto max-w-7xl px-6 pb-16">
            <SectionLabel>Typisk kostnad — 20 ansatte, 1 lokasjon</SectionLabel>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {competitors.map((c) => (
                <div
                  key={c.id}
                  className={`rounded-2xl border p-5 transition ${
                    (c.id === "smartout_free" || c.id === "smartout_premium")
                      ? "border-brand-orange/40 bg-brand-orange/10"
                      : "border-border bg-card/90"
                  }`}
                >
                  <p className={`text-sm font-semibold ${c.color}`}>{c.name}</p>
                  <p className="text-foreground mt-2 text-2xl font-bold tracking-tight">
                    {c.typicalCost}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">{c.pricingModel}</p>
                  {c.id !== "smartout_free" && c.id !== "smartout_premium" && (
                    <p className="text-muted-foreground mt-2 text-xs">
                      Smartout gratis inkluderer{" "}
                      <strong className="text-brand-orange">{countSmartoutWins(c.id)}</strong> funksjoner
                      de tar betalt for
                    </p>
                  )}
                  {(c.id === "smartout_free" || c.id === "smartout_premium") && (
                    <p className="text-brand-orange mt-2 text-xs font-medium">
                      Gratis — ubegrenset ansatte
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>'''

new_cards = '''          <section className="mx-auto max-w-7xl px-6 pb-16">
            <SectionLabel>Hva koster de grønne hakene?</SectionLabel>
            <p className="text-muted-foreground mt-2 mb-6 max-w-2xl text-sm">
              Slik ser den månedlige prisen ut for 20 ansatte og 1 lokasjon for å få funksjonene som inngår <strong className="text-emerald-500 font-medium">gratis</strong> i Smartout Free.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {competitors.filter(c => visibleCompetitors.includes(c.id)).map((c) => {
                const isFree = c.id === "smartout_free";
                const isPrem = c.id === "smartout_premium";
                const isSmart = isFree || isPrem;
                const wins = !isSmart ? countSmartoutWins(c.id) : 0;
                
                return (
                  <div
                    key={c.id}
                    className={`rounded-2xl border p-5 transition flex flex-col ${
                      isFree
                        ? "border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_30px_-10px_rgba(16,185,129,0.3)] scale-[1.02] z-10"
                        : isPrem
                        ? "border-brand-orange/30 bg-brand-orange/5"
                        : "border-border bg-card/90"
                    }`}
                  >
                    <p className={`text-sm font-semibold ${c.color}`}>{c.name}</p>
                    <p className="text-foreground mt-2 text-3xl font-bold tracking-tight">
                      {c.typicalCost}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">{c.pricingModel}</p>
                    
                    <div className="mt-auto pt-5">
                      {!isSmart && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                          <p className="text-emerald-500 text-xs font-medium mb-1">
                            Hvorfor betale?
                          </p>
                          <p className="text-muted-foreground text-xs leading-relaxed">
                            Smartout gir deg <strong className="text-foreground">{wins} funksjoner</strong> helt gratis som {c.name} krever betalt for.
                          </p>
                        </div>
                      )}
                      {isFree && (
                        <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-xl p-3">
                          <p className="text-emerald-500 text-xs font-semibold">
                            Alltid 0 kr. Ubegrenset ansatte.
                          </p>
                        </div>
                      )}
                      {isPrem && (
                        <div className="bg-brand-orange/10 border border-brand-orange/20 rounded-xl p-3">
                          <p className="text-brand-orange text-xs font-semibold">
                            Kun når du vil ha AI & automasjon.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>'''

content = content.replace(old_cards, new_cards)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Refactoring done")
