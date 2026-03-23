"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { FullTracker } from "../components/tracking";

// The landing variants
const VariantELanding = dynamic(() => import("../components/landing/VariantELanding"));
const VariantTLanding = dynamic(() => import("../components/landing/VariantTLanding"));
const VariantKLanding = dynamic(() => import("../components/landing/VariantKLanding"));
const VariantALanding = dynamic(() => import("../components/landing/VariantALanding"));
const VariantFLanding = dynamic(() => import("../components/landing/VariantFLanding"));
const VariantSLanding = dynamic(() => import("../components/landing/VariantSLanding"));
const VariantMLanding = dynamic(() => import("../components/landing/VariantMLanding"));

import { useVariant } from "../lib/landing-variant";

export default function SmartoutLandingPage() {
  return (
    <Suspense>
      <SmartoutLandingPageContent />
    </Suspense>
  );
}

function SmartoutLandingPageContent() {
  // We use the new logic where M is default.
  // It still supports explicitly hitting ?v=E or ?v=T for AB-tests,
  // but all new traffic + empty URLs will render Variant M ("App in Motion")
  const { variant } = useVariant();

  if (variant === "E") return <VariantELanding />;
  if (variant === "T") return <VariantTLanding />;
  if (variant === "K") return <VariantKLanding />;
  if (variant === "A") return <VariantALanding />;
  if (variant === "F") return <VariantFLanding />;
  if (variant === "S") return <VariantSLanding />;

  // Default, ultimate state of the homepage.
  return <VariantMLanding />;
}
