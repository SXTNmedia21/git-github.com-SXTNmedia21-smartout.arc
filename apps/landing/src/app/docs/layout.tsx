import type { Metadata } from "next";
import { headers } from "next/headers";
import { DocsSidebar } from "./_components/docs-sidebar";
import { getUserManualNavigation, type DocsLocale } from "@/lib/user-manual";
import { FullTracker } from "../../components/tracking";

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const locale = (headersList.get("x-locale") ?? "nb") as DocsLocale;
  return {
    title: locale === "en" ? "Documentation – SmartOut" : "Dokumentasjon – SmartOut",
    description:
      locale === "en"
        ? "User guide and documentation for SmartOut. Learn how to set up and use the platform."
        : "Brukerveiledning og dokumentasjon for SmartOut. Lær hvordan du setter opp og bruker plattformen.",
  };
}

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const locale = (headersList.get("x-locale") ?? "nb") as DocsLocale;
  const navigation = getUserManualNavigation(locale);

  return (
    <div className="bg-background text-foreground flex min-h-screen font-sans">
      <FullTracker />
      <DocsSidebar navigation={navigation} locale={locale} />

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-3xl px-6 py-12 lg:px-12 lg:py-16">{children}</div>
      </main>
    </div>
  );
}
