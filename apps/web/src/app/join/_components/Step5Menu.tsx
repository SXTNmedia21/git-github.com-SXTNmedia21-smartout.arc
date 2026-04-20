"use client";

import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles } from "lucide-react";
import type { WizardStepProps } from "@smartout/ui";
import type { JoinState } from "../types";
import { DevAutoFill } from "./DevAutoFill";

const RESTAURANT_TYPES = [
  "Restaurant",
  "Kafe",
  "Bar/Pub",
  "Bakeri",
  "Fast food",
  "Fine dining",
  "Catering",
  "Annet",
];

const CUISINE_TYPES = [
  "Norsk/Nordisk",
  "Husmanskost",
  "Italiensk",
  "Asiatisk",
  "Sjomat",
  "Burger",
  "Sushi",
  "Pizza",
  "Indisk",
  "Meksikansk",
  "Vegetar/Vegan",
  "Internasjonal",
  "Annet",
];

const PRICE_CATEGORIES = [
  { value: "budget", label: "Budsjett (<200kr)" },
  { value: "moderate", label: "Moderat (200-400kr)" },
  { value: "premium", label: "Premium (400-800kr)" },
  { value: "fine_dining", label: "Fine dining (800+kr)" },
];

/* Map intelligence cuisine_types to our CUISINE_TYPES display values */
const CUISINE_MAP: Record<string, string> = {
  sjomat: "Sjomat",
  seafood: "Sjomat",
  nordisk: "Norsk/Nordisk",
  norsk: "Norsk/Nordisk",
  husmanskost: "Husmanskost",
  husman: "Husmanskost",
  "comfort food": "Husmanskost",
  tradisjonsmat: "Husmanskost",
  italiensk: "Italiensk",
  pizza: "Pizza",
  burger: "Burger",
  sushi: "Sushi",
  japansk: "Sushi",
  indisk: "Indisk",
  meksikansk: "Meksikansk",
  thai: "Asiatisk",
  asiatisk: "Asiatisk",
  vegetar: "Vegetar/Vegan",
  vegan: "Vegetar/Vegan",
};

/* Map intelligence price_range to our PRICE_CATEGORIES values */
function mapPriceRange(range: string | null | undefined): string {
  if (!range) return "";
  const r = range.toLowerCase();
  if (r.includes("$$$$") || r.includes("fine") || r.includes("dyr")) return "fine_dining";
  if (r.includes("$$$") || r.includes("prem")) return "premium";
  if (r.includes("$$") || r.includes("mod")) return "moderate";
  if (r.includes("$") || r.includes("bud")) return "budget";
  return "";
}

/* Map intelligence to restaurant type — uses google_category first, then concept_clues */
function mapRestaurantType(clues: string[], googleCategory?: string): string {
  // Google Maps category is the most reliable signal
  if (googleCategory) {
    const cat = googleCategory.toLowerCase();
    if (cat.includes("fine dining")) return "Fine dining";
    if (cat.includes("fast food")) return "Fast food";
    if (cat.includes("kaffebar") || cat.includes("cafe") || cat.includes("cafe")) return "Kafe";
    if (cat.includes("bakeri") || cat.includes("bakery")) return "Bakeri";
    if (cat.includes("catering")) return "Catering";
    // "Restaurant" is the Google default for most dining places, including those with bars
    if (cat.includes("restaurant")) return "Restaurant";
    if (cat.includes("bar") || cat.includes("pub")) return "Bar/Pub";
  }

  const joined = clues.join(" ").toLowerCase();
  if (joined.includes("fine dining")) return "Fine dining";
  if (joined.includes("fast food") || joined.includes("take away")) return "Fast food";
  if (joined.includes("bakeri")) return "Bakeri";
  if (joined.includes("kafe")) return "Kafe";
  // "restaurant" clue takes priority over "bar" — a restaurant with a bar is still a restaurant
  if (joined.includes("restaurant")) return "Restaurant";
  if (joined.includes("bistro") || joined.includes("casual dining")) return "Restaurant";
  if (joined.includes("gastropub")) return "Bar/Pub";
  if (joined.includes("bar") || joined.includes("cocktail")) return "Bar/Pub";
  return "";
}

