"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { usePages, type PageRow } from "../_hooks/use-pages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, EyeOff, Trash2, Plus, ChevronRight } from "lucide-react";
import SortablePageItem from "./SortablePageItem";

type Props = {
  websiteId: string;
};

const PAGE_TYPE_LABELS: Record<string, string> = {
  hjem: "Hjem",
  meny: "Meny",
  "om-oss": "Om oss",
  kontakt: "Kontakt",
  custom: "Egendefinert",
};

export default function PageList({ websiteId }: Props) {
  const router = useRouter();
  const { pages, isLoading, create, remove, reorder, toggleVisibility } = usePages(websiteId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPageType, setNewPageType] = useState("custom");
  const [newSlug, setNewSlug] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  // Home page is the one with sort_order 0 or page_type "hjem"
  const isHomePage = (page: PageRow) => page.page_type === "hjem" || page.sort_order === 0;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = pages.findIndex((p) => p.website_page_id === active.id);
    const newIndex = pages.findIndex((p) => p.website_page_id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Prevent moving anything to index 0 (home page stays pinned)
    if (newIndex === 0) return;

    const reordered = arrayMove(pages, oldIndex, newIndex);
    reorder.mutate(reordered.map((p) => p.website_page_id));
  }

  const handleVisibilityToggle = (page: PageRow, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleVisibility.mutate({ pageId: page.website_page_id, isVisible: !page.is_visible });
  };

  const handleDelete = (page: PageRow, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Vil du slette siden "${page.title}"? Denne handlingen kan ikke angres.`)) return;
    remove.mutate(page.website_page_id);
  };

  const handleCreatePage = () => {
    if (!newTitle.trim() || !newSlug.trim()) return;
    create.mutate(
      { title: newTitle.trim(), pageType: newPageType, slug: newSlug.trim() },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setNewTitle("");
          setNewPageType("custom");
          setNewSlug("");
        },
      },
    );
  };

  // Auto-generate slug from title
  const handleTitleChange = (title: string) => {
    setNewTitle(title);
    setNewSlug(
      title
        .toLowerCase()
        .replace(/æ/g, "ae")
        .replace(/ø/g, "o")
        .replace(/å/g, "a")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    );
  };

  if (isLoading) {
    return <div className="text-muted-foreground py-8 text-center text-sm">Laster sider...</div>;
  }

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={pages.map((p) => p.website_page_id)}
          strategy={verticalListSortingStrategy}
        >
          {pages.map((page) => (
            <SortablePageItem
              key={page.website_page_id}
              id={page.website_page_id}
              pinned={isHomePage(page)}
            >
              <div
                className="border-border bg-card hover:bg-accent flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors"
                onClick={() => router.push(`/dashboard/website/pages/${page.website_page_id}`)}
              >
                {/* Page title + type badge */}
                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate font-medium">{page.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {PAGE_TYPE_LABELS[page.page_type] ?? page.page_type} · /{page.slug}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => handleVisibilityToggle(page, e)}
                    title={page.is_visible ? "Skjul side" : "Vis side"}
                  >
                    {page.is_visible ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="text-muted-foreground h-4 w-4" />
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={isHomePage(page)}
                    onClick={(e) => handleDelete(page, e)}
                    title={isHomePage(page) ? "Hjemmesiden kan ikke slettes" : "Slett side"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
              </div>
            </SortablePageItem>
          ))}
        </SortableContext>
      </DndContext>

      <Button variant="outline" size="sm" className="w-full" onClick={() => setDialogOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Legg til side
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Legg til ny side</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label>Sidetittel</Label>
              <Input
                value={newTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Om oss"
                autoFocus
              />
            </div>

            <div>
              <Label>Sidetype</Label>
              <Select value={newPageType} onValueChange={setNewPageType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hjem">Hjem</SelectItem>
                  <SelectItem value="meny">Meny</SelectItem>
                  <SelectItem value="om-oss">Om oss</SelectItem>
                  <SelectItem value="kontakt">Kontakt</SelectItem>
                  <SelectItem value="custom">Egendefinert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>URL-slug</Label>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground text-sm">/</span>
                <Input
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder="om-oss"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Avbryt
            </Button>
            <Button
              onClick={handleCreatePage}
              disabled={!newTitle.trim() || !newSlug.trim() || create.isPending}
            >
              {create.isPending ? "Oppretter..." : "Opprett side"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
