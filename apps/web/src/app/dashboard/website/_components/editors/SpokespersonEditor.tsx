"use client";

/**
 * Editor for the spokesperson section.
 *
 * Two states:
 * 1. No spokesperson assigned → show EmployeePicker + assign button
 * 2. Spokesperson assigned → show SpokespersonApprovalCard + form fields (roleTitle,
 *    quote, bio, image) + ContentTaskConfig
 *
 * Assign triggers the approval flow (employee receives notification).
 * Content tasks are saved to section content and also sent to website_spokesperson.
 */

import { useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { spokespersonContentSchema, type SpokespersonContent } from "@smartout/website";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { UserPlus, Loader2 } from "lucide-react";
import ImageUpload from "../ImageUpload";
import EmployeePicker from "../EmployeePicker";
import type { SelectedProfile } from "../EmployeePicker";
import SpokespersonApprovalCard from "../SpokespersonApprovalCard";
import ContentTaskConfig from "../ContentTaskConfig";
import { useSpokesperson } from "../../_hooks/use-spokesperson";
import { useWorkspaceOptional } from "@/lib/workspace-context";

type Props = {
  content: SpokespersonContent;
  onChange: (content: SpokespersonContent) => void;
  websiteId: string;
  sectionId: string;
};

export default function SpokespersonEditor({ content, onChange, websiteId, sectionId }: Props) {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id ?? "";

  const { spokesperson, assign, revoke } = useSpokesperson(sectionId);

  // Track chosen profile before confirming assignment
  const [pendingProfile, setPendingProfile] = useState<SelectedProfile | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const form = useForm<SpokespersonContent>({
    resolver: zodResolver(spokespersonContentSchema) as Resolver<SpokespersonContent>,
    defaultValues: content,
  });

  const values = form.watch();

  // Propagate every form change to the section content
  useEffect(() => {
    onChange(values);
    // Propagate every form change to parent — onChange is stable from SectionForm
  }, [JSON.stringify(values)]);

  const hasActiveSpokesperson =
    spokesperson && spokesperson.status !== "revoked" && spokesperson.status !== "declined";

  const handleAssign = async () => {
    if (!pendingProfile) return;

    await assign.mutateAsync({
      websiteId,
      newProfileId: pendingProfile.profile_id,
      roleTitle: values.roleTitle,
      contentTasks: values.contentTasks,
    });

    // Save profileId to section content
    form.setValue("profileId", pendingProfile.profile_id, { shouldDirty: true });
    setPendingProfile(null);
    setShowPicker(false);
  };

  const handleRevoke = async () => {
    if (!spokesperson) return;

    await revoke.mutateAsync({
      websiteId,
      spokespersonId: spokesperson.website_spokesperson_id,
    });

    form.setValue("profileId", undefined, { shouldDirty: true });
    setShowPicker(false);
  };

  return (
    <form className="space-y-6 p-6">
      {/* ── Spokesperson assignment ── */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Talsperson</Label>

        {/* Approval card when already assigned */}
        {hasActiveSpokesperson && !showPicker && (
          <SpokespersonApprovalCard
            spokesperson={spokesperson}
            onChangePerson={() => setShowPicker(true)}
            onRevoke={handleRevoke}
            isRevoking={revoke.isPending}
          />
        )}

        {/* Picker when no spokesperson or admin clicked "Bytt person" */}
        {(!hasActiveSpokesperson || showPicker) && (
          <div className="space-y-3">
            {showPicker && hasActiveSpokesperson && (
              <p className="text-muted-foreground text-xs">
                Velg ny talsperson. Den nåværende vil bli tilbakekalt.
              </p>
            )}

            <EmployeePicker
              workspaceId={workspaceId}
              selectedProfileId={pendingProfile?.profile_id}
              onSelect={(_id, profile) => setPendingProfile(profile)}
            />

            <div className="flex gap-2">
              <Button
                type="button"
                onClick={handleAssign}
                disabled={!pendingProfile || assign.isPending}
                className="gap-1.5"
              >
                {assign.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                Tilordne talsperson
              </Button>

              {showPicker && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowPicker(false);
                    setPendingProfile(null);
                  }}
                >
                  Avbryt
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* ── Profile content fields ── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Rolle på nettstedet</Label>
          <Input
            {...form.register("roleTitle")}
            placeholder="f.eks. «Daglig leder» eller «Barista»"
          />
        </div>

        <div className="col-span-2">
          <Label>Sitat</Label>
          <Textarea
            {...form.register("quote")}
            placeholder="Et kort sitat fra talspersonen…"
            rows={2}
          />
        </div>

        <div className="col-span-2">
          <Label>Bio</Label>
          <Textarea
            {...form.register("bio")}
            placeholder="Litt om hvem talspersonen er og hva de gjør…"
            rows={3}
          />
        </div>

        <div className="col-span-2">
          <Label>Bilde</Label>
          <ImageUpload
            assetId={form.watch("imageAssetId")}
            onAssetChange={(id) => form.setValue("imageAssetId", id, { shouldDirty: true })}
            websiteId={websiteId}
          />
        </div>
      </div>

      <Separator />

      {/* ── Content task configuration ── */}
      <ContentTaskConfig
        tasks={values.contentTasks}
        onChange={(tasks) => form.setValue("contentTasks", tasks, { shouldDirty: true })}
      />
    </form>
  );
}
