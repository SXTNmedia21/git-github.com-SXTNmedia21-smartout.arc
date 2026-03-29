"use client";

import { EntityDrawerProvider } from "@/components/dashboard/entity-drawer/EntityDrawerContext";
import { BotssonPlayground } from "./_components/BotssonPlayground";

export default function BotssonPage() {
  return (
    <EntityDrawerProvider>
      <BotssonPlayground />
    </EntityDrawerProvider>
  );
}
