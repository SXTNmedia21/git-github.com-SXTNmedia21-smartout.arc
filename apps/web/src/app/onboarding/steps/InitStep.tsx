"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@smartout/supabase/client";
import { Globe, Bot, ArrowRight } from "lucide-react";
import { useWizard } from "../WizardContext";
import type { WorkspaceData } from "../types";

export function InitStep() {
  const wizard = useWizard();
  const supabase = createClient();
  const [urlInput, setUrlInput] = useState("");
  const searchParams = useSearchParams();
  const hasAutoStarted = useRef(false);

  useEffect(() => {
    const urlParam = searchParams?.get("url");
    if (urlParam && wizard.step === "init" && !hasAutoStarted.current) {
      hasAutoStarted.current = true;
      setUrlInput(urlParam);
      setTimeout(() => {
        handleStartCrawling(undefined, urlParam);
      }, 100);
    }
  }, [searchParams, wizard.step]);

  const handleStartCrawling = async (e?: React.FormEvent, overrideUrl?: string) => {
    if (e) e.preventDefault();
    const targetUrl = overrideUrl || urlInput;
    if (!targetUrl.trim()) return;

    wizard.goTo("crawling");

    try {
      const { data, error } = await supabase.functions.invoke("gather-workspace-intelligence", {
        body: { url: targetUrl },
      });

      if (error) {
        console.warn("Invoke error details:", error);
        throw new Error("Edge Function Failed");
      }

      const { scrapedData, brregData, webSearchData: _webSearchData, sessionId } = data;

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

      const newData: Partial<WorkspaceData> = {
        name: brregData?.legalName || scrapedData?.companyName || "",
        website: targetUrl,
        email: scrapedData?.email || "",
        phone: scrapedData?.phone || "",
        address: brregData?.address
          ? `${brregData.address.street}, ${brregData.address.postalCode} ${brregData.address.city}`.trim()
          : "",
        ceo: brregData?.dagligLeder || "",
        employeeCount: brregData?.employeeCount
          ? brregData.employeeCount.toString()
          : "",
        industry: brregData?.naceDescription || "",
        concept: "",
        summary: scrapedData?.summary || "",
        slogan: "",
        orgNumber: brregData?.orgNumber || "",
        naceCode: brregData?.naceCode || "",
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
      };

      wizard.updateData(newData);

      // Store sessionId if returned
      if (sessionId) {
        // sessionId from gather-workspace-intelligence is used as temporary reference
      }

      // Route to auth if not authenticated, otherwise skip to org verification
      if (wizard.isAuthenticated) {
        wizard.goTo("org_verification");
      } else {
        wizard.goTo("auth");
      }
    } catch (error) {
      console.warn("Scraping failed, falling back to mock data for demo:", error);
      setTimeout(() => {
        wizard.updateData({
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
            {
              id: "1",
              name: "Main Dining",
              type: "Indoor",
              function: "",
              isComplete: true,
            },
            {
              id: "2",
              name: "Terrace Bar",
              type: "Outdoor",
              function: "",
              isComplete: true,
            },
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
        });
        if (wizard.isAuthenticated) {
          wizard.goTo("org_verification");
        } else {
          wizard.goTo("auth");
        }
      }, 3000);
    }
  };

  const handleSkip = () => {
    if (wizard.isAuthenticated) {
      wizard.goTo("org_verification");
    } else {
      wizard.goTo("auth");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center text-center">
      <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
        <Bot size={40} />
      </div>
      <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
        Let&apos;s build your workspace.
      </h1>
      <p className="mb-8 text-base text-zinc-400 sm:mb-12 sm:text-lg">
        Provide your company&apos;s website address and we&apos;ll automatically generate your
        structure, departments, and core policies.
      </p>

      <form onSubmit={handleStartCrawling} className="flex w-full flex-col justify-center gap-4">
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
            Set up manually
          </button>
        </div>
      </form>
    </div>
  );
}
