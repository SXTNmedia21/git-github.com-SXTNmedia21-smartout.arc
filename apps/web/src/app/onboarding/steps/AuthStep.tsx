"use client";

import { useState } from "react";
import { useWizard } from "../WizardContext";
import { createClient } from "@smartout/supabase/client";
import { Bot, ArrowRight, Loader2 } from "lucide-react";

export function AuthStep() {
  const wizard = useWizard();
  const supabase = createClient();
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
    });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    wizard.goTo("org_verification");
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    wizard.goTo("org_verification");
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 mx-auto flex w-full max-w-xl flex-col items-center text-center duration-500">
      <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-500/10 text-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
        <Bot size={40} />
      </div>

      <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-white">Save your progress</h1>
      <p className="mb-10 text-lg text-zinc-400">
        Create an account to keep everything we just found about your business.
      </p>

      <div className="w-full overflow-hidden rounded-3xl border border-white/5 bg-[#111] p-6 shadow-xl sm:p-8">
        {/* Tab toggle */}
        <div className="mb-6 flex rounded-xl bg-black/40 p-1">
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${mode === "signup" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setError(null);
            }}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${mode === "signin" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            Sign In
          </button>
        </div>

        <form onSubmit={mode === "signup" ? handleSignUp : handleSignIn} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            required
            autoComplete="email"
            className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white transition-colors outline-none placeholder:text-zinc-600 focus:border-cyan-500"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "Password (min. 8 characters)" : "Password"}
            required
            minLength={8}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white transition-colors outline-none placeholder:text-zinc-600 focus:border-cyan-500"
          />
          {mode === "signup" && (
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white transition-colors outline-none placeholder:text-zinc-600 focus:border-cyan-500"
            />
          )}

          {error && <p className="text-sm font-medium text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-4 font-bold text-white shadow-lg shadow-cyan-500/20 transition-transform hover:from-cyan-400 hover:to-blue-500 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                {mode === "signup" ? "Create Account & Continue" : "Sign In & Continue"}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* SSO placeholder - enable when OAuth providers are configured */}
        {/* <div className="mt-6 border-t border-white/10 pt-6">
          <p className="mb-4 text-sm text-zinc-500">Or continue with</p>
          <div className="flex gap-3">
            <button className="...">Google</button>
            <button className="...">Microsoft</button>
          </div>
        </div> */}
      </div>

      <button
        type="button"
        onClick={() => wizard.goTo("org_verification")}
        className="mt-6 text-sm text-zinc-500 transition-colors hover:text-white"
      >
        Skip for now (you can create an account later)
      </button>
    </div>
  );
}
