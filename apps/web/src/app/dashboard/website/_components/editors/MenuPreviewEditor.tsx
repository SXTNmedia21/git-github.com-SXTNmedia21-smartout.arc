"use client";

/**
 * MenuPreviewEditor — read-only bridge to the Menu module.
 * Shows a compact preview section (teaser) on the website. Admin selects which
 * menu to display, how many items to show, and the "view full menu" button text.
 * Menu data (items/prices) is read-only and managed in the Menu module.
 */

import { useEffect } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { menuPreviewContentSchema, type MenuPreviewContent } from "@smartout/website";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Info, UtensilsCrossed, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useMenus } from "../../_hooks/use-menus";

type Props = {
  content: MenuPreviewContent;
  onChange: (content: MenuPreviewContent) => void;
  websiteId: string;
};

const MAX_ITEMS_OPTIONS = [3, 6, 9] as const;

export default function MenuPreviewEditor({ content, onChange }: Props) {
  const { menus, isLoading } = useMenus();

  const form = useForm<MenuPreviewContent>({
    resolver: zodResolver(menuPreviewContentSchema) as Resolver<MenuPreviewContent>,
    defaultValues: content,
  });

  const values = form.watch();

  useEffect(() => {
    onChange(values);
  }, [JSON.stringify(values)]);

  // The preview shows items from one selected menu (first in menuIds, or none)
  const selectedMenuId = values.menuIds[0] ?? "";
  const selectedMenu = menus.find((m) => m.id === selectedMenuId);

  const handleMenuSelect = (menuId: string) => {
    form.setValue("menuIds", menuId ? [menuId] : [], { shouldDirty: true });
  };

  return (
    <form className="space-y-6 p-6">
      {/* Info banner: data comes from the Menu module */}
      <div className="flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-400">
        <Info className="h-4 w-4 shrink-0" />
        Denne seksjonen henter data fra Menymodulen i Smartout.
      </div>

      {/* Website-local text fields */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Overskrift</Label>
          <Input {...form.register("heading")} />
        </div>
        <div className="col-span-2">
          <Label>Introduksjonstekst</Label>
          <Textarea {...form.register("body")} rows={3} />
        </div>
      </div>

      {/* Menu selector */}
      <div>
        <Label>Velg meny å vise</Label>
        {isLoading ? (
          <div className="bg-muted h-10 animate-pulse rounded-md" />
        ) : menus.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center">
            <UtensilsCrossed className="text-muted-foreground h-8 w-8" />
            <p className="text-muted-foreground text-sm">
              Ingen menyer registrert. Opprett en meny i Menymodulen for å vise den her.
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
          <Select value={selectedMenuId} onValueChange={handleMenuSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Velg en meny..." />
            </SelectTrigger>
            <SelectContent>
              {menus.map((menu) => (
                <SelectItem key={menu.id} value={menu.id}>
                  {menu.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Preview of selected menu items */}
      {selectedMenu && (
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs">
            Forhåndsvisning (maks {values.maxItemsPerMenu} retter)
          </Label>
          <div className="rounded-lg border">
            {selectedMenu.categories
              .flatMap((c) => c.items)
              .slice(0, values.maxItemsPerMenu)
              .map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between border-b px-3 py-2 last:border-0"
                >
                  <span className="text-sm">{item.name}</span>
                  {values.showPrices && item.price > 0 && (
                    <span className="text-muted-foreground text-sm">{item.price} kr</span>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Max items selector */}
        <div>
          <Label>Maks antall retter</Label>
          <Select
            value={String(values.maxItemsPerMenu)}
            onValueChange={(v) =>
              form.setValue("maxItemsPerMenu", Number(v) as 3 | 6 | 9, { shouldDirty: true })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MAX_ITEMS_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} retter
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Link text for "view full menu" button */}
        <div>
          <Label>Tekst på "full meny"-lenke</Label>
          <Input {...form.register("linkText")} />
        </div>
      </div>

      {/* Website-local toggles */}
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <span className="text-sm font-medium">Vis priser</span>
          <Controller
            control={form.control}
            name="showPrices"
            render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <span className="text-sm font-medium">Lenk til full meny</span>
          <Controller
            control={form.control}
            name="linkToFullMenu"
            render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
        </div>
      </div>
    </form>
  );
}
