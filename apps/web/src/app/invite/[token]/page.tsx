"use client";

/**
 * invite/[token]/page.tsx
 * Invitation accept page. The invitee lands here from their invite link.
 *
 * Flow:
 * 1. Fetch invitation details by token
 * 2. Show form — pre-fill known fields, require unknown ones
 * 3. On submit: call accept-invitation Edge Function
 * 4. Sign the user in and redirect to dashboard
 */
import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, Building2, AlertCircle, Loader2 } from "lucide-react";
import { createClient } from "@smartout/supabase/client";

type InviteData = {
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  workspaceName: string;
  role: string;
  inviterName: string | null;
};

type InviteState =
  | { status: "loading" }
  | { status: "valid"; data: InviteData }
  | { status: "invalid"; message: string };

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const supabase = createClient();

  const [inviteState, setInviteState] = useState<InviteState>({ status: "loading" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Fetch invitation details by token
  useEffect(() => {
    async function fetchInvite() {
      const { data, error: fetchError } = await supabase
        .from("invitation")
        .select(
          `email, phone, first_name, last_name, role, status, expires_at,
           workspace:workspace_id(name),
           inviter:invited_by(display_name)`,
        )
        .eq("token", token)
        .single();

      if (fetchError || !data) {
        setInviteState({ status: "invalid", message: "Invitasjonen ble ikke funnet" });
        return;
      }

      if (data.status !== "pending") {
        setInviteState({
          status: "invalid",
          message:
            data.status === "accepted"
              ? "Denne invitasjonen er allerede brukt"
              : "Denne invitasjonen er ikke lenger gyldig",
        });
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setInviteState({ status: "invalid", message: "Denne invitasjonen har utløpt" });
        return;
      }

      const ws = data.workspace as unknown as { name: string } | null;
      const inviter = data.inviter as unknown as { display_name: string } | null;

      // Pre-fill known fields
      if (data.first_name) setFirstName(data.first_name);
      if (data.last_name) setLastName(data.last_name);
      if (data.email) setEmail(data.email);
      if (data.phone) setPhone(data.phone);

      setInviteState({
        status: "valid",
        data: {
          email: data.email,
          phone: data.phone,
          firstName: data.first_name,
          lastName: data.last_name,
          workspaceName: ws?.name ?? "en arbeidsplass",
          role: data.role,
          inviterName: inviter?.display_name ?? null,
        },
      });
    }

    fetchInvite();
  }, [token, supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError("Fullt navn er påkrevd");
      return;
    }

    if (!email.trim()) {
      setError("E-post er påkrevd");
      return;
    }

    if (!phone.trim()) {
      setError("Telefonnummer er påkrevd");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passordene er ikke like");
      return;
    }

    if (password.length < 8) {
      setError("Passordet må være minst 8 tegn");
      return;
    }

    setIsSubmitting(true);

    const { data, error: fnError } = await supabase.functions.invoke("accept-invitation", {
      body: {
        token,
        first_name: firstName,
        last_name: lastName,
        email: email.trim(),
        phone: phone.trim(),
        password,
      },
    });

    if (fnError || !data?.success) {
      setError(data?.error ?? fnError?.message ?? "Kunne ikke godta invitasjonen");
      setIsSubmitting(false);
      return;
    }

    // Sign the user in with the newly created credentials
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError("Konto opprettet, men innlogging feilet. Gå til innloggingssiden.");
      setIsSubmitting(false);
      return;
    }

    // Redirect to welcome page with context
    const welcomeParams = new URLSearchParams({
      workspace: invite.workspaceName,
      name: firstName,
    });
    router.push(`/welcome?${welcomeParams.toString()}`);
    router.refresh();
  }

  // --- Loading state ---
  if (inviteState.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[oklch(0.99_0.004_60)]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          <p className="font-medium text-[oklch(0.52_0.01_52)]">Verifiserer invitasjon...</p>
        </div>
      </div>
    );
  }

  // --- Invalid / expired / already accepted ---
  if (inviteState.status === "invalid") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[oklch(0.99_0.004_60)] px-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-rose-500" />
          <h2 className="text-2xl font-bold text-[oklch(0.15_0.01_50)]">{inviteState.message}</h2>
          <p className="text-[oklch(0.52_0.01_52)]">Kontakt din leder for en ny invitasjon.</p>
        </div>
      </div>
    );
  }

  const { data: invite } = inviteState;

  const inputClass =
    "block w-full rounded-xl border border-[oklch(0.91_0.006_55)] bg-white px-4 py-2.5 text-sm text-[oklch(0.15_0.01_50)] placeholder:text-[oklch(0.52_0.01_52)] shadow-sm transition-all focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 focus:outline-none";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[oklch(0.99_0.004_60)] px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="flex flex-col items-center justify-center text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500 shadow-lg shadow-orange-500/20">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-[oklch(0.15_0.01_50)]">
            Bli med i teamet
          </h2>
          <p className="mt-2 text-sm text-[oklch(0.52_0.01_52)]">
            {invite.inviterName ? (
              <>
                <span className="font-semibold text-[oklch(0.15_0.01_50)]">
                  {invite.inviterName}
                </span>{" "}
                har invitert deg til{" "}
              </>
            ) : (
              <>Du er invitert til </>
            )}
            <span className="font-semibold text-[oklch(0.15_0.01_50)]">{invite.workspaceName}</span>
          </p>
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-[oklch(0.91_0.006_55)] bg-white p-8 shadow-lg">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Name — pre-filled but always editable so the invitee confirms */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-wider text-[oklch(0.52_0.01_52)] uppercase">
                  Fornavn
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={inputClass}
                  placeholder="Kari"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-wider text-[oklch(0.52_0.01_52)] uppercase">
                  Etternavn
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={inputClass}
                  placeholder="Nordmann"
                />
              </div>
            </div>

            {/* Email — required, editable if not pre-set */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold tracking-wider text-[oklch(0.52_0.01_52)] uppercase">
                E-post
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="kari@example.com"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold tracking-wider text-[oklch(0.52_0.01_52)] uppercase">
                Telefon
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
                placeholder="+47 900 00 000"
              />
            </div>

            {/* Password */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold tracking-wider text-[oklch(0.52_0.01_52)] uppercase">
                Opprett passord
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="Minst 8 tegn"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold tracking-wider text-[oklch(0.52_0.01_52)] uppercase">
                Bekreft passord
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                placeholder="Gjenta passord"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-orange-400 hover:shadow-[0_0_20px_rgba(249,115,22,0.3)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5" />
                    Godta invitasjon
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-[oklch(0.52_0.01_52)]">
          Ved å godta denne invitasjonen godtar du våre vilkår og personvernregler.
        </p>
      </div>
    </div>
  );
}
