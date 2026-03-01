"use client";

import { useState } from "react";
import {
  Globe,
  ChevronRight,
  Loader2,
  Image as ImageIcon,
  FileText,
  Link as LinkIcon,
  Sparkles,
} from "lucide-react";

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
      // Calls the server-side proxy route which forwards to the Scrapling service.
      // The actual service URL (SCRAPLING_SERVICE_URL) stays server-side.
      const res = await fetch("/api/scrape/raw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: urlInput }),
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
      const errorMessage =
        err instanceof Error ? err.message : "An unknown error occurred during scraping.";
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
      <div className="relative z-10 flex w-full flex-col border-r border-zinc-800/60 bg-zinc-900/50 md:w-1/3">
        <div className="flex items-center justify-between border-b border-zinc-800/60 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-purple-500/20 bg-purple-500/10 text-purple-500">
              <Globe size={20} />
            </div>
            <div>
              <h1 className="font-semibold text-zinc-100">Scraper Test</h1>
              <p className="text-xs text-zinc-400">Raw Data Diagnostics</p>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
          <div className="rounded-2xl rounded-tl-sm border border-zinc-700/50 bg-zinc-800/50 p-4 text-sm text-zinc-200">
            Enter a URL to test the raw capabilities of the Python Scrapling microservice. We will
            extract all text, images, and files for review before summarization.
          </div>

          {(step === "init" ||
            step === "done" ||
            step === "summarized" ||
            step === "summarizing") && (
            <form onSubmit={handleStartScraping} className="mt-4 flex flex-col gap-3">
              <div className="relative flex items-center overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 transition-colors focus-within:border-purple-500">
                <div className="flex items-center pr-1 pl-4 text-zinc-500 select-none">
                  <Globe size={16} className="mr-2" />
                  <span className="text-sm">https://</span>
                </div>
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/^https?:\/\//i, "");
                    setUrlInput(val);
                  }}
                  placeholder="example.com"
                  className="w-full bg-transparent py-2.5 pr-4 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                />
              </div>
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 py-2.5 font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
                disabled={!urlInput.trim() || step === "summarizing"}
              >
                Scrape URL <ChevronRight size={16} />
              </button>
            </form>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm leading-relaxed text-red-400">
              <strong className="mb-1 block">Error extracting data:</strong>
              {error}
            </div>
          )}

          {step === "scraping" && (
            <div className="flex items-center gap-3 rounded-xl border border-purple-500/20 bg-purple-500/10 p-4 text-sm text-purple-400">
              <Loader2 size={18} className="animate-spin" />
              <span>Extracting raw data from https://{urlInput}...</span>
            </div>
          )}

          {(step === "done" || step === "summarized" || step === "summarizing") && rawData && (
            <div className="flex flex-col gap-4 border-t border-zinc-800/60 pt-6">
              <div className="rounded-2xl rounded-tl-sm border border-zinc-700/50 bg-zinc-800/50 p-4 text-sm text-zinc-200">
                Raw data extracted successfully. You can review the structure on the right canvas.
                Should I attempt an AI Summary?
              </div>
              <button
                onClick={handleSummarize}
                disabled={step === "summarizing" || step === "summarized"}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {step === "summarizing" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                {step === "summarized" ? "AI Summary Complete" : "Generate AI Summary"}
              </button>
            </div>
          )}
          {step === "summarizing" && (
            <div className="flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-400">
              <Loader2 size={18} className="animate-spin" />
              <span>AI is reading the raw data and synthesizing...</span>
            </div>
          )}
        </div>
      </div>

      {/* Right Pane: Visualization Canvas */}
      <div className="flex-1 overflow-y-auto bg-zinc-950 p-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-8 pb-12">
          {!rawData && step !== "scraping" && (
            <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-zinc-500">
              <Globe size={48} className="opacity-20" />
              <p>Enter a URL to test the extraction capabilities.</p>
            </div>
          )}

          {step === "scraping" && (
            <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-purple-500/50">
              <Loader2 size={48} className="animate-spin" />
              <p>Scraping engine active...</p>
            </div>
          )}

          {rawData && (
            <>
              {/* Meta Section */}
              <div>
                <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-zinc-100">
                  <FileText size={20} className="text-zinc-500" />
                  Meta Information
                </h2>
                <div className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                  <div>
                    <div className="mb-1 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                      Title
                    </div>
                    <div className="text-zinc-200">
                      {rawData.title || (
                        <span className="text-zinc-600 italic">No title found</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                      Description
                    </div>
                    <div className="text-zinc-200">
                      {rawData.description || (
                        <span className="text-zinc-600 italic">No description found</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Images Section */}
              <div>
                <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-zinc-100">
                  <ImageIcon size={20} className="text-zinc-500" />
                  Detected Images ({rawData.images?.length || 0})
                </h2>
                {rawData.images?.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {rawData.images.map((img, i) => (
                      <div
                        key={i}
                        className="group relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"
                      >
                        <img
                          src={img.src}
                          alt={img.alt || "Scraped image"}
                          className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
                        />
                        <div className="absolute right-0 bottom-0 left-0 truncate bg-zinc-950/80 p-2 text-[10px] text-zinc-300">
                          {img.alt || img.src.split("/").pop()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/50 p-8 text-center text-zinc-500">
                    No images extracted.
                  </div>
                )}
              </div>

              {/* Files/Links Section */}
              <div>
                <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-zinc-100">
                  <LinkIcon size={20} className="text-zinc-500" />
                  Detected Files & Documents ({rawData.files?.length || 0})
                </h2>
                {rawData.files?.length > 0 ? (
                  <div className="divide-y divide-zinc-800/50 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                    {rawData.files.map((file, i) => (
                      <a
                        key={i}
                        href={file.href}
                        target="_blank"
                        rel="noreferrer"
                        className="flex flex-col p-4 transition-colors hover:bg-zinc-800/50"
                      >
                        <div className="truncate text-sm font-medium text-blue-400">
                          {file.text || "Unnamed Document"}
                        </div>
                        <div className="mt-1 truncate text-xs text-zinc-500">{file.href}</div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/50 p-8 text-center text-zinc-500">
                    No documents (.pdf, .doc, etc.) extracted.
                  </div>
                )}
              </div>

              {/* Raw Text Body Section */}
              <div>
                <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-zinc-100">
                  <FileText size={20} className="text-zinc-500" />
                  Raw Text Content Extract
                </h2>
                <div className="max-h-[500px] overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 p-6 font-mono text-sm leading-relaxed whitespace-pre-wrap text-zinc-300">
                  {rawData.text_content || (
                    <span className="text-zinc-600 italic">No text content found</span>
                  )}
                </div>
              </div>

              {/* Simulated AI Summary Section */}
              {step === "summarized" && (
                <div className="animate-in fade-in slide-in-from-bottom-4 mt-8 duration-700">
                  <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-blue-400">
                    <Sparkles size={20} />
                    AI Synthesis (Mock)
                  </h2>
                  <div className="rounded-xl border border-blue-500/20 bg-blue-950/20 p-6 text-sm leading-relaxed text-blue-100">
                    <p className="mb-4">
                      Based on the raw data extracted, here is a synthesized view of the business
                      context:
                    </p>
                    <ul className="list-disc space-y-2 pl-5 text-blue-200/80">
                      <li>
                        <strong>Primary Identity:</strong> {rawData.title || "The business"}{" "}
                        represents an operational entity based on the metadata.
                      </li>
                      <li>
                        <strong>Content Density:</strong> The page contains approximately{" "}
                        {rawData.text_content.length} characters of readable operational text.
                      </li>
                      <li>
                        <strong>Visual Assets:</strong> Discovered {rawData.images?.length || 0}{" "}
                        visual assets that could be used for location identification or branding.
                      </li>
                      <li>
                        <strong>Documentation:</strong> Found {rawData.files?.length || 0} linked
                        standard operating documents (PDFs, docs).
                      </li>
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
