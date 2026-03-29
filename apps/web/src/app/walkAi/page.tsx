"use client";

import { EntityDrawerProvider } from "@/components/dashboard/entity-drawer/EntityDrawerContext";
import { WalkAiPlayground } from "./_components/WalkAiPlayground";

export default function WalkAiPage() {
  return (
    <EntityDrawerProvider>
      <WalkAiPlayground />
    </EntityDrawerProvider>
  );
}
