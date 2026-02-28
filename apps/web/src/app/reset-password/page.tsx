"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, ArrowRight, Loader2, Mail } from "lucide-react";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    // Auth logic will be implemented here
    setTimeout(() => {
      setIsLoading(false);
      setMessage({
        type: "success",
        text: "If an account exists, a password reset link has been sent.",
      });
    }, 1500);
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-zinc-950 py-12 selection:bg-orange-500/30 selection:text-white sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex items-center justify-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border-t border-orange-300 bg-gradient-to-br from-orange-400 to-orange-600 shadow-[0_0_20px_rgba(234,88,12,0.4)] transition-transform hover:scale-105">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <span className="flex items-center gap-1 text-2xl font-black tracking-tight text-white">
            Smart<span className="text-zinc-500">out</span>
            <span className="mb-2 h-1.5 w-1.5 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(234,88,12,0.8)]" />
          </span>
        </div>
        <h2 className="mt-8 text-center text-2xl font-extrabold tracking-tight text-white">
          Reset your password
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-400">
          Enter your email to receive a reset link
        </p>
      </div>

      <div className="relative z-10 mt-8 px-4 sm:mx-auto sm:w-full sm:max-w-md sm:px-0">
        <div className="border border-zinc-800/80 bg-[#0a0a0c] px-4 py-8 shadow-2xl shadow-black/50 backdrop-blur-xl sm:rounded-2xl sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-xs font-bold tracking-wider text-zinc-300 uppercase"
              >
                Email address
              </label>
              <div className="relative mt-1 rounded-md shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-4 w-4 text-zinc-500" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full appearance-none rounded-lg border border-zinc-700/50 bg-zinc-900 px-3 py-2.5 pl-10 text-white placeholder-zinc-500 transition-colors hover:bg-zinc-800/50 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none sm:text-sm"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            {message && (
              <div
                className={`rounded-lg border p-3 text-sm font-medium ${
                  message.type === "error"
                    ? "border-red-500/20 bg-red-500/10 text-red-400"
                    : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                }`}
              >
                {message.text}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group flex w-full items-center justify-center rounded-lg border border-transparent bg-orange-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-orange-500 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-zinc-900 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Send reset link
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <p className="mt-8 text-center text-sm text-zinc-500">
        Remember your password?{" "}
        <Link
          href="/login"
          className="font-semibold text-orange-500 transition-colors hover:text-orange-400"
        >
          Back to login
        </Link>
      </p>
    </div>
  );
}
