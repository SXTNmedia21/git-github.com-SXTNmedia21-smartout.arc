"use client";

import { useState } from "react";
import { Globe, ChevronRight, Loader2, Image as ImageIcon, FileText, Link as LinkIcon, Sparkles } from "lucide-react";

type ScrapeState = "init" | "scraping" | "done" | "summarizing" | "summarized";

interface ImageModel {
    src: string;
    alt: string;
}

interface LinkModel {
    href: string;
    text: string;
}

interface RawData {
    title: string;
    description: string;
    text_content: string;
    images: ImageModel[];
    files: LinkModel[];
}

export default function ScrapeTestPage() {
    const [step, setStep] = useState<ScrapeState>("init");
    const [urlInput, setUrlInput] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [rawData, setRawData] = useState<RawData | null>(null);

    const handleStartScraping = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!urlInput.trim()) return;

        setStep("scraping");
        setError(null);
        setRawData(null);

        try {
            // Hitting the Python Microservice directly for local testing Diagnostics
            const res = await fetch("http://localhost:8000/scrape-raw", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ url: urlInput })
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(errText || "Failed to fetch from Scrapling service.");
            }

            const data = await res.json();
            setRawData(data);
            setStep("done");
        } catch (err: unknown) {
            console.error("Scraping failed:", err);
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during scraping.";
            setError(errorMessage);
            setStep("init");
        }
    };

    const handleSummarize = () => {
        setStep("summarizing");
        // Mocking an AI summary until the backend is fully hooked up
        setTimeout(() => {
            setStep("summarized");
        }, 2500);
    };

    return (
        <>
            {/* Left Pane: Controls */}
            <div className="w-full md:w-1/3 border-r border-zinc-800/60 bg-zinc-900/50 flex flex-col relative z-10">
                <div className="p-6 border-b border-zinc-800/60 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
                            <Globe size={20} />
                        </div>
                        <div>
                            <h1 className="font-semibold text-zinc-100">Scraper Test</h1>
                            <p className="text-xs text-zinc-400">Raw Data Diagnostics</p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                    <div className="bg-zinc-800/50 border border-zinc-700/50 p-4 rounded-2xl rounded-tl-sm text-sm text-zinc-200">
                        Enter a URL to test the raw capabilities of the Python Scrapling microservice. We will extract all text, images, and files for review before summarization.
                    </div>

                    {(step === "init" || step === "done" || step === "summarized" || step === "summarizing") && (
                        <form onSubmit={handleStartScraping} className="mt-4 flex flex-col gap-3">
                            <div className="relative flex items-center bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden focus-within:border-purple-500 transition-colors">
                                <div className="pl-4 pr-1 text-zinc-500 flex items-center select-none">
                                    <Globe size={16} className="mr-2" />
                                    <span className="text-sm">https://</span>
                                </div>
                                <input
                                    type="text"
                                    value={urlInput}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/^https?:\/\//i, '');
                                        setUrlInput(val);
                                    }}
                                    placeholder="example.com"
                                    className="w-full bg-transparent py-2.5 pr-4 text-sm outline-none placeholder:text-zinc-600 text-zinc-100"
                                    autoComplete="off"
                                    autoCorrect="off"
                                    autoCapitalize="off"
                                    spellCheck="false"
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                disabled={!urlInput.trim() || step === "summarizing"}
                            >
                                Scrape URL <ChevronRight size={16} />
                            </button>
                        </form>
                    )}

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm leading-relaxed">
                            <strong className="block mb-1">Error extracting data:</strong>
                            {error}
                        </div>
                    )}

                    {step === "scraping" && (
                        <div className="bg-purple-500/10 border border-purple-500/20 text-purple-400 p-4 rounded-xl flex items-center gap-3 text-sm">
                            <Loader2 size={18} className="animate-spin" />
                            <span>Extracting raw data from https://{urlInput}...</span>
                        </div>
                    )}

                    {(step === "done" || step === "summarized" || step === "summarizing") && rawData && (
                        <div className="pt-6 border-t border-zinc-800/60 flex flex-col gap-4">
                            <div className="bg-zinc-800/50 border border-zinc-700/50 p-4 rounded-2xl rounded-tl-sm text-sm text-zinc-200">
                                Raw data extracted successfully. You can review the structure on the right canvas. Should I attempt an AI Summary?
                            </div>
                            <button
                                onClick={handleSummarize}
                                disabled={step === "summarizing" || step === "summarized"}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                            >
                                {step === "summarizing" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                {step === "summarized" ? "AI Summary Complete" : "Generate AI Summary"}
                            </button>
                        </div>
                    )}
                    {step === "summarizing" && (
                        <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 p-4 rounded-xl flex items-center gap-3 text-sm">
                            <Loader2 size={18} className="animate-spin" />
                            <span>AI is reading the raw data and synthesizing...</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Pane: Visualization Canvas */}
            <div className="flex-1 bg-zinc-950 p-8 overflow-y-auto">
                <div className="max-w-4xl mx-auto flex flex-col gap-8 pb-12">

                    {!rawData && step !== "scraping" && (
                        <div className="h-[60vh] flex flex-col items-center justify-center text-zinc-500 gap-4">
                            <Globe size={48} className="opacity-20" />
                            <p>Enter a URL to test the extraction capabilities.</p>
                        </div>
                    )}

                    {step === "scraping" && (
                        <div className="h-[60vh] flex flex-col items-center justify-center text-purple-500/50 gap-4">
                            <Loader2 size={48} className="animate-spin" />
                            <p>Scraping engine active...</p>
                        </div>
                    )}

                    {rawData && (
                        <>
                            {/* Meta Section */}
                            <div>
                                <h2 className="text-xl font-semibold text-zinc-100 flex items-center gap-2 mb-4">
                                    <FileText size={20} className="text-zinc-500" />
                                    Meta Information
                                </h2>
                                <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl flex flex-col gap-4">
                                    <div>
                                        <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1">Title</div>
                                        <div className="text-zinc-200">{rawData.title || <span className="text-zinc-600 italic">No title found</span>}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1">Description</div>
                                        <div className="text-zinc-200">{rawData.description || <span className="text-zinc-600 italic">No description found</span>}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Images Section */}
                            <div>
                                <h2 className="text-xl font-semibold text-zinc-100 flex items-center gap-2 mb-4">
                                    <ImageIcon size={20} className="text-zinc-500" />
                                    Detected Images ({rawData.images?.length || 0})
                                </h2>
                                {rawData.images?.length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {rawData.images.map((img, i) => (
                                            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden aspect-square flex items-center justify-center relative group">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={img.src} alt={img.alt || 'Scraped image'} className="object-cover w-full h-full opacity-80 group-hover:opacity-100 transition-opacity" />
                                                <div className="absolute bottom-0 left-0 right-0 bg-zinc-950/80 p-2 text-[10px] text-zinc-300 truncate">
                                                    {img.alt || img.src.split('/').pop()}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-zinc-900/50 border border-zinc-800 border-dashed rounded-xl p-8 text-center text-zinc-500">
                                        No images extracted.
                                    </div>
                                )}
                            </div>

                            {/* Files/Links Section */}
                            <div>
                                <h2 className="text-xl font-semibold text-zinc-100 flex items-center gap-2 mb-4">
                                    <LinkIcon size={20} className="text-zinc-500" />
                                    Detected Files & Documents ({rawData.files?.length || 0})
                                </h2>
                                {rawData.files?.length > 0 ? (
                                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-800/50">
                                        {rawData.files.map((file, i) => (
                                            <a key={i} href={file.href} target="_blank" rel="noreferrer" className="p-4 flex flex-col hover:bg-zinc-800/50 transition-colors">
                                                <div className="text-sm font-medium text-blue-400 truncate">{file.text || 'Unnamed Document'}</div>
                                                <div className="text-xs text-zinc-500 truncate mt-1">{file.href}</div>
                                            </a>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-zinc-900/50 border border-zinc-800 border-dashed rounded-xl p-8 text-center text-zinc-500">
                                        No documents (.pdf, .doc, etc.) extracted.
                                    </div>
                                )}
                            </div>

                            {/* Raw Text Body Section */}
                            <div>
                                <h2 className="text-xl font-semibold text-zinc-100 flex items-center gap-2 mb-4">
                                    <FileText size={20} className="text-zinc-500" />
                                    Raw Text Content Extract
                                </h2>
                                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap max-h-[500px] overflow-y-auto font-mono">
                                    {rawData.text_content || <span className="text-zinc-600 italic">No text content found</span>}
                                </div>
                            </div>

                            {/* Simulated AI Summary Section */}
                            {step === "summarized" && (
                                <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                    <h2 className="text-xl font-semibold text-blue-400 flex items-center gap-2 mb-4">
                                        <Sparkles size={20} />
                                        AI Synthesis (Mock)
                                    </h2>
                                    <div className="bg-blue-950/20 border border-blue-500/20 p-6 rounded-xl text-sm text-blue-100 leading-relaxed">
                                        <p className="mb-4">Based on the raw data extracted, here is a synthesized view of the business context:</p>
                                        <ul className="list-disc pl-5 space-y-2 text-blue-200/80">
                                            <li><strong>Primary Identity:</strong> {rawData.title || "The business"} represents an operational entity based on the metadata.</li>
                                            <li><strong>Content Density:</strong> The page contains approximately {rawData.text_content.length} characters of readable operational text.</li>
                                            <li><strong>Visual Assets:</strong> Discovered {rawData.images?.length || 0} visual assets that could be used for location identification or branding.</li>
                                            <li><strong>Documentation:</strong> Found {rawData.files?.length || 0} linked standard operating documents (PDFs, docs).</li>
                                        </ul>
                                    </div>
                                </div>
                            )}

                        </>
                    )}
                </div>
            </div>
        </>
    );
}
