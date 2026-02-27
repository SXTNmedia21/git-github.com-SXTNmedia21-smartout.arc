"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@smartout/supabase/client";
import { Globe, Loader2, Bot, CheckCircle2, Building2, ArrowRight, FileText, Plus } from "lucide-react";

type WizardState = "init" | "crawling" | "org_verification" | "branding" | "season_education" | "season_identity" | "departments" | "teams" | "locations" | "procedures" | "battlefield_review" | "finalizing" | "done";

interface Policy {
    id: string;
    title: string;
    summary: string;
}

// Minimal interfaces to satisfy TS compiler while prototyping
interface CoreLocation { id?: string, name: string, description?: string, [key: string]: unknown; }
interface CoreTeam { id?: string, name: string, description?: string, roles?: string[], isMultiDepartment?: boolean, [key: string]: unknown; }
interface CoreDepartment { id?: string, name: string, description?: string, teams?: CoreTeam[], isSeasonActive?: boolean, [key: string]: unknown; }
interface CoreProcedure { id?: string, title: string, description?: string, urgency?: string, assignedTo?: string, [key: string]: unknown; }

function OnboardingContent() {
    const [step, setStep] = useState<WizardState>("init");
    const [urlInput, setUrlInput] = useState("");

    // Brreg Verification State
    const [orgNumberInput, setOrgNumberInput] = useState("");
    const [isVerifyingOrg, setIsVerifyingOrg] = useState(false);
    const [verifiedOrgData, setVerifiedOrgData] = useState<{ name: string; address: string; ceo: string; employeeCount?: string; industry?: string; description?: string } | null>(null);
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
        images: [] as { src: string, alt: string }[],
        menus: [] as { href: string, text: string }[],
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
    const [editingTeamIndex, setEditingTeamIndex] = useState<{ deptIdx: number, teamIdx: number } | null>(null);
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams, step]);

    const handleStartCrawling = async (e?: React.FormEvent, overrideUrl?: string) => {
        if (e) e.preventDefault();
        const targetUrl = overrideUrl || urlInput;
        if (!targetUrl.trim()) return;

        setStep("crawling");

        try {
            const { data, error } = await supabase.functions.invoke('gather-workspace-intelligence', {
                body: { url: targetUrl }
            });

            if (error) {
                console.warn("Invoke error details:", error);
                throw new Error("Edge Function Failed"); // Throws to catch block
            }

            const { scrapedData, brregData, sessionId } = data;

            // Auto-generate some base policies based on data
            const generatedPolicies = [
                { id: "1", title: "Standard Opening Routine", summary: "Daily unlock and setup checklist adjusted for your locations." },
                { id: "2", title: "Health & Safety (HACCP) Base", summary: "Required temperature checks and hygiene routines applicable to all food-handling departments." }
            ];

            setWorkspaceData({
                name: brregData?.navn || scrapedData?.companyName || "",
                website: "",
                email: scrapedData?.email || "",
                phone: scrapedData?.phone || "",
                address: brregData?.forretningsadresse ? `${brregData.forretningsadresse.adresse?.[0] || ''}, ${brregData.forretningsadresse.postnummer || ''} ${brregData.forretningsadresse.poststed || ''}`.trim() : "",
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
                seasonType: "Permanent"
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
                    summary: "A premium hotel experience combining classic luxury with modern comfort in the heart of Oslo.",
                    slogan: "Classic luxury in Oslo",
                    locations: [
                        { id: "1", name: "Main Dining", type: "Indoor", function: "", isComplete: true },
                        { id: "2", name: "Terrace Bar", type: "Outdoor", function: "", isComplete: true }
                    ],
                    departments: [
                        { id: "1", name: "Kitchen", roles: ["Executive Chef", "Sous Chef", "Line Cook"], description: "", isSeasonActive: true, isComplete: true },
                        { id: "2", name: "Floor", roles: ["Head Waiter", "Bartender"], description: "", isSeasonActive: true, isComplete: true }
                    ],
                    multiDepartmentTeams: [],
                    procedures: [],
                    policies: [
                        { id: "1", title: "Standard Opening Routine", summary: "Daily unlock and setup checklist. Automatically generated based on your location configuration." }
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
                    seasonType: "Permanent"
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
        const cleanOrg = orgNumberInput.replace(/\D/g, '');
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
                const rolesRes = await fetch(`https://data.brreg.no/enhetsregisteret/api/enheter/${cleanOrg}/roller`);
                if (rolesRes.ok) {
                    const rolesData = await rolesRes.json();
                    const ceoRole = rolesData.rollegrupper?.find((rg: { type: { kode: string } }) => rg.type.kode === 'DAGL');
                    if (ceoRole && ceoRole.roller && ceoRole.roller.length > 0) {
                        const person = ceoRole.roller[0].person;
                        if (person) {
                            ceoName = `${person.navn.fornavn} ${person.navn.mellomnavn ? person.navn.mellomnavn + ' ' : ''}${person.navn.etternavn}`;
                        }
                    }
                }
            } catch (e) {
                console.error("Kunne ikke hente roller:", e);
            }

            const addressLine = data.forretningsadresse ?
                `${data.forretningsadresse.adresse?.[0] || ''}, ${data.forretningsadresse.postnummer || ''} ${data.forretningsadresse.poststed || ''}`.trim() : "Ingen adresse registrert";

            const employeeCount = data.antallAnsatte ? data.antallAnsatte.toString() : "";
            const industry = data.naeringskode1 ? data.naeringskode1.beskrivelse : "";
            const description = data.vedtektsfestetFormaal ? data.vedtektsfestetFormaal.join("\n") : (data.aktivitet ? data.aktivitet.join("\n") : "");

            setVerifiedOrgData({
                name: data.navn,
                address: addressLine,
                ceo: ceoName,
                employeeCount,
                industry,
                description
            });

            // Auto-update workspace name if we found a match
            setWorkspaceData(prev => ({
                ...prev,
                name: data.navn,
                address: addressLine,
                ceo: ceoName,
                employeeCount,
                industry,
                concept: description
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
                    .from('workspace')
                    .select('company_id')
                    .eq('workspace_id', tempWorkspaceId)
                    .single();

                if (wsData?.company_id) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (supabase as any)
                        .from('company')
                        .update({ org_number: orgNumberInput })
                        .eq('company_id', wsData.company_id);
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
            const { error: invokeError } = await supabase.functions.invoke('activate-workspace', {
                body: { workspaceData }
            });

            if (invokeError) throw new Error(invokeError.message || "Failed to finalize workspace");

            setStep("done");
        } catch (err: unknown) {
            console.error("Finalization error:", err);
            setError(err instanceof Error ? err.message : "An error occurred while setting up your workspace.");
            setStep("battlefield_review"); // Fallback to review step on error
        }
    };

    return (
        <div className="w-full h-full bg-[#0a0a0c] text-zinc-300 font-sans relative flex flex-col justify-center items-center selection:bg-cyan-500/30">
            {/* Ambient Background */}
            <div className="absolute inset-0 pointer-events-none z-0">
                <div className="absolute top-0 right-1/4 w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[120px] -translate-y-1/2" />
                <div className="absolute bottom-0 left-1/4 w-[800px] h-[800px] bg-purple-600/10 rounded-full blur-[120px] translate-y-1/2" />
            </div>

            <div className="relative z-10 w-full max-w-5xl mx-auto px-6 py-12 flex flex-col justify-center">



                {step === "init" && (
                    <div className="w-full max-w-xl mx-auto flex flex-col items-center text-center">
                        <div className="w-20 h-20 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-8 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                            <Bot size={40} />
                        </div>
                        <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 tracking-tight">Let&apos;s build your workspace.</h1>
                        <p className="text-lg text-zinc-400 mb-12">Provide your company&apos;s website address and we&apos;ll automatically generate your structure, departments, and core policies.</p>

                        <form onSubmit={handleStartCrawling} className="w-full flex justify-center flex-col gap-4">
                            <div className="relative flex items-center bg-[#111] border border-white/10 rounded-2xl overflow-hidden focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-500 transition-all shadow-xl">
                                <div className="pl-6 pr-2 text-zinc-500 flex items-center select-none">
                                    <Globe size={20} className="mr-2" />
                                    <span className="text-base font-medium">https://</span>
                                </div>
                                <input
                                    type="text"
                                    value={urlInput}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/^https?:\/\//i, '');
                                        setUrlInput(val);
                                    }}
                                    placeholder="your-webpage.com"
                                    className="w-full bg-transparent py-5 pr-6 text-lg outline-none placeholder:text-zinc-600 text-white font-medium"
                                    autoComplete="off"
                                    autoCorrect="off"
                                    autoCapitalize="off"
                                    spellCheck="false"
                                />
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4 mt-4">
                                <button
                                    type="submit"
                                    className="flex-1 bg-white hover:bg-zinc-200 text-zinc-900 font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-white/10"
                                    disabled={!urlInput.trim()}
                                >
                                    Scan & Generate <ArrowRight size={18} />
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSkip}
                                    className="sm:w-auto w-full px-8 bg-zinc-900 hover:bg-zinc-800 text-white font-medium py-4 rounded-xl transition-colors border border-white/5"
                                >
                                    Skip text
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {step === "crawling" && (
                    <div className="w-full max-w-md mx-auto flex flex-col items-center text-center">
                        <div className="w-24 h-24 mb-8 relative flex items-center justify-center">
                            <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-cyan-500 rounded-full border-t-transparent animate-spin"></div>
                            <Globe className="w-8 h-8 text-cyan-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Analyzing {urlInput || "your site"}...</h2>
                        <p className="text-zinc-400">Extracting company structure, locations, and generating standard operational policies.</p>
                    </div>
                )}

                {step === "org_verification" && (
                    <div className="w-full max-w-2xl mx-auto flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="w-20 h-20 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-6 shadow-[0_0_30px_rgba(59,130,246,0.15)]">
                            <Building2 size={32} />
                        </div>
                        <h2 className="text-3xl font-extrabold text-white mb-3">Verify Company Identity</h2>
                        <p className="text-zinc-400 mb-8">Enter your Norwegian organization number to pull official public records for your workspace.</p>

                        {!verifiedOrgData ? (
                            <form onSubmit={handleVerifyOrg} className="w-full">
                                <div className="space-y-4">
                                    <div className="relative flex items-center bg-[#111] border border-white/10 rounded-2xl overflow-hidden focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-500 transition-all shadow-xl">
                                        <input
                                            type="text"
                                            value={orgNumberInput}
                                            onChange={(e) => setOrgNumberInput(e.target.value)}
                                            placeholder="Organisasjonsnummer (9 siffer)"
                                            className="w-full bg-transparent p-5 text-lg outline-none placeholder:text-zinc-600 text-white font-medium text-center"
                                            maxLength={11}
                                        />
                                    </div>
                                    {orgError && (
                                        <p className="text-red-400 text-sm font-medium">{orgError}</p>
                                    )}
                                    <button
                                        type="submit"
                                        disabled={isVerifyingOrg || !orgNumberInput}
                                        className="w-full bg-white hover:bg-zinc-200 text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-50"
                                    >
                                        {isVerifyingOrg ? <Loader2 className="animate-spin" size={20} /> : "Search Brønnøysundregistrene"}
                                    </button>
                                </div>
                                <button type="button" onClick={() => setStep("branding")} className="mt-6 text-sm text-zinc-500 hover:text-white transition-colors">
                                    Skip this step for now
                                </button>
                            </form>
                        ) : (
                            <div className="w-full text-left bg-[#111] border border-cyan-500/30 rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-2xl shadow-cyan-900/10">
                                <div className="absolute top-0 right-0 p-4">
                                    <CheckCircle2 className="text-green-500" size={24} />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-6 pr-8">{verifiedOrgData.name}</h3>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8">
                                    <div className="space-y-4">
                                        <div className="flex flex-col">
                                            <span className="text-xs uppercase font-bold text-zinc-500">Org Num</span>
                                            <span className="text-zinc-300 font-mono">{orgNumberInput}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs uppercase font-bold text-zinc-500">Forretningsadresse</span>
                                            <span className="text-zinc-300">{verifiedOrgData.address}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs uppercase font-bold text-zinc-500">Daglig Leder</span>
                                            <span className="text-zinc-300">{verifiedOrgData.ceo}</span>
                                        </div>
                                        {verifiedOrgData.industry && (
                                            <div className="flex flex-col">
                                                <span className="text-xs uppercase font-bold text-zinc-500">Industry</span>
                                                <span className="text-zinc-300">{verifiedOrgData.industry}</span>
                                            </div>
                                        )}
                                    </div>

                                    {verifiedOrgData.description && (
                                        <div className="flex flex-col bg-white/5 border border-white/10 rounded-xl p-4">
                                            <span className="text-xs uppercase font-bold text-zinc-500 mb-2">Description (Formål)</span>
                                            <span className="text-zinc-300 text-sm whitespace-pre-line leading-relaxed">{verifiedOrgData.description}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setVerifiedOrgData(null)}
                                        className="flex-1 px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium transition-colors"
                                    >
                                        Try Again
                                    </button>
                                    <button
                                        onClick={handleConfirmOrg}
                                        className="flex-[2] bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
                                    >
                                        Looks correct <ArrowRight size={18} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}


                {step === "branding" && (
                    <div className="w-full max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <div className="mb-10 text-center">
                            <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2 tracking-tight">Your Branding & Voice</h1>
                            <p className="text-zinc-400 text-lg">Set up your company&apos;s visual identity and communication style.</p>
                        </div>

                        <div className="flex flex-col gap-6">
                            <div className="bg-[#111] border border-white/5 rounded-3xl p-6 sm:p-8 relative overflow-hidden group hover:border-white/10 transition-colors shadow-xl">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500 opacity-50"></div>
                                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                                    <FileText className="text-purple-400" size={24} /> Company Summary & Images
                                </h3>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Company Logo</label>
                                        <div className="w-full h-32 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-zinc-500 hover:text-white hover:border-white/30 transition-colors cursor-pointer bg-black/30">
                                            <span className="text-sm font-medium">Click to upload or drag & drop</span>
                                            <span className="text-xs mt-1">PNG, JPG or SVG</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Company Slogan</label>
                                        <input
                                            value={workspaceData.slogan}
                                            onChange={e => setWorkspaceData({ ...workspaceData, slogan: e.target.value })}
                                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500 transition-colors"
                                            placeholder="e.g. Where quality meets service"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Brand Color</label>
                                        <div className="flex gap-4 items-center">
                                            <input
                                                type="color"
                                                value={workspaceData.brandColor || "#3B82F6"}
                                                onChange={e => setWorkspaceData({ ...workspaceData, brandColor: e.target.value })}
                                                className="w-12 h-12 rounded-xl cursor-pointer bg-black/50 border border-white/10"
                                            />
                                            <span className="text-sm font-mono text-zinc-400 bg-black/50 border border-white/10 px-4 py-3 rounded-xl">
                                                {workspaceData.brandColor || "#3B82F6"}
                                            </span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Communication Tone</label>
                                        <select
                                            value={workspaceData.communicationTone || "Professional & Formal"}
                                            onChange={e => setWorkspaceData({ ...workspaceData, communicationTone: e.target.value })}
                                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500 transition-colors appearance-none"
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
                                className="px-6 py-3.5 rounded-xl border border-white/10 hover:bg-white/5 text-white font-medium transition-colors"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleNextToSeasonEducation}
                                className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-400 hover:to-pink-500 text-white font-bold px-8 py-3.5 rounded-xl shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2 transition-transform active:scale-95"
                            >
                                Generate Contract & Proceed <CheckCircle2 size={18} />
                            </button>
                        </div>
                    </div>
                )}

                {step === "season_education" && (
                    <div className="w-full max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <div className="mb-10 text-center">
                            <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2 tracking-tight">The Concept of Seasons</h1>
                            <p className="text-zinc-400 text-lg">In Smartout, everything operates in Seasons. Reset budgets, update menus, and change setups seamlessly.</p>
                        </div>

                        <div className="bg-[#111] border border-white/5 rounded-3xl p-8 sm:p-10 relative overflow-hidden group shadow-xl flex flex-col items-center text-center">
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent pointer-events-none"></div>

                            <div className="w-24 h-24 bg-indigo-500/20 rounded-full flex items-center justify-center mb-8 border border-indigo-500/30">
                                <FileText size={40} className="text-indigo-400" />
                            </div>

                            <h2 className="text-2xl font-bold text-white mb-4">Why Seasons?</h2>
                            <p className="text-zinc-300 mb-8 max-w-lg leading-relaxed">
                                Instead of a continuously growing, unmanageable system, Smartout uses <strong>Seasons</strong>.
                                A Season can be permanent (like &quot;Core Operations&quot;) or temporal (like &quot;Summer 2024&quot;).
                                <br /><br />
                                This lets you archive past performance, assign seasonal staff cleanly, and switch entire operational configurations overnight.
                            </p>

                            <button
                                onClick={handleNextToSeasonIdentity}
                                className="bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 text-white font-bold px-8 py-3.5 rounded-xl shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-transform active:scale-95"
                            >
                                I understand, let&apos;s build one <ArrowRight size={18} />
                            </button>
                        </div>
                    </div>
                )}

                {step === "season_identity" && (
                    <div className="w-full max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <div className="mb-10 text-center">
                            <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2 tracking-tight">Name Your First Season</h1>
                            <p className="text-zinc-400 text-lg">Define the timeframe and identity for your initial setup.</p>
                        </div>

                        <div className="bg-[#111] border border-white/5 rounded-3xl p-6 sm:p-8 relative overflow-hidden group hover:border-white/10 transition-colors shadow-xl">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-400 opacity-50"></div>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Season Name</label>
                                    <input
                                        value={workspaceData.seasonName}
                                        onChange={e => setWorkspaceData({ ...workspaceData, seasonName: e.target.value })}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 transition-colors"
                                        placeholder="e.g. Core Operations or Summer 2024"
                                    />
                                    <p className="text-xs text-zinc-500 mt-2">Used internally and for your staff to identify the current active configuration.</p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Start Date (Optional)</label>
                                        <input
                                            type="date"
                                            value={workspaceData.seasonStartDate}
                                            onChange={e => setWorkspaceData({ ...workspaceData, seasonStartDate: e.target.value })}
                                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 transition-colors [color-scheme:dark]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">End Date (Optional)</label>
                                        <input
                                            type="date"
                                            value={workspaceData.seasonEndDate}
                                            onChange={e => setWorkspaceData({ ...workspaceData, seasonEndDate: e.target.value })}
                                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 transition-colors [color-scheme:dark]"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Season Type</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            type="button"
                                            onClick={() => setWorkspaceData({ ...workspaceData, seasonType: "Permanent" })}
                                            className={`p-4 rounded-xl border-2 text-left transition-colors ${workspaceData.seasonType === "Permanent" ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-white/10 bg-black/50 text-zinc-400 hover:border-white/30"}`}
                                        >
                                            <div className="font-bold mb-1">Permanent Season</div>
                                            <div className="text-xs opacity-70">A continuous baseline configuration. You can always archive it or spin up a new season later.</div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setWorkspaceData({ ...workspaceData, seasonType: "Temporal" })}
                                            className={`p-4 rounded-xl border-2 text-left transition-colors ${workspaceData.seasonType === "Temporal" ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-white/10 bg-black/50 text-zinc-400 hover:border-white/30"}`}
                                        >
                                            <div className="font-bold mb-1">Temporal Season</div>
                                            <div className="text-xs opacity-70">Strict temporal bounds (e.g. Summer 2024). Perfect for pop-ups or high-season changes.</div>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-10 flex justify-between">
                            <button
                                onClick={() => setStep("season_education")}
                                className="px-6 py-3.5 rounded-xl border border-white/10 hover:bg-white/5 text-white font-medium transition-colors"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleNextToDepartments}
                                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold px-8 py-3.5 rounded-xl shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-transform active:scale-95"
                            >
                                Setup Departments <ArrowRight size={18} />
                            </button>
                        </div>
                    </div>
                )}

                {step === "departments" && (
                    <div className="w-full max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <div className="mb-10 text-center">
                            <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2 tracking-tight">Define Departments</h1>
                            <p className="text-zinc-400 text-lg max-w-4xl mx-auto">
                                What is a department? It&apos;s a dedicated area with its own shift plan and procedures.
                                Within a Season, departments help you organize and schedule staff accurately.
                            </p>
                        </div>

                        <div className="bg-[#111] border border-white/5 rounded-3xl p-6 sm:p-8 relative overflow-hidden group hover:border-white/10 transition-colors shadow-xl mb-6">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-amber-500 opacity-50"></div>

                            <h3 className="text-xl font-bold text-white mb-4">Active Departments ({workspaceData.departments.length})</h3>

                            {workspaceData.departments.length === 0 ? (
                                <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-2xl bg-black/20">
                                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                                        <Building2 className="text-zinc-500" size={24} />
                                    </div>
                                    <p className="text-zinc-400 font-medium">No departments installed yet.</p>
                                    <p className="text-zinc-500 text-sm mt-1 mb-4">Click a suggestion below or create a custom one.</p>
                                    <button
                                        onClick={() => {
                                            const newDepts = [...workspaceData.departments, { name: "New Department", description: "", teams: [] }];
                                            setWorkspaceData({ ...workspaceData, departments: newDepts });
                                            setEditingDepartmentIndex(newDepts.length - 1);
                                            setIsDepartmentDrawerOpen(true);
                                        }}
                                        className="px-4 py-2 bg-orange-500/20 text-orange-400 font-medium rounded-lg hover:bg-orange-500/30 transition-colors border border-orange-500/30"
                                    >
                                        + Create Custom Department
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {workspaceData.departments.map((dept: CoreDepartment, idx: number) => {
                                        const isActive = dept.isSeasonActive !== false;
                                        return (
                                            <div key={idx} className={`border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${isActive ? "bg-orange-500/10 border-orange-500/30" : "bg-black/40 border-white/10 opacity-70"}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-md flex items-center justify-center ${isActive ? "bg-orange-500/20 text-orange-400" : "bg-white/5 text-zinc-500"}`}>
                                                        <CheckCircle2 size={16} />
                                                    </div>
                                                    <div>
                                                        <span className={`font-bold ${isActive ? "text-white" : "text-zinc-400"}`}>{dept.name}</span>
                                                        {!isActive && <div className="text-xs text-zinc-500 mt-0.5">Not used in {workspaceData.seasonName}</div>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 ml-11 sm:ml-0">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={isActive}
                                                            onChange={(e) => {
                                                                const newDepts = [...workspaceData.departments];
                                                                newDepts[idx].isSeasonActive = e.target.checked;
                                                                setWorkspaceData({ ...workspaceData, departments: newDepts });
                                                            }}
                                                            className="accent-orange-500 w-4 h-4"
                                                        />
                                                        <span className="text-sm font-medium text-zinc-400">Use in Season</span>
                                                    </label>
                                                    <div className="w-px h-6 bg-white/10 hidden sm:block"></div>
                                                    <button
                                                        onClick={() => {
                                                            const newDepts = [...workspaceData.departments];
                                                            newDepts.splice(idx, 1);
                                                            setWorkspaceData({ ...workspaceData, departments: newDepts });
                                                        }}
                                                        className="text-sm text-zinc-500 hover:text-red-400 transition-colors"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                    <button
                                        onClick={() => {
                                            const newDepts = [...workspaceData.departments, { name: "New Department", description: "", teams: [], isSeasonActive: true }];
                                            setWorkspaceData({ ...workspaceData, departments: newDepts });
                                            setEditingDepartmentIndex(newDepts.length - 1);
                                            setIsDepartmentDrawerOpen(true);
                                        }}
                                        className="h-full min-h-[72px] bg-black/40 border border-dashed border-white/20 rounded-xl flex items-center justify-center gap-2 cursor-pointer hover:border-white/40 hover:bg-white/5 transition-colors text-zinc-400"
                                    >
                                        <span className="font-medium text-sm">+ Add Custom</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Suggestions Block */}
                        <div className="mb-10">
                            <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-3 ml-2">Recommended for your industry</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {["Kitchen", "Front of House", "Management", "Bar", "Housekeeping", "Events"].map(dept => {
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    const isInstalled = workspaceData.departments.some((d: any) => d.name === dept);
                                    if (isInstalled) return null;

                                    return (
                                        <div
                                            key={dept}
                                            onClick={() => {
                                                setWorkspaceData({
                                                    ...workspaceData,
                                                    departments: [...workspaceData.departments, { name: dept, description: "", isSeasonActive: true, teams: [] }]
                                                });
                                            }}
                                            className="bg-black/40 border border-white/10 rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:border-orange-500/50 hover:bg-orange-500/5 transition-all outline-none"
                                        >
                                            <div className="w-6 h-6 rounded-md border border-white/20 flex flex-shrink-0 items-center justify-center bg-zinc-800 text-zinc-400">
                                                <Plus size={14} />
                                            </div>
                                            <span className="font-medium text-sm text-zinc-300">{dept}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="mt-10 flex justify-between">
                            <button
                                onClick={() => setStep("season_identity")}
                                className="px-6 py-3.5 rounded-xl border border-white/10 hover:bg-white/5 text-white font-medium transition-colors"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleNextToTeams}
                                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold px-8 py-3.5 rounded-xl shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-transform active:scale-95"
                            >
                                Setup Teams <ArrowRight size={18} />
                            </button>
                        </div>
                    </div>
                )}

                {step === "teams" && (
                    <div className="w-full max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <div className="mb-10 text-center">
                            <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2 tracking-tight">Define Teams</h1>
                            <p className="text-zinc-400 text-lg max-w-4xl mx-auto">
                                If Departments are the &quot;areas,&quot; Teams are the &quot;people.&quot; For example, the Kitchen department might have &quot;Chefs&quot; and &quot;Dishwashers&quot; teams.
                            </p>
                        </div>

                        <div className="bg-[#111] border border-white/5 rounded-3xl p-6 sm:p-8 relative overflow-hidden group hover:border-white/10 transition-colors shadow-xl mb-6">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-50"></div>

                            <h3 className="text-xl font-bold text-white mb-4">Teams Setup</h3>

                            {workspaceData.departments.length === 0 ? (
                                <div className="py-8 text-center bg-black/40 border border-white/5 rounded-xl">
                                    <p className="text-zinc-500">You haven&apos;t defined any departments yet.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {workspaceData.departments.map((dept: CoreDepartment, deptIdx: number) => {
                                        if (dept.isSeasonActive === false) return null;
                                        return (
                                            <div key={deptIdx} className="bg-black/40 border border-white/10 rounded-xl p-5">
                                                <div className="flex justify-between items-center mb-4">
                                                    <h4 className="font-bold text-white flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                                                        {dept.name}
                                                    </h4>
                                                    <button
                                                        onClick={() => {
                                                            const newDepts = [...workspaceData.departments];
                                                            const currentTeams = newDepts[deptIdx].teams || [];

                                                            // Pre-assumptions logic
                                                            let newTeamName = "New Team";
                                                            if (dept.name === "Housekeeping" && workspaceData.industry?.toLowerCase().includes("hotell")) {
                                                                newTeamName = "Room Cleaners"; // Example pre-assumption based on industry and dept
                                                            } else if (dept.name === "Kitchen") {
                                                                newTeamName = "Chefs";
                                                            }

                                                            newDepts[deptIdx].teams = [...currentTeams, { name: newTeamName, description: "" }];
                                                            setWorkspaceData({ ...workspaceData, departments: newDepts });
                                                            setEditingTeamIndex({ deptIdx, teamIdx: currentTeams.length }); // Points to the index of newly pushed item
                                                            setIsTeamDrawerOpen(true);
                                                        }}
                                                        className="text-xs px-3 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors rounded-md font-medium"
                                                    >
                                                        + Add Team
                                                    </button>
                                                </div>

                                                {/* List mapped teams representing the real data */}
                                                <div className="flex gap-2 flex-wrap">
                                                    {dept.teams && dept.teams.length > 0 ? (
                                                        dept.teams.map((team: CoreTeam, teamIdx: number) => (
                                                            <div
                                                                key={teamIdx}
                                                                onClick={() => {
                                                                    setEditingTeamIndex({ deptIdx, teamIdx });
                                                                    setIsTeamDrawerOpen(true);
                                                                }}
                                                                className="py-2 px-3 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-300 flex items-center gap-2 cursor-pointer hover:bg-white/10 transition-colors"
                                                            >
                                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                                                {team.name}
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="py-2 px-3 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-500 flex items-center gap-2">
                                                            No teams added
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            <div className="mt-8 border-t border-white/10 pt-8">
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <h4 className="font-bold text-white flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                                            Cross-Department Teams
                                        </h4>
                                        <p className="text-xs text-zinc-400 mt-1 max-w-xl">Teams that operate across multiple departments (e.g., Management). Note: these cannot be the primary team for an employee.</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const newTeams = [...(workspaceData.multiDepartmentTeams || [])];
                                            newTeams.push({ name: "New Cross-Department Team", description: "", isMultiDepartment: true });
                                            setWorkspaceData({ ...workspaceData, multiDepartmentTeams: newTeams });
                                            setEditingTeamIndex({ deptIdx: -1, teamIdx: newTeams.length - 1 });
                                            setIsTeamDrawerOpen(true);
                                        }}
                                        className="text-xs px-3 py-1.5 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors rounded-md font-medium shrink-0"
                                    >
                                        + Add Team
                                    </button>
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                    {(workspaceData.multiDepartmentTeams && workspaceData.multiDepartmentTeams.length > 0) ? (
                                        workspaceData.multiDepartmentTeams.map((team: CoreTeam, teamIdx: number) => (
                                            <div
                                                key={teamIdx}
                                                onClick={() => {
                                                    setEditingTeamIndex({ deptIdx: -1, teamIdx });
                                                    setIsTeamDrawerOpen(true);
                                                }}
                                                className="py-2 px-3 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-300 flex items-center gap-2 cursor-pointer hover:bg-white/10 transition-colors"
                                            >
                                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                                {team.name}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="py-2 px-3 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-500 flex items-center gap-2">
                                            No cross-department teams added
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mt-10 flex justify-between">
                            <button
                                onClick={() => setStep("departments")}
                                className="px-6 py-3.5 rounded-xl border border-white/10 hover:bg-white/5 text-white font-medium transition-colors"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleNextToLocations}
                                className="bg-white hover:bg-zinc-200 text-black font-bold px-8 py-3.5 rounded-xl shadow-[0_0_30px_rgba(255,255,255,0.2)] flex items-center justify-center gap-2 transition-transform active:scale-95"
                            >
                                Verify Locations <ArrowRight size={18} />
                            </button>
                        </div>
                    </div>
                )
                }

                {
                    step === "locations" && (
                        <div className="w-full max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700">
                            <div className="mb-10 text-center">
                                <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2 tracking-tight">Setup Locations</h1>
                                <p className="text-zinc-400 text-lg">Define where your business operates physically.</p>
                            </div>

                            <div className="bg-[#111] border border-white/5 rounded-3xl p-6 sm:p-8 relative overflow-hidden group hover:border-white/10 transition-colors shadow-xl">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-rose-500 opacity-50"></div>

                                <div className="space-y-4">
                                    <div className="bg-black/40 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-red-500/20 text-red-500 rounded-lg flex items-center justify-center">
                                                <Building2 size={20} />
                                            </div>
                                            <div>
                                                <div className="font-bold text-white">Main Office / Headquarters</div>
                                                <div className="text-sm text-zinc-500">{workspaceData.address || "Add address..."}</div>
                                            </div>
                                        </div>
                                    </div>
                                    {workspaceData.locations.map((loc: CoreLocation, idx: number) => (
                                        <div key={idx} className="bg-black/40 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-zinc-500/20 text-zinc-400 rounded-lg flex items-center justify-center">
                                                    <Building2 size={20} />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-white">{loc.name}</div>
                                                    <div className="text-sm text-zinc-500">{loc.description || "No description"}</div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setEditingLocationIndex(idx);
                                                    setIsLocationDrawerOpen(true);
                                                }}
                                                className="text-sm text-zinc-400 hover:text-white transition-colors"
                                            >
                                                Edit
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={() => {
                                        const newLocs = [...workspaceData.locations, { name: "New Location", description: "" }];
                                        setWorkspaceData({ ...workspaceData, locations: newLocs });
                                        setEditingLocationIndex(newLocs.length - 1);
                                        setIsLocationDrawerOpen(true);
                                    }}
                                    className="mt-6 w-full py-4 border-2 border-dashed border-white/10 hover:border-white/30 rounded-xl text-zinc-400 hover:text-white transition-colors flex justify-center items-center gap-2"
                                >
                                    + Add another Location
                                </button>
                            </div>

                            <div className="mt-10 flex justify-between">
                                <button
                                    onClick={() => setStep("teams")}
                                    className="px-6 py-3.5 rounded-xl border border-white/10 hover:bg-white/5 text-white font-medium transition-colors"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleNextToProcedures}
                                    className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 text-white font-bold px-8 py-3.5 rounded-xl shadow-lg shadow-red-500/25 flex items-center justify-center gap-2 transition-transform active:scale-95"
                                >
                                    Setup Procedures <ArrowRight size={18} />
                                </button>
                            </div>
                        </div>
                    )
                }

                {
                    step === "procedures" && (
                        <div className="w-full max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700">
                            <div className="mb-10 text-center">
                                <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2 tracking-tight">Define Procedures</h1>
                                <p className="text-zinc-400 text-lg">Set up the standard operating procedures and tasks for your departments, assigning urgency and priority.</p>
                            </div>

                            <div className="bg-[#111] border border-white/5 rounded-3xl p-6 sm:p-8 relative overflow-hidden group hover:border-white/10 transition-colors shadow-xl">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500 opacity-50"></div>

                                <h3 className="text-xl font-bold text-white mb-4">Initial Tasks & Routines</h3>

                                {workspaceData.departments.length === 0 ? (
                                    <div className="py-8 text-center bg-black/40 border border-white/5 rounded-xl">
                                        <p className="text-zinc-500">You must define departments before creating procedures.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {workspaceData.procedures.length > 0 ? (
                                            workspaceData.procedures.map((proc: CoreProcedure, idx: number) => (
                                                <div key={idx} className="bg-black/40 border border-white/10 rounded-xl p-5 relative cursor-pointer hover:bg-black/60 transition-colors" onClick={() => {
                                                    setEditingProcedureIndex(idx);
                                                    setIsProcedureDrawerOpen(true);
                                                }}>
                                                    <div className={`absolute top-4 right-4 text-xs font-bold px-2 py-1 rounded uppercase ${proc.urgency === 'High' ? 'bg-red-500/20 text-red-500' :
                                                        proc.urgency === 'Medium' ? 'bg-yellow-500/20 text-yellow-500' :
                                                            'bg-green-500/20 text-green-500'
                                                        }`}>
                                                        {proc.urgency || "Normal"} Urgency
                                                    </div>
                                                    <h4 className="font-bold text-white mb-1">{proc.title}</h4>
                                                    <p className="text-sm text-zinc-400 mb-4">Assigned to: <span className="text-zinc-200">{proc.assignedTo || "Unassigned"}</span></p>

                                                    <button className="text-sm text-purple-400 hover:text-purple-300 transition-colors">
                                                        Edit Details
                                                    </button>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="py-8 text-center border-2 border-dashed border-white/10 rounded-xl mb-4">
                                                <p className="text-zinc-500">No procedures created yet.</p>
                                            </div>
                                        )}

                                        <button
                                            onClick={() => {
                                                const newProcs = [...workspaceData.procedures, { title: "New Procedure", description: "", urgency: "Medium", assignedTo: "" }];
                                                setWorkspaceData({ ...workspaceData, procedures: newProcs });
                                                setEditingProcedureIndex(newProcs.length - 1);
                                                setIsProcedureDrawerOpen(true);
                                            }}
                                            className="mt-4 w-full py-4 border-2 border-dashed border-white/10 hover:border-white/30 rounded-xl text-zinc-400 hover:text-white transition-colors flex justify-center items-center gap-2"
                                        >
                                            + Create Custom Procedure
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="mt-10 flex justify-between">
                                <button
                                    onClick={() => setStep("locations")}
                                    className="px-6 py-3.5 rounded-xl border border-white/10 hover:bg-white/5 text-white font-medium transition-colors"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleNextToReview}
                                    className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-400 hover:to-pink-500 text-white font-bold px-8 py-3.5 rounded-xl shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2 transition-transform active:scale-95"
                                >
                                    Final Review <ArrowRight size={18} />
                                </button>
                            </div>
                        </div>
                    )
                }

                {
                    step === "battlefield_review" && (
                        <div className="w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700">
                            <div className="mb-10 text-center">
                                <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2 tracking-tight">Battlefield Review</h1>
                                <p className="text-zinc-400 text-lg">Is everything looking sharp, general? Here is the final battle plan.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Identity Summary */}
                                <div className="bg-[#111] border border-white/5 rounded-3xl p-6 sm:p-8 relative overflow-hidden group hover:border-white/10 transition-colors shadow-xl">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-400 opacity-50"></div>
                                    <h3 className="text-xl font-bold text-white mb-6">Identity & Brand</h3>
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
                                <div className="bg-[#111] border border-white/5 rounded-3xl p-6 sm:p-8 relative overflow-hidden group hover:border-white/10 transition-colors shadow-xl">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-400 opacity-50"></div>
                                    <h3 className="text-xl font-bold text-white mb-6">Initial Season</h3>
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
                                            <span className="text-white">{workspaceData.departments.length} Configured</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-10 flex justify-center gap-6">
                                <button
                                    onClick={() => setStep("procedures")}
                                    className="px-6 py-4 rounded-xl border border-white/10 hover:bg-white/5 text-white font-medium transition-colors"
                                >
                                    Wait, go back
                                </button>
                                <button
                                    onClick={handleFinalize}
                                    className="bg-white hover:bg-zinc-200 text-black font-bold px-10 py-4 rounded-xl shadow-[0_0_30px_rgba(255,255,255,0.2)] flex items-center justify-center gap-2 transition-transform active:scale-95"
                                >
                                    Activate Workspace <ArrowRight size={18} />
                                </button>
                            </div>
                        </div>
                    )
                }

                {
                    step === "finalizing" && (
                        <div className="w-full max-w-md mx-auto flex flex-col items-center text-center animate-in fade-in fill-mode-both duration-500">
                            <div className="w-24 h-24 mb-8 bg-blue-500/10 rounded-full flex items-center justify-center relative">
                                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-blue-500/20 to-transparent rounded-b-full"></div>
                                <Loader2 size={40} className="text-blue-500 animate-[spin_2s_linear_infinite]" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">Finalizing Workspace</h2>
                            <p className="text-zinc-400">Saving structure, injecting policies, and spinning up your dashboard...</p>
                        </div>
                    )
                }

                {
                    step === "done" && (
                        <div className="w-full max-w-md mx-auto flex flex-col items-center text-center animate-in zoom-in-95 fade-in duration-500">
                            <div className="w-24 h-24 mb-8 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-400 ring-4 ring-emerald-500/20 shadow-[0_0_40px_rgba(16,185,129,0.3)]">
                                <CheckCircle2 size={48} />
                            </div>
                            <h2 className="text-3xl font-extrabold text-white mb-4">You&apos;re All Set!</h2>
                            <p className="text-zinc-400 mb-8">Welcome to the future of hospitality management.</p>
                            <button className="bg-white hover:bg-zinc-200 text-zinc-900 font-bold px-8 py-4 rounded-xl transition-transform active:scale-95 shadow-xl w-full flex justify-center items-center gap-2">
                                Enter Dashboard <ArrowRight size={18} />
                            </button>
                        </div>
                    )
                }

            </div >
            {/* Right-Side Drawers (Overlays) */}
            {isDepartmentDrawerOpen && editingDepartmentIndex !== null && workspaceData.departments[editingDepartmentIndex] && (
                <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="w-full max-w-sm sm:max-w-md h-full bg-[#111] border-l border-white/10 shadow-2xl animate-in slide-in-from-right duration-300 overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-white">Edit Department</h2>
                                <button onClick={() => setIsDepartmentDrawerOpen(false)} className="text-zinc-400 hover:text-white transition-colors text-2xl leading-none">&times;</button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Internal Name</label>
                                    <input
                                        value={workspaceData.departments[editingDepartmentIndex].name}
                                        onChange={(e) => {
                                            const newDepts = [...workspaceData.departments];
                                            newDepts[editingDepartmentIndex].name = e.target.value;
                                            setWorkspaceData({ ...workspaceData, departments: newDepts });
                                        }}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-orange-500 transition-colors"
                                        placeholder="e.g. Front of House"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Description</label>
                                    <textarea
                                        value={workspaceData.departments[editingDepartmentIndex].description || ""}
                                        onChange={(e) => {
                                            const newDepts = [...workspaceData.departments];
                                            newDepts[editingDepartmentIndex].description = e.target.value;
                                            setWorkspaceData({ ...workspaceData, departments: newDepts });
                                        }}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-orange-500 transition-colors min-h-[100px] resize-y"
                                        placeholder="Internal description for this department..."
                                    />
                                </div>
                            </div>
                            <div className="mt-8 flex justify-end">
                                <button onClick={() => setIsDepartmentDrawerOpen(false)} className="bg-orange-500 hover:bg-orange-400 text-white font-bold px-6 py-2.5 rounded-lg transition-colors">Done</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isTeamDrawerOpen && editingTeamIndex !== null && (
                (() => {
                    const isMulti = editingTeamIndex.deptIdx === -1;
                    const dept = isMulti ? null : workspaceData.departments[editingTeamIndex.deptIdx];
                    const teamList = isMulti ? workspaceData.multiDepartmentTeams : dept?.teams;
                    const team = teamList?.[editingTeamIndex.teamIdx];

                    if (!team) return null;

                    return (
                        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
                            <div className="w-full max-w-sm sm:max-w-md h-full bg-[#111] border-l border-white/10 shadow-2xl animate-in slide-in-from-right duration-300 overflow-y-auto">
                                <div className="p-6">
                                    <div className="flex justify-between items-center mb-6">
                                        <div>
                                            <h2 className="text-xl font-bold text-white">Edit Team</h2>
                                            <p className={`text-xs font-medium tracking-wide uppercase mt-1 ${isMulti ? "text-purple-400" : "text-blue-400"}`}>
                                                {isMulti ? "Cross-Department Team" : `In ${dept?.name}`}
                                            </p>
                                        </div>
                                        <button onClick={() => setIsTeamDrawerOpen(false)} className="text-zinc-400 hover:text-white transition-colors text-2xl leading-none">&times;</button>
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Team Name</label>
                                            <input
                                                value={team.name}
                                                onChange={(e) => {
                                                    if (isMulti) {
                                                        const newTeams = [...(workspaceData.multiDepartmentTeams || [])];
                                                        newTeams[editingTeamIndex.teamIdx].name = e.target.value;
                                                        setWorkspaceData({ ...workspaceData, multiDepartmentTeams: newTeams });
                                                    } else {
                                                        const newDepts = [...workspaceData.departments];
                                                        newDepts[editingTeamIndex.deptIdx].teams![editingTeamIndex.teamIdx].name = e.target.value;
                                                        setWorkspaceData({ ...workspaceData, departments: newDepts });
                                                    }
                                                }}
                                                className={`w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none transition-colors ${isMulti ? "focus:border-purple-500" : "focus:border-blue-500"}`}
                                                placeholder={isMulti ? "e.g. Management" : "e.g. Chefs"}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Description</label>
                                            <textarea
                                                value={team.description || ""}
                                                onChange={(e) => {
                                                    if (isMulti) {
                                                        const newTeams = [...(workspaceData.multiDepartmentTeams || [])];
                                                        newTeams[editingTeamIndex.teamIdx].description = e.target.value;
                                                        setWorkspaceData({ ...workspaceData, multiDepartmentTeams: newTeams });
                                                    } else {
                                                        const newDepts = [...workspaceData.departments];
                                                        newDepts[editingTeamIndex.deptIdx].teams![editingTeamIndex.teamIdx].description = e.target.value;
                                                        setWorkspaceData({ ...workspaceData, departments: newDepts });
                                                    }
                                                }}
                                                className={`w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none transition-colors min-h-[100px] resize-y ${isMulti ? "focus:border-purple-500" : "focus:border-blue-500"}`}
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
                                                    newDepts[editingTeamIndex.deptIdx].teams?.splice(editingTeamIndex.teamIdx, 1);
                                                    setWorkspaceData({ ...workspaceData, departments: newDepts });
                                                }
                                                setIsTeamDrawerOpen(false);
                                            }}
                                            className="px-4 py-2.5 text-zinc-400 hover:text-red-400 transition-colors"
                                        >
                                            Remove
                                        </button>
                                        <button onClick={() => setIsTeamDrawerOpen(false)} className={`${isMulti ? "bg-purple-500 hover:bg-purple-400" : "bg-blue-500 hover:bg-blue-400"} text-white font-bold px-6 py-2.5 rounded-lg transition-colors`}>Done</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })()
            )}

            {isProcedureDrawerOpen && editingProcedureIndex !== null && workspaceData.procedures[editingProcedureIndex] && (
                <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="w-full max-w-sm sm:max-w-md h-full bg-[#111] border-l border-white/10 shadow-2xl animate-in slide-in-from-right duration-300 overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-white">Edit Procedure</h2>
                                <button onClick={() => setIsProcedureDrawerOpen(false)} className="text-zinc-400 hover:text-white transition-colors text-2xl leading-none">&times;</button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Procedure Title</label>
                                    <input
                                        value={workspaceData.procedures[editingProcedureIndex].title}
                                        onChange={(e) => {
                                            const newProcs = [...workspaceData.procedures];
                                            newProcs[editingProcedureIndex].title = e.target.value;
                                            setWorkspaceData({ ...workspaceData, procedures: newProcs });
                                        }}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500 transition-colors"
                                        placeholder="e.g. Opening Checklist"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Urgency Level</label>
                                    <select
                                        value={workspaceData.procedures[editingProcedureIndex].urgency || "Medium"}
                                        onChange={(e) => {
                                            const newProcs = [...workspaceData.procedures];
                                            newProcs[editingProcedureIndex].urgency = e.target.value;
                                            setWorkspaceData({ ...workspaceData, procedures: newProcs });
                                        }}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500 transition-colors appearance-none"
                                    >
                                        <option value="Low">Low</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">High</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Assign to Department</label>
                                    <select
                                        value={workspaceData.procedures[editingProcedureIndex].assignedTo || ""}
                                        onChange={(e) => {
                                            const newProcs = [...workspaceData.procedures];
                                            newProcs[editingProcedureIndex].assignedTo = e.target.value;
                                            setWorkspaceData({ ...workspaceData, procedures: newProcs });
                                        }}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500 transition-colors appearance-none"
                                    >
                                        <option value="">Unassigned</option>
                                        {workspaceData.departments.map((d) => (
                                            <option key={d.name} value={d.name}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Instructions</label>
                                    <textarea
                                        value={workspaceData.procedures[editingProcedureIndex].description || ""}
                                        onChange={(e) => {
                                            const newProcs = [...workspaceData.procedures];
                                            newProcs[editingProcedureIndex].description = e.target.value;
                                            setWorkspaceData({ ...workspaceData, procedures: newProcs });
                                        }}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500 transition-colors min-h-[120px] resize-y"
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
                                    className="px-4 py-2.5 text-zinc-400 hover:text-red-400 transition-colors"
                                >
                                    Remove
                                </button>
                                <button onClick={() => setIsProcedureDrawerOpen(false)} className="bg-purple-500 hover:bg-purple-400 text-white font-bold px-6 py-2.5 rounded-lg transition-colors">Done</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isLocationDrawerOpen && editingLocationIndex !== null && workspaceData.locations[editingLocationIndex] && (
                <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="w-full max-w-sm sm:max-w-md h-full bg-[#111] border-l border-white/10 shadow-2xl animate-in slide-in-from-right duration-300 overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-white">Edit Location</h2>
                                <button onClick={() => setIsLocationDrawerOpen(false)} className="text-zinc-400 hover:text-white transition-colors text-2xl leading-none">&times;</button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Location Name</label>
                                    <input
                                        value={workspaceData.locations[editingLocationIndex].name}
                                        onChange={(e) => {
                                            const newLocs = [...workspaceData.locations];
                                            newLocs[editingLocationIndex].name = e.target.value;
                                            setWorkspaceData({ ...workspaceData, locations: newLocs });
                                        }}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-red-500 transition-colors"
                                        placeholder="e.g. Downtown Branch"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Description / Address</label>
                                    <textarea
                                        value={workspaceData.locations[editingLocationIndex].description || ""}
                                        onChange={(e) => {
                                            const newLocs = [...workspaceData.locations];
                                            newLocs[editingLocationIndex].description = e.target.value;
                                            setWorkspaceData({ ...workspaceData, locations: newLocs });
                                        }}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-red-500 transition-colors min-h-[100px] resize-y"
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
                                    className="px-4 py-2.5 text-zinc-400 hover:text-red-400 transition-colors"
                                >
                                    Remove
                                </button>
                                <button onClick={() => setIsLocationDrawerOpen(false)} className="bg-red-500 hover:bg-red-400 text-white font-bold px-6 py-2.5 rounded-lg transition-colors">Done</button>
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
        <Suspense fallback={
            <div className="w-full h-full bg-[#0a0a0c] flex items-center justify-center min-h-screen">
                <Loader2 className="animate-spin text-cyan-500" size={32} />
            </div>
        }>
            <OnboardingContent />
        </Suspense>
    );
}
