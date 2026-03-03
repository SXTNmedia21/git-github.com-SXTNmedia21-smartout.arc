"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { UltravoxSession, UltravoxSessionStatus, Role } from "ultravox-client";
import { toast } from "sonner";
import type { BusinessData, SeasonData } from "../types";

type GetOnboardingState = () => Record<string, unknown>;

/** Callbacks the agent can invoke to update the onboarding UI */
export interface BotssonActions {
  getState: GetOnboardingState;
  updateBusiness: (partial: Partial<BusinessData>) => void;
  updateSeason: (partial: Partial<SeasonData>) => void;
  addDepartments: (names: string[]) => void;
  triggerScrape: (url: string, orgNumber: string) => Promise<void>;
  advanceToNextSection: () => void;
  saveMemory: (content: string, memoryType: string, expiresAt?: string) => Promise<void>;
}

interface BotssonState {
  status: UltravoxSessionStatus | "idle";
  isConnected: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  currentText: string;
  transcript: { role: string; text: string }[];
  contextLog: string[];
  startSession: () => Promise<void>;
  endSession: () => void;
  toggleMic: () => void;
  sendContext: (text: string) => void;
}

/** Tool definitions sent to Ultravox so the agent can call them */
const CLIENT_TOOLS = [
  {
    temporaryTool: {
      modelToolName: "getOnboardingState",
      description:
        "Get the current onboarding state: section, business, season, departments, scrape status.",
      dynamicParameters: [],
      client: {},
    },
  },
  {
    temporaryTool: {
      modelToolName: "updateBusiness",
      description:
        "Update business fields. Pass a JSON object with fields to update: name, orgNumber, website, email, phone, address, postalCode, city, industry, employeeCount.",
      dynamicParameters: [
        {
          name: "fields",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "JSON object with business fields to update" },
          required: true,
        },
      ],
      client: {},
    },
  },
  {
    temporaryTool: {
      modelToolName: "updateSeason",
      description:
        "Update season fields. Pass a JSON object with fields: name, startDate (YYYY-MM-DD), endDate (YYYY-MM-DD).",
      dynamicParameters: [
        {
          name: "fields",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "JSON object with season fields to update" },
          required: true,
        },
      ],
      client: {},
    },
  },
  {
    temporaryTool: {
      modelToolName: "addDepartments",
      description:
        'Add departments by name. Pass a JSON array of department name strings, e.g. ["Kjøkken", "Bar", "Sal"].',
      dynamicParameters: [
        {
          name: "names",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "JSON array of department name strings" },
          required: true,
        },
      ],
      client: {},
    },
  },
  {
    temporaryTool: {
      modelToolName: "triggerScrape",
      description:
        "Trigger a scan of the business. Pass either a website URL or org number (or both).",
      dynamicParameters: [
        {
          name: "url",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Website URL to scan" },
          required: false,
        },
        {
          name: "orgNumber",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Norwegian org number" },
          required: false,
        },
      ],
      client: {},
    },
  },
  {
    temporaryTool: {
      modelToolName: "advanceToNextSection",
      description:
        "Scroll the onboarding page to the next section. Call this when the user is ready to move on.",
      dynamicParameters: [],
      client: {},
    },
  },
  {
    temporaryTool: {
      modelToolName: "saveMemory",
      description:
        'Save a memory about the user. RULES: (1) ALWAYS confirm with the user before saving — say what you want to remember and ask "Skal jeg notere det?" Only call after user confirms. (2) Only save factual knowledge — business details, preferences, team structure. NEVER save tasks or reminders. Type "constant" for permanent facts, "temporal" for time-limited info with an end date.',
      dynamicParameters: [
        {
          name: "content",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "The memory content — what to remember" },
          required: true,
        },
        {
          name: "memoryType",
          location: "PARAMETER_LOCATION_BODY",
          schema: {
            type: "string",
            description: 'Either "constant" (permanent) or "temporal" (expires)',
          },
          required: true,
        },
        {
          name: "expiresAt",
          location: "PARAMETER_LOCATION_BODY",
          schema: {
            type: "string",
            description:
              "ISO date (YYYY-MM-DD) when this memory expires. Required for temporal memories.",
          },
          required: false,
        },
      ],
      client: {},
    },
  },
];

