"use client";

import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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

export function Step5Menu({ state, updateState }: WizardStepProps<JoinState>) {
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

  // Sync local fields to wizard state so WizardNavBar validation sees current data
  useEffect(() => {
    updateState({
      menu: {
        ...state.menu,
        restaurantType: restaurantType || undefined,
        cuisineTypes: cuisineTypes.length > 0 ? cuisineTypes : undefined,
        priceCategory: priceCategory || undefined,
        menuDescription: menuDescription || undefined,
      },
    });
  }, [restaurantType, cuisineTypes, priceCategory, menuDescription]);

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div>
        <h2 className="font-heading text-foreground text-2xl font-bold">Meny</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Fortell oss om maten og drikken dere serverer.
        </p>
        {prePopulated && (
          <p className="text-brand-orange mt-2 flex items-center gap-1.5 text-xs">
            <Sparkles className="h-3 w-3" />
            Foreslatt basert pa det vi fant — endre fritt
          </p>
        )}
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="restaurantType">Restauranttype</Label>
          <Select value={restaurantType} onValueChange={setRestaurantType}>
            <SelectTrigger id="restaurantType">
              <SelectValue placeholder="Velg type..." />
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
          <Label>Kjokkentype</Label>
          <div className="grid grid-cols-2 gap-2">
            {CUISINE_TYPES.map((cuisine) => (
              <label
                key={cuisine}
                className="border-border hover:bg-accent flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors"
              >
                <Checkbox
                  checked={cuisineTypes.includes(cuisine)}
                  onCheckedChange={() => toggleCuisine(cuisine)}
                />
                {cuisine}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="priceCategory">Priskategori</Label>
          <Select value={priceCategory} onValueChange={setPriceCategory}>
            <SelectTrigger id="priceCategory">
              <SelectValue placeholder="Velg priskategori..." />
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
            Menybeskrivelse <span className="text-muted-foreground">(valgfritt)</span>
          </Label>
          <Textarea
            id="menuDescription"
            rows={3}
            placeholder="Beskriv menyen deres kort..."
            value={menuDescription}
            onChange={(e) => setMenuDescription(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
