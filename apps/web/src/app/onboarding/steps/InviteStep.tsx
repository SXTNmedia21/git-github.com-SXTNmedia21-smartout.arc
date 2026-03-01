"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@smartout/supabase/client";
import { Mail, Phone, Link2, CheckCircle2, Loader2, ArrowRight, Copy, Users } from "lucide-react";
import { useWizard } from "../WizardContext";

export function InviteStep() {
  const wizard = useWizard();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [loading, setLoading] = useState<"email" | "sms" | "link" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dashboardUrl =
    process.env.NEXT_PUBLIC_ROOT_DOMAIN === "localhost"
      ? "/dashboard"
      : `https://${wizard.activatedWorkspaceSlug}.smartout.ai/dashboard`;

  // Auto-generate a shareable link on mount
  const generateLink = useCallback(async () => {
    if (inviteLink || !wizard.activatedWorkspaceId) return;
    setLoading("link");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("create-invitation", {
        body: {
          workspace_id: wizard.activatedWorkspaceId,
          invite_type: "link",
          role: "employee",
        },
      });
      if (fnError) throw new Error(fnError.message);
      if (data?.token) {
        const baseUrl =
          process.env.NEXT_PUBLIC_ROOT_DOMAIN === "localhost"
            ? "http://localhost:3050"
            : "https://app.smartout.ai";
        setInviteLink(`${baseUrl}/invite/${data.token}`);
      }
    } catch (err) {
      console.error("Failed to generate invite link:", err);
    } finally {
      setLoading(null);
    }
  }, [inviteLink, wizard.activatedWorkspaceId, supabase]);

  useEffect(() => {
    generateLink();
  }, [generateLink]);

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !wizard.activatedWorkspaceId) return;
    setLoading("email");
    setError(null);

    try {
      const { error: fnError } = await supabase.functions.invoke("create-invitation", {
        body: {
          workspace_id: wizard.activatedWorkspaceId,
          invite_type: "email",
          email: email.trim(),
          role: "employee",
        },
      });
      if (fnError) throw new Error(fnError.message);
      setEmailSent(true);
      setEmail("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send email invite");
    } finally {
      setLoading(null);
    }
  };

  const handleSendSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim() || !wizard.activatedWorkspaceId) return;
    setLoading("sms");
    setError(null);

    try {
      const fullPhone = phoneNumber.startsWith("+")
        ? phoneNumber.trim()
        : `+47${phoneNumber.trim()}`;

      const { error: fnError } = await supabase.functions.invoke("create-invitation", {
        body: {
          workspace_id: wizard.activatedWorkspaceId,
          invite_type: "sms",
          phone: fullPhone,
          role: "employee",
        },
      });
      if (fnError) throw new Error(fnError.message);
      setSmsSent(true);
      setPhoneNumber("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send SMS invite");
    } finally {
      setLoading(null);
    }
  };

  const handleCopyLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 mx-auto flex w-full max-w-2xl flex-col items-center text-center duration-500">
      <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
        <Users size={40} />
      </div>

      <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-white">
        Invite your first team member
      </h1>
      <p className="mb-10 text-lg text-zinc-400">
        {wizard.workspaceData.name
          ? `${wizard.workspaceData.name} is ready!`
          : "Your workspace is ready!"}{" "}
        Bring someone onboard.
      </p>

      {error && (
        <div className="mb-6 w-full rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="w-full space-y-4">
        {/* Email invite */}
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#111] p-6">
          <div className="mb-4 flex items-center gap-3">
            <Mail size={20} className="text-blue-400" />
            <h3 className="font-bold text-white">Email Invite</h3>
            {emailSent && (
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-400">
                <CheckCircle2 size={14} /> Sent!
              </span>
            )}
          </div>
          <form onSubmit={handleSendEmail} className="flex gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="flex-1 rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white transition-colors outline-none placeholder:text-zinc-600 focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={!email.trim() || loading === "email"}
              className="shrink-0 rounded-xl bg-blue-500 px-6 py-3 font-bold text-white transition-colors hover:bg-blue-400 disabled:opacity-50"
            >
              {loading === "email" ? <Loader2 className="animate-spin" size={18} /> : "Send"}
            </button>
          </form>
        </div>

        {/* SMS invite */}
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#111] p-6">
          <div className="mb-4 flex items-center gap-3">
            <Phone size={20} className="text-green-400" />
            <h3 className="font-bold text-white">SMS Invite</h3>
            {smsSent && (
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-400">
                <CheckCircle2 size={14} /> Sent!
              </span>
            )}
          </div>
          <form onSubmit={handleSendSms} className="flex gap-3">
            <div className="flex flex-1 items-center overflow-hidden rounded-xl border border-white/10 bg-black/50 transition-colors focus-within:border-green-500">
              <span className="pl-4 text-sm font-medium text-zinc-500">+47</span>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="912 34 567"
                className="w-full bg-transparent px-2 py-3 text-white outline-none placeholder:text-zinc-600"
              />
            </div>
            <button
              type="submit"
              disabled={!phoneNumber.trim() || loading === "sms"}
              className="shrink-0 rounded-xl bg-green-500 px-6 py-3 font-bold text-white transition-colors hover:bg-green-400 disabled:opacity-50"
            >
              {loading === "sms" ? <Loader2 className="animate-spin" size={18} /> : "Send"}
            </button>
          </form>
        </div>

        {/* Shareable link */}
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#111] p-6">
          <div className="mb-4 flex items-center gap-3">
            <Link2 size={20} className="text-purple-400" />
            <h3 className="font-bold text-white">Shareable Link</h3>
          </div>
          {inviteLink ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 truncate rounded-xl border border-white/10 bg-black/50 px-4 py-3 font-mono text-sm text-zinc-400">
                {inviteLink}
              </div>
              <button
                onClick={handleCopyLink}
                className="shrink-0 rounded-xl bg-purple-500 px-4 py-3 font-bold text-white transition-colors hover:bg-purple-400"
              >
                {linkCopied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center py-3 text-sm text-zinc-500">
              {loading === "link" ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                "Generating link..."
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-10 flex w-full flex-col gap-4 sm:flex-row sm:justify-center">
        <a
          href={dashboardUrl}
          className="flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 font-bold text-zinc-900 shadow-xl transition-transform hover:bg-zinc-200 active:scale-95"
        >
          Enter Dashboard <ArrowRight size={18} />
        </a>
        <button
          onClick={() => wizard.goTo("done")}
          className="text-sm text-zinc-500 transition-colors hover:text-white"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
