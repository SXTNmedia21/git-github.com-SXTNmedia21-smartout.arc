export const callKeys = {
  all: ["calls"] as const,
  status: (workspaceId: string, channelId: string) =>
    ["calls", "status", workspaceId, channelId] as const,
  history: (workspaceId: string, channelId: string) =>
    ["calls", "history", workspaceId, channelId] as const,
};
