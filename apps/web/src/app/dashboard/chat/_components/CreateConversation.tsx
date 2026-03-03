"use client";

import { useState } from "react";
import { MessageSquare, Sparkles, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ChatConversationType } from "../_hooks/chat-types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: {
    type: ChatConversationType;
    name?: string;
    description?: string;
    participantIds: string[];
  }) => void;
  isCreating: boolean;
};

const TYPE_OPTIONS: Array<{
  type: ChatConversationType;
  label: string;
  description: string;
  icon: typeof Users;
}> = [
  {
    type: "group",
    label: "Gruppe",
    description: "Avdeling, team eller prosjekt",
    icon: Users,
  },
  {
    type: "dm",
    label: "Direktemelding",
    description: "Privat 1-til-1 samtale",
    icon: MessageSquare,
  },
  {
    type: "ai",
    label: "AI Assistent",
    description: "Sp\u00f8r AI om hjelp med en oppgave",
    icon: Sparkles,
  },
];

export function CreateConversation({ open, onOpenChange, onCreate, isCreating }: Props) {
  const [step, setStep] = useState<"type" | "details">("type");
  const [selectedType, setSelectedType] = useState<ChatConversationType | null>(null);
  const [name, setName] = useState("");

  const handleSelectType = (type: ChatConversationType) => {
    setSelectedType(type);
    if (type === "ai") {
      // AI conversations are created immediately with no extra details
      onCreate({ type: "ai", name: "AI Assistent", participantIds: [] });
      return;
    }
    setStep("details");
  };

  const handleCreate = () => {
    if (!selectedType) return;
    onCreate({
      type: selectedType,
      name: name.trim() || undefined,
      participantIds: [], // TODO: participant picker in future iteration
    });
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setStep("type");
      setSelectedType(null);
      setName("");
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{step === "type" ? "Ny samtale" : "Opprett samtale"}</DialogTitle>
        </DialogHeader>

        {step === "type" && (
          <div className="flex flex-col gap-2 pt-2">
            {TYPE_OPTIONS.map(({ type, label, description, icon: Icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => handleSelectType(type)}
                disabled={isCreating}
                className={cn(
                  "border-border flex items-center gap-3 rounded-lg border p-4 text-left transition-colors",
                  "hover:bg-accent",
                )}
              >
                <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-lg">
                  <Icon className="text-muted-foreground h-5 w-5" />
                </div>
                <div>
                  <p className="text-foreground text-sm font-medium">{label}</p>
                  <p className="text-muted-foreground text-xs">{description}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {step === "details" && (
          <div className="flex flex-col gap-4 pt-2">
            <div>
              <Label htmlFor="conv-name">
                {selectedType === "dm" ? "Velg person" : "Gruppenavn"}
              </Label>
              <Input
                id="conv-name"
                placeholder={
                  selectedType === "dm"
                    ? "S\u00f8k etter navn..."
                    : "F.eks. Kj\u00f8kkenet, Vaktansvarlige"
                }
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setStep("type");
                  setSelectedType(null);
                }}
              >
                Tilbake
              </Button>
              <Button onClick={handleCreate} disabled={isCreating || !name.trim()}>
                Opprett
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
