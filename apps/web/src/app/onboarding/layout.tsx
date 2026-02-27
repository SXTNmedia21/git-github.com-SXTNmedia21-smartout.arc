import React from "react";

export default function OnboardingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center p-4 sm:p-8">
            <div className="w-full h-[90vh] max-w-screen-2xl bg-zinc-900 border border-zinc-800/60 rounded-3xl overflow-hidden shadow-2xl flex relative">
                {children}
            </div>
        </div>
    );
}
