"use client";

/**
 * DesksClient — Spec §1 client shell.
 *
 * Wraps the desk list with AnimatePresence for card entrance/exit,
 * owns the CreateDeskDialog + QueueSheet state, and routes inline
 * "Tildel ansvarlig" actions to a reassign flow. All mutations pass
 * through the Server Actions in _actions/desk-actions.ts.
 */

import * as React from "react";
import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@smartout/i18n";
import { emit, nonEmpty } from "@smartout/telemetry";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace-context";
import { CreateDeskDialog } from "./CreateDeskDialog";
import { DeskCard, type DeskSummary } from "./DeskCard";
import { QueueSheet, type DeskQueueContext } from "./QueueSheet";
import { ResponsibleRepCombobox, type ResponsibleRep } from "./ResponsibleRepCombobox";
import { updateDeskResponsible, archiveDesk } from "../_actions/desk-actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export type DesksClientProps = {
  desks: DeskSummary[];
  reps: ResponsibleRep[];
  canManage: boolean;
  currentProfileId: string;
};

export function DesksClient({
  desks: initialDesks,
  reps,
  canManage,
  currentProfileId,
}: DesksClientProps) {
  const { t } = useTranslation("helpdesk");
  const { workspace } = useWorkspace();
  const [desks, setDesks] = useState(initialDesks);
  const [createOpen, setCreateOpen] = useState(false);
  const [queueDesk, setQueueDesk] = useState<DeskQueueContext | null>(null);
  const [reassignDesk, setReassignDesk] = useState<DeskSummary | null>(null);
  const [reassignId, setReassignId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Fire the page-viewed telemetry once on mount. The UI-specific
  // helpdesk.desks.page_viewed event in Spec §4.3 is deferred to a
  // follow-up; the generic "page viewed" is already registered.
  const hasEmittedRef = React.useRef(false);
  React.useEffect(() => {
    if (hasEmittedRef.current) return;
    hasEmittedRef.current = true;
    void emit({
      event: "page viewed",
      workspace_id: nonEmpty(workspace.workspace_id, "workspace_id"),
      actor_id: nonEmpty(currentProfileId, "actor_id"),
      properties: { path: "/dashboard/komm/desks" },
    });
  }, [workspace.workspace_id, currentProfileId]);

  const openQueue = (desk: DeskSummary) => {
    if (!desk.responsible) return;
    setQueueDesk({
      desk_channel_id: desk.id,
      desk_name: desk.name,
      responsible_name: desk.responsible.display_name,
      responsible_avatar_url: desk.responsible.avatar_url,
      open_count: desk.open_count,
    });
  };

  const openReassign = (desk: DeskSummary) => {
    setReassignDesk(desk);
    setReassignId(desk.responsible?.profile_id ?? null);
  };

  const confirmReassign = () => {
    if (!reassignDesk || !reassignId) return;
    startTransition(async () => {
      const result = await updateDeskResponsible({
        desk_channel_id: reassignDesk.id,
        responsible_profile_id: reassignId,
      });
      if (result.ok) {
        const rep = reps.find((r) => r.profile_id === reassignId);
        setDesks((prev) =>
          prev.map((d) =>
            d.id === reassignDesk.id
              ? {
                  ...d,
                  responsible: rep
                    ? {
                        profile_id: rep.profile_id,
                        display_name: rep.display_name,
                        avatar_url: rep.avatar_url,
                      }
                    : d.responsible,
                }
              : d,
          ),
        );
        toast.success("Ansvarlig oppdatert.");
        setReassignDesk(null);
        setReassignId(null);
      } else {
        toast.error(result.error);
      }
    });
  };

  const confirmArchive = (desk: DeskSummary) => {
    startTransition(async () => {
      const result = await archiveDesk({ desk_channel_id: desk.id });
      if (result.ok) {
        setDesks((prev) => prev.filter((d) => d.id !== desk.id));
        toast.success("Skranken er arkivert.");
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="mx-auto max-w-[880px] px-8 pt-12 pb-24">
      <header className="flex items-start justify-between gap-6">
        <div>
          <h1 className="font-heading text-foreground text-[44px] leading-[1.05] tracking-[-0.02em]">
            {t("page.desks_title")}
          </h1>
          <p className="text-muted-foreground mt-2 max-w-[520px] text-sm">{t("page.desks_lede")}</p>
        </div>
        {canManage ? (
          <Button onClick={() => setCreateOpen(true)} className="shrink-0">
            <Plus size={16} /> {t("page.desks_create")}
          </Button>
        ) : null}
      </header>

      {desks.length === 0 ? (
        <EmptyState canManage={canManage} onCreate={() => setCreateOpen(true)} />
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
          }}
          className="mt-10 space-y-4"
        >
          <AnimatePresence mode="popLayout">
            {desks.map((desk) => (
              <motion.div
                key={desk.id}
                layout
                variants={{
                  hidden: { opacity: 0, y: 12 },
                  show: {
                    opacity: 1,
                    y: 0,
                    transition: { type: "spring", stiffness: 38, damping: 22, mass: 2.2 },
                  },
                }}
                exit={{ opacity: 0, x: 24, filter: "blur(2px)" }}
                transition={{ duration: 0.32 }}
              >
                <DeskCard
                  desk={desk}
                  onOpenQueue={openQueue}
                  onAssign={openReassign}
                  onReassign={openReassign}
                  onArchive={confirmArchive}
                  canManage={canManage}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <CreateDeskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        reps={reps}
        onCreated={(deskId) => {
          // Server action revalidates; nudge the UI optimistically by appending
          // a placeholder that will resolve on next RSC refresh.
          const pickedRep = reps.find((r) => r.profile_id);
          if (!pickedRep) return;
          setDesks((prev) => [
            {
              id: deskId,
              name: "Ny skranke",
              description: null,
              responsible: {
                profile_id: pickedRep.profile_id,
                display_name: pickedRep.display_name,
                avatar_url: pickedRep.avatar_url,
              },
              open_count: 0,
              last_active_at: null,
            },
            ...prev,
          ]);
        }}
      />

      <QueueSheet desk={queueDesk} onOpenChange={(o) => !o && setQueueDesk(null)} />

      <Dialog open={Boolean(reassignDesk)} onOpenChange={(o) => !o && setReassignDesk(null)}>
        <DialogContent className="max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">
              {reassignDesk?.responsible ? "Endre ansvarlig" : t("desk_card.orphan_cta")}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <p className="text-muted-foreground text-sm">
              {reassignDesk?.name
                ? `${reassignDesk.name} — velg hvem som skal svare på henvendelser.`
                : ""}
            </p>
            <div className="space-y-1.5">
              <Label>{t("desk_dialog.field_responsible")}</Label>
              <ResponsibleRepCombobox
                reps={reps}
                value={reassignId}
                onChange={setReassignId}
                disabled={pending}
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setReassignDesk(null)} disabled={pending}>
                {t("desk_dialog.cancel")}
              </Button>
              <Button onClick={confirmReassign} disabled={pending || !reassignId}>
                {pending ? "Lagrer…" : "Lagre"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({ canManage, onCreate }: { canManage: boolean; onCreate: () => void }) {
  const { t } = useTranslation("helpdesk");
  return (
    <div className="relative mt-20 flex flex-col items-center gap-6 text-center">
      <div
        aria-hidden="true"
        className="pointer-events-none h-60 w-60 rounded-full opacity-40 blur-[0.5px]"
        style={{
          background: "radial-gradient(circle at 50% 50%, oklch(0.72 0.06 50) 0%, transparent 70%)",
        }}
      />
      <div className="-mt-40 space-y-3">
        <h2 className="font-heading text-foreground text-[32px]">{t("page.desks_empty_title")}</h2>
        <p className="text-muted-foreground mx-auto max-w-[440px] text-base">
          {t("page.desks_empty_body")}
        </p>
        {canManage ? (
          <div className="pt-4">
            <Button onClick={onCreate}>{t("page.desks_empty_cta")}</Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
