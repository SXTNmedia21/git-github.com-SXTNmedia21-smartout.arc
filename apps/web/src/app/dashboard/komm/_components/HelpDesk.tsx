"use client";

import { useState } from "react";
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
    label: "Spør Botsson",
    sub: "AI-assistent",
    icon: Bot,
    color: "bg-amber-500/15 text-amber-500",
  },
  {
    key: "problem",
    label: "Meld problem",
    sub: "Til leder",
    icon: AlertTriangle,
    color: "bg-red-500/15 text-red-500",
  },
  {
    key: "manual",
    label: "Finn manual",
    sub: "Søk i håndboken",
    icon: BookOpen,
    color: "bg-blue-500/15 text-blue-500",
  },
  {
    key: "call",
    label: "Ring leder",
    sub: "Direkte kontakt",
    icon: Phone,
    color: "bg-green-500/15 text-green-500",
  },
];

type Props = {
  profileId: string;
  onClose: () => void;
};

export function HelpDesk({ profileId, onClose }: Props) {
  const { data: requests, isLoading } = useHelpRequests();
  const createRequest = useCreateHelpRequest(profileId);
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
          <DialogTitle>Trenger du hjelp?</DialogTitle>
        </DialogHeader>

        {showCreateForm ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Hva trenger du hjelp med?</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="f.eks. Oppvaskmaskin lekker"
                className="h-9"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Beskrivelse (valgfritt)</Label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Beskriv problemet..."
                rows={3}
                className="bg-muted focus:ring-primary w-full resize-none rounded-md px-3 py-2 text-sm focus:ring-1 focus:outline-none"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setShowCreateForm(false)}>
                Tilbake
              </Button>
              <Button
                size="sm"
                onClick={handleCreateRequest}
                disabled={!title.trim() || createRequest.isPending}
              >
                Send henvendelse
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
                      <p className="text-sm font-medium">{action.label}</p>
                      <p className="text-muted-foreground text-xs">{action.sub}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* My tickets */}
            <div>
              <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                Mine henvendelser
              </p>
              <ScrollArea className="max-h-48">
                {isLoading ? (
                  <p className="text-muted-foreground p-2 text-xs">Laster...</p>
                ) : !requests || requests.length === 0 ? (
                  <p className="text-muted-foreground p-2 text-xs">Ingen henvendelser ennå</p>
                ) : (
                  <div className="space-y-2">
                    {requests.map((req) => (
                      <div key={req.id} className="rounded-lg border p-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                              req.status === "resolved" || req.status === "closed"
                                ? "bg-green-500/15 text-green-500"
                                : "bg-amber-500/15 text-amber-500",
                            )}
                          >
                            {req.status === "open"
                              ? "Åpen"
                              : req.status === "in_progress"
                                ? "Under arbeid"
                                : req.status === "resolved"
                                  ? "Løst"
                                  : "Lukket"}
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
