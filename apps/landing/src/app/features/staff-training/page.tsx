"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Navigation from "../../../components/navigation";
import Footer from "../../../components/footer";
import { usePageTracking } from "../../../hooks/useTracking";
import NextPageBanner from "../../../components/next-page-banner";

export default function HROpplaeringPage() {
  usePageTracking();
  const router = useRouter();
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);

  const quizData = [
    {
      question:
        "Hvor lenge må man vaske hendene for at de skal regnes som rene iht. våre retningslinjer?",
      options: ["10 sekunder", "30 sekunder (og såpe)", "1 minutt", "Bare skylle med vann"],
      correct: 1,
    },
  ] as const;
  const quiz = quizData[0];

  const handleSelect = (idx: number) => {
    if (isAnswered) return;
    setSelectedAnswer(idx);
    setIsAnswered(true);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050505] p-4 pt-24 text-zinc-100 selection:bg-fuchsia-500/30 sm:p-6 md:p-12 md:pt-28">
      <Navigation />

      <button
        onClick={() => router.back()}
        className="mb-12 inline-flex items-center gap-2 text-zinc-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-5 w-5" />
        Tilbake til forside
      </button>

      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-fuchsia-500 to-pink-500 p-[1px] shadow-2xl">
            <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[#111]">
              <GraduationCap className="h-8 w-8 text-white drop-shadow-md" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-black text-white sm:text-4xl">HR & Opplæring</h1>
            <p className="text-lg text-zinc-400">AI-drevne quiz og mikrolæring for opplæring</p>
          </div>
        </div>

        {/* The Mock App Area */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0c]/80 p-6 shadow-[0_0_50px_-15px_rgba(217,70,239,0.3)] backdrop-blur-3xl sm:p-8 md:p-12"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-fuchsia-500 to-pink-500"></div>
          <div className="pointer-events-none absolute -inset-20 bg-fuchsia-500/5 blur-[100px]"></div>

          <div className="relative z-10 flex flex-col gap-12 md:flex-row">
            {/* Sidebar */}
            <div className="flex flex-col gap-4 border-r border-white/5 pr-8 md:w-1/3">
              <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-fuchsia-500/20 bg-fuchsia-500/10 px-3 py-1.5 text-sm font-bold text-fuchsia-400">
                <BookOpen className="h-4 w-4" /> Modul 3: Hygiene
              </div>
              <div className="space-y-4">
                {[
                  { title: "Velkommen", time: "2 min", status: "done" },
                  { title: "Personlig hygiene", time: "4 min", status: "current" },
                  { title: "Kjøkkenrutiner", time: "5 min", status: "locked" },
                ].map((step, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between rounded-xl border p-4 ${step.status === "current" ? "border-fuchsia-500/30 bg-fuchsia-500/10" : "border-white/5 bg-black/20 opacity-60"}`}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white">{step.title}</span>
                      <span className="text-xs text-zinc-500">{step.time}</span>
                    </div>
                    {step.status === "done" && (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    )}
                    {step.status === "locked" && (
                      <div className="h-5 w-5 rounded-full border-2 border-zinc-700"></div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Quiz View */}
            <div className="flex flex-col md:w-2/3">
              <h2 className="mb-8 text-2xl leading-relaxed font-bold">{quiz.question}</h2>

              <div className="flex flex-col gap-3">
                {quiz.options.map((option, idx) => {
                  let stateClasses = "bg-white/5 border-white/10 hover:bg-white/10 text-zinc-300";
                  let icon = null;

                  if (isAnswered) {
                    if (idx === quiz.correct) {
                      stateClasses = "bg-emerald-500/10 border-emerald-500 text-emerald-400";
                      icon = <CheckCircle2 className="h-5 w-5" />;
                    } else if (idx === selectedAnswer) {
                      stateClasses = "bg-red-500/10 border-red-500 text-red-500";
                      icon = <XCircle className="h-5 w-5" />;
                    } else {
                      stateClasses = "bg-black/50 border-white/5 text-zinc-600 opacity-50";
                    }
                  }

                  return (
                    <button
                      key={idx}
                      disabled={isAnswered}
                      onClick={() => handleSelect(idx)}
                      className={`flex items-center justify-between rounded-xl border p-5 text-left font-medium transition-all ${stateClasses} ${!isAnswered && "hover:-translate-y-1"}`}
                    >
                      {option}
                      {icon}
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  disabled={!isAnswered}
                  className={`flex items-center gap-2 rounded-full px-6 py-3 font-bold transition-all ${isAnswered ? "bg-fuchsia-600 text-white hover:bg-fuchsia-500" : "cursor-not-allowed bg-zinc-800 text-zinc-500"}`}
                >
                  Neste spørsmål
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        <NextPageBanner
          href="/features/haccp-complience"
          title="IK-Mat & Avvik"
          subtitle="Neste Funksjon"
          color="from-rose-500/10"
        />
      </div>
      <Footer />
    </div>
  );
}
