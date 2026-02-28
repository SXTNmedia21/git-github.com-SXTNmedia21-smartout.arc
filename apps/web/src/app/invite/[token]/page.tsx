"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, Building2 } from "lucide-react";

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Mock fetch invite details
  useEffect(() => {
    const fetchInvite = async () => {
      // Simulate API call
      setTimeout(() => {
        setEmail("jonas@smartout.io"); // Default mock email decoded from token
        setIsLoading(false);
      }, 800);
    };
    fetchInvite();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    setIsSubmitting(true);

    // Simulate API call to accept invite
    setTimeout(() => {
      setIsSubmitting(false);
      // Redirect to dashboard after successful signup
      router.push("/dashboard");
    }, 1500);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
          <p className="font-medium text-zinc-400">Verifying invitation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-12 font-sans sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        {/* Header branding */}
        <div className="flex flex-col items-center justify-center text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 shadow-lg shadow-orange-500/20">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-black tracking-tight text-white">Join the Team</h2>
          <p className="mt-2 text-sm text-zinc-400">
            You&apos;ve been invited to join{" "}
            <span className="font-bold text-white">Smartout Workspace</span>.
          </p>
        </div>

        {/* Form */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1.5 block text-sm font-bold text-zinc-300">Email Address</label>
              <input
                type="email"
                value={email}
                disabled
                className="block w-full rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-2.5 text-zinc-500 shadow-sm transition-all focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 focus:outline-none sm:text-sm"
              />
              <p className="mt-1.5 text-xs text-zinc-500">
                This email is linked to your invitation.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-bold text-zinc-300">First Name</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="block w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-white shadow-sm transition-all placeholder:text-zinc-600 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none sm:text-sm"
                  placeholder="Jonas"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-bold text-zinc-300">Last Name</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="block w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-white shadow-sm transition-all placeholder:text-zinc-600 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none sm:text-sm"
                  placeholder="Bakken"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-bold text-zinc-300">
                Create Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-white shadow-sm transition-all placeholder:text-zinc-600 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none sm:text-sm"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-bold text-zinc-300">
                Confirm Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-white shadow-sm transition-all placeholder:text-zinc-600 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none sm:text-sm"
                placeholder="••••••••"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-orange-500/20 transition-all hover:from-orange-400 hover:to-orange-500 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-zinc-950 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5" />
                    Accept Invite & Create Account
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-xs font-medium text-zinc-600">
          By accepting this invite, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
