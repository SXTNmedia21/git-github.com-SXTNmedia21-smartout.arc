"use client";

import { useParams, notFound } from "next/navigation";
import dynamic from "next/dynamic";
import { SLUG_MAP } from "../../lib/perspective-slugs";

const VariantELanding = dynamic(() => import("../../components/landing/VariantELanding"));
const VariantTLanding = dynamic(() => import("../../components/landing/VariantTLanding"));
const VariantKLanding = dynamic(() => import("../../components/landing/VariantKLanding"));
const VariantALanding = dynamic(() => import("../../components/landing/VariantALanding"));
const VariantFLanding = dynamic(() => import("../../components/landing/VariantFLanding"));
const VariantSLanding = dynamic(() => import("../../components/landing/VariantSLanding"));
const VariantVLanding = dynamic(() => import("../../components/landing/VariantVLanding"));
const VariantILanding = dynamic(() => import("../../components/landing/VariantILanding"));
const VariantMLanding = dynamic(() => import("../../components/landing/VariantMLanding"));

const VARIANT_COMPONENTS: Record<string, React.ComponentType> = {
  E: VariantELanding,
  T: VariantTLanding,
  K: VariantKLanding,
  A: VariantALanding,
  F: VariantFLanding,
  S: VariantSLanding,
  V: VariantVLanding,
  I: VariantILanding,
  M: VariantMLanding,
};

export default function PerspectivePage() {
  const params = useParams<{ slug: string }>();
  const config = SLUG_MAP.get(params.slug);

  if (!config) {
    notFound();
  }

  const Component = VARIANT_COMPONENTS[config.variant];
  if (!Component) {
    notFound();
  }

  return <Component />;
}
