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
                    <div className="w-8 h-8 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
                    <p className="text-zinc-400 font-medium">Verifying invitation...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 py-12 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="w-full max-w-md space-y-8">

                {/* Header branding */}
                <div className="flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20 mb-6">
                        <Building2 className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-3xl font-black tracking-tight text-white">
                        Join the Team
                    </h2>
                    <p className="mt-2 text-sm text-zinc-400">
                        You&apos;ve been invited to join <span className="font-bold text-white">Smartout Workspace</span>.
                    </p>
                </div>

                {/* Form */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
                    <form className="space-y-6" onSubmit={handleSubmit}>

                        <div>
                            <label className="block text-sm font-bold text-zinc-300 mb-1.5">
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={email}
                                disabled
                                className="block w-full rounded-xl border border-zinc-800 bg-zinc-950/50 py-2.5 px-4 text-zinc-500 shadow-sm focus:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-700 sm:text-sm transition-all"
                            />
                            <p className="text-xs text-zinc-500 mt-1.5">This email is linked to your invitation.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-zinc-300 mb-1.5">
                                    First Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    className="block w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 px-4 text-white shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 sm:text-sm transition-all placeholder:text-zinc-600"
                                    placeholder="Jonas"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-zinc-300 mb-1.5">
                                    Last Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    className="block w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 px-4 text-white shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 sm:text-sm transition-all placeholder:text-zinc-600"
                                    placeholder="Bakken"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-zinc-300 mb-1.5">
                                Create Password
                            </label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="block w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 px-4 text-white shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 sm:text-sm transition-all placeholder:text-zinc-600"
                                placeholder="••••••••"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-zinc-300 mb-1.5">
                                Confirm Password
                            </label>
                            <input
                                type="password"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="block w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 px-4 text-white shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 sm:text-sm transition-all placeholder:text-zinc-600"
                                placeholder="••••••••"
                            />
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 py-3 px-4 text-sm font-black text-white shadow-lg shadow-orange-500/20 hover:from-orange-400 hover:to-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-zinc-950 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-5 h-5" />
                                        Accept Invite & Create Account
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                <p className="text-center text-xs text-zinc-600 font-medium">
                    By accepting this invite, you agree to our Terms of Service and Privacy Policy.
                </p>
            </div>
        </div>
    );
}
