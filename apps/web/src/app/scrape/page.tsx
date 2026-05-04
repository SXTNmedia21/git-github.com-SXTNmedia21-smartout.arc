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
      <div className="border-border bg-card/50 relative z-10 flex w-full flex-col border-r md:w-1/3">
        <div className="border-border flex items-center justify-between border-b p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-purple-500/20 bg-purple-500/10 text-purple-500">
              <Globe size={20} />
            </div>
            <div>
              <h1 className="font-heading text-foreground font-semibold">Scraper Test</h1>
              <p className="text-muted-foreground text-xs">Raw Data Diagnostics</p>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
          <div className="border-border bg-muted/50 text-foreground rounded-2xl rounded-tl-sm border p-4 text-sm">
            Enter a URL to test the raw capabilities of the Python Scrapling microservice. We will
            extract all text, images, and files for review before summarization.
          </div>

          {(step === "init" ||
            step === "done" ||
            step === "summarized" ||
            step === "summarizing") && (
            <form onSubmit={handleStartScraping} className="mt-4 flex flex-col gap-3">
              <div className="border-border bg-background relative flex items-center overflow-hidden rounded-lg border transition-colors focus-within:border-purple-500">
                <div className="text-muted-foreground flex items-center pr-1 pl-4 select-none">
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
                  className="text-foreground placeholder:text-muted-foreground w-full bg-transparent py-2.5 pr-4 text-sm outline-none"
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
            <div className="border-border flex flex-col gap-4 border-t pt-6">
              <div className="border-border bg-muted/50 text-foreground rounded-2xl rounded-tl-sm border p-4 text-sm">
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
      <div className="bg-background flex-1 overflow-y-auto p-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-8 pb-12">
          {!rawData && step !== "scraping" && (
            <div className="text-muted-foreground flex h-[60vh] flex-col items-center justify-center gap-4">
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
                <h2 className="font-heading text-foreground mb-4 flex items-center gap-2 text-xl font-semibold">
                  <FileText size={20} className="text-muted-foreground" />
                  Meta Information
                </h2>
                <div className="border-border bg-card flex flex-col gap-4 rounded-xl border p-5">
                  <div>
                    <div className="text-muted-foreground mb-1 text-xs font-semibold tracking-wider uppercase">
                      Title
                    </div>
                    <div className="text-foreground">
                      {rawData.title || (
                        <span className="text-muted-foreground italic">No title found</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1 text-xs font-semibold tracking-wider uppercase">
                      Description
                    </div>
                    <div className="text-foreground">
                      {rawData.description || (
                        <span className="text-muted-foreground italic">No description found</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Images Section */}
              <div>
                <h2 className="font-heading text-foreground mb-4 flex items-center gap-2 text-xl font-semibold">
                  <ImageIcon size={20} className="text-muted-foreground" />
                  Detected Images ({rawData.images?.length || 0})
                </h2>
                {rawData.images?.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {rawData.images.map((img, i) => (
                      <div
                        key={i}
                        className="group border-border bg-card relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border"
                      >
                        {/* eslint-disable-next-line -- suppress no-img-element: dynamic user content with unknown dimensions from external scraped URLs */}
                        <img
                          src={img.src}
                          alt={img.alt || "Scraped image"}
                          className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
                        />
                        <div className="bg-background/80 text-foreground absolute right-0 bottom-0 left-0 truncate p-2 text-[10px]">
                          {img.alt || img.src.split("/").pop()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border-border bg-card/50 text-muted-foreground rounded-xl border border-dashed p-8 text-center">
                    No images extracted.
                  </div>
                )}
              </div>

              {/* Files/Links Section */}
              <div>
                <h2 className="font-heading text-foreground mb-4 flex items-center gap-2 text-xl font-semibold">
                  <LinkIcon size={20} className="text-muted-foreground" />
                  Detected Files & Documents ({rawData.files?.length || 0})
                </h2>
                {rawData.files?.length > 0 ? (
                  <div className="divide-border border-border bg-card divide-y overflow-hidden rounded-xl border">
                    {rawData.files.map((file, i) => (
                      <a
                        key={i}
                        href={file.href}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:bg-accent flex flex-col p-4 transition-colors"
                      >
                        <div className="truncate text-sm font-medium text-blue-400">
                          {file.text || "Unnamed Document"}
                        </div>
                        <div className="text-muted-foreground mt-1 truncate text-xs">
                          {file.href}
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="border-border bg-card/50 text-muted-foreground rounded-xl border border-dashed p-8 text-center">
                    No documents (.pdf, .doc, etc.) extracted.
                  </div>
                )}
              </div>

              {/* Raw Text Body Section */}
              <div>
                <h2 className="font-heading text-foreground mb-4 flex items-center gap-2 text-xl font-semibold">
                  <FileText size={20} className="text-muted-foreground" />
                  Raw Text Content Extract
                </h2>
                <div className="border-border bg-card text-foreground max-h-[500px] overflow-y-auto rounded-xl border p-6 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                  {rawData.text_content || (
                    <span className="text-muted-foreground italic">No text content found</span>
                  )}
                </div>
              </div>

              {/* Simulated AI Summary Section */}
              {step === "summarized" && (
                <div className="animate-in fade-in slide-in-from-bottom-4 mt-8 duration-700">
                  <h2 className="font-heading mb-4 flex items-center gap-2 text-xl font-semibold text-blue-400">
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
