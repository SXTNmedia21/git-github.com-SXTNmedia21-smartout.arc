"use client";

// ============================================
// onboarding/showcase/page.tsx
// Sandbox showcase page for onboarding modules.
// This page exists as a safe test ground to validate
// agent-driven UI orchestration against existing
// onboarding visual language before broader rollout.
// ============================================

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bot, Mic, MicOff, Sparkles, Search, MessageSquare } from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import { SectionReveal, RevealItem } from "../components/SectionReveal";
import { TypewriterText } from "../components/TypewriterText";
import { AlertOrchestra } from "./_components/AlertOrchestra";

type ShowcaseModule = "text" | "input" | "quiz";

type QuizOption = {
  id: string;
  label: string;
  isCorrect: boolean;
};

type ManuscriptStep = {
  id: string;
  label: string;
  message: string;
  module: ShowcaseModule;
  apply: () => void;
};

type ScrapedData = {
  summary?: string;
  email?: string;
  phone?: string;
  locations?: Array<{ name?: string }>;
};

/**
 * Creates a short deterministic answer for sandbox Q&A.
 * Why: The showcase needs an "answer if asked" flow without introducing
 * additional backend dependencies for this isolated page.
 * Returns a short text answer grounded in current local state.
 */
function buildSandboxAnswer(
  question: string,
  context: { website: string; summary: string },
): string {
  const lower = question.toLowerCase();
  if (lower.includes("scrape") || lower.includes("hent") || lower.includes("data")) {
    return context.summary
      ? `Jeg fant data fra ${context.website}. Kort oppsummert: ${context.summary}`
      : `Jeg er klar til å hente data. Legg inn URL og trykk "Fetch & Scrape".`;
  }

  if (lower.includes("quiz") || lower.includes("test")) {
    return "Quiz-modulen tester om elementer og agent-handlinger fungerer sammen i samme flyt.";
  }

  if (lower.includes("input") || lower.includes("felt")) {
    return "Input-modulen er agent-klar. Den kan fylles manuelt, via manus-steg, eller fra scrape-resultat.";
  }

  return "Jeg svarer i tekstmodus i denne sandkassen. Bruk manus-knappen for neste demonstrasjonssteg.";
}

