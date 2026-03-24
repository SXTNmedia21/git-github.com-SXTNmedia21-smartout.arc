"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import type { WizardStepProps } from "@smartout/ui";
import type { JoinState } from "../types";

const EMPLOYEE_COUNTS = [
  { value: "1-5", label: "1-5" },
  { value: "6-15", label: "6-15" },
  { value: "16-30", label: "16-30" },
  { value: "31-50", label: "31-50" },
  { value: "50+", label: "50+" },
];

export function Step6Team({ state, updateState, next, back }: WizardStepProps<JoinState>) {
  const [employeeCount, setEmployeeCount] = useState(state.team.employeeCount ?? "");
  const [invites, setInvites] = useState<string[]>(state.team.teamInvites ?? [""]);
  const [inviteErrors, setInviteErrors] = useState<Record<number, string>>({});

  const addInvite = () => {
    setInvites((prev) => [...prev, ""]);
  };

  const removeInvite = (index: number) => {
    setInvites((prev) => prev.filter((_, i) => i !== index));
    setInviteErrors((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const updateInvite = (index: number, value: string) => {
    setInvites((prev) => prev.map((v, i) => (i === index ? value : v)));
    setInviteErrors((prev) => ({ ...prev, [index]: "" }));
  };

  const validateEmail = (email: string): boolean => {
    if (!email) return true; // empty is ok, we filter later
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleFinish = () => {
    // Validate non-empty emails
    const errors: Record<number, string> = {};
    invites.forEach((email, index) => {
      if (email && !validateEmail(email)) {
        errors[index] = "Ugyldig e-postadresse";
      }
    });

    if (Object.keys(errors).length > 0) {
      setInviteErrors(errors);
      return;
    }

    const validEmails = invites.filter((email) => email && validateEmail(email));

    updateState({
      team: {
        ...state.team,
        employeeCount: employeeCount || undefined,
        teamInvites: validEmails.length > 0 ? validEmails : undefined,
      },
    });

    // Trigger wizard completion (last step)
    next();
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div>
        <h2 className="font-heading text-foreground text-2xl font-bold">Team</h2>
        <p className="text-muted-foreground mt-1 text-sm">Inviter teamet ditt til Smartout.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="employeeCount">Antall ansatte</Label>
          <Select value={employeeCount} onValueChange={setEmployeeCount}>
            <SelectTrigger id="employeeCount">
              <SelectValue placeholder="Velg..." />
            </SelectTrigger>
            <SelectContent>
              {EMPLOYEE_COUNTS.map((count) => (
                <SelectItem key={count.value} value={count.value}>
                  {count.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Inviter teammedlemmer</Label>
          <div className="space-y-2">
            {invites.map((email, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  type="email"
                  placeholder="navn@bedrift.no"
                  value={email}
                  onChange={(e) => updateInvite(index, e.target.value)}
                  aria-invalid={!!inviteErrors[index]}
                />
                {invites.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeInvite(index)}
                    className="text-muted-foreground hover:text-destructive h-9 w-9 shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {invites.map(
              (_, index) =>
                inviteErrors[index] && (
                  <p key={`error-${index}`} className="text-destructive text-xs">
                    {inviteErrors[index]}
                  </p>
                ),
            )}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={addInvite} className="mt-1">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Legg til
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={back} className="flex-1">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Tilbake
          </Button>
          <Button
            type="button"
            onClick={handleFinish}
            className="bg-brand-orange hover:bg-brand-orange-dark flex-1 text-white"
          >
            Fullfor registrering
          </Button>
        </div>
        <button
          type="button"
          onClick={() => {
            updateState({ team: {} });
            next();
          }}
          className="text-muted-foreground hover:text-foreground text-center text-sm underline transition-colors"
        >
          Hopp over
        </button>
      </div>
    </div>
  );
}
