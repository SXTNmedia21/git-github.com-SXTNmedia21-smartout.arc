"use client";

// Change-password card for the security tab.
// Three inputs (current, new, confirm). Re-authenticates with current password
// before calling supabase.auth.updateUser({ password }) — protects against
// session-hijack scenarios where a stolen JWT alone shouldn't allow rotation.

import { useState } from "react";
import { Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@smartout/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";

const MIN_LENGTH = 8;

export function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const tooShort = newPassword.length > 0 && newPassword.length < MIN_LENGTH;
  const sameAsCurrent = newPassword.length > 0 && newPassword === currentPassword;
  const canSubmit =
    !submitting &&
    currentPassword.length > 0 &&
    newPassword.length >= MIN_LENGTH &&
    newPassword === confirmPassword &&
    !sameAsCurrent;

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user?.email) {
        toast.error("Kunne ikke hente brukerdata. Logg inn på nytt.");
        return;
      }

      // Re-auth with current password. If wrong, signInWithPassword returns an
      // error and the existing session is NOT invalidated (Supabase doesn't
      // log you out on failed re-login).
      const { error: reauthErr } = await supabase.auth.signInWithPassword({
        email: userData.user.email,
        password: currentPassword,
      });
      if (reauthErr) {
        toast.error("Feil nåværende passord");
        return;
      }

      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateErr) {
        toast.error(updateErr.message || "Kunne ikke oppdatere passord");
        return;
      }

      toast.success("Passord oppdatert");
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Uventet feil");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="h-4 w-4" /> Bytt passord
        </CardTitle>
        <CardDescription>
          Bekreft nåværende passord før du kan velge et nytt. Minimum {MIN_LENGTH} tegn.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="current-password">Nåværende passord</Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="new-password">Nytt passord</Label>
          <div className="relative">
            <Input
              id="new-password"
              type={showNew ? "text" : "password"}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={submitting}
            />
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
              aria-label={showNew ? "Skjul passord" : "Vis passord"}
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {newPassword.length > 0 && (
            <PasswordStrengthMeter password={newPassword} minLength={MIN_LENGTH} />
          )}
          {tooShort && <p className="text-destructive text-xs">Minimum {MIN_LENGTH} tegn</p>}
          {sameAsCurrent && (
            <p className="text-destructive text-xs">
              Nytt passord må være forskjellig fra nåværende
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Bekreft nytt passord</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={submitting}
          />
          {mismatch && <p className="text-destructive text-xs">Passordene matcher ikke</p>}
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Lock className="mr-2 h-4 w-4" />
            )}
            Lagre nytt passord
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