export function useBotsson(actions?: BotssonActions): BotssonState {
  const [status, setStatus] = useState<UltravoxSessionStatus | "idle">("idle");
  const [transcript, setTranscript] = useState<{ role: string; text: string }[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [currentText, setCurrentText] = useState("");
  const [contextLog, setContextLog] = useState<string[]>([]);
  const sessionRef = useRef<UltravoxSession | null>(null);
  const startingRef = useRef(false);
  const actionsRef = useRef(actions);

  // Keep ref in sync
  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  const startSession = useCallback(async () => {
    // Prevent double-start from concurrent clicks (event bubbling)
    if (sessionRef.current || startingRef.current) return;
    startingRef.current = true;

    setStatus(UltravoxSessionStatus.CONNECTING);

    try {
      const session = new UltravoxSession();
      sessionRef.current = session;

      // Register client tool implementations
      session.registerToolImplementation("getOnboardingState", () => {
        const state = actionsRef.current?.getState() ?? {};
        return JSON.stringify(state);
      });

      session.registerToolImplementation("updateBusiness", (params) => {
        try {
          const fields = JSON.parse(String(params.fields ?? "{}"));
          actionsRef.current?.updateBusiness(fields);
          return JSON.stringify({ success: true });
        } catch {
          return JSON.stringify({ success: false, error: "Invalid JSON" });
        }
      });

      session.registerToolImplementation("updateSeason", (params) => {
        try {
          const fields = JSON.parse(String(params.fields ?? "{}"));
          actionsRef.current?.updateSeason(fields);
          return JSON.stringify({ success: true });
        } catch {
          return JSON.stringify({ success: false, error: "Invalid JSON" });
        }
      });

      session.registerToolImplementation("addDepartments", (params) => {
        try {
          const names = JSON.parse(String(params.names ?? "[]")) as string[];
          actionsRef.current?.addDepartments(names);
          return JSON.stringify({ success: true, added: names });
        } catch {
          return JSON.stringify({ success: false, error: "Invalid JSON" });
        }
      });

      session.registerToolImplementation("triggerScrape", (params) => {
        const url = String(params.url ?? "");
        const orgNumber = String(params.orgNumber ?? "");
        actionsRef.current?.triggerScrape(url, orgNumber).catch(() => {});
        return JSON.stringify({ success: true, message: "Scan started" });
      });

      session.registerToolImplementation("advanceToNextSection", () => {
        actionsRef.current?.advanceToNextSection();
        return JSON.stringify({ success: true, message: "Scrolled to next section" });
      });

      session.registerToolImplementation("saveMemory", (params) => {
        const content = String(params.content ?? "");
        const memoryType = String(params.memoryType ?? "constant");
        const expiresAt = params.expiresAt ? String(params.expiresAt) : undefined;
        actionsRef.current?.saveMemory(content, memoryType, expiresAt).catch(() => {});
        return JSON.stringify({ success: true, message: "Memory saved" });
      });

      let introSent = false;
      session.addEventListener("status", () => {
        if (sessionRef.current === session) {
          setStatus(session.status || "idle");

          // Send inference trigger ONCE when session first becomes LISTENING
          if (!introSent && session.status === UltravoxSessionStatus.LISTENING) {
            introSent = true;
            setTimeout(() => {
              if (sessionRef.current === session) {
                session.sendText(
                  "[Systemmelding: Brukeren er klar. Start samtalen — presenter deg og spør hva de heter.]",
                );
              }
            }, 800);
          }
        }
      });

      session.addEventListener("transcripts", () => {
        if (sessionRef.current === session) {
          const transcripts = session.transcripts;
          if (transcripts) {
            const formatted = transcripts.map((t) => ({
              role: t.speaker === Role.USER ? "user" : "agent",
              text: t.text,
            }));
            setTranscript(formatted);

            const lastAgent = [...formatted].reverse().find((m) => m.role === "agent");
            if (lastAgent) {
              setCurrentText(lastAgent.text);
            }
          }
        }
      });

      // Fetch joinUrl from API
      const res = await fetch("/api/wizard/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mission_id: "onboarding-interview",
          selected_tools: CLIENT_TOOLS,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Ukjent feil" }));
        const msg = errorData.error ?? "Kunne ikke starte stemmeassistenten";
        console.error("[useBotsson] Failed to start session:", res.status, msg);
        toast.error(msg);
        sessionRef.current = null;
        startingRef.current = false;
        setStatus("idle");
        return;
      }

      const data = await res.json();
      const joinUrl = data.joinUrl;

      if (joinUrl && sessionRef.current === session) {
        session.joinCall(joinUrl);
      } else {
        sessionRef.current = null;
        startingRef.current = false;
        setStatus("idle");
      }
    } catch (error) {
      console.error("[useBotsson] Failed to start session:", error);
      sessionRef.current = null;
      startingRef.current = false;
      setStatus("idle");
    }
  }, []);

  const endSession = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.leaveCall();
      sessionRef.current = null;
    }
    startingRef.current = false;
    setStatus("idle");
    setCurrentText("");
    setContextLog([]);
  }, []);

  const toggleMic = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;

    if (isMuted) {
      session.unmuteMic();
      setIsMuted(false);
    } else {
      session.muteMic();
      setIsMuted(true);
    }
  }, [isMuted]);

  const sendContext = useCallback((text: string) => {
    const session = sessionRef.current;
    if (!session) return;

    const currentStatus = session.status;
    const connected =
      currentStatus === UltravoxSessionStatus.LISTENING ||
      currentStatus === UltravoxSessionStatus.THINKING ||
      currentStatus === UltravoxSessionStatus.SPEAKING;

    if (connected) {
      setContextLog((prev) => [...prev, text]);
      session.sendText(text);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.leaveCall();
        sessionRef.current = null;
      }
    };
  }, []);

  const isConnected =
    status === UltravoxSessionStatus.LISTENING ||
    status === UltravoxSessionStatus.THINKING ||
    status === UltravoxSessionStatus.SPEAKING;

  const isSpeaking = status === UltravoxSessionStatus.SPEAKING;

  return {
    status,
    isConnected,
    isSpeaking,
    isMuted,
    currentText,
    transcript,
    contextLog,
    startSession,
    endSession,
    toggleMic,
    sendContext,
  };
}