export function Step5Menu({ state, updateState, t }: WizardStepProps<JoinState>) {
  const intel = state.intelligence as Record<string, unknown> | null;

  // Initialize empty to avoid hydration mismatch — localStorage values
  // are restored via useEffect below (client-only)
  const [restaurantType, setRestaurantType] = useState("");
  const [cuisineTypes, setCuisineTypes] = useState<string[]>([]);
  const [priceCategory, setPriceCategory] = useState("");
  const [menuDescription, setMenuDescription] = useState("");
  const [prePopulated, setPrePopulated] = useState(false);

  // Restore saved values from wizard state on mount (client-only)
  const hasRestored = useRef(false);
  useEffect(() => {
    if (hasRestored.current) return;
    hasRestored.current = true;
    if (state.menu.restaurantType) setRestaurantType(state.menu.restaurantType);
    if (state.menu.cuisineTypes?.length) setCuisineTypes(state.menu.cuisineTypes);
    if (state.menu.priceCategory) setPriceCategory(state.menu.priceCategory);
    if (state.menu.menuDescription) setMenuDescription(state.menu.menuDescription);
  }, []);

  // Pre-populate from intelligence data (once)
  const hasApplied = useRef(false);
  useEffect(() => {
    if (!intel || hasApplied.current) return;
    hasApplied.current = true;
    let applied = false;

    // Cuisine types — try enrichment data first, then LLM classification
    const intelCuisines = (intel.cuisine_types as string[]) ?? [];
    const llmCuisines = (intel.llm_cuisine_types as string[]) ?? [];
    if (cuisineTypes.length === 0) {
      let mapped: string[] = [];
      if (intelCuisines.length > 0) {
        mapped = intelCuisines
          .map((c) => CUISINE_MAP[c.toLowerCase()] ?? null)
          .filter((v): v is string => v !== null);
      }
      // Fallback: LLM-classified cuisines (already in display format)
      if (mapped.length === 0 && llmCuisines.length > 0) {
        mapped = llmCuisines.filter((c) => CUISINE_TYPES.includes(c));
      }
      const unique = [...new Set(mapped)];
      if (unique.length > 0) {
        setCuisineTypes(unique);
        applied = true;
      }
    }

    // Price range — try enrichment data first, then LLM classification
    const intelPrice = intel.price_range as string | undefined;
    const llmPrice = intel.llm_price_category as string | undefined;
    if (!priceCategory) {
      const mapped = mapPriceRange(intelPrice) || llmPrice || "";
      if (mapped && PRICE_CATEGORIES.some((c) => c.value === mapped)) {
        setPriceCategory(mapped);
        applied = true;
      }
    }

    // Restaurant type — Google category > LLM classification > concept clues
    const clues = (intel.concept_clues as string[]) ?? [];
    const googleCategory = intel.google_category as string | undefined;
    const llmType = intel.llm_restaurant_type as string | undefined;
    if (!restaurantType) {
      const mapped =
        mapRestaurantType(clues, googleCategory) ||
        (llmType && RESTAURANT_TYPES.includes(llmType) ? llmType : "");
      if (mapped) {
        setRestaurantType(mapped);
        applied = true;
      }
    }

    // Menu description from LLM-generated content (stored on intelligence object)
    const intelMenu = intel.menu_description as string | undefined;
    if (intelMenu && !menuDescription) {
      setMenuDescription(intelMenu);
      applied = true;
    }

    if (applied) setPrePopulated(true);
  }, [intel]); // intentional: only run when intelligence changes

  const toggleCuisine = (cuisine: string) => {
    setCuisineTypes((prev) =>
      prev.includes(cuisine) ? prev.filter((c) => c !== cuisine) : [...prev, cuisine],
    );
  };

  // Sync local fields to wizard state — skip until restore is done to avoid wiping devFill data
  useEffect(() => {
    if (!hasRestored.current) return;
    updateState({
      menu: {
        restaurantType: restaurantType || undefined,
        cuisineTypes: cuisineTypes.length > 0 ? cuisineTypes : undefined,
        priceCategory: priceCategory || undefined,
        menuDescription: menuDescription || undefined,
      },
    });
  }, [restaurantType, cuisineTypes, priceCategory, menuDescription]);

  const devFill = () => {
    setRestaurantType("Restaurant");
    setCuisineTypes(["Norsk/Nordisk", "Sjomat", "Internasjonal"]);
    setPriceCategory("moderate");
    setMenuDescription(
      "Sesongbasert nordisk meny med fokus pa lokale ravarer. Sjomatretter, kjottgryter og vegetariske alternativer. Fast lunsjmeny og a la carte pa kvelden.",
    );
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <DevAutoFill onFill={devFill} label="Fyll steg 5" />
      <div>
        <h2 className="font-heading text-foreground text-[1.75rem] leading-tight tracking-tight">
          {t("step5.heading")}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("step5.description")}</p>
        {prePopulated && (
          <p className="text-brand-orange mt-2 flex items-center gap-1.5 text-xs">
            <Sparkles className="h-3 w-3" />
            {t("step5.aiSuggested")}
          </p>
        )}
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="restaurantType">{t("step5.restaurantType")}</Label>
          <Select value={restaurantType} onValueChange={setRestaurantType}>
            <SelectTrigger id="restaurantType">
              <SelectValue placeholder={t("step5.restaurantType_placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {RESTAURANT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t("step5.cuisineType")}</Label>
          <div className="flex flex-wrap gap-1.5">
            {CUISINE_TYPES.map((cuisine) => {
              const isSelected = cuisineTypes.includes(cuisine);
              return (
                <button
                  key={cuisine}
                  type="button"
                  onClick={() => toggleCuisine(cuisine)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    isSelected
                      ? "border-brand-orange bg-brand-orange/10 text-brand-orange"
                      : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {cuisine}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="priceCategory">{t("step5.priceCategory")}</Label>
          <Select value={priceCategory} onValueChange={setPriceCategory}>
            <SelectTrigger id="priceCategory">
              <SelectValue placeholder={t("step5.priceCategory_placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {PRICE_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="menuDescription">
            {t("step5.menuDescription")}{" "}
            <span className="text-muted-foreground">{t("step5.menuDescription_suffix")}</span>
          </Label>
          <Textarea
            id="menuDescription"
            rows={3}
            placeholder={t("step5.menuDescription_placeholder")}
            value={menuDescription}
            onChange={(e) => setMenuDescription(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
