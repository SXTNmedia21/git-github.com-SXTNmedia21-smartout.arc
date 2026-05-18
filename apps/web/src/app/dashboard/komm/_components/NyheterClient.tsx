"use client";

/**
 * NyheterClient — Full-page bulletin board for company announcements.
 * Single column, centered, card-based feed. NOT a chat interface.
 *
 * Managers+ can compose announcements via a slide-out Sheet.
 * All users can view and react to announcements.
 */

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "@smartout/i18n";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Newspaper, Plus, Eye, Send, Smile, Filter, Pin } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { useChannels } from "../_hooks/use-channels";
import { useChannelMessages } from "../_hooks/use-channel-messages";
import { useChannelRealtime } from "../_hooks/use-channel-realtime";
import { useMarkAsRead } from "../_hooks/use-mark-as-read";
import { useToggleReaction } from "../_hooks/use-reactions";
import { useProfileRole } from "../_hooks/use-profile-role";
import { useSendAnnouncement } from "../_hooks/use-send-announcement";
import { useAudienceResolver, type AudienceInput } from "../_hooks/use-audience-resolver";
import { AudiencePicker } from "./AudiencePicker";
import {
  AnnouncementKindPicker,
  type AnnouncementKind,
  type AnnouncementTier,
} from "./AnnouncementKindPicker";
import { AnnouncementTierPicker } from "./AnnouncementTierPicker";
import { EntityLinkPicker, type EntityLinkValue } from "./EntityLinkPicker";
import { PinnedStrip } from "./PinnedStrip";
import { NewsCardMenu } from "./NewsCardMenu";
import { KommToolsBridge } from "../_tools/komm-tools-bridge";
import { usePinMessage } from "../_hooks/use-pin-message";
import type { MessageWithSender, AttachmentEntry, ReactionEntry } from "../_hooks/channel-types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RecipientCountPill } from "@/app/dashboard/_components/RecipientCountPill";

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const SPRING = { type: "spring" as const, stiffness: 35, damping: 22, mass: 2.2 };

const QUICK_EMOJIS = ["👍", "❤️", "🎉", "👏", "💡", "🔥"];

const ROLE_LABEL_KEYS: Record<string, string> = {
  employee: "nyheter.role_employee",
  manager: "nyheter.role_manager",
  admin: "nyheter.role_admin",
  owner: "nyheter.role_owner",
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function useFormatRelativeTime() {
  const { t } = useTranslation("komm");
  return useCallback(
    (dateStr: string): string => {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffHours < 1) return t("time.just_now");
      if (diffHours < 24) return t("time.hours_ago", { count: diffHours });
      if (diffDays === 1) return t("time.yesterday");
      if (diffDays < 7) return t("time.days_ago", { count: diffDays });
      return date.toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
    },
    [t],
  );
}

/* -------------------------------------------------------------------------- */
/*  ReactionBar                                                                */
/* -------------------------------------------------------------------------- */

type ReactionBarProps = {
  reactions: ReactionEntry[];
  messageId: string;
  profileId: string;
  channelId: string;
};

