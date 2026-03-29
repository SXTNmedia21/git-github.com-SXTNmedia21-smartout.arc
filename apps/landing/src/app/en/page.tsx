import type { Metadata } from "next";
import VariantMLanding from "../../components/landing/VariantMLanding";

export const metadata: Metadata = {
  alternates: {
    canonical: "/en/",
    languages: {
      nb: "/",
      en: "/en/",
    },
  },
};

export default function EnglishLandingPage() {
  return <VariantMLanding locale="en" />;
}
