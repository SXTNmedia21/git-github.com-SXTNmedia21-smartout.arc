"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, ArrowRight, Loader2, Mail } from "lucide-react";

export default function ResetPasswordPage() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        // Auth logic will be implemented here
        setTimeout(() => {
            setIsLoading(false);
            setMessage({ type: 'success', text: 'If an account exists, a password reset link has been sent.' });
        }, 1500);
    };

    return (
        <div className="min-h-screen bg-zinc-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-orange-500/30 selection:text-white">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 shadow-[0_0_20px_rgba(234,88,12,0.4)] flex items-center justify-center border-t border-orange-300 transition-transform hover:scale-105">
                        <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-2xl font-black tracking-tight text-white flex items-center gap-1">
                        Smart<span className="text-zinc-500">out</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mb-2 shadow-[0_0_10px_rgba(234,88,12,0.8)]" />
                    </span>
                </div>
                <h2 className="mt-8 text-center text-2xl font-extrabold text-white tracking-tight">
                    Reset your password
                </h2>
                <p className="mt-2 text-center text-sm text-zinc-400">
                    Enter your email to receive a reset link
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0 relative z-10">
                <div className="bg-[#0a0a0c] py-8 px-4 shadow-2xl shadow-black/50 sm:rounded-2xl sm:px-10 border border-zinc-800/80 backdrop-blur-xl">
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label
                                htmlFor="email"
                                className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2"
                            >
                                Email address
                            </label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
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
                                    className="appearance-none block w-full pl-10 px-3 py-2.5 bg-zinc-900 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 sm:text-sm transition-colors hover:bg-zinc-800/50"
                                    placeholder="name@company.com"
                                />
                            </div>
                        </div>

                        {message && (
                            <div className={`p-3 rounded-lg text-sm font-medium border ${message.type === 'error'
                                    ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                }`}>
                                {message.text}
                            </div>
                        )}

                        <div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="group w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-orange-600 hover:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 focus:ring-offset-zinc-900 transition-all disabled:opacity-70 disabled:cursor-not-allowed items-center"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        Send reset link
                                        <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <p className="mt-8 text-center text-sm text-zinc-500">
                Remember your password?{' '}
                <Link href="/login" className="font-semibold text-orange-500 hover:text-orange-400 transition-colors">
                    Back to login
                </Link>
            </p>
        </div>
    );
}