function ReactionBar({ reactions, messageId, profileId, channelId }: ReactionBarProps) {
  const { t } = useTranslation("komm");
  const toggleReaction = useToggleReaction(channelId, profileId);

  const grouped = useMemo(() => {
    const map = new Map<string, { count: number; hasOwn: boolean }>();
    for (const r of reactions) {
      const entry = map.get(r.emoji) ?? { count: 0, hasOwn: false };
      entry.count += 1;
      if (r.profile_id === profileId) entry.hasOwn = true;
      map.set(r.emoji, entry);
    }
    return map;
  }, [reactions, profileId]);

  const handleToggle = (emoji: string) => {
    toggleReaction.mutate({ messageId, emoji });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {Array.from(grouped.entries()).map(([emoji, { count, hasOwn }]) => (
        <Button
          key={emoji}
          variant="ghost"
          size="sm"
          className={`h-7 rounded-full px-2 text-xs ${
            hasOwn ? "bg-komm-accent/10 border-komm-accent/30 border" : "hover:bg-muted/60"
          }`}
          onClick={() => handleToggle(emoji)}
        >
          {emoji} {count}
        </Button>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 rounded-full px-2"
            aria-label={t("nyheter.add_reaction")}
          >
            <Smile className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="flex gap-1">
            {QUICK_EMOJIS.map((emoji) => (
              <Button
                key={emoji}
                variant="ghost"
                size="sm"
                className="h-8 w-8 rounded-full p-0 text-base"
                onClick={() => handleToggle(emoji)}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  ReadReceipt (placeholder)                                                  */
/* -------------------------------------------------------------------------- */

function ReadReceipt() {
  const { t } = useTranslation("komm");
  return (
    <div className="text-muted-foreground flex items-center gap-1 text-xs">
      <Eye className="h-3 w-3" />
      <span>{t("nyheter.read_placeholder")}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  AttachmentChips                                                            */
/* -------------------------------------------------------------------------- */

function AttachmentChips({ attachments }: { attachments: AttachmentEntry[] }) {
  if (attachments.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((att) => (
        <a
          key={att.id}
          href={att.url}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-muted/50 hover:bg-muted flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors"
        >
          <Newspaper className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{att.filename}</span>
        </a>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  NewsCard                                                                   */
/* -------------------------------------------------------------------------- */

type NewsCardProps = {
  message: MessageWithSender;
  profileId: string;
  channelId: string;
  formatRelativeTime: (dateStr: string) => string;
  isUnread?: boolean;
  index: number;
  shouldAnimate: boolean;
  canManage: boolean;
  onTogglePin: () => void;
};

function NewsCard({
  message,
  profileId,
  channelId,
  formatRelativeTime,
  isUnread,
  index,
  shouldAnimate,
  canManage,
  onTogglePin,
}: NewsCardProps) {
  const { t } = useTranslation("komm");
  const senderRoleKey = message.sender_role ? ROLE_LABEL_KEYS[message.sender_role] : undefined;

  // Split content: first line = title, rest = body
  const lines = message.content.split("\n");
  const title = lines[0] ?? "";
  const body = lines.slice(1).join("\n").trim();

  return (
    <motion.div
      id={`news-card-${message.message_id}`}
      initial={shouldAnimate ? { opacity: 0, y: 16 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        ...SPRING,
        delay: shouldAnimate ? index * 0.08 : 0,
      }}
      className={`bg-card/80 border-border/30 relative rounded-xl border p-5 backdrop-blur-sm ${
        isUnread ? "border-l-komm-accent border-l-2" : ""
      }`}
    >
      {/* Pin marker — top-right, visible only when pinned */}
      {message.is_pinned && (
        <Pin
          className="absolute top-4 right-12 h-4 w-4"
          style={{ color: "var(--color-pin)" }}
          aria-hidden="true"
        />
      )}
      {/* Manager-only context menu */}
      {canManage && <NewsCardMenu isPinned={message.is_pinned} onTogglePin={onTogglePin} />}
      {/* Author header */}
      <div className="mb-3 flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
            {(message.sender_name ?? "?").charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{message.sender_name}</span>
            {senderRoleKey && (
              <span className="text-muted-foreground text-[11px]">{t(senderRoleKey)}</span>
            )}
          </div>
          <p className="text-muted-foreground text-[11px]">
            {formatRelativeTime(message.created_at)}
          </p>
        </div>
      </div>

      {/* Title */}
      {title && <h3 className="font-heading mb-1 text-base">{title}</h3>}

      {/* Body */}
      {body && (
        <p className="text-foreground/80 mb-3 text-sm leading-relaxed whitespace-pre-wrap">
          {body}
        </p>
      )}

      {/* Attachments */}
      {message.attachments.length > 0 && (
        <div className="mb-3">
          <AttachmentChips attachments={message.attachments} />
        </div>
      )}

      {/* Footer: reactions + read receipt + operational badge */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <ReactionBar
            reactions={message.reactions}
            messageId={message.message_id}
            profileId={profileId}
            channelId={channelId}
          />
          {message.message_type === "announcement" && (
            <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-[0.16em] uppercase">
              {t("nyheter.operational_badge")}
            </span>
          )}
        </div>
        <ReadReceipt />
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*  ComposeAnnouncement (Sheet)                                                */
/* -------------------------------------------------------------------------- */

type ComposeProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string;
  profileId: string;
};

function ComposeAnnouncement({ open, onOpenChange, channelId, profileId }: ComposeProps) {
  const { t } = useTranslation("komm");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<AudienceInput>({ kind: "all" });
  const [announcementKind, setAnnouncementKind] = useState<AnnouncementKind>("general");
  const [announcementTier, setAnnouncementTier] = useState<AnnouncementTier>("work");
  const [linkedEntity, setLinkedEntity] = useState<EntityLinkValue>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendAnnouncement = useSendAnnouncement();

  // Resolve recipient count from current audience selection
  const audienceQuery = useAudienceResolver(audience);
  const recipientCount = audienceQuery.data?.count ?? 0;

  // Return the i18n label for the current audience kind
  function audienceLabel(): string {
    if (audience.kind === "all") return t("nyheter.audience_all");
    if (audience.kind === "on_duty") return t("nyheter.audience_on_duty");
    if (audience.kind === "department") return t("nyheter.audience_department");
    if (audience.kind === "role") return t("nyheter.audience_role");
    return t("nyheter.audience_individuals");
  }

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [body]);

  const handleSubmit = () => {
    if (!title.trim()) return;
    if (recipientCount === 0) return;
    const content = body.trim() ? `${title.trim()}\n${body.trim()}` : title.trim();
    const isTargeted = audience.kind !== "all";

    sendAnnouncement.mutate(
      {
        channelId,
        content,
        profileId,
        targetProfileIds: isTargeted ? (audienceQuery.data?.profileIds ?? []) : undefined,
        visibilityScope: isTargeted ? "targeted_members" : "all_members",
        audienceKind: audience.kind,
        audienceLabel: audienceLabel(),
        kind: announcementKind,
        tier: announcementTier,
        linkedEntityType: linkedEntity?.type,
        linkedEntityId: linkedEntity?.id,
        tags: [],
      },
      {
        onSuccess: () => {
          setTitle("");
          setBody("");
          setAudience({ kind: "all" });
          setAnnouncementKind("general");
          setAnnouncementTier("work");
          setLinkedEntity(null);
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("nyheter.compose_title")}</SheetTitle>
          <SheetDescription>{t("nyheter.compose_description")}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex flex-1 flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">{t("nyheter.field_title")}</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("nyheter.field_title_placeholder")}
            />
          </div>

          <div className="flex-1">
            <label className="mb-1.5 block text-sm font-medium">{t("nyheter.field_body")}</label>
            <Textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t("nyheter.field_body_placeholder")}
              className="min-h-[120px] resize-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {t("nyheter.audience_label")}
            </label>
            <AudiencePicker value={audience} onChange={setAudience} />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">{t("nyheter.kind.label")}</label>
            <AnnouncementKindPicker
              value={announcementKind}
              onChange={(nextKind, autoTier) => {
                setAnnouncementKind(nextKind);
                setAnnouncementTier(autoTier);
                setLinkedEntity(null);
              }}
              profileId={profileId}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">{t("nyheter.tier.label")}</label>
            <AnnouncementTierPicker
              value={announcementTier}
              onChange={setAnnouncementTier}
              kind={announcementKind}
              profileId={profileId}
            />
          </div>

          <EntityLinkPicker
            value={linkedEntity}
            onChange={setLinkedEntity}
            kind={announcementKind}
          />

          <div className="flex flex-wrap items-center gap-2.5">
            <RecipientCountPill count={recipientCount} />
          </div>
        </div>

        <div className="mt-4 flex justify-end border-t pt-4">
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || recipientCount === 0 || sendAnnouncement.isPending}
          >
            <Send className="mr-2 h-4 w-4" />
            {sendAnnouncement.isPending ? t("nyheter.publishing") : t("nyheter.publish")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* -------------------------------------------------------------------------- */
/*  NyheterClient (main export)                                                */
/* -------------------------------------------------------------------------- */

export function NyheterClient({ profileId }: { profileId: string }) {
  const { t } = useTranslation("komm");
  const shouldReduceMotion = useReducedMotion();
  const formatRelativeTime = useFormatRelativeTime();
  const [composeOpen, setComposeOpen] = useState(false);
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  // Role check for compose visibility
  const { isAtLeast } = useProfileRole(profileId);
  const canCompose = isAtLeast("manager");

  // Find news channels
  const { data: channelGroups } = useChannels();
  const newsChannel = useMemo(
    () => channelGroups?.flatMap((g) => g.channels).find((ch) => ch.channel_type === "news"),
    [channelGroups],
  );

  const channelId = newsChannel?.channel_id ?? null;
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useChannelMessages(channelId);

  // Live updates: re-fetch when a new announcement is published or reactions change.
  useChannelRealtime(workspaceId, channelId);

  // Messages come in reverse-chronological from the RPC, newest first is what we want
  const messages = useMemo(() => data?.pages.flat() ?? [], [data]);

  // Pin state — derived from messages; realtime fan-out via useChannelRealtime keeps in sync
  const pinnedMessages = useMemo(() => messages.filter((m) => m.is_pinned), [messages]);
  const pinMessage = usePinMessage();

  function togglePin(messageId: string, currentlyPinned: boolean) {
    if (!channelId) return;
    pinMessage.mutate({
      messageId,
      channelId,
      pin: !currentlyPinned,
      profileId,
    });
  }

  function jumpToCard(messageId: string) {
    const el = document.getElementById(`news-card-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary/40");
      setTimeout(() => el.classList.remove("ring-2", "ring-primary/40"), 700);
    }
  }

  // Auto-mark-as-read: when the feed opens with a newest message, advance the
  // viewer's last_read_message_id so the unread badge clears. Tracked per
  // (channel, message) so we only fire once per new arrival, not on every
  // re-render. Safe: useMarkAsRead is idempotent against the same value.
  const markAsRead = useMarkAsRead(channelId, profileId);
  const lastMarkedRef = useRef<string | null>(null);
  const newestMessageId = messages[0]?.message_id ?? null;
  useEffect(() => {
    if (!channelId || !newestMessageId) return;
    if (lastMarkedRef.current === newestMessageId) return;
    lastMarkedRef.current = newestMessageId;
    markAsRead.mutate({ messageId: newestMessageId });
  }, [channelId, newestMessageId, markAsRead]);

  /* ---- Loading state ---- */
  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-6">
          <div className="bg-muted h-7 w-24 animate-pulse rounded" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-muted h-36 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  /* ---- Empty state ---- */
  if (!newsChannel || messages.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-heading text-xl">{t("nyheter.title")}</h1>
          <div className="flex items-center gap-2">
            {canCompose && newsChannel && (
              <Button size="sm" onClick={() => setComposeOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                {t("nyheter.compose_button")}
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-20">
          <Newspaper className="text-muted-foreground/40 mb-4 h-12 w-12" />
          <p className="text-muted-foreground text-sm font-medium">{t("nyheter.empty_title")}</p>
          <p className="text-muted-foreground/70 mt-1 text-xs">{t("nyheter.empty_subtitle")}</p>
        </div>
        {newsChannel && (
          <ComposeAnnouncement
            open={composeOpen}
            onOpenChange={setComposeOpen}
            channelId={newsChannel.channel_id}
            profileId={profileId}
          />
        )}
      </div>
    );
  }

  /* ---- Feed ---- */
  return (
    <>
      <KommToolsBridge profileId={profileId} surface="channels" activeChannelId={null} />
      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* Header row */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-heading text-xl">{t("nyheter.title")}</h1>
          <div className="flex items-center gap-2">
            <Select defaultValue="all">
              <SelectTrigger className="h-8 w-auto gap-1.5 text-xs">
                <Filter className="h-3.5 w-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("nyheter.filter_all")}</SelectItem>
              </SelectContent>
            </Select>
            {canCompose && (
              <Button size="sm" onClick={() => setComposeOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                {t("nyheter.compose_button")}
              </Button>
            )}
          </div>
        </div>

        {/* Pinned strip — sticky above feed, hidden when nothing is pinned */}
        {newsChannel && (
          <PinnedStrip
            messages={pinnedMessages}
            canManage={canCompose}
            onUnpin={(id) => togglePin(id, true)}
            onJumpTo={jumpToCard}
          />
        )}

        {/* Card feed */}
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {messages.map((msg, i) => (
              <NewsCard
                key={msg.message_id}
                message={msg}
                profileId={profileId}
                channelId={newsChannel.channel_id}
                formatRelativeTime={formatRelativeTime}
                index={i}
                shouldAnimate={!shouldReduceMotion}
                canManage={canCompose}
                onTogglePin={() => togglePin(msg.message_id, msg.is_pinned)}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Load more */}
        {hasNextPage && (
          <div className="mt-6 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? t("nyheter.loading_more") : t("nyheter.load_more")}
            </Button>
          </div>
        )}

        {/* Compose sheet */}
        <ComposeAnnouncement
          open={composeOpen}
          onOpenChange={setComposeOpen}
          channelId={newsChannel.channel_id}
          profileId={profileId}
        />
      </div>
    </>
  );
}
