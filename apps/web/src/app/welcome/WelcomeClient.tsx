"use client";

/**
 * WelcomeClient — /welcome post-signup orientation (one-time, dismissible).
 *
 * Per council verdicts (auth plan 2026-04-20):
 *   - Q16=b: single screen with 3 cards (NOT a multi-step wizard)
 *   - Q20=a: tracked via user_metadata.welcome_shown_at — shows once
 *   - Q22=a: success via toast, not modal
 *
 * Cards are informational — they do NOT navigate anywhere. The user gets
 * the landscape, then clicks "Kom i gang" to enter the dashboard. A
 * "Hopp over" link performs the same state write but with a neutral toast.
 *
 * No telemetry emit — "auth welcome_shown" is not in packages/telemetry
 * registry. Per L-0083 Trust Gate, we do not emit registered-less events.
 * Register + producer in the same change; not here.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Calendar, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@smartout/supabase/client";
import { workspaceAccentOklch } from "@smartout/design-tokens";

type CardDef = {
  icon: typeof BookOpen;
  title: string;
  body: string;
  caption?: string;
};

type RoleKey = "employee" | "manager" | "admin" | "owner" | "trainee";

function roleLearnBody(role: RoleKey): string {
  switch (role) {
    case "admin":
    case "owner":
      return "Sett opp arbeidsflaten og inviter teamet.";
    case "manager":
      return "Se teamet ditt og kommende opplæring.";
    case "trainee":
      return "Start med Policy-protokollene for rollen din.";
    case "employee":
    default:
      return "Start med Policy-protokollene for rollen din.";
  }
}

type Props = {
  workspaceName: string;
  workspaceSlug: string;
  role: RoleKey;
  /** Production: "" (live subdomain we're on). Local dev: "/dashboard?ws=<id>". */
  dashboardHref: string;
};

export function WelcomeClient({ workspaceName, workspaceSlug, role, dashboardHref }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [isFinishing, setIsFinishing] = useState(false);

  const accent = workspaceAccentOklch(workspaceSlug);

  const cards: CardDef[] = [
    {
      icon: BookOpen,
      title: "Lær",
      body: roleLearnBody(role),
    },
    {
      icon: Calendar,
      title: "Jobb",
      body: "Se vaktplanen og kommende skift.",
    },
    {
      icon: MessageCircle,
      title: "Spør",
      body: "Botsson hjelper deg hvor som helst.",
      caption: "Prøv: «Hva skjer i dag?»",
    },
  ];

  async function finish(via: "primary" | "skip") {
    if (isFinishing) return;
    setIsFinishing(true);
    try {
      const shownAt = new Date().toISOString();
      const { error } = await supabase.auth.updateUser({
        data: { welcome_shown_at: shownAt },
      });
      if (error) {
        // Non-fatal — still navigate, but tell the user. Next login will show
        // /welcome again, which is annoying but not broken.
        toast.error("Kunne ikke lagre status. Vi prøver igjen senere.");
      } else if (via === "primary") {
        toast.success("La oss sette i gang.");
      }
    } catch {
      toast.error("Noe gikk galt. Vi prøver igjen senere.");
    }
    // Full navigation — we want a fresh dashboard load on the workspace subdomain.
    if (dashboardHref.startsWith("http") || dashboardHref === "/dashboard") {
      window.location.href = dashboardHref || "/dashboard";
    } else {
      router.push(dashboardHref);
    }
  }

  return (
    <div className="bg-background relative min-h-screen overflow-hidden">
      {/* Full-bleed hero orb — tinted via per-slug accent, slow drift. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[-35%] h-[80vh] opacity-[0.18] blur-[140px]"
        style={{
          background: `radial-gradient(ellipse at 50% 50%, ${accent} 0%, transparent 65%)`,
        }}
        animate={{
          y: [0, 20, 0],
          scale: [1, 1.05, 1],
        }}
        transition={{
          type: "spring",
          stiffness: 15,
          damping: 30,
          mass: 3,
          repeat: Infinity,
          repeatType: "mirror",
          duration: 18,
        }}
      />

      {/* Warm secondary orb */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-10%] bottom-[-30%] h-[60vh] w-[60vh] rounded-full opacity-[0.1] blur-[120px]"
        style={{ backgroundColor: "oklch(0.72 0.16 45)" }}
      />

      <main className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 80, damping: 18, mass: 0.8 }}
          className="mb-12 text-center"
        >
          <p className="text-muted-foreground text-[0.8125rem] tracking-[0.12em] uppercase">
            Velkommen
          </p>
          <h1 className="font-heading text-foreground mt-3 text-[2.5rem] leading-[1.05] tracking-tight sm:text-[3rem]">
            Velkommen til {workspaceName}
          </h1>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-base leading-relaxed">
            Her er de tre viktigste tingene du kan gjøre.
          </p>
        </motion.div>

        {/* 3 cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          {cards.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 70,
                  damping: 18,
                  mass: 0.8,
                  delay: 0.2 + i * 0.1,
                }}
                className="border-border bg-card rounded-2xl border p-6 shadow-sm"
              >
                <div className="bg-brand-orange/15 text-brand-orange mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <h2 className="font-heading text-foreground text-lg leading-tight">{card.title}</h2>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{card.body}</p>
                {card.caption && (
                  <p className="text-muted-foreground/80 mt-3 text-xs">{card.caption}</p>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, type: "spring", stiffness: 80, damping: 20 }}
          className="mt-12 flex flex-col items-center gap-4"
        >
          <button
            type="button"
            disabled={isFinishing}
            onClick={() => finish("primary")}
            className="bg-brand-orange focus-visible:ring-brand-orange/40 inline-flex items-center justify-center rounded-xl px-8 py-3.5 text-sm font-semibold text-white shadow-[0_4px_20px_oklch(0.65_0.22_40/0.25)] transition-all hover:brightness-110 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
          >
            {isFinishing ? "Åpner dashbord …" : "Kom i gang"}
          </button>
          <button
            type="button"
            disabled={isFinishing}
            onClick={() => finish("skip")}
            className="text-muted-foreground hover:text-foreground text-sm transition-colors disabled:opacity-70"
          >
            Hopp over
          </button>
        </motion.div>
      </main>
    </div>
  );
}
