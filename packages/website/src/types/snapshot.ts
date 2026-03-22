import type { WebsiteTheme } from "./theme";
import type { SectionSettings } from "./section";

/** The published snapshot is the sole data source for public rendering. */
export type SiteSnapshot = {
  site: {
    name: string;
    tagline: string;
    contact: {
      email: string;
      phone: string;
      address: {
        street: string;
        city: string;
        postalCode: string;
        country: string;
      };
    };
    social: {
      instagram?: string;
      facebook?: string;
      tripadvisor?: string;
      googleMaps?: string;
    };
  };
  theme: WebsiteTheme;
  navigation: {
    pages: SnapshotNavPage[];
  };
  pages: Record<string, SnapshotPage>;
  menuData: {
    menus: SnapshotMenu[];
  };
  seoDefaults: {
    title: string;
    description: string;
    ogImage: string;
  };
  assets: {
    byId: Record<string, SnapshotAsset>;
    storageBaseUrl: string;
  };
  integrations: {
    booking: {
      provider: string;
      url: string;
    };
  };
  buildMeta: BuildMeta;
};

export type SnapshotNavPage = {
  slug: string;
  title: string;
  sortOrder: number;
};

export type SnapshotPage = {
  title: string;
  slug: string;
  meta: {
    title: string;
    description: string;
    ogImage: string;
  };
  sections: SnapshotSection[];
};

export type SnapshotSection = {
  id: string;
  type: string;
  content: Record<string, unknown>;
  settings: SectionSettings;
  sortOrder: number;
};

export type SnapshotMenu = {
  name: string;
  description: string;
  sourceType: "structured" | "pdf";
  pdfPath?: string;
  categories: SnapshotMenuCategory[];
};

export type SnapshotMenuCategory = {
  name: string;
  description: string;
  items: SnapshotMenuItem[];
};

export type SnapshotMenuItem = {
  name: string;
  description: string;
  price: number;
  currency: string;
  allergens: string[];
  dietaryTags: string[];
  imageAssetId?: string;
};

export type SnapshotAsset = {
  storagePath: string;
  alt: string;
  width: number | null;
  height: number | null;
  mimeType: string;
};

export type BuildMeta = {
  snapshotVersion: number;
  templateKey: string;
  templateVersion: number;
  schemaVersion: number;
  publishedAt: string;
  publishedBy: string;
};
