// ============================================
// block-editor-client.tsx — Block Editor Client Component
// Main client component for the landing page variant block editor.
// Handles drag-and-drop reordering, block CRUD, variant metadata,
// debounced autosave, publish/unpublish flow, and preview link.
//
// Connected to: ../page.tsx (server data)
//               ./block-card.tsx (individual block rendering)
//               ./variant-metadata-form.tsx (variant settings)
//               ./add-block-dialog.tsx (block type picker)
//               ../preview/page.tsx (iframe preview)
// ============================================

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { createClient } from "@smartout/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Save,
  Rocket,
  Plus,
  Loader2,
  Eye,
  CircleOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/platform-admin/status-badge";

import type { VariantData, BlockData } from "../page";
import { BlockCard } from "./block-card";
import { VariantMetadataForm } from "./variant-metadata-form";
import { AddBlockDialog } from "./add-block-dialog";

type BlockEditorClientProps = {
  variant: VariantData | null;
  blocks: BlockData[];
  isNew?: boolean;
};

type SaveStatus = "saved" | "saving" | "unsaved";

function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  switch (status) {
    case "saved":
      return <span className="text-xs text-green-500">Lagret</span>;
    case "saving":
      return <span className="text-xs text-yellow-500">Lagrer...</span>;
    case "unsaved":
      return <span className="text-xs text-orange-500">Ulagrede endringer</span>;
  }
}

const AUTOSAVE_DELAY_MS = 1000;

// TODO: Replace (supabase as any) once landing tables are in database.types.ts

