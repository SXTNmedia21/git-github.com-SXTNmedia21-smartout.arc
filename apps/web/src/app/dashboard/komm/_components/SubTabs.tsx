"use client";

import { cn } from "@/lib/utils";

export type KommTab = "kanaler" | "chat" | "nyheter";

type Props = {
  activeTab: KommTab;
  onTabChange: (tab: KommTab) => void;
  channelUnread: number;
  chatUnread: number;
};

const TABS: { key: KommTab; label: string }[] = [
  { key: "kanaler", label: "Kanaler" },
  { key: "chat", label: "Chat" },
  { key: "nyheter", label: "Nyheter" },
];

export function SubTabs({ activeTab, onTabChange, channelUnread, chatUnread }: Props) {
  const getBadge = (key: KommTab) => {
    if (key === "kanaler" && channelUnread > 0) return channelUnread;
    if (key === "chat" && chatUnread > 0) return chatUnread;
    return 0;
  };

  return (
    <div className="flex border-b">
      {TABS.map((tab) => {
        const badge = getBadge(tab.key);
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={cn(
              "relative flex-1 py-2.5 text-center text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {badge > 0 && (
              <span className="bg-primary text-primary-foreground ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
            {activeTab === tab.key && (
              <div className="bg-primary absolute right-[20%] bottom-0 left-[20%] h-0.5 rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
