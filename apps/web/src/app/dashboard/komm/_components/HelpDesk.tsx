"use client";

import { useState } from "react";
import { useTranslation } from "@smartout/i18n";
import { useHelpRequests, useCreateHelpRequest } from "../_hooks/use-help-requests";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, AlertTriangle, BookOpen, Phone, X } from "lucide-react";
import { cn } from "@/lib/utils";

const QUICK_ACTIONS = [
  {
    key: "botsson",
    labelKey: "helpdesk.ask_botsson",
    subKey: "helpdesk.ai_assistant",
    icon: Bot,
    color: "bg-komm-ai/15 text-komm-ai",
  },
  {
    key: "problem",
    labelKey: "helpdesk.report_problem",
    subKey: "helpdesk.to_manager",
    icon: AlertTriangle,
    color: "bg-komm-problem/15 text-komm-problem",
  },
  {
    key: "manual",
    labelKey: "helpdesk.find_manual",
    subKey: "helpdesk.search_handbook",
    icon: BookOpen,
    color: "bg-komm-manual/15 text-komm-manual",
  },
  {
    key: "call",
    labelKey: "helpdesk.call_manager",
    subKey: "helpdesk.direct_contact",
    icon: Phone,
    color: "bg-komm-call-active/15 text-komm-call-active",
  },
] as const;

type Props = {
  profileId: string;
  /**
   * The helpdesk-enabled channel to route new tickets to. When undefined,
   * the "Rapporter problem" submit button is disabled — the workspace has
   * not configured a helpdesk channel yet.
   *
   * ADR-0173: this ID is forwarded to `openPrivateTicket` Server Action,
   * never to a direct table write. The capability tool owns gate_action +
   * telemetry.
   */
  deskChannelId?: string;
  onClose: () => void;
};

export function HelpDesk({ profileId, deskChannelId, onClose }: Props) {
  const { t } = useTranslation("komm");
  const { data: requests, isLoading } = useHelpRequests(profileId);
  const createRequest = useCreateHelpRequest(profileId, deskChannelId);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleQuickAction = (key: string) => {
    if (key === "problem") {
      setShowCreateForm(true);
    }
    // Other actions will be wired later (Botsson DM, manual search, call)
  };

  const handleCreateRequest = () => {
    if (!title.trim()) return;
    createRequest.mutate(
      { title: title.trim(), description: description.trim() || undefined },
      {
        onSuccess: () => {
          setTitle("");
          setDescription("");
          setShowCreateForm(false);
        },
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("helpdesk.dialog_title")}</DialogTitle>
        </DialogHeader>

        {showCreateForm ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("helpdesk.subject_label")}</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("helpdesk.subject_placeholder")}
                className="h-9"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("helpdesk.description_label")}</Label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("helpdesk.description_placeholder")}
                rows={3}
                className="bg-muted focus:ring-primary w-full resize-none rounded-md px-3 py-2 text-sm focus:ring-1 focus:outline-none"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setShowCreateForm(false)}>
                {t("helpdesk.back")}
              </Button>
              <Button
                size="sm"
                onClick={handleCreateRequest}
                disabled={!title.trim() || createRequest.isPending || !deskChannelId}
              >
                {t("helpdesk.submit")}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-2">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.key}
                    onClick={() => handleQuickAction(action.key)}
                    className="hover:bg-accent/50 flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors"
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full",
                        action.color,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">{t(action.labelKey)}</p>
                      <p className="text-muted-foreground text-xs">{t(action.subKey)}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* My tickets */}
            <div>
              <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                {t("helpdesk.my_requests")}
              </p>
              <ScrollArea className="max-h-48">
                {isLoading ? (
                  <p className="text-muted-foreground p-2 text-xs">{t("helpdesk.loading")}</p>
                ) : !requests || requests.length === 0 ? (
                  <p className="text-muted-foreground p-2 text-xs">{t("helpdesk.no_requests")}</p>
                ) : (
                  <div className="space-y-2">
                    {requests.map((req) => (
                      <div key={req.id} className="rounded-lg border p-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                              req.status === "resolved" || req.status === "closed"
                                ? "bg-komm-summary/15 text-komm-summary"
                                : "bg-komm-ai/15 text-komm-ai",
                            )}
                          >
                            {req.status === "open"
                              ? t("helpdesk.status_open")
                              : req.status === "in_progress"
                                ? t("helpdesk.status_in_progress")
                                : req.status === "resolved"
                                  ? t("helpdesk.status_resolved")
                                  : t("helpdesk.status_closed")}
                          </span>
                          <span className="truncate text-sm font-medium">{req.title}</span>
                        </div>
                        {req.description && (
                          <p className="text-muted-foreground mt-1 text-xs">{req.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