export function BlockEditorClient({
  variant: initialVariant,
  blocks: initialBlocks,
  isNew = false,
}: BlockEditorClientProps) {
  const router = useRouter();
  const supabase = createClient();

  // Local state
  const [variant, setVariant] = useState<VariantData | null>(initialVariant);
  const [blocks, setBlocks] = useState<BlockData[]>(initialBlocks);
  const [metadataOpen, setMetadataOpen] = useState(isNew);
  const [saving, setSaving] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");

  // Variant metadata state for new/edited variants
  const [variantForm, setVariantForm] = useState({
    name: initialVariant?.name ?? "",
    slug: initialVariant?.slug ?? "",
    status: initialVariant?.status ?? ("draft" as const),
    is_default: initialVariant?.is_default ?? false,
    meta_title: initialVariant?.meta_title ?? "",
    meta_description: initialVariant?.meta_description ?? "",
    theme_accent: initialVariant?.theme_accent ?? "orange",
  });

  // Refs for autosave debounce
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const variantFormRef = useRef(variantForm);
  const variantRef = useRef(variant);

  // Keep refs in sync
  useEffect(() => {
    variantFormRef.current = variantForm;
  }, [variantForm]);

  useEffect(() => {
    variantRef.current = variant;
  }, [variant]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  // ── Autosave logic ─────────────────────────────────────────────

  const performAutosave = useCallback(async () => {
    const currentForm = variantFormRef.current;
    const currentVariant = variantRef.current;

    // Don't autosave if it's a new unsaved variant or missing required fields
    if (!currentVariant || !currentForm.name.trim() || !currentForm.slug.trim()) {
      return;
    }

    setSaveStatus("saving");

    const payload = {
      name: currentForm.name.trim(),
      slug: currentForm.slug.trim(),
      status: currentForm.status,
      is_default: currentForm.is_default,
      meta_title: currentForm.meta_title.trim() || null,
      meta_description: currentForm.meta_description.trim() || null,
      theme_accent: currentForm.theme_accent,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("landing_variant")
      .update(payload)
      .eq("id", currentVariant.id)
      .select()
      .single();

    if (error) {
      setSaveStatus("unsaved");
      // Don't toast on autosave errors to avoid spam — just show indicator
      return;
    }

    setVariant(data as VariantData);
    setSaveStatus("saved");
  }, [supabase]);

  const scheduleAutosave = useCallback(() => {
    // Don't autosave new variants
    if (isNew && !variant) return;

    setSaveStatus("unsaved");

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      void performAutosave();
    }, AUTOSAVE_DELAY_MS);
  }, [isNew, variant, performAutosave]);

  // Cleanup autosave timer on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  // Track metadata changes for autosave
  const handleVariantFormChange = useCallback(
    (newForm: typeof variantForm) => {
      setVariantForm(newForm);
      scheduleAutosave();
    },
    [scheduleAutosave],
  );

  // ── Drag & drop ──────────────────────────────────────────────────

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(blocks, oldIndex, newIndex);
      setBlocks(reordered);

      // Update sort_order for all affected blocks
      const updates = reordered.map((block, index) => ({
        id: block.id,
        sort_order: index,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const update of updates) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("landing_block")
          .update({ sort_order: update.sort_order })
          .eq("id", update.id);
        if (error) {
          toast.error("Failed to save block order", {
            description: error.message,
          });
          return;
        }
      }

      toast.success("Block order updated");
    },
    [blocks, supabase],
  );

  // ── Block actions ────────────────────────────────────────────────

  const handleAddBlock = useCallback(
    async (blockType: string) => {
      if (!variant) {
        toast.error("Save the variant first before adding blocks");
        return;
      }

      const newSortOrder = blocks.length;
      const defaultContent = { heading: "", subheading: "" };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("landing_block")
        .insert({
          variant_id: variant.id,
          block_type: blockType,
          content: defaultContent,
          sort_order: newSortOrder,
          is_visible: true,
        })
        .select()
        .single();

      if (error) {
        toast.error("Failed to add block", { description: error.message });
        return;
      }

      setBlocks((prev) => [...prev, data as BlockData]);
      setAddDialogOpen(false);
      toast.success(`Added ${blockType.replace(/_/g, " ")} block`);
    },
    [variant, blocks, supabase],
  );

  const handleDeleteBlock = useCallback(
    async (blockId: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("landing_block").delete().eq("id", blockId);

      if (error) {
        toast.error("Failed to delete block", { description: error.message });
        return;
      }

      setBlocks((prev) => prev.filter((b) => b.id !== blockId));
      toast.success("Block deleted");
    },
    [supabase],
  );

  const handleToggleVisibility = useCallback(
    async (blockId: string, isVisible: boolean) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("landing_block")
        .update({ is_visible: isVisible })
        .eq("id", blockId);

      if (error) {
        toast.error("Failed to toggle visibility", {
          description: error.message,
        });
        return;
      }

      setBlocks((prev) =>
        prev.map((b) => (b.id === blockId ? { ...b, is_visible: isVisible } : b)),
      );
    },
    [supabase],
  );

  const handleToggleExpand = useCallback((blockId: string) => {
    setExpandedBlockId((prev) => (prev === blockId ? null : blockId));
  }, []);

  const handleContentChange = useCallback(
    async (blockId: string, content: Record<string, unknown>) => {
      // Update local state immediately
      setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, content } : b)));

      // Persist to database
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("landing_block")
        .update({ content })
        .eq("id", blockId);

      if (error) {
        toast.error("Failed to save block content", {
          description: error.message,
        });
      }
    },
    [supabase],
  );

  // ── Save variant ─────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!variantForm.name.trim()) {
      toast.error("Variant name is required");
      return;
    }
    if (!variantForm.slug.trim()) {
      toast.error("Variant slug is required");
      return;
    }

    // Clear any pending autosave
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    setSaving(true);
    setSaveStatus("saving");

    const payload = {
      name: variantForm.name.trim(),
      slug: variantForm.slug.trim(),
      status: variantForm.status,
      is_default: variantForm.is_default,
      meta_title: variantForm.meta_title.trim() || null,
      meta_description: variantForm.meta_description.trim() || null,
      theme_accent: variantForm.theme_accent,
    };

    if (isNew || !variant) {
      // Create new variant
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("landing_variant")
        .insert({ ...payload, sort_order: 0 })
        .select()
        .single();

      if (error) {
        toast.error("Failed to create variant", {
          description: error.message,
        });
        setSaving(false);
        setSaveStatus("unsaved");
        return;
      }

      toast.success("Variant created");
      setSaveStatus("saved");
      // Navigate to the edit page for the new variant
      router.push(`/platform-admin/landing/variants/${(data as VariantData).id}`);
    } else {
      // Update existing variant
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("landing_variant")
        .update(payload)
        .eq("id", variant.id)
        .select()
        .single();

      if (error) {
        toast.error("Failed to save variant", { description: error.message });
        setSaving(false);
        setSaveStatus("unsaved");
        return;
      }

      setVariant(data as VariantData);
      setSaveStatus("saved");
      toast.success("Variant saved");
    }

    setSaving(false);
  }, [variant, variantForm, isNew, supabase, router]);

  // ── Publish / Unpublish ────────────────────────────────────────

  const triggerRevalidation = useCallback(async () => {
    try {
      const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL ?? "http://localhost:3055";
      const res = await fetch(`${landingUrl}/api/revalidate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: process.env.NEXT_PUBLIC_REVALIDATION_SECRET ?? "dev-revalidation-secret",
        }),
      });

      if (!res.ok) {
        console.warn("[revalidate] Landing page revalidation failed:", res.status);
      }
    } catch (err) {
      // Revalidation failure is non-critical — log but don't block
      console.warn("[revalidate] Could not reach landing app:", err);
    }
  }, []);

  const handlePublish = useCallback(async () => {
    if (!variant) {
      toast.error("Save the variant first");
      return;
    }

    // Save any pending changes first
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    setSaving(true);
    setSaveStatus("saving");

    // Save current form data + set status to published
    const payload = {
      name: variantForm.name.trim(),
      slug: variantForm.slug.trim(),
      status: "published" as const,
      is_default: variantForm.is_default,
      meta_title: variantForm.meta_title.trim() || null,
      meta_description: variantForm.meta_description.trim() || null,
      theme_accent: variantForm.theme_accent,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("landing_variant")
      .update(payload)
      .eq("id", variant.id)
      .select()
      .single();

    if (error) {
      toast.error("Failed to publish", { description: error.message });
      setSaving(false);
      setSaveStatus("unsaved");
      return;
    }

    setVariant(data as VariantData);
    setVariantForm((prev) => ({ ...prev, status: "published" }));
    setSaveStatus("saved");

    // Trigger revalidation to bust landing page cache
    await triggerRevalidation();

    toast.success("Variant published and landing page updated");
    setSaving(false);
  }, [variant, variantForm, supabase, triggerRevalidation]);

  const handleUnpublish = useCallback(async () => {
    if (!variant) return;

    setSaving(true);
    setSaveStatus("saving");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("landing_variant")
      .update({ status: "draft" })
      .eq("id", variant.id)
      .select()
      .single();

    if (error) {
      toast.error("Failed to unpublish", { description: error.message });
      setSaving(false);
      setSaveStatus("unsaved");
      return;
    }

    setVariant(data as VariantData);
    setVariantForm((prev) => ({ ...prev, status: "draft" }));
    setSaveStatus("saved");

    // Trigger revalidation so the landing page reflects the change
    await triggerRevalidation();

    toast.success("Variant unpublished");
    setSaving(false);
  }, [variant, supabase, triggerRevalidation]);

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/platform-admin/landing/variants">
              <ArrowLeft className="h-4 w-4" />
              Tilbake
            </Link>
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <h1 className="text-xl font-semibold">
              {isNew ? "Ny variant" : (variant?.name ?? "Variant")}
            </h1>
            {variant && (
              <div className="mt-0.5 flex items-center gap-2">
                <StatusBadge status={variant.status} size="sm" />
                {variant.is_default && (
                  <Badge
                    variant="outline"
                    className="border-amber-500/20 bg-amber-500/15 px-1.5 py-0 text-[10px] text-amber-500"
                  >
                    default
                  </Badge>
                )}
                <SaveStatusIndicator status={saveStatus} />
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Preview button */}
          {variant && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/platform-admin/landing/variants/${variant.id}/preview`}>
                <Eye className="h-4 w-4" />
                Forhandsvisning
              </Link>
            </Button>
          )}

          {/* Save button */}
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Lagre
          </Button>

          {/* Publish / Unpublish button */}
          {variant && variant.status !== "published" && (
            <Button size="sm" onClick={handlePublish} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4" />
              )}
              Publiser
            </Button>
          )}
          {variant && variant.status === "published" && (
            <Button variant="outline" size="sm" onClick={handleUnpublish} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CircleOff className="h-4 w-4" />
              )}
              Avpubliser
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* Metadata section (collapsible) */}
      <div className="rounded-lg border">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
          onClick={() => setMetadataOpen((prev) => !prev)}
        >
          <span>Variant-innstillinger</span>
          {metadataOpen ? (
            <ChevronDown className="text-muted-foreground h-4 w-4" />
          ) : (
            <ChevronRight className="text-muted-foreground h-4 w-4" />
          )}
        </button>
        {metadataOpen && (
          <div className="border-t px-4 py-4">
            <VariantMetadataForm values={variantForm} onChange={handleVariantFormChange} />
          </div>
        )}
      </div>

      {/* Block list with drag and drop */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Blokker ({blocks.length})</h2>
        </div>

        {blocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
            <p className="text-muted-foreground mb-3 text-sm">Ingen blokker lagt til enn&aring;.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddDialogOpen(true)}
              disabled={isNew && !variant}
            >
              <Plus className="h-4 w-4" />
              Legg til blokk
            </Button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {blocks.map((block) => (
                  <BlockCard
                    key={block.id}
                    block={block}
                    isExpanded={expandedBlockId === block.id}
                    onToggleExpand={handleToggleExpand}
                    onDelete={handleDeleteBlock}
                    onToggleVisibility={handleToggleVisibility}
                    onContentChange={handleContentChange}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Add block button */}
        {(variant || !isNew) && blocks.length > 0 && (
          <div className="flex justify-center pt-2">
            <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Legg til blokk
            </Button>
          </div>
        )}
      </div>

      {/* Add block dialog */}
      <AddBlockDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAddBlock={handleAddBlock}
      />
    </div>
  );
}
