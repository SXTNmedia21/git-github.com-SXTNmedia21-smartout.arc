export type CallType = "direct" | "group" | "ptt";
export type CallStatus = "active" | "ending" | "ended";
export type AudioPolicy = "disabled" | "ptt" | "open_mic" | "listen_only";
export type VideoPolicy = "disabled" | "optional" | "default_on" | "required";

export type CallSession = {
  id: string;
  channelId: string;
  workspaceId: string;
  callType: CallType;
  livekitRoomName: string;
  status: CallStatus;
  audioPolicy: AudioPolicy;
  videoPolicy: VideoPolicy;
  startedBy: string | null;
  maxParticipants: number;
  startedAt: string;
  endedAt: string | null;
};

export type CallParticipant = {
  id: string;
  callSessionId: string;
  profileId: string;
  isAi: boolean;
  joinedAt: string;
  leftAt: string | null;
  micEnabled: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  speakingSeconds: number;
  deviceType: string | null;
};

export type CallLogEntry = {
  id: string;
  channelId: string;
  callSessionId: string;
  livekitRoomName: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  maxParticipants: number;
  totalParticipants: number;
  participantSummary: Array<{
    profile_id: string;
    joined: string;
    left: string;
    spoke_seconds: number;
  }>;
  createdAt: string;
};

export type IncomingCall = {
  callSessionId: string;
  channelId: string;
  callerName: string;
  callerAvatar: string | null;
  roomName: string;
  workspaceId: string;
};

export type PTTState = "idle" | "connecting" | "connected_muted" | "talking";

export type CallSignalingEvent =
  | { type: "call_invite"; payload: IncomingCall }
  | { type: "call_accepted"; payload: { callSessionId: string } }
  | { type: "call_rejected"; payload: { callSessionId: string } }
  | { type: "call_cancelled"; payload: { callSessionId: string } }
  | { type: "call_ended"; payload: { callSessionId: string } }
  | {
      type: "group_call_started";
      payload: {
        callSessionId: string;
        initiatorName: string;
        roomName: string;
        participantCount: number;
      };
    };
