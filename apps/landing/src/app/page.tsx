import type { Metadata } from "next";
import { headers } from "next/headers";
import VariantMLanding from "../components/landing/VariantMLanding";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
    languages: {
      nb: "/",
      en: "/en/",
    },
  },
};

export default async function SmartoutLandingPage() {
  const headersList = await headers();
  const locale = (headersList.get("x-locale") ?? "nb") as "nb" | "en";

  return <VariantMLanding locale={locale} />;
}
