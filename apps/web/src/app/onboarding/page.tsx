"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@smartout/supabase/client";
import {
  Globe,
  Loader2,
  Bot,
  CheckCircle2,
  Building2,
  ArrowRight,
  FileText,
  Plus,
} from "lucide-react";

type WizardState =
  | "init"
  | "crawling"
  | "org_verification"
  | "branding"
  | "season_education"
  | "season_identity"
  | "departments"
  | "teams"
  | "locations"
  | "procedures"
  | "battlefield_review"
  | "finalizing"
  | "done";

interface Policy {
  id: string;
  title: string;
  summary: string;
}

// Minimal interfaces to satisfy TS compiler while prototyping
interface CoreLocation {
  id?: string;
  name: string;
  description?: string;
  [key: string]: unknown;
}
interface CoreTeam {
  id?: string;
  name: string;
  description?: string;
  roles?: string[];
  isMultiDepartment?: boolean;
  [key: string]: unknown;
}
interface CoreDepartment {
  id?: string;
  name: string;
  description?: string;
  teams?: CoreTeam[];
  isSeasonActive?: boolean;
  [key: string]: unknown;
}
interface CoreProcedure {
  id?: string;
  title: string;
  description?: string;
  urgency?: string;
  assignedTo?: string;
  [key: string]: unknown;
}