export default function OnboardingShowcasePage() {
  const supabase = createClient();

  const [activeModule, setActiveModule] = useState<ShowcaseModule>("text");
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [manualSpeechText, setManualSpeechText] = useState("");
  const [log, setLog] = useState<string[]>([
    "Showcase initialized. Agent is in listen mode. Speech is manual-only.",
  ]);

  const [businessName, setBusinessName] = useState("");
  const [orgNumber, setOrgNumber] = useState("");
  const [website, setWebsite] = useState("");
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [scrapeError, setScrapeError] = useState("");
  const [scrapeSummary, setScrapeSummary] = useState("");
  const [scrapeEmail, setScrapeEmail] = useState("");
  const [scrapePhone, setScrapePhone] = useState("");
  const [scrapeLocations, setScrapeLocations] = useState<string[]>([]);

  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null);
  const [quizMessage, setQuizMessage] = useState("");

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const quizOptions = useMemo<QuizOption[]>(
    () => [
      { id: "a", label: "Agent should auto-speak continuously", isCorrect: false },
      { id: "b", label: "Agent should speak only when manually triggered", isCorrect: true },
      { id: "c", label: "Agent should not manipulate UI elements", isCorrect: false },
    ],
    [],
  );

  const appendLog = useCallback((entry: string) => {
    setLog((prev) => [`${new Date().toLocaleTimeString()}: ${entry}`, ...prev].slice(0, 10));
  }, []);

  /**
   * Speaks text via browser TTS, but only when explicitly triggered.
   * Why: Requirement is manual speech control only.
   * Returns nothing; side effect is optional speech output.
   */
  const speakNow = useCallback(
    (text: string) => {
      if (!voiceEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) {
        appendLog("Manual speech skipped (disabled or unsupported).");
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "nb-NO";
      window.speechSynthesis.speak(utterance);
      appendLog("Manual speech played.");
    },
    [appendLog, voiceEnabled],
  );

  const runTextStep = useCallback(() => {
    const text =
      "Dette er tekstmodulen. Agenten forteller stegvis, men forblir stille til du ber om stemme.";
    setActiveModule("text");
    setManualSpeechText(text);
    appendLog("Text module activated by manuscript.");
  }, [appendLog]);

  const runInputStep = useCallback(() => {
    setActiveModule("input");
    setBusinessName((prev) => prev || "Smartout Demo Workspace");
    setOrgNumber((prev) => prev || "920228192");
    setWebsite((prev) => prev || "https://smartout.no");
    setManualSpeechText("Inputmodulen er klar. Felter er forberedt for datahenting.");
    appendLog("Input module activated and prefilled by manuscript.");
  }, [appendLog]);

  const runQuizStep = useCallback(() => {
    setActiveModule("quiz");
    setSelectedAnswerId("b");
    setQuizMessage("Riktig fokus: agenten snakker kun ved manuell trigger.");
    setManualSpeechText("Quizmodulen viser kontroll over agentadferd og UI-tilstand.");
    appendLog("Quiz module activated and answer pre-selected by manuscript.");
  }, [appendLog]);

  const manuscriptSteps = useMemo<ManuscriptStep[]>(
    () => [
      {
        id: "text-intro",
        label: "Step 1: Text module",
        message: "Starter med tekstmodulen og viser kontrollert fortelling.",
        module: "text",
        apply: runTextStep,
      },
      {
        id: "input-prefill",
        label: "Step 2: Input module",
        message: "Bytter til inputmodulen og fyller felter før henting.",
        module: "input",
        apply: runInputStep,
      },
      {
        id: "quiz-check",
        label: "Step 3: Quiz module",
        message: "Avslutter med quizmodulen som verifiserer agentpolicy.",
        module: "quiz",
        apply: runQuizStep,
      },
    ],
    [runInputStep, runQuizStep, runTextStep],
  );

  const [stepIndex, setStepIndex] = useState(0);
  const activeStep = manuscriptSteps[stepIndex] ?? manuscriptSteps[manuscriptSteps.length - 1];

  const runNextManuscriptStep = useCallback(() => {
    const step = manuscriptSteps[stepIndex];
    if (!step) return;

    step.apply();
    appendLog(`${step.label} executed. ${step.message}`);
    setStepIndex((prev) => (prev < manuscriptSteps.length - 1 ? prev + 1 : prev));
  }, [appendLog, manuscriptSteps, stepIndex]);

  /**
   * Calls existing onboarding edge function for website scraping.
   * Why: Reuse proven onboarding data path without introducing new APIs.
   * Returns nothing; updates local module state with fetched data.
   */
  const handleScrape = useCallback(async () => {
    if (!website.trim()) {
      setScrapeError("Legg inn en URL for å hente data.");
      return;
    }

    setScrapeLoading(true);
    setScrapeError("");
    appendLog(`Fetching scrape data for ${website} ...`);

    try {
      const { data, error } = await supabase.functions.invoke("scrape-website", {
        body: { url: website.trim() },
      });

      if (error) {
        throw new Error(error.message || "Unknown scrape error");
      }

      const scrapedData = (data?.scrapedData ?? null) as ScrapedData | null;
      if (!scrapedData) {
        setScrapeError("Ingen data mottatt fra scrape-funksjonen.");
        appendLog("Scrape completed with empty payload.");
        return;
      }

      const summary = scrapedData.summary || "";
      const email = scrapedData.email || "";
      const phone = scrapedData.phone || "";
      const locations = (scrapedData.locations || []).map((loc) => loc.name || "Ukjent lokasjon");

      setScrapeSummary(summary);
      setScrapeEmail(email);
      setScrapePhone(phone);
      setScrapeLocations(locations);
      setManualSpeechText("Data er hentet og presentert i inputmodulen.");
      appendLog("Scrape data applied to showcase state.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ukjent feil";
      setScrapeError(message);
      appendLog(`Scrape failed: ${message}`);
    } finally {
      setScrapeLoading(false);
    }
  }, [appendLog, supabase.functions, website]);

  const handleQuizAnswer = useCallback(
    (option: QuizOption) => {
      setSelectedAnswerId(option.id);
      setQuizMessage(
        option.isCorrect
          ? "Riktig. Speech skal trigges manuelt, ikke automatisk."
          : "Feil for denne sandkassen. Målet er kontrollert, manuell speech-policy.",
      );
      appendLog(`Quiz answer selected: ${option.label}`);
    },
    [appendLog],
  );

  const handleAsk = useCallback(() => {
    const response = buildSandboxAnswer(question, {
      website,
      summary: scrapeSummary,
    });
    setAnswer(response);
    appendLog("Question answered in text mode.");
  }, [appendLog, question, scrapeSummary, website]);

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[oklch(0.10_0.01_250)] text-white">
      <div className="bg-noise pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-overlay" />

      <div className="relative z-10 mx-auto grid min-h-dvh w-full max-w-7xl grid-cols-1 gap-6 px-6 py-10 lg:grid-cols-[360px_1fr]">
        <aside className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-2">
            <Bot className="h-4 w-4 text-white/70" />
            <p className="text-sm font-semibold text-white/80">Agent Console (Sandbox)</p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={runNextManuscriptStep}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[oklch(0.75_0.18_55)] px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-[oklch(0.72_0.18_55)]"
            >
              <Sparkles className="h-4 w-4" />
              Run Next Manuscript Step
            </button>

            <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3">
              <p className="text-xs font-semibold tracking-wider text-white/50 uppercase">
                Current step
              </p>
              <p className="mt-1 text-sm text-white/80">{activeStep.label}</p>
              <p className="mt-1 text-xs text-white/50">{activeStep.message}</p>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2">
              <span className="text-xs font-semibold tracking-wider text-white/50 uppercase">
                Manual speech
              </span>
              <button
                type="button"
                onClick={() => setVoiceEnabled((prev) => !prev)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  voiceEnabled
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                {voiceEnabled ? (
                  <Mic className="h-3.5 w-3.5" />
                ) : (
                  <MicOff className="h-3.5 w-3.5" />
                )}
                {voiceEnabled ? "Enabled" : "Disabled"}
              </button>
            </div>

            <button
              type="button"
              onClick={() => speakNow(manualSpeechText || "Ingen manus tilgjengelig ennå.")}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white/80 transition-all hover:bg-white/[0.09]"
            >
              Speak Current Manuscript (manual)
            </button>
          </div>

          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold tracking-wider text-white/50 uppercase">
              Runtime log
            </p>
            <div className="max-h-60 space-y-2 overflow-auto rounded-xl border border-white/[0.08] bg-black/20 p-3">
              {log.map((entry) => (
                <p key={entry} className="text-xs text-white/60">
                  {entry}
                </p>
              ))}
            </div>
          </div>
        </aside>

        <main className="space-y-6">
          <SectionReveal>
            <RevealItem>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.05] p-6 backdrop-blur-xl">
                <p className="text-xs font-semibold tracking-[0.2em] text-white/40 uppercase">
                  Onboarding showcase
                </p>
                <h1 className="font-heading mt-2 text-4xl leading-tight tracking-tight text-white">
                  Agent-Ready Sandbox
                </h1>
                <p className="mt-3 max-w-3xl text-white/55">
                  One text module, one input module, and one quiz module orchestrated by controlled
                  manuscripts. Agent speech is manual-only.
                </p>
              </div>
            </RevealItem>
          </SectionReveal>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <button
              type="button"
              onClick={() => setActiveModule("text")}
              className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
                activeModule === "text"
                  ? "border-white/20 bg-white/[0.12] text-white"
                  : "border-white/[0.08] bg-white/[0.04] text-white/65 hover:bg-white/[0.08]"
              }`}
            >
              Text module
            </button>
            <button
              type="button"
              onClick={() => setActiveModule("input")}
              className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
                activeModule === "input"
                  ? "border-white/20 bg-white/[0.12] text-white"
                  : "border-white/[0.08] bg-white/[0.04] text-white/65 hover:bg-white/[0.08]"
              }`}
            >
              Input module
            </button>
            <button
              type="button"
              onClick={() => setActiveModule("quiz")}
              className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
                activeModule === "quiz"
                  ? "border-white/20 bg-white/[0.12] text-white"
                  : "border-white/[0.08] bg-white/[0.04] text-white/65 hover:bg-white/[0.08]"
              }`}
            >
              Quiz module
            </button>
          </div>

          {activeModule === "text" && (
            <motion.section
              key="text-module"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.05] p-7 backdrop-blur-xl"
            >
              <p className="text-xs font-semibold tracking-[0.2em] text-white/40 uppercase">
                Text module
              </p>
              <p className="mt-3 text-xl leading-relaxed text-white/85">
                <TypewriterText
                  text="Velkommen til onboardingsandkassen. Her kan vi kontrollere agenten, teste modulene, og validere hvordan UI reagerer i sanntid."
                  speed={18}
                />
              </p>
              <p className="mt-4 text-white/55">
                Agenten forteller med manus, men snakker ikke automatisk. Du bestemmer når stemme
                skal brukes.
              </p>
            </motion.section>
          )}

          {activeModule === "input" && (
            <motion.section
              key="input-module"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.05] p-7 backdrop-blur-xl"
            >
              <p className="text-xs font-semibold tracking-[0.2em] text-white/40 uppercase">
                Input module
              </p>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm text-white/65">Business name</span>
                  <input
                    value={businessName}
                    onChange={(event) => setBusinessName(event.target.value)}
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none"
                    placeholder="Smartout AS"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm text-white/65">Org number</span>
                  <input
                    value={orgNumber}
                    onChange={(event) => setOrgNumber(event.target.value)}
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none"
                    placeholder="999999999"
                  />
                </label>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                <input
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none"
                  placeholder="https://example.com"
                />
                <button
                  type="button"
                  onClick={handleScrape}
                  disabled={scrapeLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[oklch(0.75_0.18_55)] px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-[oklch(0.72_0.18_55)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Search className="h-4 w-4" />
                  {scrapeLoading ? "Fetching..." : "Fetch & Scrape"}
                </button>
              </div>

              {scrapeError && <p className="mt-3 text-sm text-red-300">{scrapeError}</p>}

              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3">
                  <p className="text-xs tracking-wider text-white/40 uppercase">Email</p>
                  <p className="mt-1 text-sm text-white/80">{scrapeEmail || "—"}</p>
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3">
                  <p className="text-xs tracking-wider text-white/40 uppercase">Phone</p>
                  <p className="mt-1 text-sm text-white/80">{scrapePhone || "—"}</p>
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3">
                  <p className="text-xs tracking-wider text-white/40 uppercase">Locations</p>
                  <p className="mt-1 text-sm text-white/80">{scrapeLocations.join(", ") || "—"}</p>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-white/[0.08] bg-black/20 p-3">
                <p className="text-xs tracking-wider text-white/40 uppercase">Summary</p>
                <p className="mt-1 text-sm text-white/75">{scrapeSummary || "No summary yet."}</p>
              </div>
            </motion.section>
          )}

          {activeModule === "quiz" && (
            <motion.section
              key="quiz-module"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.05] p-7 backdrop-blur-xl"
            >
              <p className="text-xs font-semibold tracking-[0.2em] text-white/40 uppercase">
                Quiz module
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                Which speech behavior is correct here?
              </h2>
              <div className="mt-4 space-y-3">
                {quizOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleQuizAnswer(option)}
                    className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                      selectedAnswerId === option.id
                        ? "border-white/20 bg-white/[0.12] text-white"
                        : "border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {quizMessage && <p className="mt-4 text-sm text-white/80">{quizMessage}</p>}
            </motion.section>
          )}

          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.05] p-6 backdrop-blur-xl">
            <div className="mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-white/70" />
              <p className="text-sm font-semibold text-white/80">
                Ask the agent (text response only)
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none"
                placeholder="Ask about the modules, scrape flow, or policy..."
              />
              <button
                type="button"
                onClick={handleAsk}
                className="rounded-xl border border-white/[0.08] bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white/85 transition-all hover:bg-white/[0.09]"
              >
                Answer
              </button>
            </div>
            <p className="mt-3 text-sm text-white/75">{answer || "Agent answer appears here."}</p>
          </section>

          <AlertOrchestra />
        </main>
      </div>
    </div>
  );
}
