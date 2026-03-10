import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { Badge } from "@/components/ui/badge";

const getContentData = unstable_cache(
  async () => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("landing_config")
      .select("config_id, slug, name, locale, status, version, published_at, updated_at")
      .order("updated_at", { ascending: false });
    return data;
  },
  ["platform-admin-content-v1"],
  { revalidate: 120 },
);

export default async function ContentPage() {
  const [adminId, configs] = await Promise.all([getSuperAdminId(), getContentData()]);
  if (!adminId) redirect("/dashboard");

  const statusColor: Record<string, string> = {
    draft: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    published: "bg-green-500/10 text-green-400 border-green-500/20",
    archived: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold">Content</h1>
      <p className="text-muted-foreground mt-1 text-sm">Landing page configurations</p>

      <div className="border-border mt-6 rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-left text-xs tracking-wider uppercase">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Locale</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Published</th>
            </tr>
          </thead>
          <tbody>
            {configs?.map((config) => (
              <tr key={config.config_id} className="border-border border-b last:border-0">
                <td className="px-4 py-3 font-medium">{config.name}</td>
                <td className="text-muted-foreground px-4 py-3 font-mono text-xs">{config.slug}</td>
                <td className="text-muted-foreground px-4 py-3 uppercase">{config.locale}</td>
                <td className="px-4 py-3">
                  <Badge
                    variant="outline"
                    className={`text-xs capitalize ${statusColor[config.status] || ""}`}
                  >
                    {config.status}
                  </Badge>
                </td>
                <td className="text-muted-foreground px-4 py-3">v{config.version}</td>
                <td className="text-muted-foreground px-4 py-3">
                  {config.published_at
                    ? new Date(config.published_at).toLocaleDateString("no-NO")
                    : "\u2014"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
