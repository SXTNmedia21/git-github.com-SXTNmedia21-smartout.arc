// ============================================
// preview-client.tsx — Landing Variant Preview Client
// Renders an iframe preview of a landing variant with device
// size toggles (mobile, tablet, desktop) and utility controls.
//
// Uses the landing app's /v?preview=true&id={variantId} route.
//
// Connected to: ../page.tsx (server wrapper)
//               apps/landing/src/app/v/page.tsx (iframe target)
// ============================================

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Monitor, Smartphone, Tablet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type PreviewClientProps = {
  variantId: string;
};

type DeviceSize = "mobile" | "tablet" | "desktop";

const DEVICE_SIZES: Record<DeviceSize, { label: string; width: string; icon: typeof Monitor }> = {
  mobile: { label: "Mobil", width: "375px", icon: Smartphone },
  tablet: { label: "Nettbrett", width: "768px", icon: Tablet },
  desktop: { label: "Desktop", width: "100%", icon: Monitor },
};

export function PreviewClient({ variantId }: PreviewClientProps) {
  const [device, setDevice] = useState<DeviceSize>("desktop");

  const landingUrl = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_LANDING_URL ?? "";
    return `${base}/v?preview=true&id=${variantId}`;
  }, [variantId]);

  const iframeWidth = DEVICE_SIZES[device].width;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header bar */}
      <div className="bg-background border-b px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          {/* Left: Back + variant info */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/platform-admin/landing/variants/${variantId}`}>
                <ArrowLeft className="h-4 w-4" />
                Tilbake til editor
              </Link>
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <span className="text-muted-foreground text-sm">Forhandsvisning</span>
          </div>

          {/* Center: Device toggles */}
          <div className="flex items-center gap-1 rounded-lg border p-1">
            {(
              Object.entries(DEVICE_SIZES) as [DeviceSize, (typeof DEVICE_SIZES)[DeviceSize]][]
            ).map(([key, { label, icon: Icon }]) => (
              <Button
                key={key}
                variant={device === key ? "secondary" : "ghost"}
                size="sm"
                className={cn("gap-1.5", device === key && "shadow-sm")}
                onClick={() => setDevice(key)}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </Button>
            ))}
          </div>

          {/* Right: Open in new tab */}
          <Button variant="outline" size="sm" asChild>
            <a href={landingUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Apne i ny fane
            </a>
          </Button>
        </div>
      </div>

      {/* Iframe container */}
      <div className="bg-muted/50 flex flex-1 items-start justify-center overflow-auto p-4">
        <div
          className={cn(
            "h-full overflow-hidden rounded-lg border bg-white shadow-lg transition-all duration-300",
            device !== "desktop" && "mx-auto",
          )}
          style={{
            width: iframeWidth,
            maxWidth: "100%",
          }}
        >
          <iframe
            src={landingUrl}
            title="Landing page preview"
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
}