function OnboardingContent() {
  const [step, setStep] = useState<WizardState>("init");
  const [urlInput, setUrlInput] = useState("");

  // Brreg Verification State
  const [orgNumberInput, setOrgNumberInput] = useState("");
  const [isVerifyingOrg, setIsVerifyingOrg] = useState(false);
  const [verifiedOrgData, setVerifiedOrgData] = useState<{
    name: string;
    address: string;
    ceo: string;
    employeeCount?: string;
    industry?: string;
    description?: string;
  } | null>(null);
  const [orgError, setOrgError] = useState("");
  const [tempWorkspaceId, setTempWorkspaceId] = useState<string | null>(null);
  const [, setError] = useState<string | null>(null);
  const supabase = createClient();

  // Core Data
  const [workspaceData, setWorkspaceData] = useState({
    name: "",
    website: "",
    email: "",
    phone: "",
    address: "",
    ceo: "",
    employeeCount: "",
    industry: "",
    concept: "",
    summary: "",
    slogan: "",
    locations: [] as CoreLocation[],
    departments: [] as CoreDepartment[],
    multiDepartmentTeams: [] as CoreTeam[],
    procedures: [] as CoreProcedure[],
    policies: [] as Policy[],
    pageDictionary: {} as Record<string, string>,
    images: [] as { src: string; alt: string }[],
    menus: [] as { href: string; text: string }[],
    socialLinks: {} as Record<string, string>,
    reservationUrl: null as string | null,
    brandColor: "#3B82F6",
    communicationTone: "Professional & Formal",
    seasonName: "Core Operations",
    seasonStartDate: "",
    seasonEndDate: "",
    seasonType: "Permanent",
  });

  // Drawer State
  const [isDepartmentDrawerOpen, setIsDepartmentDrawerOpen] = useState(false);
  const [editingDepartmentIndex, setEditingDepartmentIndex] = useState<number | null>(null);
  const [isTeamDrawerOpen, setIsTeamDrawerOpen] = useState(false);
  // Track both which department the team is in, and which team it is. deptIdx = -1 means multi-department team.
  const [editingTeamIndex, setEditingTeamIndex] = useState<{
    deptIdx: number;
    teamIdx: number;
  } | null>(null);
  const [isProcedureDrawerOpen, setIsProcedureDrawerOpen] = useState(false);
  const [editingProcedureIndex, setEditingProcedureIndex] = useState<number | null>(null);
  const [isLocationDrawerOpen, setIsLocationDrawerOpen] = useState(false);
  const [editingLocationIndex, setEditingLocationIndex] = useState<number | null>(null);

  const searchParams = useSearchParams();
  const hasAutoStarted = useRef(false);

  useEffect(() => {
    const urlParam = searchParams?.get("url");
    if (urlParam && step === "init" && !hasAutoStarted.current) {
      hasAutoStarted.current = true;
      setUrlInput(urlParam);
      // We need to defer this slightly to ensure state has mounted correctly
      setTimeout(() => {
        handleStartCrawling(undefined, urlParam);
      }, 100);
    }
    // eslint-disable-next-line -- suppress exhaustive-deps: handleStartCrawling excluded; ref guard ensures single execution
  }, [searchParams, step]);

  const handleStartCrawling = async (e?: React.FormEvent, overrideUrl?: string) => {
    if (e) e.preventDefault();
    const targetUrl = overrideUrl || urlInput;
    if (!targetUrl.trim()) return;

    setStep("crawling");

    try {
      const { data, error } = await supabase.functions.invoke("gather-workspace-intelligence", {
        body: { url: targetUrl },
      });

      if (error) {
        console.warn("Invoke error details:", error);
        throw new Error("Edge Function Failed"); // Throws to catch block
      }

      const { scrapedData, brregData, sessionId } = data;

      // Auto-generate some base policies based on data
      const generatedPolicies = [
        {
          id: "1",
          title: "Standard Opening Routine",
          summary: "Daily unlock and setup checklist adjusted for your locations.",
        },
        {
          id: "2",
          title: "Health & Safety (HACCP) Base",
          summary:
            "Required temperature checks and hygiene routines applicable to all food-handling departments.",
        },
      ];

      setWorkspaceData({
        name: brregData?.navn || scrapedData?.companyName || "",
        website: "",
        email: scrapedData?.email || "",
        phone: scrapedData?.phone || "",
        address: brregData?.forretningsadresse
          ? `${brregData.forretningsadresse.adresse?.[0] || ""}, ${brregData.forretningsadresse.postnummer || ""} ${brregData.forretningsadresse.poststed || ""}`.trim()
          : "",
        ceo: "", // Ceo requires a separate roles call usually, doing it in step 2 if needed
        employeeCount: brregData?.antallAnsatte ? brregData.antallAnsatte.toString() : "",
        industry: brregData?.naeringskode1 ? brregData.naeringskode1.beskrivelse : "",
        concept: "",
        summary: scrapedData?.summary || "",
        slogan: "",
        locations: scrapedData?.locations || [],
        departments: scrapedData?.departments || [],
        multiDepartmentTeams: [],
        procedures: [],
        policies: generatedPolicies,
        pageDictionary: scrapedData?.pageDictionary || {},
        images: scrapedData?.images || [],
        menus: scrapedData?.menus || [],
        socialLinks: scrapedData?.socialLinks || {},
        reservationUrl: scrapedData?.reservationUrl || null,
        brandColor: "#3B82F6",
        communicationTone: "Professional & Formal",
        seasonName: "Core Operations",
        seasonStartDate: "",
        seasonEndDate: "",
        seasonType: "Permanent",
      });
      if (sessionId) setTempWorkspaceId(sessionId); // Storing sessionId temporarily
      setStep("org_verification");
    } catch (error) {
      console.warn("Scraping failed, falling back to mock data for demo:", error);
      setTimeout(() => {
        setWorkspaceData({
          name: "Grand Hotel Oslo",
          website: "www.grand.no",
          email: "post@grand.no",
          phone: "+47 22 88 10 00",
          address: "Karl Johans gate 31, 0159 Oslo",
          ceo: "Christian Ringnes",
          employeeCount: "450",
          industry: "Hotell og overnatting",
          concept: "Luxury Hotel & Fine Dining",
          summary:
            "A premium hotel experience combining classic luxury with modern comfort in the heart of Oslo.",
          slogan: "Classic luxury in Oslo",
          locations: [
            { id: "1", name: "Main Dining", type: "Indoor", function: "", isComplete: true },
            { id: "2", name: "Terrace Bar", type: "Outdoor", function: "", isComplete: true },
          ],
          departments: [
            {
              id: "1",
              name: "Kitchen",
              roles: ["Executive Chef", "Sous Chef", "Line Cook"],
              description: "",
              isSeasonActive: true,
              isComplete: true,
            },
            {
              id: "2",
              name: "Floor",
              roles: ["Head Waiter", "Bartender"],
              description: "",
              isSeasonActive: true,
              isComplete: true,
            },
          ],
          multiDepartmentTeams: [],
          procedures: [],
          policies: [
            {
              id: "1",
              title: "Standard Opening Routine",
              summary:
                "Daily unlock and setup checklist. Automatically generated based on your location configuration.",
            },
          ],
          pageDictionary: {},
          images: [],
          menus: [],
          socialLinks: {},
          reservationUrl: null,
          brandColor: "#3B82F6",
          communicationTone: "Professional & Formal",
          seasonName: "Core Operations",
          seasonStartDate: "",
          seasonEndDate: "",
          seasonType: "Permanent",
        });
        setStep("org_verification");
      }, 3000);
    }
  };

  const handleSkip = () => {
    setStep("org_verification");
  };

  const handleVerifyOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOrg = orgNumberInput.replace(/\D/g, "");
    if (cleanOrg.length !== 9) {
      setOrgError("Et gyldig norsk organisasjonsnummer har 9 siffer.");
      return;
    }

    setIsVerifyingOrg(true);
    setOrgError("");

    try {
      const res = await fetch(`https://data.brreg.no/enhetsregisteret/api/enheter/${cleanOrg}`);
      if (!res.ok) throw new Error("Fant ikke firma i Brønnøysundregistrene.");

      const data = await res.json();

      let ceoName = "Ikke registrert / Styret";
      try {
        const rolesRes = await fetch(
          `https://data.brreg.no/enhetsregisteret/api/enheter/${cleanOrg}/roller`,
        );
        if (rolesRes.ok) {
          const rolesData = await rolesRes.json();
          const ceoRole = rolesData.rollegrupper?.find(
            (rg: { type: { kode: string } }) => rg.type.kode === "DAGL",
          );
          if (ceoRole && ceoRole.roller && ceoRole.roller.length > 0) {
            const person = ceoRole.roller[0].person;
            if (person) {
              ceoName = `${person.navn.fornavn} ${person.navn.mellomnavn ? person.navn.mellomnavn + " " : ""}${person.navn.etternavn}`;
            }
          }
        }
      } catch (e) {
        console.error("Kunne ikke hente roller:", e);
      }

      const addressLine = data.forretningsadresse
        ? `${data.forretningsadresse.adresse?.[0] || ""}, ${data.forretningsadresse.postnummer || ""} ${data.forretningsadresse.poststed || ""}`.trim()
        : "Ingen adresse registrert";

      const employeeCount = data.antallAnsatte ? data.antallAnsatte.toString() : "";
      const industry = data.naeringskode1 ? data.naeringskode1.beskrivelse : "";
      const description = data.vedtektsfestetFormaal
        ? data.vedtektsfestetFormaal.join("\n")
        : data.aktivitet
          ? data.aktivitet.join("\n")
          : "";

      setVerifiedOrgData({
        name: data.navn,
        address: addressLine,
        ceo: ceoName,
        employeeCount,
        industry,
        description,
      });

      // Auto-update workspace name if we found a match
      setWorkspaceData((prev) => ({
        ...prev,
        name: data.navn,
        address: addressLine,
        ceo: ceoName,
        employeeCount,
        industry,
        concept: description,
      }));
    } catch (error: unknown) {
      setOrgError(error instanceof Error ? error.message : "En feil oppstod ved søk.");
      setVerifiedOrgData(null);
    } finally {
      setIsVerifyingOrg(false);
    }
  };

  const handleConfirmOrg = async () => {
    if (tempWorkspaceId && orgNumberInput) {
      try {
        // Determine company_id from workspace
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: wsData } = await (supabase as any)
          .from("workspace")
          .select("company_id")
          .eq("workspace_id", tempWorkspaceId)
          .single();

        if (wsData?.company_id) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from("company")
            .update({ org_number: orgNumberInput })
            .eq("company_id", wsData.company_id);
        }
      } catch (e) {
        console.error("Failed to persist org_number", e);
      }
    }

    setStep("branding");
  };

  const handleNextToSeasonEducation = () => {
    setStep("season_education");
  };

  const handleNextToSeasonIdentity = () => {
    setStep("season_identity");
  };

  const handleNextToDepartments = () => {
    setStep("departments");
  };

  const handleNextToTeams = () => {
    setStep("teams");
  };

  const handleNextToLocations = () => {
    setStep("locations");
  };

  const handleNextToProcedures = () => {
    setStep("procedures");
  };

  const handleNextToReview = () => {
    setStep("battlefield_review");
  };

  const handleFinalize = async () => {
    setStep("finalizing");
    setError(null);

    try {
      const { error: invokeError } = await supabase.functions.invoke("activate-workspace", {
        body: { workspaceData },
      });

      if (invokeError) throw new Error(invokeError.message || "Failed to finalize workspace");

      setStep("done");
    } catch (err: unknown) {
      console.error("Finalization error:", err);
      setError(
        err instanceof Error ? err.message : "An error occurred while setting up your workspace.",
      );
      setStep("battlefield_review"); // Fallback to review step on error
    }
  };

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center bg-[#0a0a0c] font-sans text-zinc-300 selection:bg-cyan-500/30">
      {/* Ambient Background */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute top-0 right-1/4 h-[800px] w-[800px] -translate-y-1/2 rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 h-[800px] w-[800px] translate-y-1/2 rounded-full bg-purple-600/10 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col justify-center px-6 py-12">
        {step === "init" && (
          <div className="mx-auto flex w-full max-w-xl flex-col items-center text-center">
            <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
              <Bot size={40} />
            </div>
            <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              Let&apos;s build your workspace.
            </h1>
            <p className="mb-12 text-lg text-zinc-400">
              Provide your company&apos;s website address and we&apos;ll automatically generate your
              structure, departments, and core policies.
            </p>

            <form
              onSubmit={handleStartCrawling}
              className="flex w-full flex-col justify-center gap-4"
            >
              <div className="relative flex items-center overflow-hidden rounded-2xl border border-white/10 bg-[#111] shadow-xl transition-all focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-500">
                <div className="flex items-center pr-2 pl-6 text-zinc-500 select-none">
                  <Globe size={20} className="mr-2" />
                  <span className="text-base font-medium">https://</span>
                </div>
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/^https?:\/\//i, "");
                    setUrlInput(val);
                  }}
                  placeholder="your-webpage.com"
                  className="w-full bg-transparent py-5 pr-6 text-lg font-medium text-white outline-none placeholder:text-zinc-600"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                />
              </div>
              <div className="mt-4 flex flex-col gap-4 sm:flex-row">
                <button
                  type="submit"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white py-4 font-bold text-zinc-900 shadow-xl shadow-white/10 transition-transform hover:bg-zinc-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!urlInput.trim()}
                >
                  Scan & Generate <ArrowRight size={18} />
                </button>
                <button
                  type="button"
                  onClick={handleSkip}
                  className="w-full rounded-xl border border-white/5 bg-zinc-900 px-8 py-4 font-medium text-white transition-colors hover:bg-zinc-800 sm:w-auto"
                >
                  Skip text
                </button>
              </div>
            </form>
          </div>
        )}

        {step === "crawling" && (
          <div className="mx-auto flex w-full max-w-md flex-col items-center text-center">
            <div className="relative mb-8 flex h-24 w-24 items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20"></div>
              <div className="absolute inset-0 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent"></div>
              <Globe className="h-8 w-8 text-cyan-400" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-white">
              Analyzing {urlInput || "your site"}...
            </h2>
            <p className="text-zinc-400">
              Extracting company structure, locations, and generating standard operational policies.
            </p>
          </div>
        )}

        {step === "org_verification" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 mx-auto flex w-full max-w-2xl flex-col items-center text-center duration-500">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.15)]">
              <Building2 size={32} />
            </div>
            <h2 className="mb-3 text-3xl font-extrabold text-white">Verify Company Identity</h2>
            <p className="mb-8 text-zinc-400">
              Enter your Norwegian organization number to pull official public records for your
              workspace.
            </p>

            {!verifiedOrgData ? (
              <form onSubmit={handleVerifyOrg} className="w-full">
                <div className="space-y-4">
                  <div className="relative flex items-center overflow-hidden rounded-2xl border border-white/10 bg-[#111] shadow-xl transition-all focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-500">
                    <input
                      type="text"
                      value={orgNumberInput}
                      onChange={(e) => setOrgNumberInput(e.target.value)}
                      placeholder="Organisasjonsnummer (9 siffer)"
                      className="w-full bg-transparent p-5 text-center text-lg font-medium text-white outline-none placeholder:text-zinc-600"
                      maxLength={11}
                    />
                  </div>
                  {orgError && <p className="text-sm font-medium text-red-400">{orgError}</p>}
                  <button
                    type="submit"
                    disabled={isVerifyingOrg || !orgNumberInput}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-4 font-bold text-black transition-transform hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-50"
                  >
                    {isVerifyingOrg ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      "Search Brønnøysundregistrene"
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setStep("branding")}
                  className="mt-6 text-sm text-zinc-500 transition-colors hover:text-white"
                >
                  Skip this step for now
                </button>
              </form>
            ) : (
              <div className="relative w-full overflow-hidden rounded-2xl border border-cyan-500/30 bg-[#111] p-6 text-left shadow-2xl shadow-cyan-900/10 sm:p-8">
                <div className="absolute top-0 right-0 p-4">
                  <CheckCircle2 className="text-green-500" size={24} />
                </div>
                <h3 className="mb-6 pr-8 text-2xl font-bold text-white">{verifiedOrgData.name}</h3>

                <div className="mb-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
                  <div className="space-y-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-zinc-500 uppercase">Org Num</span>
                      <span className="font-mono text-zinc-300">{orgNumberInput}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-zinc-500 uppercase">
                        Forretningsadresse
                      </span>
                      <span className="text-zinc-300">{verifiedOrgData.address}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-zinc-500 uppercase">
                        Daglig Leder
                      </span>
                      <span className="text-zinc-300">{verifiedOrgData.ceo}</span>
                    </div>
                    {verifiedOrgData.industry && (
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-zinc-500 uppercase">Industry</span>
                        <span className="text-zinc-300">{verifiedOrgData.industry}</span>
                      </div>
                    )}
                  </div>

                  {verifiedOrgData.description && (
                    <div className="flex flex-col rounded-xl border border-white/10 bg-white/5 p-4">
                      <span className="mb-2 text-xs font-bold text-zinc-500 uppercase">
                        Description (Formål)
                      </span>
                      <span className="text-sm leading-relaxed whitespace-pre-line text-zinc-300">
                        {verifiedOrgData.description}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setVerifiedOrgData(null)}
                    className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-700"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={handleConfirmOrg}
                    className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 font-bold text-white shadow-lg shadow-cyan-500/20 hover:opacity-90"
                  >
                    Looks correct <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === "branding" && (
          <div className="animate-in fade-in slide-in-from-bottom-8 mx-auto w-full max-w-3xl duration-700">
            <div className="mb-10 text-center">
              <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Your Branding & Voice
              </h1>
              <p className="text-lg text-zinc-400">
                Set up your company&apos;s visual identity and communication style.
              </p>
            </div>

            <div className="flex flex-col gap-6">
              <div className="group relative overflow-hidden rounded-3xl border border-white/5 bg-[#111] p-6 shadow-xl transition-colors hover:border-white/10 sm:p-8">
                <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-purple-500 to-pink-500 opacity-50"></div>
                <h3 className="mb-6 flex items-center gap-3 text-xl font-bold text-white">
                  <FileText className="text-purple-400" size={24} /> Company Summary & Images
                </h3>
                <div className="space-y-6">
                  <div>
                    <label className="mb-2 block text-xs font-bold tracking-wider text-zinc-500 uppercase">
                      Company Logo
                    </label>
                    <div className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/10 bg-black/30 text-zinc-500 transition-colors hover:border-white/30 hover:text-white">
                      <span className="text-sm font-medium">Click to upload or drag & drop</span>
                      <span className="mt-1 text-xs">PNG, JPG or SVG</span>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold tracking-wider text-zinc-500 uppercase">
                      Company Slogan
                    </label>
                    <input
                      value={workspaceData.slogan}
                      onChange={(e) =>
                        setWorkspaceData({ ...workspaceData, slogan: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white transition-colors outline-none focus:border-purple-500"
                      placeholder="e.g. Where quality meets service"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold tracking-wider text-zinc-500 uppercase">
                      Brand Color
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="color"
                        value={workspaceData.brandColor || "#3B82F6"}
                        onChange={(e) =>
                          setWorkspaceData({ ...workspaceData, brandColor: e.target.value })
                        }
                        className="h-12 w-12 cursor-pointer rounded-xl border border-white/10 bg-black/50"
                      />
                      <span className="rounded-xl border border-white/10 bg-black/50 px-4 py-3 font-mono text-sm text-zinc-400">
                        {workspaceData.brandColor || "#3B82F6"}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold tracking-wider text-zinc-500 uppercase">
                      Communication Tone
                    </label>
                    <select
                      value={workspaceData.communicationTone || "Professional & Formal"}
                      onChange={(e) =>
                        setWorkspaceData({ ...workspaceData, communicationTone: e.target.value })
                      }
                      className="w-full appearance-none rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white transition-colors outline-none focus:border-purple-500"
                    >
                      <option>Professional & Formal</option>
                      <option>Friendly & Casual</option>
                      <option>Energetic & Upbeat</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10 flex justify-between">
              <button
                onClick={() => setStep("org_verification")}
                className="rounded-xl border border-white/10 px-6 py-3.5 font-medium text-white transition-colors hover:bg-white/5"
              >
                Back
              </button>
              <button
                onClick={handleNextToSeasonEducation}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 px-8 py-3.5 font-bold text-white shadow-lg shadow-purple-500/25 transition-transform hover:from-purple-400 hover:to-pink-500 active:scale-95"
              >
                Generate Contract & Proceed <CheckCircle2 size={18} />
              </button>
            </div>
          </div>
        )}

        {step === "season_education" && (
          <div className="animate-in fade-in slide-in-from-bottom-8 mx-auto w-full max-w-3xl duration-700">
            <div className="mb-10 text-center">
              <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                The Concept of Seasons
              </h1>
              <p className="text-lg text-zinc-400">
                In Smartout, everything operates in Seasons. Reset budgets, update menus, and change
                setups seamlessly.
              </p>
            </div>

            <div className="group relative flex flex-col items-center overflow-hidden rounded-3xl border border-white/5 bg-[#111] p-8 text-center shadow-xl sm:p-10">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent"></div>

              <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/20">
                <FileText size={40} className="text-indigo-400" />
              </div>

              <h2 className="mb-4 text-2xl font-bold text-white">Why Seasons?</h2>
              <p className="mb-8 max-w-lg leading-relaxed text-zinc-300">
                Instead of a continuously growing, unmanageable system, Smartout uses{" "}
                <strong>Seasons</strong>. A Season can be permanent (like &quot;Core
                Operations&quot;) or temporal (like &quot;Summer 2024&quot;).
                <br />
                <br />
                This lets you archive past performance, assign seasonal staff cleanly, and switch
                entire operational configurations overnight.
              </p>

              <button
                onClick={handleNextToSeasonIdentity}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 px-8 py-3.5 font-bold text-white shadow-lg shadow-indigo-500/25 transition-transform hover:from-indigo-400 hover:to-blue-500 active:scale-95"
              >
                I understand, let&apos;s build one <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {step === "season_identity" && (
          <div className="animate-in fade-in slide-in-from-bottom-8 mx-auto w-full max-w-3xl duration-700">
            <div className="mb-10 text-center">
              <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Name Your First Season
              </h1>
              <p className="text-lg text-zinc-400">
                Define the timeframe and identity for your initial setup.
              </p>
            </div>

            <div className="group relative overflow-hidden rounded-3xl border border-white/5 bg-[#111] p-6 shadow-xl transition-colors hover:border-white/10 sm:p-8">
              <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-400 opacity-50"></div>
              <div className="space-y-6">
                <div>
                  <label className="mb-2 block text-xs font-bold tracking-wider text-zinc-500 uppercase">
                    Season Name
                  </label>
                  <input
                    value={workspaceData.seasonName}
                    onChange={(e) =>
                      setWorkspaceData({ ...workspaceData, seasonName: e.target.value })
                    }
                    className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white transition-colors outline-none focus:border-emerald-500"
                    placeholder="e.g. Core Operations or Summer 2024"
                  />
                  <p className="mt-2 text-xs text-zinc-500">
                    Used internally and for your staff to identify the current active configuration.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-bold tracking-wider text-zinc-500 uppercase">
                      Start Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={workspaceData.seasonStartDate}
                      onChange={(e) =>
                        setWorkspaceData({ ...workspaceData, seasonStartDate: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white [color-scheme:dark] transition-colors outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-bold tracking-wider text-zinc-500 uppercase">
                      End Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={workspaceData.seasonEndDate}
                      onChange={(e) =>
                        setWorkspaceData({ ...workspaceData, seasonEndDate: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white [color-scheme:dark] transition-colors outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold tracking-wider text-zinc-500 uppercase">
                    Season Type
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() =>
                        setWorkspaceData({ ...workspaceData, seasonType: "Permanent" })
                      }
                      className={`rounded-xl border-2 p-4 text-left transition-colors ${workspaceData.seasonType === "Permanent" ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-white/10 bg-black/50 text-zinc-400 hover:border-white/30"}`}
                    >
                      <div className="mb-1 font-bold">Permanent Season</div>
                      <div className="text-xs opacity-70">
                        A continuous baseline configuration. You can always archive it or spin up a
                        new season later.
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setWorkspaceData({ ...workspaceData, seasonType: "Temporal" })}
                      className={`rounded-xl border-2 p-4 text-left transition-colors ${workspaceData.seasonType === "Temporal" ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-white/10 bg-black/50 text-zinc-400 hover:border-white/30"}`}
                    >
                      <div className="mb-1 font-bold">Temporal Season</div>
                      <div className="text-xs opacity-70">
                        Strict temporal bounds (e.g. Summer 2024). Perfect for pop-ups or
                        high-season changes.
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10 flex justify-between">
              <button
                onClick={() => setStep("season_education")}
                className="rounded-xl border border-white/10 px-6 py-3.5 font-medium text-white transition-colors hover:bg-white/5"
              >
                Back
              </button>
              <button
                onClick={handleNextToDepartments}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-8 py-3.5 font-bold text-white shadow-lg shadow-emerald-500/25 transition-transform hover:from-emerald-400 hover:to-teal-500 active:scale-95"
              >
                Setup Departments <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {step === "departments" && (
          <div className="animate-in fade-in slide-in-from-bottom-8 mx-auto w-full max-w-3xl duration-700">
            <div className="mb-10 text-center">
              <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Define Departments
              </h1>
              <p className="mx-auto max-w-4xl text-lg text-zinc-400">
                What is a department? It&apos;s a dedicated area with its own shift plan and
                procedures. Within a Season, departments help you organize and schedule staff
                accurately.
              </p>
            </div>

            <div className="group relative mb-6 overflow-hidden rounded-3xl border border-white/5 bg-[#111] p-6 shadow-xl transition-colors hover:border-white/10 sm:p-8">
              <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-orange-500 to-amber-500 opacity-50"></div>

              <h3 className="mb-4 text-xl font-bold text-white">
                Active Departments ({workspaceData.departments.length})
              </h3>

              {workspaceData.departments.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/10 bg-black/20 py-12">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
                    <Building2 className="text-zinc-500" size={24} />
                  </div>
                  <p className="font-medium text-zinc-400">No departments installed yet.</p>
                  <p className="mt-1 mb-4 text-sm text-zinc-500">
                    Click a suggestion below or create a custom one.
                  </p>
                  <button
                    onClick={() => {
                      const newDepts = [
                        ...workspaceData.departments,
                        { name: "New Department", description: "", teams: [] },
                      ];
                      setWorkspaceData({ ...workspaceData, departments: newDepts });
                      setEditingDepartmentIndex(newDepts.length - 1);
                      setIsDepartmentDrawerOpen(true);
                    }}
                    className="rounded-lg border border-orange-500/30 bg-orange-500/20 px-4 py-2 font-medium text-orange-400 transition-colors hover:bg-orange-500/30"
                  >
                    + Create Custom Department
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {workspaceData.departments.map((dept: CoreDepartment, idx: number) => {
                    const isActive = dept.isSeasonActive !== false;
                    return (
                      <div
                        key={idx}
                        className={`flex flex-col justify-between gap-4 rounded-xl border p-4 transition-colors sm:flex-row sm:items-center ${isActive ? "border-orange-500/30 bg-orange-500/10" : "border-white/10 bg-black/40 opacity-70"}`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-md ${isActive ? "bg-orange-500/20 text-orange-400" : "bg-white/5 text-zinc-500"}`}
                          >
                            <CheckCircle2 size={16} />
                          </div>
                          <div>
                            <span
                              className={`font-bold ${isActive ? "text-white" : "text-zinc-400"}`}
                            >
                              {dept.name}
                            </span>
                            {!isActive && (
                              <div className="mt-0.5 text-xs text-zinc-500">
                                Not used in {workspaceData.seasonName}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="ml-11 flex items-center gap-3 sm:ml-0">
                          <label className="flex cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isActive}
                              onChange={(e) => {
                                const newDepts = [...workspaceData.departments];
                                newDepts[idx]!.isSeasonActive = e.target.checked;
                                setWorkspaceData({ ...workspaceData, departments: newDepts });
                              }}
                              className="h-4 w-4 accent-orange-500"
                            />
                            <span className="text-sm font-medium text-zinc-400">Use in Season</span>
                          </label>
                          <div className="hidden h-6 w-px bg-white/10 sm:block"></div>
                          <button
                            onClick={() => {
                              const newDepts = [...workspaceData.departments];
                              newDepts.splice(idx, 1);
                              setWorkspaceData({ ...workspaceData, departments: newDepts });
                            }}
                            className="text-sm text-zinc-500 transition-colors hover:text-red-400"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <button
                    onClick={() => {
                      const newDepts = [
                        ...workspaceData.departments,
                        {
                          name: "New Department",
                          description: "",
                          teams: [],
                          isSeasonActive: true,
                        },
                      ];
                      setWorkspaceData({ ...workspaceData, departments: newDepts });
                      setEditingDepartmentIndex(newDepts.length - 1);
                      setIsDepartmentDrawerOpen(true);
                    }}
                    className="flex h-full min-h-[72px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-black/40 text-zinc-400 transition-colors hover:border-white/40 hover:bg-white/5"
                  >
                    <span className="text-sm font-medium">+ Add Custom</span>
                  </button>
                </div>
              )}
            </div>

            {/* Suggestions Block */}
            <div className="mb-10">
              <h4 className="mb-3 ml-2 text-sm font-bold tracking-wider text-zinc-500 uppercase">
                Recommended for your industry
              </h4>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {["Kitchen", "Front of House", "Management", "Bar", "Housekeeping", "Events"].map(
                  (dept) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const isInstalled = workspaceData.departments.some((d: any) => d.name === dept);
                    if (isInstalled) return null;

                    return (
                      <div
                        key={dept}
                        onClick={() => {
                          setWorkspaceData({
                            ...workspaceData,
                            departments: [
                              ...workspaceData.departments,
                              { name: dept, description: "", isSeasonActive: true, teams: [] },
                            ],
                          });
                        }}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-black/40 p-4 transition-all outline-none hover:border-orange-500/50 hover:bg-orange-500/5"
                      >
                        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border border-white/20 bg-zinc-800 text-zinc-400">
                          <Plus size={14} />
                        </div>
                        <span className="text-sm font-medium text-zinc-300">{dept}</span>
                      </div>
                    );
                  },
                )}
              </div>
            </div>

            <div className="mt-10 flex justify-between">
              <button
                onClick={() => setStep("season_identity")}
                className="rounded-xl border border-white/10 px-6 py-3.5 font-medium text-white transition-colors hover:bg-white/5"
              >
                Back
              </button>
              <button
                onClick={handleNextToTeams}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-8 py-3.5 font-bold text-white shadow-lg shadow-emerald-500/25 transition-transform hover:from-emerald-400 hover:to-teal-500 active:scale-95"
              >
                Setup Teams <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {step === "teams" && (
          <div className="animate-in fade-in slide-in-from-bottom-8 mx-auto w-full max-w-3xl duration-700">
            <div className="mb-10 text-center">
              <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Define Teams
              </h1>
              <p className="mx-auto max-w-4xl text-lg text-zinc-400">
                If Departments are the &quot;areas,&quot; Teams are the &quot;people.&quot; For
                example, the Kitchen department might have &quot;Chefs&quot; and
                &quot;Dishwashers&quot; teams.
              </p>
            </div>

            <div className="group relative mb-6 overflow-hidden rounded-3xl border border-white/5 bg-[#111] p-6 shadow-xl transition-colors hover:border-white/10 sm:p-8">
              <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-500 opacity-50"></div>

              <h3 className="mb-4 text-xl font-bold text-white">Teams Setup</h3>

              {workspaceData.departments.length === 0 ? (
                <div className="rounded-xl border border-white/5 bg-black/40 py-8 text-center">
                  <p className="text-zinc-500">You haven&apos;t defined any departments yet.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {workspaceData.departments.map((dept: CoreDepartment, deptIdx: number) => {
                    if (dept.isSeasonActive === false) return null;
                    return (
                      <div
                        key={deptIdx}
                        className="rounded-xl border border-white/10 bg-black/40 p-5"
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <h4 className="flex items-center gap-2 font-bold text-white">
                            <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                            {dept.name}
                          </h4>
                          <button
                            onClick={() => {
                              const newDepts = [...workspaceData.departments];
                              const currentTeams = newDepts[deptIdx]!.teams || [];

                              // Pre-assumptions logic
                              let newTeamName = "New Team";
                              if (
                                dept.name === "Housekeeping" &&
                                workspaceData.industry?.toLowerCase().includes("hotell")
                              ) {
                                newTeamName = "Room Cleaners"; // Example pre-assumption based on industry and dept
                              } else if (dept.name === "Kitchen") {
                                newTeamName = "Chefs";
                              }

                              newDepts[deptIdx]!.teams = [
                                ...currentTeams,
                                { name: newTeamName, description: "" },
                              ];
                              setWorkspaceData({ ...workspaceData, departments: newDepts });
                              setEditingTeamIndex({ deptIdx, teamIdx: currentTeams.length }); // Points to the index of newly pushed item
                              setIsTeamDrawerOpen(true);
                            }}
                            className="rounded-md bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/20"
                          >
                            + Add Team
                          </button>
                        </div>

                        {/* List mapped teams representing the real data */}
                        <div className="flex flex-wrap gap-2">
                          {dept.teams && dept.teams.length > 0 ? (
                            dept.teams.map((team: CoreTeam, teamIdx: number) => (
                              <div
                                key={teamIdx}
                                onClick={() => {
                                  setEditingTeamIndex({ deptIdx, teamIdx });
                                  setIsTeamDrawerOpen(true);
                                }}
                                className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/10"
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                                {team.name}
                              </div>
                            ))
                          ) : (
                            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-500">
                              No teams added
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-8 border-t border-white/10 pt-8">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h4 className="flex items-center gap-2 font-bold text-white">
                      <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                      Cross-Department Teams
                    </h4>
                    <p className="mt-1 max-w-xl text-xs text-zinc-400">
                      Teams that operate across multiple departments (e.g., Management). Note: these
                      cannot be the primary team for an employee.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const newTeams = [...(workspaceData.multiDepartmentTeams || [])];
                      newTeams.push({
                        name: "New Cross-Department Team",
                        description: "",
                        isMultiDepartment: true,
                      });
                      setWorkspaceData({ ...workspaceData, multiDepartmentTeams: newTeams });
                      setEditingTeamIndex({ deptIdx: -1, teamIdx: newTeams.length - 1 });
                      setIsTeamDrawerOpen(true);
                    }}
                    className="shrink-0 rounded-md bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-400 transition-colors hover:bg-purple-500/20"
                  >
                    + Add Team
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {workspaceData.multiDepartmentTeams &&
                  workspaceData.multiDepartmentTeams.length > 0 ? (
                    workspaceData.multiDepartmentTeams.map((team: CoreTeam, teamIdx: number) => (
                      <div
                        key={teamIdx}
                        onClick={() => {
                          setEditingTeamIndex({ deptIdx: -1, teamIdx });
                          setIsTeamDrawerOpen(true);
                        }}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/10"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-purple-500"></span>
                        {team.name}
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-500">
                      No cross-department teams added
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-10 flex justify-between">
              <button
                onClick={() => setStep("departments")}
                className="rounded-xl border border-white/10 px-6 py-3.5 font-medium text-white transition-colors hover:bg-white/5"
              >
                Back
              </button>
              <button
                onClick={handleNextToLocations}
                className="flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-3.5 font-bold text-black shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-transform hover:bg-zinc-200 active:scale-95"
              >
                Verify Locations <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {step === "locations" && (
          <div className="animate-in fade-in slide-in-from-bottom-8 mx-auto w-full max-w-3xl duration-700">
            <div className="mb-10 text-center">
              <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Setup Locations
              </h1>
              <p className="text-lg text-zinc-400">
                Define where your business operates physically.
              </p>
            </div>

            <div className="group relative overflow-hidden rounded-3xl border border-white/5 bg-[#111] p-6 shadow-xl transition-colors hover:border-white/10 sm:p-8">
              <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-red-500 to-rose-500 opacity-50"></div>

              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/20 text-red-500">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <div className="font-bold text-white">Main Office / Headquarters</div>
                      <div className="text-sm text-zinc-500">
                        {workspaceData.address || "Add address..."}
                      </div>
                    </div>
                  </div>
                </div>
                {workspaceData.locations.map((loc: CoreLocation, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-500/20 text-zinc-400">
                        <Building2 size={20} />
                      </div>
                      <div>
                        <div className="font-bold text-white">{loc.name}</div>
                        <div className="text-sm text-zinc-500">
                          {loc.description || "No description"}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setEditingLocationIndex(idx);
                        setIsLocationDrawerOpen(true);
                      }}
                      className="text-sm text-zinc-400 transition-colors hover:text-white"
                    >
                      Edit
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  const newLocs = [
                    ...workspaceData.locations,
                    { name: "New Location", description: "" },
                  ];
                  setWorkspaceData({ ...workspaceData, locations: newLocs });
                  setEditingLocationIndex(newLocs.length - 1);
                  setIsLocationDrawerOpen(true);
                }}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/10 py-4 text-zinc-400 transition-colors hover:border-white/30 hover:text-white"
              >
                + Add another Location
              </button>
            </div>

            <div className="mt-10 flex justify-between">
              <button
                onClick={() => setStep("teams")}
                className="rounded-xl border border-white/10 px-6 py-3.5 font-medium text-white transition-colors hover:bg-white/5"
              >
                Back
              </button>
              <button
                onClick={handleNextToProcedures}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 px-8 py-3.5 font-bold text-white shadow-lg shadow-red-500/25 transition-transform hover:from-red-400 hover:to-rose-500 active:scale-95"
              >
                Setup Procedures <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {step === "procedures" && (
          <div className="animate-in fade-in slide-in-from-bottom-8 mx-auto w-full max-w-3xl duration-700">
            <div className="mb-10 text-center">
              <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Define Procedures
              </h1>
              <p className="text-lg text-zinc-400">
                Set up the standard operating procedures and tasks for your departments, assigning
                urgency and priority.
              </p>
            </div>

            <div className="group relative overflow-hidden rounded-3xl border border-white/5 bg-[#111] p-6 shadow-xl transition-colors hover:border-white/10 sm:p-8">
              <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-purple-500 to-pink-500 opacity-50"></div>

              <h3 className="mb-4 text-xl font-bold text-white">Initial Tasks & Routines</h3>

              {workspaceData.departments.length === 0 ? (
                <div className="rounded-xl border border-white/5 bg-black/40 py-8 text-center">
                  <p className="text-zinc-500">
                    You must define departments before creating procedures.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {workspaceData.procedures.length > 0 ? (
                    workspaceData.procedures.map((proc: CoreProcedure, idx: number) => (
                      <div
                        key={idx}
                        className="relative cursor-pointer rounded-xl border border-white/10 bg-black/40 p-5 transition-colors hover:bg-black/60"
                        onClick={() => {
                          setEditingProcedureIndex(idx);
                          setIsProcedureDrawerOpen(true);
                        }}
                      >
                        <div
                          className={`absolute top-4 right-4 rounded px-2 py-1 text-xs font-bold uppercase ${
                            proc.urgency === "High"
                              ? "bg-red-500/20 text-red-500"
                              : proc.urgency === "Medium"
                                ? "bg-yellow-500/20 text-yellow-500"
                                : "bg-green-500/20 text-green-500"
                          }`}
                        >
                          {proc.urgency || "Normal"} Urgency
                        </div>
                        <h4 className="mb-1 font-bold text-white">{proc.title}</h4>
                        <p className="mb-4 text-sm text-zinc-400">
                          Assigned to:{" "}
                          <span className="text-zinc-200">{proc.assignedTo || "Unassigned"}</span>
                        </p>

                        <button className="text-sm text-purple-400 transition-colors hover:text-purple-300">
                          Edit Details
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="mb-4 rounded-xl border-2 border-dashed border-white/10 py-8 text-center">
                      <p className="text-zinc-500">No procedures created yet.</p>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      const newProcs = [
                        ...workspaceData.procedures,
                        {
                          title: "New Procedure",
                          description: "",
                          urgency: "Medium",
                          assignedTo: "",
                        },
                      ];
                      setWorkspaceData({ ...workspaceData, procedures: newProcs });
                      setEditingProcedureIndex(newProcs.length - 1);
                      setIsProcedureDrawerOpen(true);
                    }}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/10 py-4 text-zinc-400 transition-colors hover:border-white/30 hover:text-white"
                  >
                    + Create Custom Procedure
                  </button>
                </div>
              )}
            </div>

            <div className="mt-10 flex justify-between">
              <button
                onClick={() => setStep("locations")}
                className="rounded-xl border border-white/10 px-6 py-3.5 font-medium text-white transition-colors hover:bg-white/5"
              >
                Back
              </button>
              <button
                onClick={handleNextToReview}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 px-8 py-3.5 font-bold text-white shadow-lg shadow-purple-500/25 transition-transform hover:from-purple-400 hover:to-pink-500 active:scale-95"
              >
                Final Review <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {step === "battlefield_review" && (
          <div className="animate-in fade-in slide-in-from-bottom-8 mx-auto w-full max-w-4xl duration-700">
            <div className="mb-10 text-center">
              <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Battlefield Review
              </h1>
              <p className="text-lg text-zinc-400">
                Is everything looking sharp, general? Here is the final battle plan.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Identity Summary */}
              <div className="group relative overflow-hidden rounded-3xl border border-white/5 bg-[#111] p-6 shadow-xl transition-colors hover:border-white/10 sm:p-8">
                <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-blue-500 to-cyan-400 opacity-50"></div>
                <h3 className="mb-6 text-xl font-bold text-white">Identity & Brand</h3>
                <div className="space-y-4 text-sm text-zinc-400">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="font-medium text-zinc-500">Name</span>
                    <span className="text-white">{workspaceData.name}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="font-medium text-zinc-500">Org Num</span>
                    <span className="text-white">{orgNumberInput || "Not verified"}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="font-medium text-zinc-500">Tone</span>
                    <span className="text-white">{workspaceData.communicationTone}</span>
                  </div>
                </div>
              </div>

              {/* Season Summary */}
              <div className="group relative overflow-hidden rounded-3xl border border-white/5 bg-[#111] p-6 shadow-xl transition-colors hover:border-white/10 sm:p-8">
                <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-400 opacity-50"></div>
                <h3 className="mb-6 text-xl font-bold text-white">Initial Season</h3>
                <div className="space-y-4 text-sm text-zinc-400">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="font-medium text-zinc-500">Season Name</span>
                    <span className="text-white">{workspaceData.seasonName}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="font-medium text-zinc-500">Type</span>
                    <span className="text-white">{workspaceData.seasonType}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="font-medium text-zinc-500">Departments</span>
                    <span className="text-white">
                      {workspaceData.departments.length} Configured
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10 flex justify-center gap-6">
              <button
                onClick={() => setStep("procedures")}
                className="rounded-xl border border-white/10 px-6 py-4 font-medium text-white transition-colors hover:bg-white/5"
              >
                Wait, go back
              </button>
              <button
                onClick={handleFinalize}
                className="flex items-center justify-center gap-2 rounded-xl bg-white px-10 py-4 font-bold text-black shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-transform hover:bg-zinc-200 active:scale-95"
              >
                Activate Workspace <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {step === "finalizing" && (
          <div className="animate-in fade-in fill-mode-both mx-auto flex w-full max-w-md flex-col items-center text-center duration-500">
            <div className="relative mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-blue-500/10">
              <div className="absolute inset-x-0 bottom-0 h-1/2 rounded-b-full bg-gradient-to-t from-blue-500/20 to-transparent"></div>
              <Loader2 size={40} className="animate-[spin_2s_linear_infinite] text-blue-500" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-white">Finalizing Workspace</h2>
            <p className="text-zinc-400">
              Saving structure, injecting policies, and spinning up your dashboard...
            </p>
          </div>
        )}

        {step === "done" && (
          <div className="animate-in zoom-in-95 fade-in mx-auto flex w-full max-w-md flex-col items-center text-center duration-500">
            <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.3)] ring-4 ring-emerald-500/20">
              <CheckCircle2 size={48} />
            </div>
            <h2 className="mb-4 text-3xl font-extrabold text-white">You&apos;re All Set!</h2>
            <p className="mb-8 text-zinc-400">Welcome to the future of hospitality management.</p>
            <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 font-bold text-zinc-900 shadow-xl transition-transform hover:bg-zinc-200 active:scale-95">
              Enter Dashboard <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
      {/* Right-Side Drawers (Overlays) */}
      {isDepartmentDrawerOpen &&
        editingDepartmentIndex !== null &&
        workspaceData.departments[editingDepartmentIndex] && (
          <div className="animate-in fade-in fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm duration-300">
            <div className="animate-in slide-in-from-right h-full w-full max-w-sm overflow-y-auto border-l border-white/10 bg-[#111] shadow-2xl duration-300 sm:max-w-md">
              <div className="p-6">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">Edit Department</h2>
                  <button
                    onClick={() => setIsDepartmentDrawerOpen(false)}
                    className="text-2xl leading-none text-zinc-400 transition-colors hover:text-white"
                  >
                    &times;
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-xs font-bold tracking-wider text-zinc-500 uppercase">
                      Internal Name
                    </label>
                    <input
                      value={workspaceData.departments[editingDepartmentIndex]!.name}
                      onChange={(e) => {
                        const newDepts = [...workspaceData.departments];
                        newDepts[editingDepartmentIndex]!.name = e.target.value;
                        setWorkspaceData({ ...workspaceData, departments: newDepts });
                      }}
                      className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white transition-colors outline-none focus:border-orange-500"
                      placeholder="e.g. Front of House"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-bold tracking-wider text-zinc-500 uppercase">
                      Description
                    </label>
                    <textarea
                      value={workspaceData.departments[editingDepartmentIndex]!.description || ""}
                      onChange={(e) => {
                        const newDepts = [...workspaceData.departments];
                        newDepts[editingDepartmentIndex]!.description = e.target.value;
                        setWorkspaceData({ ...workspaceData, departments: newDepts });
                      }}
                      className="min-h-[100px] w-full resize-y rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white transition-colors outline-none focus:border-orange-500"
                      placeholder="Internal description for this department..."
                    />
                  </div>
                </div>
                <div className="mt-8 flex justify-end">
                  <button
                    onClick={() => setIsDepartmentDrawerOpen(false)}
                    className="rounded-lg bg-orange-500 px-6 py-2.5 font-bold text-white transition-colors hover:bg-orange-400"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      {isTeamDrawerOpen &&
        editingTeamIndex !== null &&
        (() => {
          const isMulti = editingTeamIndex.deptIdx === -1;
          const dept = isMulti ? null : workspaceData.departments[editingTeamIndex.deptIdx];
          const teamList = isMulti ? workspaceData.multiDepartmentTeams : dept?.teams;
          const team = teamList?.[editingTeamIndex.teamIdx];

          if (!team) return null;

          return (
            <div className="animate-in fade-in fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm duration-300">
              <div className="animate-in slide-in-from-right h-full w-full max-w-sm overflow-y-auto border-l border-white/10 bg-[#111] shadow-2xl duration-300 sm:max-w-md">
                <div className="p-6">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-white">Edit Team</h2>
                      <p
                        className={`mt-1 text-xs font-medium tracking-wide uppercase ${isMulti ? "text-purple-400" : "text-blue-400"}`}
                      >
                        {isMulti ? "Cross-Department Team" : `In ${dept?.name}`}
                      </p>
                    </div>
                    <button
                      onClick={() => setIsTeamDrawerOpen(false)}
                      className="text-2xl leading-none text-zinc-400 transition-colors hover:text-white"
                    >
                      &times;
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 block text-xs font-bold tracking-wider text-zinc-500 uppercase">
                        Team Name
                      </label>
                      <input
                        value={team.name}
                        onChange={(e) => {
                          if (isMulti) {
                            const newTeams = [...(workspaceData.multiDepartmentTeams || [])];
                            newTeams[editingTeamIndex.teamIdx]!.name = e.target.value;
                            setWorkspaceData({ ...workspaceData, multiDepartmentTeams: newTeams });
                          } else {
                            const newDepts = [...workspaceData.departments];
                            newDepts[editingTeamIndex.deptIdx]!.teams![
                              editingTeamIndex.teamIdx
                            ]!.name = e.target.value;
                            setWorkspaceData({ ...workspaceData, departments: newDepts });
                          }
                        }}
                        className={`w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white transition-colors outline-none ${isMulti ? "focus:border-purple-500" : "focus:border-blue-500"}`}
                        placeholder={isMulti ? "e.g. Management" : "e.g. Chefs"}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-bold tracking-wider text-zinc-500 uppercase">
                        Description
                      </label>
                      <textarea
                        value={team.description || ""}
                        onChange={(e) => {
                          if (isMulti) {
                            const newTeams = [...(workspaceData.multiDepartmentTeams || [])];
                            newTeams[editingTeamIndex.teamIdx]!.description = e.target.value;
                            setWorkspaceData({ ...workspaceData, multiDepartmentTeams: newTeams });
                          } else {
                            const newDepts = [...workspaceData.departments];
                            newDepts[editingTeamIndex.deptIdx]!.teams![
                              editingTeamIndex.teamIdx
                            ]!.description = e.target.value;
                            setWorkspaceData({ ...workspaceData, departments: newDepts });
                          }
                        }}
                        className={`min-h-[100px] w-full resize-y rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white transition-colors outline-none ${isMulti ? "focus:border-purple-500" : "focus:border-blue-500"}`}
                        placeholder="Who makes up this team?"
                      />
                    </div>
                  </div>
                  <div className="mt-8 flex justify-end gap-3">
                    <button
                      onClick={() => {
                        if (isMulti) {
                          const newTeams = [...(workspaceData.multiDepartmentTeams || [])];
                          newTeams.splice(editingTeamIndex.teamIdx, 1);
                          setWorkspaceData({ ...workspaceData, multiDepartmentTeams: newTeams });
                        } else {
                          const newDepts = [...workspaceData.departments];
                          newDepts[editingTeamIndex.deptIdx]!.teams?.splice(
                            editingTeamIndex.teamIdx,
                            1,
                          );
                          setWorkspaceData({ ...workspaceData, departments: newDepts });
                        }
                        setIsTeamDrawerOpen(false);
                      }}
                      className="px-4 py-2.5 text-zinc-400 transition-colors hover:text-red-400"
                    >
                      Remove
                    </button>
                    <button
                      onClick={() => setIsTeamDrawerOpen(false)}
                      className={`${isMulti ? "bg-purple-500 hover:bg-purple-400" : "bg-blue-500 hover:bg-blue-400"} rounded-lg px-6 py-2.5 font-bold text-white transition-colors`}
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {isProcedureDrawerOpen &&
        editingProcedureIndex !== null &&
        workspaceData.procedures[editingProcedureIndex] && (
          <div className="animate-in fade-in fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm duration-300">
            <div className="animate-in slide-in-from-right h-full w-full max-w-sm overflow-y-auto border-l border-white/10 bg-[#111] shadow-2xl duration-300 sm:max-w-md">
              <div className="p-6">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">Edit Procedure</h2>
                  <button
                    onClick={() => setIsProcedureDrawerOpen(false)}
                    className="text-2xl leading-none text-zinc-400 transition-colors hover:text-white"
                  >
                    &times;
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-xs font-bold tracking-wider text-zinc-500 uppercase">
                      Procedure Title
                    </label>
                    <input
                      value={workspaceData.procedures[editingProcedureIndex]!.title}
                      onChange={(e) => {
                        const newProcs = [...workspaceData.procedures];
                        newProcs[editingProcedureIndex]!.title = e.target.value;
                        setWorkspaceData({ ...workspaceData, procedures: newProcs });
                      }}
                      className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white transition-colors outline-none focus:border-purple-500"
                      placeholder="e.g. Opening Checklist"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-bold tracking-wider text-zinc-500 uppercase">
                      Urgency Level
                    </label>
                    <select
                      value={workspaceData.procedures[editingProcedureIndex]!.urgency || "Medium"}
                      onChange={(e) => {
                        const newProcs = [...workspaceData.procedures];
                        newProcs[editingProcedureIndex]!.urgency = e.target.value;
                        setWorkspaceData({ ...workspaceData, procedures: newProcs });
                      }}
                      className="w-full appearance-none rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white transition-colors outline-none focus:border-purple-500"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-bold tracking-wider text-zinc-500 uppercase">
                      Assign to Department
                    </label>
                    <select
                      value={workspaceData.procedures[editingProcedureIndex]!.assignedTo || ""}
                      onChange={(e) => {
                        const newProcs = [...workspaceData.procedures];
                        newProcs[editingProcedureIndex]!.assignedTo = e.target.value;
                        setWorkspaceData({ ...workspaceData, procedures: newProcs });
                      }}
                      className="w-full appearance-none rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white transition-colors outline-none focus:border-purple-500"
                    >
                      <option value="">Unassigned</option>
                      {workspaceData.departments.map((d) => (
                        <option key={d.name} value={d.name}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-bold tracking-wider text-zinc-500 uppercase">
                      Instructions
                    </label>
                    <textarea
                      value={workspaceData.procedures[editingProcedureIndex]!.description || ""}
                      onChange={(e) => {
                        const newProcs = [...workspaceData.procedures];
                        newProcs[editingProcedureIndex]!.description = e.target.value;
                        setWorkspaceData({ ...workspaceData, procedures: newProcs });
                      }}
                      className="min-h-[120px] w-full resize-y rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white transition-colors outline-none focus:border-purple-500"
                      placeholder="Describe the steps..."
                    />
                  </div>
                </div>
                <div className="mt-8 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      const newProcs = [...workspaceData.procedures];
                      newProcs.splice(editingProcedureIndex, 1);
                      setWorkspaceData({ ...workspaceData, procedures: newProcs });
                      setIsProcedureDrawerOpen(false);
                    }}
                    className="px-4 py-2.5 text-zinc-400 transition-colors hover:text-red-400"
                  >
                    Remove
                  </button>
                  <button
                    onClick={() => setIsProcedureDrawerOpen(false)}
                    className="rounded-lg bg-purple-500 px-6 py-2.5 font-bold text-white transition-colors hover:bg-purple-400"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      {isLocationDrawerOpen &&
        editingLocationIndex !== null &&
        workspaceData.locations[editingLocationIndex] && (
          <div className="animate-in fade-in fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm duration-300">
            <div className="animate-in slide-in-from-right h-full w-full max-w-sm overflow-y-auto border-l border-white/10 bg-[#111] shadow-2xl duration-300 sm:max-w-md">
              <div className="p-6">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">Edit Location</h2>
                  <button
                    onClick={() => setIsLocationDrawerOpen(false)}
                    className="text-2xl leading-none text-zinc-400 transition-colors hover:text-white"
                  >
                    &times;
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-xs font-bold tracking-wider text-zinc-500 uppercase">
                      Location Name
                    </label>
                    <input
                      value={workspaceData.locations[editingLocationIndex]!.name}
                      onChange={(e) => {
                        const newLocs = [...workspaceData.locations];
                        newLocs[editingLocationIndex]!.name = e.target.value;
                        setWorkspaceData({ ...workspaceData, locations: newLocs });
                      }}
                      className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white transition-colors outline-none focus:border-red-500"
                      placeholder="e.g. Downtown Branch"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-bold tracking-wider text-zinc-500 uppercase">
                      Description / Address
                    </label>
                    <textarea
                      value={workspaceData.locations[editingLocationIndex]!.description || ""}
                      onChange={(e) => {
                        const newLocs = [...workspaceData.locations];
                        newLocs[editingLocationIndex]!.description = e.target.value;
                        setWorkspaceData({ ...workspaceData, locations: newLocs });
                      }}
                      className="min-h-[100px] w-full resize-y rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white transition-colors outline-none focus:border-red-500"
                      placeholder="Location details..."
                    />
                  </div>
                </div>
                <div className="mt-8 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      const newLocs = [...workspaceData.locations];
                      newLocs.splice(editingLocationIndex, 1);
                      setWorkspaceData({ ...workspaceData, locations: newLocs });
                      setIsLocationDrawerOpen(false);
                    }}
                    className="px-4 py-2.5 text-zinc-400 transition-colors hover:text-red-400"
                  >
                    Remove
                  </button>
                  <button
                    onClick={() => setIsLocationDrawerOpen(false)}
                    className="rounded-lg bg-red-500 px-6 py-2.5 font-bold text-white transition-colors hover:bg-red-400"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full min-h-screen w-full items-center justify-center bg-[#0a0a0c]">
          <Loader2 className="animate-spin text-cyan-500" size={32} />
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
