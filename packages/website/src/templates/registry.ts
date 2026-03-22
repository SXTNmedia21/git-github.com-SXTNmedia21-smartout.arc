import type { WebsiteTheme } from "../types/theme";
import type { SectionType } from "../constants";
import { restaurantClassic } from "./restaurant-classic";
import { cafeModern } from "./cafe-modern";

export type TemplatePage = {
  type: string;
  slug: string;
  title: string;
  sections: SectionType[];
};

export type WebsiteTemplate = {
  key: string;
  version: number;
  name: string;
  description: string;
  industry: string;
  tier: "basic" | "pro" | "premium";
  category: string;
  defaultPages: TemplatePage[];
  defaultTheme: WebsiteTheme;
};

const TEMPLATE_REGISTRY = new Map<string, WebsiteTemplate>();

function registerTemplate(template: WebsiteTemplate): void {
  TEMPLATE_REGISTRY.set(template.key, template);
}

export function getTemplate(key: string): WebsiteTemplate | undefined {
  return TEMPLATE_REGISTRY.get(key);
}

export function getAllTemplates(): WebsiteTemplate[] {
  return Array.from(TEMPLATE_REGISTRY.values());
}

// Register built-in templates
registerTemplate(restaurantClassic);
registerTemplate(cafeModern);
