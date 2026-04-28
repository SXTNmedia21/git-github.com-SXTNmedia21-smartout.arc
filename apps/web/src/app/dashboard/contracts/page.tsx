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

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@smartout/ui";
import { useTranslation } from "@smartout/i18n";
import { emit, nonEmpty } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BotssonAmbientChip } from "./_components/BotssonAmbientChip";
import { KontrakterTab } from "./_components/KontrakterTab";
import { MalerTab } from "./_components/MalerTab";
import { BindingerTab } from "./_components/BindingerTab";
import { CompositionDrawer } from "@/components/contracts/CompositionDrawer";

type HubTab = "kontrakter" | "maler" | "bindinger";

const TAB_KEYS: HubTab[] = ["kontrakter", "maler", "bindinger"];

function parseTab(raw: string | null): HubTab {
  if (raw === "maler" || raw === "bindinger") return raw;
  return "kontrakter";
}

export default function ContractsPage() {
  const { t } = useTranslation("contracts");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { workspaceData, profileId } = useContext(DashboardContext);

  const initialTab = useMemo(() => parseTab(searchParams.get("tab")), [searchParams]);
  const openParam = searchParams.get("open");
  const profileIdParam = searchParams.get("profileId");

  const [activeTab, setActiveTab] = useState<HubTab>(initialTab);
  // Drawer open state — Phase 2 just toggles; Phase 3 wires the
  // CompositionDrawer to this state + profileIdParam.
  const [drawerOpen, setDrawerOpen] = useState(openParam === "compose");

  const workspaceId = workspaceData?.workspace_id ?? null;

  // Emit `contract.hub_viewed` once workspace is known. Using a ref prevents
  // re-emission on re-render; StrictMode double-invoke is defensible here.
  const hubViewedRef = useRef(false);
  useEffect(() => {
    if (!workspaceId || hubViewedRef.current) return;
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
        data: {
          initial_tab: initialTab,
        },
      },
    });
  }, [workspaceId, profileId, initialTab]);

  // Keep URL state in sync when user clicks a tab trigger.
  const handleTabChange = useCallback(
    (next: string) => {
      const nextTab = parseTab(next);
      const prevTab = activeTab;
      setActiveTab(nextTab);
      if (!workspaceId) return;
      if (prevTab !== nextTab) {
        void emit({
          event: "contract.tab_switched",
          workspace_id: nonEmpty(workspaceId, "workspace_id"),
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: {
            entity: {
              entity_type: "workspace",
              entity_id: workspaceId,
              entity_label: "Contracts Hub",
            },
            data: {
              from: prevTab,
              to: nextTab,
            },
          },
        });
      }
      const nextParams = new URLSearchParams(searchParams.toString());
      if (nextTab === "kontrakter") {
        nextParams.delete("tab");
      } else {
        nextParams.set("tab", nextTab);
      }
      const qs = nextParams.toString();
      router.replace(qs ? `/dashboard/contracts?${qs}` : "/dashboard/contracts", { scroll: false });
    },
    [activeTab, workspaceId, profileId, searchParams, router],
  );

  // Primary "Lag kontrakt" CTA — opens the composition drawer via query param
  // so the flow is deep-linkable and shareable.
  const handleCreateContract = useCallback(() => {
    if (workspaceId) {
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
    }
    setDrawerOpen(true);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("open", "compose");
    router.replace(`/dashboard/contracts?${nextParams.toString()}`, { scroll: false });
  }, [router, searchParams]);

  // `?open=compose` sync — if the user navigates with the param already set.
  useEffect(() => {
    if (openParam === "compose" && !drawerOpen) {
      setDrawerOpen(true);
    }
  }, [openParam, drawerOpen]);

  if (!workspaceId) return null;

  const scope: HubTab = activeTab;

  return (
    <div className="relative flex flex-col gap-6">
      {/* Ambient orb — single radial layer, not animating, decorative only.
          Uses warm hue 50 per Nordic Split; opacity kept subtle so the hub
          surface remains typography-led. */}
      <div
        className="pointer-events-none absolute -top-24 -right-24 h-[420px] w-[420px] rounded-full"
        style={{
          backgroundImage:
            "radial-gradient(circle at center, oklch(0.82 0.14 55 / 0.25), transparent 70%)",
        }}
        aria-hidden="true"
      />

      {/* Header — typography-led, no boxes */}
      <header className="relative flex items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-foreground text-4xl leading-tight tracking-tight">
            {t("page.title")}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">{t("page.description")}</p>
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

      {/* Tabs-in-hub */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="relative w-full">
        <TabsList>
          {TAB_KEYS.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {t(`hub.tab_${tab}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="kontrakter" className="mt-6">
          <KontrakterTab workspaceId={workspaceId} actorProfileId={profileId} />
        </TabsContent>
        <TabsContent value="maler" className="mt-6">
          <MalerTab workspaceId={workspaceId} />
        </TabsContent>
        <TabsContent value="bindinger" className="mt-6">
          <BindingerTab />
        </TabsContent>
      </Tabs>

      {/* Ambient Botsson chip — pinned bottom-right, hub only.
          Phase 3 replaces this with a richer dock when voice is wired. */}
      <BotssonAmbientChip workspaceId={workspaceId} actorProfileId={profileId} scope={scope} />

      {/* Phase 3: CompositionDrawer — replaces the retired full-page wizard.
          `initialProfileId` is the reverse-flow entry (from /people/[id]).
          Closing the drawer strips `open=compose` (and profileId) from the URL
          so bookmarked deep links stay shareable but closing is a clean
          return. */}
      <CompositionDrawer
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
        initialProfileId={profileIdParam ?? undefined}
      />
    </div>
  );
}
