"use client";

import type { Editor } from "@tiptap/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlaceholderPanel } from "./placeholder-panel";
import type { PlaceholderItem } from "./placeholder-panel";
import { AttachmentsPanel } from "./attachments-panel";
import { DocumentOutline } from "./document-outline";
import type { TemplateAttachment } from "@/app/platform-admin/contracts/templates/[id]/edit/save-action";

type SidebarPanelProps = {
  editor: Editor | null;
  placeholders: PlaceholderItem[];
  onPlaceholdersChange: (placeholders: PlaceholderItem[]) => void;
  contentHtml: string;
  attachments: TemplateAttachment[];
  onUpload: (file: File) => Promise<void>;
  onRemoveAttachment: (attachment: TemplateAttachment) => Promise<void>;
};

export function SidebarPanel({
  editor,
  placeholders,
  onPlaceholdersChange,
  contentHtml,
  attachments,
  onUpload,
  onRemoveAttachment,
}: SidebarPanelProps) {
  return (
    <Tabs defaultValue="placeholders" className="flex h-full flex-col">
      <TabsList className="border-border w-full justify-start rounded-none border-b bg-transparent px-2">
        <TabsTrigger value="placeholders" className="text-xs">
          Plassholdere
        </TabsTrigger>
        <TabsTrigger value="attachments" className="text-xs">
          Vedlegg
          {attachments.length > 0 && (
            <span className="bg-primary/10 text-primary ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium">
              {attachments.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="outline" className="text-xs">
          Oversikt
        </TabsTrigger>
      </TabsList>

      <TabsContent value="placeholders" className="mt-0 flex-1 overflow-hidden">
        <PlaceholderPanel
          placeholders={placeholders}
          onChange={onPlaceholdersChange}
          editor={editor}
          contentHtml={contentHtml}
        />
      </TabsContent>

      <TabsContent value="attachments" className="mt-0 flex-1 overflow-hidden">
        <AttachmentsPanel
          attachments={attachments}
          onUpload={onUpload}
          onRemove={onRemoveAttachment}
        />
      </TabsContent>

      <TabsContent value="outline" className="mt-0 flex-1 overflow-hidden">
        <DocumentOutline editor={editor} />
      </TabsContent>
    </Tabs>
  );
}
