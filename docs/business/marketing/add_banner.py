import re

filepath = '/home/sxtnl/dev/smartout.ai/apps/landing/src/app/compare/page.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Add dynamic "Bytt system" banner
old_matrix_start = '''          {/* Comparison matrix */}
          <section className="mx-auto max-w-7xl px-6 py-12">
            <div className="space-y-6">'''

new_matrix_start = '''          {/* Comparison matrix */}
          <section className="mx-auto max-w-7xl px-6 py-12">
            
            {/* Dynamic Competitor Alert */}
            {visibleCompetitors.length === 3 && !visibleCompetitors.includes("smartout_premium") && (
              <div className="mb-10 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6 justify-between">
                <div>
                  <h3 className="text-foreground text-xl sm:text-2xl font-bold tracking-tight">
                    Bruker du {competitors.find(c => c.id === visibleCompetitors.find(id => id !== "smartout_free"))?.name} i dag?
                  </h3>
                  <p className="text-muted-foreground mt-2 max-w-2xl">
                    Bytt til Smartout Free og få flere funksjoner, ubegrenset antall ansatte og null lisenskostnader for basisdrift. Vi hjelper deg med import av data og onboarding av ansatte.
                  </p>
                </div>
                <TrackedCta
                  label="Switch competitor CTA"
                  href={WEB_APP_LINKS.login}
                  className="bg-emerald-500 text-emerald-950 whitespace-nowrap rounded-full px-6 py-3 text-sm font-bold transition hover:opacity-90"
                >
                  Bytt til Smartout
                </TrackedCta>
              </div>
            )}
            {visibleCompetitors.length === 4 && visibleCompetitors.includes("smartout_premium") && (
              <div className="mb-10 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6 justify-between">
                <div>
                  <h3 className="text-foreground text-xl sm:text-2xl font-bold tracking-tight">
                    Bruker du {competitors.find(c => c.id === visibleCompetitors.find(id => id !== "smartout_free" && id !== "smartout_premium"))?.name} i dag?
                  </h3>
                  <p className="text-muted-foreground mt-2 max-w-2xl">
                    Bytt til Smartout Free og få flere funksjoner uten lisenskostnader. Trenger du enda mer fart? Slå på Premium og få AI-vakter og Lise Botsson.
                  </p>
                </div>
                <TrackedCta
                  label="Switch competitor CTA"
                  href={WEB_APP_LINKS.login}
                  className="bg-emerald-500 text-emerald-950 whitespace-nowrap rounded-full px-6 py-3 text-sm font-bold transition hover:opacity-90"
                >
                  Opprett gratis konto
                </TrackedCta>
              </div>
            )}

            <div className="space-y-6">'''

content = content.replace(old_matrix_start, new_matrix_start)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Dynamic banner added")
