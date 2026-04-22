"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Globe, Loader2, Settings2, Sparkles } from "lucide-react";
import type { WizardStepProps } from "@smartout/ui";
import type { JoinState } from "../types";
import { useWorkspaceIntelligence } from "../_hooks/useWorkspaceIntelligence";
import { useJoinScraping } from "../_context/JoinScrapingProvider";
import { useTypewriterSequence } from "../_hooks/useTypewriter";
import { WizardLoadingOverlay } from "./WizardLoadingOverlay";
import { DevAutoFill } from "./DevAutoFill";

const MIN_SPINNER_MS = 800;

export function Step3About({ state, updateState, t }: WizardStepProps<JoinState>) {
  const { prefetchedContent, prefetchStatus, scrapeStatus, triggerScrape } = useJoinScraping();
  const { content, status, enrichAndGenerate, rewriteField } = useWorkspaceIntelligence(
    state,
    updateState,
  );

  const [websiteUrl, setWebsiteUrl] = useState(state.account.websiteUrl ?? "");
  const [aboutUs, setAboutUs] = useState(state.about.aboutUs ?? "");
  const [ourHistory, setOurHistory] = useState(state.about.ourHistory ?? "");
  const [ourConcept, setOurConcept] = useState(state.about.ourConcept ?? "");
  const [userEdited, setUserEdited] = useState<Record<string, boolean>>({});
  const [showSpinner, setShowSpinner] = useState(true);

  // Brief spinner on arrival — always show at least MIN_SPINNER_MS
  const mountedAt = useRef(Date.now());
  useEffect(() => {
    const elapsed = Date.now() - mountedAt.current;
    const remaining = Math.max(0, MIN_SPINNER_MS - elapsed);
    const timer = setTimeout(() => setShowSpinner(false), remaining);
    return () => clearTimeout(timer);
  }, []);

  // Website URL scrape trigger (debounced)
  const scrapeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleUrlChange = useCallback(
    (url: string) => {
      setWebsiteUrl(url);
      if (scrapeDebounceRef.current) clearTimeout(scrapeDebounceRef.current);
      if (url.length > 4) {
        scrapeDebounceRef.current = setTimeout(() => {
          const fullUrl = url.startsWith("http") ? url : `https://${url}`;
          triggerScrape(fullUrl);
        }, 1000);
      }
    },
    [triggerScrape],
  );
  useEffect(() => {
    return () => {
      if (scrapeDebounceRef.current) clearTimeout(scrapeDebounceRef.current);
    };
  }, []);

  // Auto-trigger scrape on mount if URL already exists in state (from devFill or localStorage)
  const hasScrapeTriggered = useRef(false);
  useEffect(() => {
    if (hasScrapeTriggered.current || scrapeStatus !== "idle") return;
    if (websiteUrl && websiteUrl.length > 4) {
      hasScrapeTriggered.current = true;
      const fullUrl = websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`;
      triggerScrape(fullUrl);
    }
  }, [websiteUrl, scrapeStatus, triggerScrape]);

  // Use pre-fetched content from Step2 if available, otherwise fall back to own fetch
  const hasExistingContent = !!(
    state.about.aboutUs ||
    state.about.ourHistory ||
    state.about.ourConcept
  );
  const hasTriggered = useRef(false);
  const hasAppliedPrefetch = useRef(false);

  useEffect(() => {
    if (hasAppliedPrefetch.current || hasExistingContent) return;
    if (prefetchedContent && prefetchStatus === "done") {
      hasAppliedPrefetch.current = true;
      hasTriggered.current = true;
      if (prefetchedContent.about_us && !aboutUs) setAboutUs(prefetchedContent.about_us);
      if (prefetchedContent.our_history && !ourHistory)
        setOurHistory(prefetchedContent.our_history);
      if (prefetchedContent.our_concept && !ourConcept)
        setOurConcept(prefetchedContent.our_concept);
      // Store intelligence in wizard state so Step5 can read cuisine/price/type classifications
      if (prefetchedContent.intelligence) {
        updateState({ intelligence: prefetchedContent.intelligence });
      }
    }
  }, [
    prefetchedContent,
    prefetchStatus,
    hasExistingContent,
    aboutUs,
    ourHistory,
    ourConcept,
    updateState,
  ]);

  useEffect(() => {
    if (hasTriggered.current || hasExistingContent) return;
    if (prefetchStatus === "fetching") return;
    if (prefetchStatus === "done" && prefetchedContent) return;
    if (status === "idle") {
      hasTriggered.current = true;
      enrichAndGenerate();
    }
  }, [status, enrichAndGenerate, hasExistingContent, prefetchStatus, prefetchedContent]);

  // Typewriter
  const hasApplied = useRef(false);
  const typewriterFields = useMemo(() => {
    if (!content || hasApplied.current) return [];
    const fields: Array<{ key: string; value: string }> = [];
    if (content.about_us) fields.push({ key: "aboutUs", value: content.about_us });
    if (content.our_history) fields.push({ key: "ourHistory", value: content.our_history });
    if (content.our_concept) fields.push({ key: "ourConcept", value: content.our_concept });
    return fields;
  }, [content]);

  const shouldType = typewriterFields.length > 0 && !hasApplied.current;
  const {
    values: typedValues,
    activeIndex,
    allDone,
  } = useTypewriterSequence(typewriterFields, shouldType, {
    initialDelay: 200,
    speed: 12,
    gap: 300,
  });

  useEffect(() => {
    if (!shouldType) return;
    if (typedValues.aboutUs && !userEdited.aboutUs) setAboutUs(typedValues.aboutUs);
    if (typedValues.ourHistory && !userEdited.ourHistory) setOurHistory(typedValues.ourHistory);
    if (typedValues.ourConcept && !userEdited.ourConcept) setOurConcept(typedValues.ourConcept);
  }, [typedValues, shouldType, userEdited]);

  useEffect(() => {
    if (allDone && shouldType) hasApplied.current = true;
  }, [allDone, shouldType]);

  // Content sync for rewrites
  const prevContentRef = useRef(content);
  useEffect(() => {
    if (!content) return;
    const prev = prevContentRef.current;
    prevContentRef.current = content;
    if (!prev) return;
    if (content.about_us !== prev.about_us && content.about_us) setAboutUs(content.about_us);
    if (content.our_history !== prev.our_history && content.our_history)
      setOurHistory(content.our_history);
    if (content.our_concept !== prev.our_concept && content.our_concept)
      setOurConcept(content.our_concept);
  }, [content]);

  const markEdited = (field: string) => setUserEdited((prev) => ({ ...prev, [field]: true }));

  const handleRewriteField = async (
    contentKey: "about_us" | "our_history" | "our_concept",
    stateKey: "aboutUs" | "ourHistory" | "ourConcept",
    mode: "rewrite" | "longer" | "shorter" = "rewrite",
  ) => {
    const currentText =
      stateKey === "aboutUs" ? aboutUs : stateKey === "ourHistory" ? ourHistory : ourConcept;
    await rewriteField(contentKey, currentText, mode);
  };

  // Sync to wizard state
  const lastSyncRef = useRef({ websiteUrl, aboutUs, ourHistory, ourConcept });
  useEffect(() => {
    const prev = lastSyncRef.current;
    if (
      prev.websiteUrl === websiteUrl &&
      prev.aboutUs === aboutUs &&
      prev.ourHistory === ourHistory &&
      prev.ourConcept === ourConcept
    )
      return;
    lastSyncRef.current = { websiteUrl, aboutUs, ourHistory, ourConcept };
    updateState({
      account: { ...state.account, websiteUrl },
      about: { aboutUs, ourHistory: ourHistory || undefined, ourConcept },
    });
  }, [websiteUrl, aboutUs, ourHistory, ourConcept, updateState]);

  const typingField =
    activeIndex >= 0 && activeIndex < typewriterFields.length
      ? typewriterFields[activeIndex]!.key
      : null;

  const isLoading = status === "enriching" || status === "generating";
  const isWaitingForContent =
    (isLoading || prefetchStatus === "fetching" || showSpinner) &&
    !content &&
    !allDone &&
    !hasExistingContent;

  if (isWaitingForContent) {
    return (
      <WizardLoadingOverlay
        messages={[
          t("step3.loading1"),
          t("step3.loading2"),
          t("step3.loading3"),
          t("step3.loading4"),
        ]}
      />
    );
  }

  const devFill = () => {
    setAboutUs(
      state.about.aboutUs ||
        "Strøm Mat & Bar er en moderne restaurant i hjertet av Skien med fokus på lokale råvarer og sesongbasert meny.",
    );
    setOurHistory(
      state.about.ourHistory ||
        "Åpnet i 2019. Startet som en liten matbar, vokst til et populært spisested med vinbar.",
    );
    setOurConcept(
      state.about.ourConcept ||
        "Nordisk bistro med vinbar. Avslappet atmosfære, høy kvalitet på mat og drikke.",
    );
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <DevAutoFill onFill={devFill} label="Fyll steg 3" />
      <div>
        <h2 className="font-heading text-foreground text-[1.75rem] leading-tight tracking-tight">
          {t("step3.heading")}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("step3.description")}</p>
        {isLoading && (
          <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
            <Loader2 className="h-3 w-3 animate-spin" />
            {status === "enriching" ? t("step3.enriching") : t("step3.generating")}
          </p>
        )}
        {allDone && (
          <p className="text-brand-orange mt-2 flex items-center gap-1.5 text-xs">
            <Sparkles className="h-3 w-3" />
            {t("step3.aiDone")}
          </p>
        )}
        {status === "failed" && (
          <p className="text-muted-foreground mt-2 text-xs">{t("step3.aiFailed")}</p>
        )}
      </div>

      {/* Website URL — at top of Step3 to trigger scrape early */}
      <div className="space-y-2">
        <Label htmlFor="websiteUrl">{t("step3.website")}</Label>
        <div className="relative">
          <Globe className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            id="websiteUrl"
            type="text"
            placeholder={t("step3.website_placeholder")}
            value={websiteUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            className="pl-9"
          />
        </div>
        {scrapeStatus === "scraping" && (
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t("step3.websiteScraping")}
          </p>
        )}
      </div>

      <div className="space-y-4">
        <TypewriterTextarea
          label={t("step3.aboutUs")}
          id="aboutUs"
          rows={3}
          placeholder={t("step3.aboutUs_placeholder")}
          value={aboutUs}
          typing={typingField === "aboutUs"}
          autoFilled={allDone && !userEdited.aboutUs && !!content?.about_us}
          isLoading={isLoading}
          onChange={(val) => {
            setAboutUs(val);
            markEdited("aboutUs");
          }}
          onRewrite={(mode) => handleRewriteField("about_us", "aboutUs", mode)}
          rewriteLabel={t("step3.rewrite")}
          longerLabel={t("step3.longer")}
          shorterLabel={t("step3.shorter")}
        />

        <TypewriterTextarea
          label={t("step3.ourHistory")}
          labelSuffix={t("step3.ourHistory_suffix")}
          id="ourHistory"
          rows={2}
          placeholder={t("step3.ourHistory_placeholder")}
          value={ourHistory}
          typing={typingField === "ourHistory"}
          autoFilled={allDone && !userEdited.ourHistory && !!content?.our_history}
          isLoading={isLoading}
          onChange={(val) => {
            setOurHistory(val);
            markEdited("ourHistory");
          }}
          onRewrite={(mode) => handleRewriteField("our_history", "ourHistory", mode)}
          rewriteLabel={t("step3.rewrite")}
          longerLabel={t("step3.longer")}
          shorterLabel={t("step3.shorter")}
        />

        <TypewriterTextarea
          label={t("step3.ourConcept")}
          id="ourConcept"
          rows={3}
          placeholder={t("step3.ourConcept_placeholder")}
          value={ourConcept}
          typing={typingField === "ourConcept"}
          autoFilled={allDone && !userEdited.ourConcept && !!content?.our_concept}
          isLoading={isLoading}
          onChange={(val) => {
            setOurConcept(val);
            markEdited("ourConcept");
          }}
          onRewrite={(mode) => handleRewriteField("our_concept", "ourConcept", mode)}
          rewriteLabel={t("step3.rewrite")}
          longerLabel={t("step3.longer")}
          shorterLabel={t("step3.shorter")}
        />
      </div>
    </div>
  );
}

/* -- Typewriter textarea with gear menu -- */

type AiAction = "rewrite" | "longer" | "shorter";

function TypewriterTextarea({
  label,
  labelSuffix,
  id,
  rows,
  placeholder,
  value,
  typing,
  autoFilled,
  isLoading,
  onChange,
  onRewrite,
  rewriteLabel,
  longerLabel,
  shorterLabel,
  error,
}: {
  label: string;
  labelSuffix?: string;
  id: string;
  rows: number;
  placeholder: string;
  value: string;
  typing: boolean;
  autoFilled: boolean;
  isLoading: boolean;
  onChange: (val: string) => void;
  onRewrite: (mode: AiAction) => void;
  rewriteLabel: string;
  longerLabel: string;
  shorterLabel: string;
  error?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const handleAction = (action: AiAction) => {
    setMenuOpen(false);
    onRewrite(action);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Label htmlFor={id}>
            {label}
            {labelSuffix && <span className="text-muted-foreground ml-1">{labelSuffix}</span>}
          </Label>
          {typing && (
            <span className="text-brand-orange flex animate-pulse items-center gap-0.5 text-[10px]">
              <Sparkles className="h-2.5 w-2.5" />
            </span>
          )}
          {autoFilled && !typing && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--warning)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--warning)]">
              <Sparkles className="h-2.5 w-2.5" />
              AI
            </span>
          )}
        </div>

        {value && !typing && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              disabled={isLoading}
              className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--brand-orange)] transition-colors hover:bg-[var(--brand-orange)]/10 hover:text-[var(--brand-orange-dark)] disabled:opacity-40"
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Settings2 className="h-3.5 w-3.5" />
              )}
            </button>

            {menuOpen && (
              <div className="border-border bg-card absolute right-0 z-20 mt-1 w-36 rounded-lg border py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => handleAction("rewrite")}
                  className="text-foreground flex w-full items-center px-3 py-1.5 text-left text-xs hover:bg-[var(--brand-orange)]/10 hover:text-[var(--brand-orange)]"
                >
                  {rewriteLabel}
                </button>
                <button
                  type="button"
                  onClick={() => handleAction("longer")}
                  className="text-foreground flex w-full items-center px-3 py-1.5 text-left text-xs hover:bg-[var(--brand-orange)]/10 hover:text-[var(--brand-orange)]"
                >
                  {longerLabel}
                </button>
                <button
                  type="button"
                  onClick={() => handleAction("shorter")}
                  className="text-foreground flex w-full items-center px-3 py-1.5 text-left text-xs hover:bg-[var(--brand-orange)]/10 hover:text-[var(--brand-orange)]"
                >
                  {shorterLabel}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <Textarea
        id={id}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
      />
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
