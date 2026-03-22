"use server";

/**
 * Bridge actions — fetch and update data that is shared between the website builder
 * and other Smartout modules (company_opening_hours, website menus).
 *
 * Hours bridge is bidirectional: reads/writes company_opening_hours in the public schema.
 * Menu bridge is read-only: fetches from websites.website_menu and nested tables.
 */

import { createClient as createServerClient } from "@smartout/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { emit } from "@smartout/telemetry";

/** Service-role client for bypassing RLS on privileged writes. */
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export type DayHours = {
  day: string;
  open: string;
  close: string;
  closed: boolean;
};

/**
 * Fetch company_opening_hours for a workspace.
 * Uses user-scoped client — RLS enforces workspace membership.
 * Returns all 7 days (Mandag–Sondag) even if no rows exist yet.
 */
export async function getCompanyHours(workspaceId: string): Promise<DayHours[]> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("company_opening_hours")
    .select("day_of_week, open_time, close_time, is_closed")
    .eq("workspace_id", workspaceId)
    .order("day_of_week");

  if (error) throw new Error(error.message);

  const dayNames = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lordag", "Sondag"];

  return dayNames.map((day, i) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = (data as any[])?.find((r) => r.day_of_week === i);
    return {
      day,
      open: row?.open_time ?? "",
      close: row?.close_time ?? "",
      closed: row?.is_closed ?? true,
    };
  });
}

/**
 * Upsert company_opening_hours for all 7 days.
 * Verifies auth via user client, then uses admin client for the upsert.
 */
export async function updateCompanyHours(
  workspaceId: string,
  hours: DayHours[],
): Promise<{ success: true }> {
  const userClient = await createServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const admin = getAdminClient();

  for (let i = 0; i < hours.length; i++) {
    const h = hours[i]!;
    await admin.from("company_opening_hours").upsert(
      {
        workspace_id: workspaceId,
        day_of_week: i,
        open_time: h.open || null,
        close_time: h.close || null,
        is_closed: h.closed,
      },
      { onConflict: "workspace_id,day_of_week" },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await emit({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    event: "website hours_updated" as any,
    workspace_id: workspaceId,
    actor_id: user.id,
    properties: {
      entity: { entity_type: "website" as const, entity_id: workspaceId },
      data: { days_updated: hours.length },
    },
  });

  return { success: true };
}

export type MenuForBridge = {
  id: string;
  name: string;
  categories: {
    id: string;
    name: string;
    sort_order: number;
    items: {
      id: string;
      name: string;
      description: string;
      price: number;
      allergens: string[];
      dietary_tags: string[];
      is_available: boolean;
    }[];
  }[];
};

/**
 * Fetch all menus for a workspace from the websites schema.
 * Read-only — menu items/prices are managed in the Menu module.
 */
export async function getMenusForWorkspace(workspaceId: string): Promise<MenuForBridge[]> {
  const admin = getAdminClient();

  const { data: menus, error } = await admin
    .schema("websites")
    .from("website_menu")
    .select("website_menu_id, name, menu_type")
    .eq("workspace_id", workspaceId)
    .order("name");

  // No menus configured yet — return empty rather than throwing
  if (error || !menus) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const menuRows = menus as any[];
  const result: MenuForBridge[] = [];

  for (const menu of menuRows) {
    const { data: cats } = await admin
      .schema("websites")
      .from("website_menu_category")
      .select("website_menu_category_id, name, sort_order")
      .eq("website_menu_id", menu.website_menu_id)
      .order("sort_order");

    const categories: MenuForBridge["categories"] = [];

    for (const cat of (cats ?? []) as {
      website_menu_category_id: string;
      name: string;
      sort_order: number;
    }[]) {
      const { data: items } = await admin
        .schema("websites")
        .from("website_menu_item")
        .select(
          "website_menu_item_id, name, description, price, allergens, dietary_tags, is_available",
        )
        .eq("website_menu_category_id", cat.website_menu_category_id)
        .order("sort_order");

      categories.push({
        id: cat.website_menu_category_id,
        name: cat.name,
        sort_order: cat.sort_order,
        items: ((items ?? []) as Record<string, unknown>[]).map((item) => ({
          id: item.website_menu_item_id as string,
          name: item.name as string,
          description: (item.description as string) ?? "",
          price: (item.price as number) ?? 0,
          allergens: (item.allergens as string[]) ?? [],
          dietary_tags: (item.dietary_tags as string[]) ?? [],
          is_available: (item.is_available as boolean) ?? true,
        })),
      });
    }

    result.push({
      id: menu.website_menu_id,
      name: menu.name,
      categories,
    });
  }

  return result;
}
