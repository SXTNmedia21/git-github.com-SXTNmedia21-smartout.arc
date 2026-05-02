"use client";

/**
 * OversiktClient — Intelligence dashboard for the Komm module.
 *
 * Bird's-eye view of communication activity: stat cards, quick actions,
 * and a chronological activity feed. Reuses existing data hooks
 * (channels, unread counts, helpdesk ticket count, communication overview).
 *
 * The legacy "Rapporter problem" CTA and HelpDesk dialog have been removed
 * per ADR-0165. Ticket count now reads from engine_state (canonical model).
 * The user path to file a helpdesk ticket is via a desk channel composer.
 */

import { useMemo, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@smartout/i18n";
import { motion, useReducedMotion } from "framer-motion";
import {
  Megaphone,
  ArrowRightLeft,
  HelpCircle,
  Sparkles,
  Phone,
  Settings,
  type LucideProps,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { useChannels } from "../_hooks/use-channels";
import { useUnreadCounts } from "../_hooks/use-unread-counts";
import { useMyHelpdeskCount } from "../_hooks/use-my-helpdesk-count";
import { KommToolsBridge } from "../_tools/komm-tools-bridge";
import {
  useCommunicationOverview,
  type CommunicationEntry,
} from "../_hooks/use-communication-overview";

// ---------------------------------------------------------------------------
// Animation constants
// ---------------------------------------------------------------------------

const SPRING = { type: "spring" as const, stiffness: 35, damping: 22, mass: 2.2 };

const STAGGER_CONTAINER = {
  hidden: {},
  visible: (stagger: number) => ({
    transition: { staggerChildren: stagger },
  }),
};

const SCALE_ITEM = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: SPRING },
};

const SLIDE_ITEM = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: SPRING },
};

// ---------------------------------------------------------------------------
// Activity type config
// ---------------------------------------------------------------------------

type ActivityType =
  | "announcement"
  | "handoff"
  | "help_request"
  | "ai_action"
  | "call"
  | "system"
  | "brief"
  | "reminder"
  | "summary"
  | "planning_event";

