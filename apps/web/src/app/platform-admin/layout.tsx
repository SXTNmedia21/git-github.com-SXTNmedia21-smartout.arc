import { Suspense } from "react";
import { BotssonProvider } from "@/app/Botsson/_components/BotssonProvider";
import { BotssonShell } from "@/app/Botsson/_components/BotssonShell";
import { PlatformAdminSidebarNav } from "@/components/platform-admin/sidebar-nav";
import { QueryProvider } from "@/app/dashboard/query-provider";

export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    // Suspense required — BotssonProvider calls useSearchParams() for session URL param sync.
    <Suspense>
      <BotssonProvider initialRank="admin" initialPersona="puls" initialBlend={5}>
        <div className="dark bg-background text-foreground flex h-screen">
          <aside className="border-border bg-background w-56 shrink-0 border-r">
            <PlatformAdminSidebarNav />
          </aside>
          <main className="flex-1 overflow-y-auto p-6">
            <QueryProvider>{children}</QueryProvider>
          </main>
          <BotssonShell />
        </div>
      </BotssonProvider>
    </Suspense>
  );
}
