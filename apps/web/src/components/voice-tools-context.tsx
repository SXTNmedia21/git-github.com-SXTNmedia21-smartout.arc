"use client";

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";

export type ClientToolDefinition = {
  temporaryTool: {
    modelToolName: string;
    description: string;
    dynamicParameters: Array<{
      name: string;
      location: "PARAMETER_LOCATION_BODY";
      schema: Record<string, unknown>;
      required?: boolean;
    }>;
    client: Record<string, never>;
  };
};

export type ClientToolImplementation = (
  params: Record<string, unknown>,
) => string | Promise<string>;

export type ClientTools = {
  definitions: ClientToolDefinition[];
  implementations: Record<string, ClientToolImplementation>;
};

type VoiceToolsContextValue = {
  clientTools: ClientTools | null;
  setClientTools: (tools: ClientTools | null) => void;
};

const VoiceToolsContext = createContext<VoiceToolsContextValue>({
  clientTools: null,
  setClientTools: () => {},
});

export function VoiceToolsProvider({ children }: { children: ReactNode }) {
  const [clientTools, setClientToolsState] = useState<ClientTools | null>(null);

  const setClientTools = useCallback((tools: ClientTools | null) => {
    setClientToolsState(tools);
  }, []);

  const value = useMemo(() => ({ clientTools, setClientTools }), [clientTools, setClientTools]);

  return <VoiceToolsContext.Provider value={value}>{children}</VoiceToolsContext.Provider>;
}

export function useVoiceTools() {
  return useContext(VoiceToolsContext);
}
