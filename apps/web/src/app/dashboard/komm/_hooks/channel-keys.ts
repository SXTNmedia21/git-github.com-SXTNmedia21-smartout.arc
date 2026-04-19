export const channelKeys = {
  all: ["channels"] as const,
  list: (workspaceId: string) => ["channels", "list", workspaceId] as const,
  detail: (workspaceId: string, channelId: string) =>
    ["channels", "detail", workspaceId, channelId] as const,
  messages: (workspaceId: string, channelId: string) =>
    ["channels", "messages", workspaceId, channelId] as const,
  members: (workspaceId: string, channelId: string) =>
    ["channels", "members", workspaceId, channelId] as const,
  unread: (workspaceId: string) => ["channels", "unread", workspaceId] as const,
  callStatus: (workspaceId: string, channelId: string) =>
    ["channels", "call-status", workspaceId, channelId] as const,
  callHistory: (workspaceId: string, channelId: string) =>
    ["channels", "call-history", workspaceId, channelId] as const,
  workspaceActiveCalls: (workspaceId: string) =>
    ["channels", "workspace-active-calls", workspaceId] as const,
};
