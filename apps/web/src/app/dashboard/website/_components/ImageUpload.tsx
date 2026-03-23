"use client";

import { useState, useRef } from "react";
import { ImagePlus, X, Upload, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LIMITS } from "@smartout/website";
import { uploadWebsiteAsset } from "../_actions/asset-actions";
import { toast } from "sonner";

type Props = {
  /** The current asset UUID, if one is already selected. */
  assetId?: string;
  /** Called with the new assetId after a successful upload, or undefined when cleared. */
  onAssetChange: (assetId: string | undefined) => void;
  websiteId: string;
  /** Supabase storage base URL — used to render the thumbnail. Defaults to env var. */
  storageBaseUrl?: string;
};

/**
 * Reusable image upload widget used inside section editors.
 *
 * - Shows a thumbnail preview when an assetId exists
 * - "Bytt bilde" / "Last opp bilde" button opens a hidden file input
 * - "Fjern" removes the current asset reference
 * - Validates file size against LIMITS.maxImageUploadBytes (5 MB)
 * - Uploads to Supabase Storage `website-assets` bucket via server action
 * - Alt-text field is required for accessibility
 */
export default function ImageUpload({ assetId, onAssetChange, websiteId, storageBaseUrl }: Props) {
  const [isUploading, setIsUploading] = useState(false);
  const [altText, setAltText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const baseUrl =
    storageBaseUrl ??
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/website-assets`;

  const thumbnailUrl = assetId ? `${baseUrl}/${assetId}` : null;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side size guard — also validated server-side
    if (file.size > LIMITS.maxImageUploadBytes) {
      toast.error(`Filen er for stor. Maks ${LIMITS.maxImageUploadBytes / 1024 / 1024} MB.`);
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("altText", altText);

      const result = await uploadWebsiteAsset(websiteId, formData);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      onAssetChange(result.assetId);
      toast.success("Bilde lastet opp");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Opplasting feilet");
    } finally {
      setIsUploading(false);
      // Reset input so the same file can be re-selected after a clear
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-4">
      {assetId ? (
        <div className="relative">
          {/* Thumbnail preview — uses asset storage path as URL. */}
          {thumbnailUrl && (
            <img
              src={thumbnailUrl}
              alt={altText || "Opplastet bilde"}
              className="max-h-48 w-full rounded-md object-cover"
            />
          )}
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileRef.current?.click()}
              className="hover:bg-accent inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              Bytt bilde
            </button>
            <button
              type="button"
              onClick={() => onAssetChange(undefined)}
              className="border-destructive/30 text-destructive hover:bg-destructive/10 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Fjern
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={isUploading}
          className="text-muted-foreground hover:text-foreground flex w-full flex-col items-center gap-2 py-8 transition-colors disabled:opacity-50"
          onClick={() => fileRef.current?.click()}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm">Laster opp...</span>
            </>
          ) : (
            <>
              <ImagePlus className="h-8 w-8" />
              <span className="text-sm">Last opp bilde</span>
              <span className="text-xs">Maks {LIMITS.maxImageUploadBytes / 1024 / 1024} MB</span>
            </>
          )}
        </button>
      )}

      {/* Hidden file input — triggered by the upload buttons above */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />

      <div>
        <Label htmlFor="image-alt-text" className="text-xs">
          Alt-tekst <span className="text-destructive">*</span>
        </Label>
        <Input
          id="image-alt-text"
          value={altText}
          onChange={(e) => setAltText(e.target.value)}
          placeholder="Beskriv bildet for skjermlesere..."
          className="mt-1"
        />
      </div>
    </div>
  );
}
