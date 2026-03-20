"use client";

import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { useSignupWizard } from "../_hooks/useSignupWizard";

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
  italiensk: "Italiensk",
  pizza: "Pizza",
  burger: "Burger",
  sushi: "Sushi",
  japansk: "Sushi",
  indisk: "Indisk",
  meksikansk: "Meksikansk",
  thai: "Asiatisk",
  asiatisk: "Asiatisk",
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

/* Map intelligence concept_clues to restaurant type */
function mapRestaurantType(clues: string[]): string {
  const joined = clues.join(" ").toLowerCase();
  if (joined.includes("fine dining")) return "Fine dining";
  if (joined.includes("fast food") || joined.includes("take away")) return "Fast food";
  if (joined.includes("bar") || joined.includes("cocktail")) return "Bar/Pub";
  if (joined.includes("bistro") || joined.includes("casual dining")) return "Restaurant";
  if (joined.includes("bakeri")) return "Bakeri";
  if (joined.includes("gastropub")) return "Bar/Pub";
  return "";
}

export function Step5Menu() {
  const { state, updateStep, nextStep, prevStep } = useSignupWizard();
  const intel = state.intelligence as Record<string, unknown> | null;

  const [restaurantType, setRestaurantType] = useState(state.step5.restaurantType ?? "");
  const [cuisineTypes, setCuisineTypes] = useState<string[]>(state.step5.cuisineTypes ?? []);
  const [priceCategory, setPriceCategory] = useState(state.step5.priceCategory ?? "");
  const [menuDescription, setMenuDescription] = useState(state.step5.menuDescription ?? "");
  const [prePopulated, setPrePopulated] = useState(false);

  // Pre-populate from intelligence data (once)
  const hasApplied = useRef(false);
  useEffect(() => {
    if (!intel || hasApplied.current) return;
    hasApplied.current = true;
    let applied = false;

    // Cuisine types
    const intelCuisines = (intel.cuisine_types as string[]) ?? [];
    if (intelCuisines.length > 0 && cuisineTypes.length === 0) {
      const mapped = intelCuisines
        .map((c) => CUISINE_MAP[c.toLowerCase()] ?? null)
        .filter((v): v is string => v !== null);
      const unique = [...new Set(mapped)];
      if (unique.length > 0) {
        setCuisineTypes(unique);
        applied = true;
      }
    }

    // Price range
    const intelPrice = intel.price_range as string | undefined;
    if (intelPrice && !priceCategory) {
      const mapped = mapPriceRange(intelPrice);
      if (mapped) {
        setPriceCategory(mapped);
        applied = true;
      }
    }

    // Restaurant type from concept clues
    const clues = (intel.concept_clues as string[]) ?? [];
    if (clues.length > 0 && !restaurantType) {
      const mapped = mapRestaurantType(clues);
      if (mapped) {
        setRestaurantType(mapped);
        applied = true;
      }
    }

    if (applied) setPrePopulated(true);
  }, [intel]); // intentional: only run when intelligence changes

  const toggleCuisine = (cuisine: string) => {
    setCuisineTypes((prev) =>
      prev.includes(cuisine) ? prev.filter((c) => c !== cuisine) : [...prev, cuisine],
    );
  };

  const handleNext = () => {
    updateStep("step5", {
      restaurantType: restaurantType || undefined,
      cuisineTypes: cuisineTypes.length > 0 ? cuisineTypes : undefined,
      priceCategory: priceCategory || undefined,
      menuDescription: menuDescription || undefined,
    });
    nextStep();
  };

  const handleSkip = () => {
    updateStep("step5", {});
    nextStep();
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div>
        <h2 className="text-foreground text-2xl font-bold">Meny</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Fortell oss om maten og drikken dere serverer.
        </p>
        {prePopulated && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-orange-500">
            <Sparkles className="h-3 w-3" />
            Foreslått basert på det vi fant — endre fritt
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

      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={prevStep} className="flex-1">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Tilbake
          </Button>
          <Button
            type="button"
            onClick={handleNext}
            className="flex-1 bg-orange-500 text-white hover:bg-orange-600"
          >
            Neste
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
        <button
          type="button"
          onClick={handleSkip}
          className="text-muted-foreground hover:text-foreground text-center text-sm underline transition-colors"
        >
          Hopp over
        </button>
      </div>
    </div>
  );
}
