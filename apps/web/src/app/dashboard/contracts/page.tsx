"use client";

/**
 * ContractsPage — /dashboard/contracts
 *
 * Phase 2 hub redesign per JOURNEY-contract-hub-redesign. Tabs-in-hub
 * layout: `Kontrakter | Maler | Bindinger`. The header carries the primary
 * `Lag kontrakt` CTA (brand fill). The deprecated "Lag kontrakt med Botsson"
 * header button is retired — its role is taken over by the ambient
 * `BotssonAmbientChip` pinned to the bottom-right of the hub.
 *
 * Deep-link behavior:
 *  - `/dashboard/contracts` → Kontrakter tab
 *  - `/dashboard/contracts?tab=maler` → Maler tab (and similarly `bindinger`)
 *  - `/dashboard/contracts?open=compose[&profileId=…]` → toggles drawerOpen
 *    state (the actual composition drawer is stubbed here — Phase 3 wires the
 *    CompositionDrawer proper).
 *
 * Emits on mount:
 *  - `contract.hub_viewed` with initial tab
 *
 * Emits on tab switch:
 *  - `contract.tab_switched` with from/to tab ids
 */

import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@smartout/ui";
import { useTranslation } from "@smartout/i18n";
import { emit, nonEmpty } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { PageTabNav } from "@/components/dashboard/PageTabNav";
import { BotssonAmbientChip } from "./_components/BotssonAmbientChip";
import { KontrakterTab } from "./_components/KontrakterTab";
import { EmployeePickerDrawer } from "@/components/contracts/EmployeePickerDrawer";
import { PEOPLE_TAB_DEFS } from "@/app/dashboard/_lib/people-tabs";

export default function ContractsPage() {
  const { t } = useTranslation("contracts");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { workspaceData, profileId } = useContext(DashboardContext);

  const openParam = searchParams.get("open");
  const profileIdParam = searchParams.get("profileId");

  // Drawer open state — Phase 2 just toggles; Phase 3 wires the
  // CompositionDrawer to this state + profileIdParam.
  const [drawerOpen, setDrawerOpen] = useState(openParam === "compose");

  const workspaceId = workspaceData?.workspace_id ?? null;

  // Emit `contract.hub_viewed` once workspace AND profile are known.
  // Both required: nonEmpty() throws on null/empty per ADR-0152 fail-fast.
  const hubViewedRef = useRef(false);
  useEffect(() => {
    if (!workspaceId || !profileId || hubViewedRef.current) return;
    hubViewedRef.current = true;
    void emit({
      event: "contract.hub_viewed",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(profileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "workspace",
          entity_id: workspaceId,
          entity_label: "Contracts Hub",
        },
        data: { initial_tab: "kontrakter" },
      },
    });
  }, [workspaceId, profileId]);

  // Primary "Lag kontrakt" CTA — opens the composition drawer via query param
  // so the flow is deep-linkable and shareable. Guard: profileId required for
  // emit's actor_id (ADR-0152 fail-fast). Without the guard nonEmpty() throws
  // synchronously, the callback aborts mid-way, drawer never opens cleanly,
  // and the user only sees the Sheet overlay (the "blurry button" symptom).
  const handleCreateContract = useCallback(() => {
    if (!workspaceId || !profileId) return;
    void emit({
      event: "contracts.compose.opened",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(profileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "workspace",
          entity_id: workspaceId,
          entity_label: "Contracts Hub",
        },
        data: {
          source: "hub_cta",
        },
      },
    });
    setDrawerOpen(true);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("open", "compose");
    router.replace(`/dashboard/contracts?${nextParams.toString()}`, { scroll: false });
  }, [router, searchParams, workspaceId, profileId]);

  // `?open=compose` sync — only honour the deep-link once both ids are present
  // so the drawer never mounts against an empty DashboardContext (would render
  // overlay-only since step 1 needs workspaceId for SelectEmployeeStep fetch).
  useEffect(() => {
    if (openParam === "compose" && !drawerOpen && workspaceId && profileId) {
      setDrawerOpen(true);
    }
  }, [openParam, drawerOpen, workspaceId, profileId]);

  if (!workspaceId || !profileId) return null;

  return (
    <div className="relative flex flex-col gap-5">
      {/* Header — Reports-style: H1 + subtitle freestanding, action right */}
      <header className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-foreground text-3xl leading-tight tracking-tight">
            {t("page.title")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("page.description")}</p>
        </div>
        <Button
          onClick={handleCreateContract}
          className="gap-2"
          aria-label={t("page.create_contract")}
        >
          <Plus className="h-4 w-4" />
          {t("page.create_contract")}
        </Button>
      </header>

      {/* Top-level Ansatte-modul nav (matches /dashboard/people) */}
      <PageTabNav
        tabs={PEOPLE_TAB_DEFS.map((tab) => ({ key: tab.key, label: tab.label, icon: tab.icon }))}
        active={pathname ?? "/dashboard/contracts"}
        onChange={(href) => router.push(href)}
        ariaLabel="Ansatte-seksjoner"
      />

      {/* Contract list — create/view/sign/send only. Maler + Bindinger flyttet
          til Innstillinger (out-of-scope her). */}
      <KontrakterTab workspaceId={workspaceId} actorProfileId={profileId} />

      {/* Ambient Botsson chip — pinned bottom-right, hub only.
          Phase 3 replaces this with a richer dock when voice is wired. */}
      <BotssonAmbientChip workspaceId={workspaceId} actorProfileId={profileId} scope="kontrakter" />

      {/* Hub Lag-kontrakt entry. Picks the employee, then forwards to
          /dashboard/people/[id]?compose=open which mounts the working
          ContractDispatchDrawer (Wave 5). The 5-step CompositionDrawer
          is retired from the hub — it stays in the codebase for the
          reverse flow only. */}
      <EmployeePickerDrawer
        open={drawerOpen}
        onOpenChange={(next) => {
          setDrawerOpen(next);
          if (!next) {
            const nextParams = new URLSearchParams(searchParams.toString());
            nextParams.delete("open");
            nextParams.delete("profileId");
            const qs = nextParams.toString();
            router.replace(qs ? `/dashboard/contracts?${qs}` : "/dashboard/contracts", {
              scroll: false,
            });
          }
        }}
        workspaceId={workspaceId}
      />
    </div>
  );
}
