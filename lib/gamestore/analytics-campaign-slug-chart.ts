/** Righe RPC `analytics_outbox_campaign_segment_stats_by_slug` (o equivalenti). */
export type CampaignSlugOutboxRow = {
  campaign_id: string;
  status: string;
  n: number | string;
};

export type CampaignSlugStackSegment = {
  status: string;
  n: number;
  /** Percentuale del totale slug (0–100), somma segmenti ≈ 100 salvo arrotondamenti. */
  pct: number;
};

export type CampaignSlugStackRow = {
  slug: string;
  total: number;
  segments: CampaignSlugStackSegment[];
};

/**
 * Aggrega per `campaign_id` e prepara segmenti per barra impilata (ordine per volume totale desc).
 */
export function buildCampaignSlugStackChart(
  rows: CampaignSlugOutboxRow[],
  maxSlugs = 12,
): CampaignSlugStackRow[] {
  const bySlug = new Map<string, Map<string, number>>();

  for (const r of rows) {
    const slug = String(r.campaign_id ?? "").trim();
    if (!slug) continue;
    const status = String(r.status ?? "").trim() || "unknown";
    const n = Number(r.n);
    if (!Number.isFinite(n) || n < 0) continue;
    if (!bySlug.has(slug)) bySlug.set(slug, new Map());
    const m = bySlug.get(slug)!;
    m.set(status, (m.get(status) ?? 0) + n);
  }

  const out: CampaignSlugStackRow[] = [];
  for (const [slug, statusMap] of bySlug) {
    let total = 0;
    for (const v of statusMap.values()) total += v;
    if (total <= 0) continue;
    const segments: CampaignSlugStackSegment[] = [...statusMap.entries()]
      .map(([status, n]) => ({
        status,
        n,
        pct: total > 0 ? (100 * n) / total : 0,
      }))
      .sort((a, b) => b.n - a.n);
    out.push({ slug, total, segments });
  }

  out.sort((a, b) => b.total - a.total);
  return out.slice(0, Math.max(0, maxSlugs));
}

/** Classi Tailwind per fascia stato outbox (best-effort). */
export function outboxStatusBarClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "sent") return "bg-emerald-600/85";
  if (s === "failed") return "bg-destructive/80";
  if (s === "pending") return "bg-amber-500/75";
  if (s === "processing") return "bg-primary/70";
  if (s === "cancelled") return "bg-muted-foreground/50";
  return "bg-secondary-foreground/40";
}
