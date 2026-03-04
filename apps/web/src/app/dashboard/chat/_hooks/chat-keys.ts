/**
 * TanStack Query key factory for all chat queries.
 * Structured for granular invalidation.
 * Connected to: all use-*.ts hooks in this folder.
 */
export const chatKeys = {
  all: ["chat"] as const,

  conversations: (workspaceId: string) => ["chat", "conversations", workspaceId] as const,

  conversation: (workspaceId: string, conversationId: string) =>
    ["chat", "conversation", workspaceId, conversationId] as const,

  messages: (workspaceId: string, conversationId: string) =>
    ["chat", "messages", workspaceId, conversationId] as const,

  participants: (workspaceId: string, conversationId: string) =>
    ["chat", "participants", workspaceId, conversationId] as const,

  unreadCounts: (workspaceId: string) => ["chat", "unread", workspaceId] as const,
};
