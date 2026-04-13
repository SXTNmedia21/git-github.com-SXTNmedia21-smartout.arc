"use client";

import { cn } from "@/lib/utils";
import { useTranslation } from "@smartout/i18n";

export type KommTab = "oversikt" | "kanaler" | "chat" | "nyheter";

type Props = {
  activeTab: KommTab;
  onTabChange: (tab: KommTab) => void;
  channelUnread: number;
  chatUnread: number;
};

const TAB_KEYS: KommTab[] = ["oversikt", "kanaler", "chat", "nyheter"];

const TAB_I18N: Record<KommTab, string> = {
  oversikt: "tabs.overview",
  kanaler: "tabs.channels",
  chat: "tabs.chat",
  nyheter: "tabs.news",
};

export function SubTabs({ activeTab, onTabChange, channelUnread, chatUnread }: Props) {
  const { t } = useTranslation("komm");
  const getBadge = (key: KommTab) => {
    if (key === "kanaler" && channelUnread > 0) return channelUnread;
    if (key === "chat" && chatUnread > 0) return chatUnread;
    return 0;
  };

  return (
    <div className="flex border-b">
      {TAB_KEYS.map((key) => {
        const badge = getBadge(key);
        return (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            className={cn(
              "relative flex-1 py-2.5 text-center text-sm font-medium transition-colors",
              activeTab === key ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(TAB_I18N[key])}
            {badge > 0 && (
              <span className="bg-primary text-primary-foreground ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
            {activeTab === key && (
              <div className="bg-primary absolute right-[20%] bottom-0 left-[20%] h-0.5 rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
