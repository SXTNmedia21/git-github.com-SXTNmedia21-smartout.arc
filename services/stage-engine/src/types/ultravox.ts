// ============================================
// ultravox.ts
// Type definitions for Ultravox API integration.
// Covers call creation, tool definitions, and new-stage responses.
// Connected to: Ultravox Call Stages docs
// ============================================

/** POST /adapters/ultravox/create-call — request body */
export type CreateUltravoxCallRequest = {
  mission_id: string;
  workspace_id: string;
  user_id?: string;
  voice?: string;
  language?: string;
};

/** POST /adapters/ultravox/create-call — response body */
export type CreateUltravoxCallResponse = {
  session_id: string;
  call_id: string;
  join_url: string;
};

/** Parameter location for Ultravox tool parameters */
export type UltravoxParameterLocation =
  | "PARAMETER_LOCATION_BODY"
  | "PARAMETER_LOCATION_QUERY"
  | "PARAMETER_LOCATION_HEADER"
  | "PARAMETER_LOCATION_PATH";

/** A static parameter passed with every tool invocation (invisible to the AI) */
export type UltravoxStaticParameter = {
  name: string;
  location: UltravoxParameterLocation;
  value: string;
};

/** Ultravox tool definition for HTTP tools (server-side, called via HTTP) */
export type UltravoxHttpTool = {
  temporaryTool: {
    modelToolName: string;
    description: string;
    dynamicParameters: Array<{
      name: string;
      location: "PARAMETER_LOCATION_BODY";
      schema: Record<string, unknown>;
      required: boolean;
    }>;
    staticParameters?: UltravoxStaticParameter[];
    http: {
      baseUrlPattern: string;
      httpMethod: "POST";
    };
  };
};

/** Ultravox tool definition for client tools (browser-side, called via SDK) */
export type UltravoxClientTool = {
  temporaryTool: {
    modelToolName: string;
    description: string;
    dynamicParameters: Array<{
      name: string;
      location: "PARAMETER_LOCATION_BODY";
      schema: Record<string, unknown>;
      required: boolean;
    }>;
    client: Record<string, never>;
  };
};

/** Any Ultravox tool — HTTP or client */
export type UltravoxTool = UltravoxHttpTool | UltravoxClientTool;

/**
 * Ultravox new-stage response body.
 * Returned with header X-Ultravox-Response-Type: new-stage
 * to trigger a seamless stage transition during a voice call.
 */
export type UltravoxNewStageResponse = {
  systemPrompt: string;
  toolResultText: string;
  selectedTools?: UltravoxTool[];
  temperature?: number;
  voice?: string;
  languageHint?: string;
};

/** Ultravox Create Call API request */
export type UltravoxCreateCallPayload = {
  systemPrompt: string;
  model?: string;
  voice?: string;
  languageHint?: string;
  temperature?: number;
  firstSpeaker?: "FIRST_SPEAKER_USER" | "FIRST_SPEAKER_AGENT";
  selectedTools: UltravoxTool[];
  medium?: { serverWebSocket?: { inputSampleRate: number; outputSampleRate: number } };
};

/** Ultravox Create Call API response */
export type UltravoxCreateCallApiResponse = {
  callId: string;
  joinUrl: string;
};
