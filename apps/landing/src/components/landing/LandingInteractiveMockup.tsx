"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Bot,
  CalendarClock,
  MessageSquare,
  AlertCircle,
  Info,
  ChevronRight,
  Sun,
  Calendar,
} from "lucide-react";

import { createTranslator } from "@smartout/i18n";

type InteractiveState = "idle" | "shift-clicked" | "botsson-clicked" | "vacation-clicked";

export function LandingInteractiveMockup({ locale = "nb" }: { locale?: "nb" | "en" }) {
  const t = createTranslator(locale, "landing");
  const [activeState, setActiveState] = useState<InteractiveState>("idle");

  const closeOverlay = () => setActiveState("idle");

  return (
    <div className="relative mx-auto my-32 max-w-7xl overflow-hidden px-6 lg:my-48">
      {/* 
        This wrapper is slightly blurred or scaled to give depth.
        The App sits inside it. 
      */}
      <div className="border-border bg-card/60 relative flex flex-col items-center justify-center overflow-hidden rounded-[2.5rem] border py-24 shadow-[0_20px_100px_rgba(0,0,0,0.2)] backdrop-blur-xl sm:py-32">
        <div className="to-background/50 pointer-events-none absolute inset-0 bg-gradient-to-br from-transparent" />

        {/* Main App Window */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true, margin: "-200px" }}
          transition={{ type: "spring", damping: 25, mass: 2 }}
          className="border-border bg-background relative z-10 w-full max-w-4xl overflow-hidden rounded-2xl border shadow-2xl"
        >
          {/* Mac-style Window Header */}
          <div className="border-border/50 bg-muted/30 flex h-12 items-center justify-between border-b px-4">
            <div className="flex gap-2">
              <div className="bg-destructive/80 h-3 w-3 rounded-full" />
              <div className="bg-warning/80 h-3 w-3 rounded-full" />
              <div className="bg-success/80 h-3 w-3 rounded-full" />
            </div>
            <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Smartout AI Workspace
            </div>
            <div className="w-12" />
          </div>

          {/* App Content */}
          <div className="flex h-full min-h-[500px] flex-col md:flex-row">
            {/* Sidebar (simplified for landing effect) */}
            <div className="border-border/50 bg-muted/10 hidden w-64 flex-col border-r p-6 md:flex">
              <div className="mb-8 flex items-center gap-3">
                <div className="bg-brand-orange/20 flex h-10 w-10 items-center justify-center rounded-xl">
                  <Bot className="text-brand-orange h-5 w-5" />
                </div>
                <span className="text-lg font-bold">{t("mockup.sidebar.kitchen")}</span>
              </div>

              <div className="space-y-2">
                {[
                  {
                    label: t("mockup.sidebar.dashboard"),
                    icon: <Info className="h-4 w-4" />,
                    active: false,
                  },
                  {
                    label: t("mockup.sidebar.schedule"),
                    icon: <CalendarClock className="h-4 w-4" />,
                    active: true,
                  },
                  {
                    label: t("mockup.sidebar.messages"),
                    icon: <MessageSquare className="h-4 w-4" />,
                    active: false,
                  },
                  {
                    label: t("mockup.sidebar.vacation"),
                    icon: <Sun className="h-4 w-4" />,
                    active: false,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                      item.active
                        ? "bg-brand-orange/10 text-brand-orange"
                        : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Main Area: The Schedule building itself */}
            <div className="relative flex-1 overflow-y-auto p-6 sm:p-8">
              <div className="border-border/50 mb-8 flex items-center justify-between border-b pb-6">
                <div>
                  <h4 className="text-2xl font-bold tracking-tight">{t("mockup.header.title")}</h4>
                  <p className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                    <span className="relative flex h-2 w-2">
                      <span className="bg-brand-orange absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"></span>
                      <span className="bg-brand-orange relative inline-flex h-2 w-2 rounded-full"></span>
                    </span>
                    {t("mockup.header.subtitle")}
                  </p>
                </div>
                <div className="border-brand-orange flex h-12 w-12 animate-spin items-center justify-center rounded-full border-2 border-t-transparent shadow-lg">
                  <Sparkles className="text-brand-orange h-5 w-5" />
                </div>
              </div>

              {/* The Interactive Rows */}
              <div className="flex flex-col gap-4">
                {/* 1: The "Dagens Beskjed" Notification */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 50 }}
                  className="border-primary/20 bg-primary/5 mb-4 flex items-start gap-4 rounded-2xl border p-4 shadow-sm"
                >
                  <AlertCircle className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                  <div>
                    <h5 className="text-sm font-semibold">{t("mockup.notice.title")}</h5>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {`"${t("mockup.notice.message")}"`}
                      <span className="text-primary ml-2 font-medium">
                        {t("mockup.notice.readBy")}
                      </span>
                    </p>
                  </div>
                </motion.div>

                {/* 2: Shift 1 - Clickable */}
                <motion.button
                  initial={{ x: -20, opacity: 0 }}
                  whileInView={{ x: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5, type: "spring", stiffness: 50 }}
                  onClick={() => setActiveState("shift-clicked")}
                  className="group border-border/50 bg-card hover:bg-foreground/5 hover:border-brand-orange/30 focus:ring-brand-orange relative flex w-full flex-col justify-between gap-4 rounded-2xl border p-4 text-left transition-all hover:shadow-md focus:ring-2 focus:outline-none sm:flex-row sm:items-center"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-success/20 text-success flex h-12 w-12 items-center justify-center rounded-full font-bold">
                      J
                    </div>
                    <div>
                      <div className="text-foreground font-semibold">{t("mockup.shift1.name")}</div>
                      <div className="text-muted-foreground mt-0.5 text-xs">
                        {t("mockup.shift1.time")}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="bg-success/10 text-success rounded-lg px-3 py-1.5 text-[11px] font-bold tracking-wide uppercase">
                      {t("mockup.shift1.status")}
                    </div>
                    <ChevronRight className="text-muted-foreground group-hover:text-brand-orange h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </motion.button>

                {/* 3: Shift 2 - Also Clickable */}
                <motion.button
                  initial={{ x: -20, opacity: 0 }}
                  whileInView={{ x: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.8, type: "spring", stiffness: 50 }}
                  onClick={() => setActiveState("shift-clicked")}
                  className="group border-border/50 bg-card hover:bg-foreground/5 hover:border-brand-orange/30 focus:ring-brand-orange relative flex w-full flex-col justify-between gap-4 rounded-2xl border p-4 text-left transition-all hover:shadow-md focus:ring-2 focus:outline-none sm:flex-row sm:items-center"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-primary/20 text-primary flex h-12 w-12 items-center justify-center rounded-full font-bold">
                      M
                    </div>
                    <div>
                      <div className="text-foreground font-semibold">{t("mockup.shift2.name")}</div>
                      <div className="text-muted-foreground mt-0.5 text-xs">
                        {t("mockup.shift2.time")}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="bg-success/10 text-success rounded-lg px-3 py-1.5 text-[11px] font-bold tracking-wide uppercase">
                      {t("mockup.shift2.status")}
                    </div>
                    <ChevronRight className="text-muted-foreground group-hover:text-brand-orange h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </motion.button>

                {/* 4: Vacation Request */}
                <motion.button
                  initial={{ x: -20, opacity: 0 }}
                  whileInView={{ x: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 1.1, type: "spring", stiffness: 50 }}
                  onClick={() => setActiveState("vacation-clicked")}
                  className="group border-warning/30 bg-warning/5 hover:bg-warning/10 focus:ring-warning relative flex w-full flex-col justify-between gap-4 rounded-2xl border p-4 text-left transition-all hover:shadow-md focus:ring-2 focus:outline-none sm:flex-row sm:items-center"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-warning/20 text-warning flex h-12 w-12 items-center justify-center rounded-full">
                      <Sun className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-foreground font-semibold">
                        {t("mockup.vacation.title")}
                      </div>
                      <div className="text-muted-foreground mt-0.5 text-xs">
                        {t("mockup.vacation.duration")}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="bg-warning text-warning-foreground rounded-lg px-3 py-1.5 text-[11px] font-bold tracking-wide uppercase shadow-sm">
                      {t("mockup.vacation.status")}
                    </div>
                    <ChevronRight className="text-warning h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </motion.button>
              </div>

              {/* OVERLAYS (The interactive popups inside the app window) */}
              <AnimatePresence>
                {activeState === "shift-clicked" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", damping: 25, stiffness: 250 }}
                    className="bg-background/60 absolute inset-0 z-20 flex items-center justify-center p-6 backdrop-blur-md"
                    onClick={closeOverlay}
                  >
                    <div
                      className="border-border bg-card w-full max-w-sm rounded-3xl border p-6 shadow-2xl"
                      onClick={(e) => e.stopPropagation()} // Prevent click from closing immediately
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <div className="bg-brand-orange/10 text-brand-orange rounded-lg px-3 py-1 text-xs font-bold uppercase">
                          {t("mockup.overlay.shift.badge")}
                        </div>
                        <button
                          onClick={closeOverlay}
                          className="text-muted-foreground hover:text-foreground text-xs font-medium"
                        >
                          {t("mockup.overlay.shift.close")}
                        </button>
                      </div>

                      <h3 className="mb-1 text-xl font-bold">{t("mockup.overlay.shift.title")}</h3>
                      <p className="text-muted-foreground mb-6 text-sm">
                        {t("mockup.overlay.shift.subtitle")}
                      </p>

                      <div className="space-y-4">
                        <div className="border-border/50 rounded-xl border p-3">
                          <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                            {t("mockup.overlay.shift.reqLabel")}
                          </span>
                          <p className="text-foreground mt-1 text-sm font-medium">
                            {t("mockup.overlay.shift.reqValue")}
                          </p>
                        </div>
                        <div className="border-border/50 rounded-xl border p-3">
                          <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                            {t("mockup.overlay.shift.tariffLabel")}
                          </span>
                          <ul className="mt-2 space-y-1">
                            <li className="flex justify-between text-sm">
                              <span className="text-muted-foreground">
                                {t("mockup.overlay.shift.evening")}
                              </span>{" "}
                              <span className="font-semibold">
                                {t("mockup.overlay.shift.eveningRate")}
                              </span>
                            </li>
                            <li className="flex justify-between text-sm">
                              <span className="text-muted-foreground">
                                {t("mockup.overlay.shift.weekend")}
                              </span>{" "}
                              <span className="font-semibold">
                                {t("mockup.overlay.shift.weekendRate")}
                              </span>
                            </li>
                          </ul>
                        </div>
                        <div className="bg-success/10 text-success rounded-xl p-3 text-sm font-medium">
                          {t("mockup.overlay.shift.hmsNote")}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeState === "vacation-clicked" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", damping: 25, stiffness: 250 }}
                    className="bg-background/60 absolute inset-0 z-20 flex items-center justify-center p-6 backdrop-blur-md"
                    onClick={closeOverlay}
                  >
                    <div
                      className="border-border bg-card w-full max-w-sm rounded-3xl border p-6 shadow-2xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <h3 className="mb-1 text-xl font-bold">
                        {t("mockup.overlay.vacation.title")}
                      </h3>
                      <p className="text-muted-foreground mb-6 text-sm">
                        {t("mockup.overlay.vacation.subtitle")}
                      </p>

                      <div className="bg-primary/5 text-foreground border-primary/10 rounded-xl border p-4 text-sm leading-relaxed">
                        <strong className="text-primary mb-2 block">
                          {t("mockup.overlay.vacation.insightLabel")}
                        </strong>
                        {`"${t("mockup.overlay.vacation.insight")}"`}
                      </div>

                      <div className="mt-6 flex gap-3">
                        <button className="bg-success text-background flex-1 rounded-xl py-3 text-sm font-bold transition hover:opacity-90">
                          {t("mockup.overlay.vacation.approve")}
                        </button>
                        <button className="bg-muted text-foreground hover:bg-muted/80 flex-1 rounded-xl py-3 text-sm font-bold transition">
                          {t("mockup.overlay.vacation.reject")}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* Interactive Botsson Chat Head outside the app */}
        <motion.button
          initial={{ x: -50, opacity: 0, rotate: -10 }}
          whileInView={{ x: 0, opacity: 1, rotate: -4 }}
          viewport={{ once: true }}
          transition={{ delay: 1.5, type: "spring", stiffness: 60 }}
          onClick={() =>
            setActiveState(activeState === "botsson-clicked" ? "idle" : "botsson-clicked")
          }
          className="border-border bg-card absolute bottom-10 left-4 z-30 flex max-w-[240px] flex-col gap-3 rounded-2xl border p-5 shadow-2xl transition-transform hover:scale-105 hover:rotate-0 focus:outline-none sm:bottom-16 sm:left-16 sm:max-w-sm"
        >
          <div className="flex items-center gap-3">
            <div className="bg-brand-orange/20 flex h-10 w-10 items-center justify-center rounded-full">
              <Bot className="text-brand-orange h-5 w-5" />
            </div>
            <div>
              <p className="text-base leading-none font-bold">{t("mockup.botsson.name")}</p>
              <p className="text-brand-orange mt-1 text-xs font-semibold">
                {t("mockup.botsson.role")}
              </p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {activeState === "botsson-clicked" ? (
              <motion.div
                key="expanded"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="text-foreground text-sm leading-relaxed"
              >
                <strong>{t("mockup.botsson.expanded.title")}</strong>
                <br />
                <br />
                {t("mockup.botsson.expanded.body")}
                <br />
                <br />
                <em>{t("mockup.botsson.expanded.tagline")}</em>
              </motion.div>
            ) : (
              <motion.div
                key="collapsed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-muted-foreground text-xs leading-relaxed"
              >
                {t("mockup.botsson.collapsed")}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </div>
  );
}
