import type { Metadata } from "next";
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

export default function SmartoutLandingPage() {
  return <VariantMLanding />;
}
