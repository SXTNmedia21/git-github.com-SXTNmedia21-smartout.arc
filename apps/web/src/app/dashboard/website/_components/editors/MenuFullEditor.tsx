"use client";

/**
 * MenuFullEditor — read-only system bridge to the workspace's menu module.
 * Displays menus, categories, and items from websites.website_menu (managed in
 * the Menu module). Admins can toggle which menus appear on the website and
 * adjust display settings (showPrices, etc.) — these are website-local.
 * No editing of prices, names, or items happens here.
 */

import { useEffect } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { menuFullContentSchema, type MenuFullContent } from "@smartout/website";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Info, AlertTriangle, ExternalLink, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { useMenus } from "../../_hooks/use-menus";

type Props = {
  content: MenuFullContent;
  onChange: (content: MenuFullContent) => void;
  websiteId: string;
};

const displayToggles: { name: keyof MenuFullContent; label: string }[] = [
  { name: "showPrices", label: "Vis priser" },
  { name: "showDescriptions", label: "Vis beskrivelser" },
  { name: "showAllergens", label: "Vis allergener" },
  { name: "showDietaryTags", label: "Vis kostholdsmerker" },
  { name: "showImages", label: "Vis bilder" },
];

export default function MenuFullEditor({ content, onChange }: Props) {
  const { menus, isLoading } = useMenus();

  const form = useForm<MenuFullContent>({
    resolver: zodResolver(menuFullContentSchema) as Resolver<MenuFullContent>,
    defaultValues: content,
  });

  const values = form.watch();

  useEffect(() => {
    onChange(values);
  }, [JSON.stringify(values)]);

  const toggleMenuId = (menuId: string, included: boolean) => {
    const current = form.getValues("menuIds");
    const next = included ? [...current, menuId] : current.filter((id) => id !== menuId);
    form.setValue("menuIds", next, { shouldDirty: true });
  };

  return (
    <form className="space-y-6 p-6">
      {/* Info banner: data comes from the Menu module */}
      <div className="flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-400">
        <Info className="h-4 w-4 shrink-0" />
        Denne seksjonen henter data fra Menymodulen i Smartout.
      </div>

      {/* Website-local fields */}
      <div>
        <Label>Overskrift</Label>
        <Input {...form.register("heading")} />
      </div>

      <div>
        <Label>Layout</Label>
        <Select
          value={values.layout}
          onValueChange={(v) =>
            form.setValue("layout", v as "list" | "cards", { shouldDirty: true })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="list">Liste</SelectItem>
            <SelectItem value="cards">Kort</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Menu bridge — read-only from menu module */}
      <div className="space-y-3">
        <Label>Menyer fra Smartout</Label>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="bg-muted h-12 animate-pulse rounded-md" />
            ))}
          </div>
        ) : menus.length === 0 ? (
          // Empty state: guide admin to create menus in the Menu module
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center">
            <UtensilsCrossed className="text-muted-foreground h-8 w-8" />
            <p className="text-muted-foreground text-sm">
              Ingen menyer registrert ennå. Opprett en meny i Menymodulen for å vise den her.
            </p>
            <Link
              href="/dashboard/menu"
              className="text-primary flex items-center gap-1 text-sm underline"
            >
              Gå til Menymodulen
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        ) : (
          <Tabs defaultValue={menus[0]?.id}>
            <TabsList className="w-full">
              {menus.map((menu) => (
                <TabsTrigger key={menu.id} value={menu.id} className="flex-1 truncate text-xs">
                  {menu.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {menus.map((menu) => {
              const isIncluded = values.menuIds.includes(menu.id);
              return (
                <TabsContent key={menu.id} value={menu.id} className="space-y-3">
                  {/* Menu include/exclude toggle */}
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{menu.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {menu.categories.length} kategorier,{" "}
                        {menu.categories.reduce((sum, c) => sum + c.items.length, 0)} retter
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">Vis på nettside</span>
                      <Switch
                        checked={isIncluded}
                        onCheckedChange={(checked) => toggleMenuId(menu.id, checked)}
                      />
                    </div>
                  </div>

                  {/* Category + item list — read-only preview */}
                  <div className="space-y-3">
                    {menu.categories.map((cat) => (
                      <div key={cat.id} className="rounded-lg border">
                        <div className="bg-muted/50 flex items-center justify-between px-3 py-2">
                          <span className="text-sm font-medium">{cat.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {cat.items.length} retter
                          </Badge>
                        </div>
                        <div className="divide-y">
                          {cat.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between px-3 py-2"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm">{item.name}</p>
                                {item.description && (
                                  <p className="text-muted-foreground truncate text-xs">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                              {item.price > 0 && (
                                <span className="text-muted-foreground ml-3 shrink-0 text-sm">
                                  {item.price} kr
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </div>

      {/* Warning: menu data is managed in the Menu module */}
      {menus.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-sm text-yellow-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Endringer i menymodulen påvirker hele systemet.
        </div>
      )}

      {/* Website-local display toggles */}
      <div className="space-y-2">
        <Label>Vis innhold</Label>
        {displayToggles.map(({ name, label }) => (
          <div key={name} className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm font-medium">{label}</span>
            <Controller
              control={form.control}
              name={name}
              render={({ field }) => (
                <Switch checked={field.value as boolean} onCheckedChange={field.onChange} />
              )}
            />
          </div>
        ))}
      </div>
    </form>
  );
}
