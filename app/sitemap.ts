import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site-url";
import { createPublicAnonClient } from "@/lib/supabase/public-anon";

/** Rigenera spesso: URL da CMS cambiano senza redeploy. */
export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl().replace(/\/$/, "");
  const now = new Date();
  const supabase = createPublicAnonClient();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/giochi`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/giochi/beyblade-x`, lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${base}/events`, lastModified: now, changeFrequency: "weekly", priority: 0.85 },
    { url: `${base}/news`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${base}/reserve`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
  ];

  if (!supabase) {
    return staticEntries;
  }

  const [gamesRes, postsRes, eventsRes] = await Promise.all([
    supabase
      .from("game_pages")
      .select("slug, updated_at")
      .eq("status", "published")
      .order("sort_order", { ascending: true }),
    supabase
      .from("posts")
      .select("slug, updated_at, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("events")
      .select("slug, updated_at")
      .eq("status", "published")
      .order("starts_at", { ascending: true }),
  ]);

  const gameEntries: MetadataRoute.Sitemap = (gamesRes.data ?? []).map((row) => ({
    url: `${base}/giochi/${row.slug}`,
    lastModified: row.updated_at ? new Date(row.updated_at) : now,
    changeFrequency: "monthly" as const,
    priority: 0.85,
  }));

  const postEntries: MetadataRoute.Sitemap = (postsRes.data ?? []).map((row) => ({
    url: `${base}/news/${row.slug}`,
    lastModified: new Date(row.updated_at ?? row.published_at ?? now),
    changeFrequency: "weekly" as const,
    priority: 0.65,
  }));

  const eventEntries: MetadataRoute.Sitemap = (eventsRes.data ?? []).map((row) => ({
    url: `${base}/events/${row.slug}`,
    lastModified: row.updated_at ? new Date(row.updated_at) : now,
    changeFrequency: "weekly" as const,
    priority: 0.75,
  }));

  const urls = new Set<string>();
  const merged: MetadataRoute.Sitemap = [];

  function pushUnique(entry: MetadataRoute.Sitemap[number]) {
    if (urls.has(entry.url)) return;
    urls.add(entry.url);
    merged.push(entry);
  }

  for (const e of staticEntries) pushUnique(e);
  for (const e of gameEntries) pushUnique(e);
  for (const e of postEntries) pushUnique(e);
  for (const e of eventEntries) pushUnique(e);

  return merged;
}
