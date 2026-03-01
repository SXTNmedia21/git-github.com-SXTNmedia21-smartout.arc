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

/** Ultravox tool definition for HTTP tools */
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
    http: {
      baseUrlPattern: string;
      httpMethod: "POST";
    };
  };
};

/**
 * Ultravox new-stage response body.
 * Returned with header X-Ultravox-Response-Type: new-stage
 * to trigger a seamless stage transition during a voice call.
 */
export type UltravoxNewStageResponse = {
  systemPrompt: string;
  toolResultText: string;
  selectedTools?: UltravoxHttpTool[];
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
  selectedTools: UltravoxHttpTool[];
  medium?: { serverWebSocket?: { inputSampleRate: number; outputSampleRate: number } };
};

/** Ultravox Create Call API response */
export type UltravoxCreateCallApiResponse = {
  callId: string;
  joinUrl: string;
};
