import type { ComponentType } from "react";
import type { SectionSettings, WebsiteTheme, SnapshotAsset } from "@smartout/website";

export interface PublicSectionProps {
  content: Record<string, unknown>;
  settings: SectionSettings;
  theme: WebsiteTheme;
  assets: {
    byId: Record<string, SnapshotAsset>;
    storageBaseUrl: string;
  };
}

export type SectionComponent = ComponentType<PublicSectionProps>;
