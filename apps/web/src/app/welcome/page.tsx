"use client";

/**
 * Welcome page — shown after a new employee accepts their invitation.
 * Animated entrance with workspace context and next-steps guidance.
 * Redirects to /dashboard after the user clicks "Kom i gang".
 */

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, BookOpen, Shield, Users } from "lucide-react";

const spring = {
  type: "spring" as const,
  stiffness: 35,
  damping: 22,
  mass: 2,
};

const stagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15, delayChildren: 0.3 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: spring },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1, transition: { ...spring, stiffness: 40 } },
};

const steps = [
  {
    icon: BookOpen,
    title: "Lær bedriften å kjenne",
    desc: "Gjennomgå policyer og rutiner tilpasset din rolle",
    color: "text-blue-500",
    bg: "bg-blue-50",
  },
  {
    icon: Shield,
    title: "Fullfør opplæringen",
    desc: "Steg-for-steg protokoller som gjør deg klar for jobb",
    color: "text-emerald-500",
    bg: "bg-emerald-50",
  },
  {
    icon: Users,
    title: "Bli kjent med teamet",
    desc: "Se hvem du jobber med og finn din plass",
    color: "text-orange-500",
    bg: "bg-orange-50",
  },
];

function WelcomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const workspaceName = searchParams.get("workspace") ?? "teamet";
  const firstName = searchParams.get("name") ?? "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[oklch(0.99_0.004_60)] px-4 py-12">
      {/* Ambient glow */}
      <motion.div
        className="pointer-events-none fixed top-[-20%] left-[15%] h-[55vh] w-[55vh] rounded-full bg-[oklch(0.45_0.18_40)] opacity-[0.12] blur-[130px]"
        animate={{ scale: [1, 1.1, 1], opacity: [0.12, 0.18, 0.12] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none fixed right-[10%] bottom-[-5%] h-[45vh] w-[45vh] rounded-full bg-[oklch(0.35_0.14_35)] opacity-[0.1] blur-[110px]"
        animate={{ scale: [1, 1.15, 1], opacity: [0.1, 0.16, 0.1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />

      <motion.div
        className="relative z-10 w-full max-w-lg"
        variants={stagger}
        initial="hidden"
        animate="visible"
      >
        {/* Celebration icon */}
        <motion.div variants={scaleIn} className="mb-8 flex justify-center">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-orange-500 shadow-lg shadow-orange-500/25">
              <Sparkles className="h-10 w-10 text-white" />
            </div>
            {/* Pulse ring */}
            <motion.div
              className="absolute inset-0 rounded-3xl border-2 border-orange-500/30"
              animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
            />
          </div>
        </motion.div>

        {/* Heading */}
        <motion.div variants={fadeUp} className="mb-2 text-center">
          <h1 className="font-heading text-4xl font-bold tracking-tight text-[oklch(0.15_0.01_50)]">
            Velkommen{firstName ? `, ${firstName}` : ""}!
          </h1>
        </motion.div>

        <motion.p
          variants={fadeUp}
          className="mb-10 text-center text-lg text-[oklch(0.52_0.01_52)]"
        >
          Du er nå en del av{" "}
          <span className="font-semibold text-[oklch(0.15_0.01_50)]">{workspaceName}</span>. Her er
          hva som venter deg.
        </motion.p>

        {/* Next steps cards */}
        <div className="mb-10 space-y-3">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              variants={fadeUp}
              whileHover={{ scale: 1.02, y: -2 }}
              transition={spring}
              className="flex items-start gap-4 rounded-2xl border border-[oklch(0.91_0.006_55)] bg-white p-5 shadow-sm"
            >
              <div className={`rounded-xl p-2.5 ${step.bg}`}>
                <step.icon className={`h-5 w-5 ${step.color}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[oklch(0.52_0.01_52)]">STEG {i + 1}</span>
                </div>
                <h3 className="mt-0.5 text-sm font-bold text-[oklch(0.15_0.01_50)]">
                  {step.title}
                </h3>
                <p className="mt-0.5 text-xs leading-relaxed text-[oklch(0.52_0.01_52)]">
                  {step.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA button */}
        <motion.div variants={fadeUp}>
          <motion.button
            onClick={() => router.push("/dashboard")}
            whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(249,115,22,0.3)" }}
            whileTap={{ scale: 0.98 }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-4 text-base font-bold text-white shadow-lg shadow-orange-500/20 transition-colors hover:bg-orange-400"
          >
            Kom i gang
            <ArrowRight className="h-5 w-5" />
          </motion.button>
        </motion.div>

        <motion.p variants={fadeUp} className="mt-6 text-center text-xs text-[oklch(0.52_0.01_52)]">
          Du kan alltid finne tilbake til opplæringen fra menyen.
        </motion.p>
      </motion.div>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[oklch(0.99_0.004_60)]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
        </div>
      }
    >
      <WelcomeContent />
    </Suspense>
  );
}
