"use client";

/**
 * ContractsPage — /dashboard/people/contracts
 *
 * Phase 2 hub redesign per JOURNEY-contract-hub-redesign. Tabs-in-hub
 * layout: `Kontrakter | Maler | Bindinger`. The header carries the primary
 * `Lag kontrakt` CTA (brand fill). The deprecated "Lag kontrakt med Botsson"
 * header button is retired — its role is taken over by the ambient
 * `BotssonAmbientChip` pinned to the bottom-right of the hub.
 *
 * Deep-link behavior:
 *  - `/dashboard/people/contracts` → Kontrakter tab
 *  - `/dashboard/people/contracts?tab=maler` → Maler tab (and similarly `bindinger`)
 *  - `/dashboard/people/contracts?open=compose[&profileId=…]` → toggles drawerOpen
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
import { ContractDispatchDrawer } from "@/components/contracts/ContractDispatchDrawer";
import { PEOPLE_TAB_DEFS } from "@/app/dashboard/_lib/people-tabs";
import { ContractsToolsBridge } from "./_tools/contracts-tools-bridge";
import type { BucketFilter, ContractRow } from "./_tools/use-contracts-tools";

export default function ContractsPage() {
  const { t } = useTranslation("contracts");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { workspaceData, profileId } = useContext(DashboardContext);

  const openParam = searchParams.get("open");
  const profileIdParam = searchParams.get("profileId");

  // Two-stage drawer: picker → dispatch. Picker shows employee list; on pick
  // we close picker and mount ContractDispatchDrawer with that profile so the
  // whole flow stays on the hub (no navigation to /people/[id]).
  const [drawerOpen, setDrawerOpen] = useState(openParam === "compose");
  const [pickedProfile, setPickedProfile] = useState<{
    profile_id: string;
    display_name: string;
  } | null>(null);

  // Bridge state — contracts list + bucket filter shared with ContractsToolsBridge.
  // Fetched lightweight here (no pagination) so Botsson always has a fresh snapshot.
  const [contractsForBridge, setContractsForBridge] = useState<ContractRow[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [activeBucketForBridge, setActiveBucketForBridge] = useState<BucketFilter>("all");

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

  // Populate bridge data — lightweight list fetch (all statuses, page 1) for
  // Botsson tools. KontrakterTab has its own fetch+pagination; this is parallel
  // and non-blocking. Refresh on workspaceId change only (stale 30s acceptable).
  useEffect(() => {
    if (!workspaceId) return;
    setContractsLoading(true);
    void fetch(`/api/employment-contracts/list?workspace_id=${workspaceId}`)
      .then(async (res) => {
        if (!res.ok) return;
        const json = (await res.json()) as { data?: ContractRow[] };
        setContractsForBridge(json.data ?? []);
      })
      .catch(() => {
        // Bridge data is non-critical — silently ignore fetch errors
      })
      .finally(() => setContractsLoading(false));
  }, [workspaceId]);

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
    router.replace(`/dashboard/people/contracts?${nextParams.toString()}`, { scroll: false });
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
      {/* Header — Reports-style: H1 + subtitle + instructions freestanding, action right */}
      <header className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-foreground text-3xl leading-tight tracking-tight">
            {t("page.title")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("page.description")}</p>
          {/* Page instructions — explains what admin/manager can do on this hub */}
          <p className="text-muted-foreground mt-2 max-w-prose text-sm">
            Her finner du alle ansattkontrakter for arbeidsområdet. Filtrer på status for å finne
            kontrakter som krever handling, og åpne en kontrakt for å se detaljer, sende på nytt
            eller følge signeringsforløpet.
          </p>
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
        active={pathname ?? "/dashboard/people/contracts"}
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
        open={drawerOpen && pickedProfile === null}
        onOpenChange={(next) => {
          setDrawerOpen(next);
          if (!next) {
            const nextParams = new URLSearchParams(searchParams.toString());
            nextParams.delete("open");
            nextParams.delete("profileId");
            const qs = nextParams.toString();
            router.replace(
              qs ? `/dashboard/people/contracts?${qs}` : "/dashboard/people/contracts",
              {
                scroll: false,
              },
            );
          }
        }}
        workspaceId={workspaceId}
        onPick={(profile) =>
          setPickedProfile({ profile_id: profile.profile_id, display_name: profile.display_name })
        }
      />

      {/* Stage 2 — dispatch drawer mounts after employee picked. Close returns
          the user to the hub (both drawers cleared, URL stripped). */}
      {pickedProfile && (
        <ContractDispatchDrawer
          open={true}
          onOpenChange={(next) => {
            if (!next) {
              setPickedProfile(null);
              setDrawerOpen(false);
              const nextParams = new URLSearchParams(searchParams.toString());
              nextParams.delete("open");
              nextParams.delete("profileId");
              const qs = nextParams.toString();
              router.replace(
                qs ? `/dashboard/people/contracts?${qs}` : "/dashboard/people/contracts",
                {
                  scroll: false,
                },
              );
            }
          }}
          targetProfileId={pickedProfile.profile_id}
          targetProfileName={pickedProfile.display_name}
          onSuccess={() => {
            setPickedProfile(null);
            setDrawerOpen(false);
          }}
        />
      )}

      {/* Harness bridge — registers Botsson tools for this page. Returns null.
          Unregistered automatically when the user navigates away. */}
      <ContractsToolsBridge
        contracts={contractsForBridge}
        isLoading={contractsLoading}
        activeBucket={activeBucketForBridge}
        actorProfileId={profileId}
        uiActions={{
          openContractDetail: (contractId) =>
            router.push(`/dashboard/people/contracts/${contractId}`),
          openNewContractFlow: handleCreateContract,
          switchStatusFilter: setActiveBucketForBridge,
        }}
      />
    </div>
  );
}