const ACTIVITY_ICON: Record<ActivityType, ComponentType<LucideProps>> = {
  announcement: Megaphone,
  handoff: ArrowRightLeft,
  help_request: HelpCircle,
  ai_action: Sparkles,
  call: Phone,
  system: Settings,
  brief: Megaphone,
  reminder: HelpCircle,
  summary: Settings,
  planning_event: Settings,
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  value,
  label,
  accent = false,
  reducedMotion,
}: {
  value: number;
  label: string;
  accent?: boolean;
  reducedMotion: boolean;
}) {
  return (
    <motion.div variants={reducedMotion ? undefined : SCALE_ITEM}>
      <Card
        className={cn(
          "border-border/30 bg-card/60 rounded-xl backdrop-blur-sm",
          accent && "border-komm-accent",
        )}
      >
        <CardContent className="p-4">
          <p className="font-mono text-2xl font-semibold">{value}</p>
          <p className="text-muted-foreground mt-1 text-xs">{label}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function QuickActionCard({
  icon: Icon,
  label,
  onClick,
  reducedMotion,
}: {
  icon: ComponentType<LucideProps>;
  label: string;
  onClick: () => void;
  reducedMotion: boolean;
}) {
  return (
    <motion.div variants={reducedMotion ? undefined : SCALE_ITEM}>
      <Card
        className="border-border/20 bg-card/40 hover:bg-accent/30 cursor-pointer rounded-xl transition-colors"
        onClick={onClick}
      >
        <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
          <div className="bg-komm-accent/10 flex h-10 w-10 items-center justify-center rounded-xl transition-transform hover:scale-105">
            <Icon className="text-komm-accent h-5 w-5" />
          </div>
          <span className="text-sm font-medium">{label}</span>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ActivityItem({
  type,
  title,
  content,
  date,
  reducedMotion,
  formatDate,
}: {
  type: ActivityType;
  title: string;
  content: string;
  date: string;
  reducedMotion: boolean;
  formatDate: (dateStr: string) => string;
}) {
  const Icon = ACTIVITY_ICON[type] ?? Settings;
  const formatted = formatDate(date);

  return (
    <motion.div
      variants={reducedMotion ? undefined : SLIDE_ITEM}
      className="hover:bg-muted/30 flex items-center gap-3 px-4 py-3 transition-colors"
    >
      <div className="bg-muted/50 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
        <Icon className="text-muted-foreground h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          <span className="font-medium">{title}</span>
          {content && <span className="text-muted-foreground"> — {content}</span>}
        </p>
      </div>
      <span className="text-muted-foreground shrink-0 text-xs">{formatted}</span>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function useFormatRelativeDate() {
  const { t } = useTranslation("komm");
  return (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60_000);

    if (diffMins < 1) return t("time.just_now");
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return t("time.hours_ago", { count: diffHours });
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return t("time.yesterday");
    if (diffDays < 7) return t("time.days_ago", { count: diffDays });
    return date.toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
  };
}

function mapEntryToActivity(entry: CommunicationEntry): {
  type: ActivityType;
  title: string;
  content: string;
  date: string;
} {
  return {
    type: entry.type as ActivityType,
    title: entry.title,
    content: entry.content,
    date: entry.date,
  };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function OversiktClient({ profileId }: { profileId: string }) {
  const { t } = useTranslation("komm");
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const rm = !!prefersReducedMotion;

  const formatDate = useFormatRelativeDate();

  // Data hooks
  const { data: channelGroups } = useChannels();
  const { data: unreadCounts } = useUnreadCounts();
  const { data: pendingHelpCount } = useMyHelpdeskCount(profileId);
  const { data: overviewEntries, isLoading: overviewLoading } = useCommunicationOverview();

  // Derived stats
  const channelCount = useMemo(() => {
    if (!channelGroups) return 0;
    return channelGroups.reduce((sum, g) => sum + g.channels.length, 0);
  }, [channelGroups]);

  const unreadTotal = useMemo(() => {
    if (!unreadCounts) return 0;
    return unreadCounts.reduce((sum, c) => sum + c.unread_count, 0);
  }, [unreadCounts]);

  const pendingHelp = pendingHelpCount ?? 0;

  const conversationsToday = useMemo(() => {
    if (!channelGroups) return 0;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();
    return channelGroups.reduce((sum, g) => {
      return (
        sum +
        g.channels.filter((ch) => {
          if (!ch.last_message_at) return false;
          return new Date(ch.last_message_at).getTime() >= todayMs;
        }).length
      );
    }, 0);
  }, [channelGroups]);

  // Activity feed (latest 20)
  const activities = useMemo(() => {
    if (!overviewEntries) return [];
    return overviewEntries.slice(0, 20).map(mapEntryToActivity);
  }, [overviewEntries]);

  // Quick action handlers
  const handleAskBotsson = () => {
    router.push("/dashboard/ai");
  };

  return (
    <>
      <KommToolsBridge profileId={profileId} surface="channels" activeChannelId={null} />
      <div className="mx-auto max-w-5xl space-y-8 p-6">
        {/* Stat cards */}
        <motion.div
          className="grid grid-cols-2 gap-4 lg:grid-cols-4"
          variants={rm ? undefined : STAGGER_CONTAINER}
          custom={0.05}
          initial="hidden"
          animate="visible"
        >
          <StatCard value={channelCount} label={t("oversikt.stat_channels")} reducedMotion={rm} />
          <StatCard
            value={conversationsToday}
            label={t("oversikt.stat_conversations_today")}
            reducedMotion={rm}
          />
          <StatCard value={unreadTotal} label={t("oversikt.stat_unread")} reducedMotion={rm} />
          <StatCard
            value={pendingHelp}
            label={t("oversikt.stat_pending_help")}
            accent={pendingHelp > 0}
            reducedMotion={rm}
          />
        </motion.div>

        {/* Quick actions */}
        <section>
          <h2 className="font-heading text-muted-foreground mb-3 text-sm tracking-wider">
            {t("oversikt.quick_actions")}
          </h2>
          <motion.div
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            variants={rm ? undefined : STAGGER_CONTAINER}
            custom={0.05}
            initial="hidden"
            animate="visible"
          >
            <QuickActionCard
              icon={Sparkles}
              label={t("oversikt.action_botsson")}
              onClick={handleAskBotsson}
              reducedMotion={rm}
            />
          </motion.div>
        </section>

        {/* Activity feed */}
        <section>
          <h2 className="font-heading text-muted-foreground mb-3 text-sm tracking-wider">
            {t("oversikt.recent_activity")}
          </h2>
          <Card className="border-border/30 bg-card/60 rounded-xl backdrop-blur-sm">
            {overviewLoading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="bg-muted h-8 w-8 animate-pulse rounded-lg" />
                    <div className="flex-1 space-y-1">
                      <div className="bg-muted h-3 w-48 animate-pulse rounded" />
                      <div className="bg-muted h-2 w-16 animate-pulse rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activities.length === 0 ? (
              <div className="flex items-center justify-center p-8">
                <p className="text-muted-foreground text-xs">{t("oversikt.empty_activity")}</p>
              </div>
            ) : (
              <motion.div
                className="divide-border/30 divide-y"
                variants={rm ? undefined : STAGGER_CONTAINER}
                custom={0.04}
                initial="hidden"
                animate="visible"
              >
                {activities.map((a, idx) => (
                  <ActivityItem
                    key={`${a.type}-${a.date}-${idx}`}
                    type={a.type}
                    title={a.title}
                    content={a.content}
                    date={a.date}
                    reducedMotion={rm}
                    formatDate={formatDate}
                  />
                ))}
              </motion.div>
            )}
          </Card>
        </section>
      </div>
    </>
  );
}
