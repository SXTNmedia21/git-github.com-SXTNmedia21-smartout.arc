import type { Metadata } from "next";
import { DocsSidebar } from "../../docs/_components/docs-sidebar";
import { getUserManualNavigation } from "@/lib/user-manual";
import { FullTracker } from "../../../components/tracking";

export const metadata: Metadata = {
  title: "Documentation – SmartOut",
  description:
    "User guide and documentation for SmartOut. Learn how to set up and use the platform.",
};

export default function EnDocsLayout({ children }: { children: React.ReactNode }) {
  const navigation = getUserManualNavigation("en");

  return (
    <div className="bg-background text-foreground flex min-h-screen font-sans">
      <FullTracker />
      <DocsSidebar navigation={navigation} locale="en" />

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-3xl px-6 py-12 lg:px-12 lg:py-16">{children}</div>
      </main>
    </div>
  );
}
