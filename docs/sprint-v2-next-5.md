# Sprint `v2-next-5` — analytics: grafico campagne per slug

**Riferimenti:** [ROADMAP.md](../ROADMAP.md) §271–277 (analytics UX), [backlog-crm-v2.md](./backlog-crm-v2.md) §56; sprint precedente [sprint-v2-next-4.md](./sprint-v2-next-4.md). **Successivo:** [sprint-v2-next-6.md](./sprint-v2-next-6.md) (segmento `registration_confirmed`).

**Obiettivo dello sprint (incremento misurabile):** aggiungere in [`/admin/analytics`](../app/admin/analytics/page.tsx) un **grafico a barre impilate** per i conteggi outbox `campaign_segment` aggregati per slug e stato (dati già forniti da `analytics_outbox_campaign_segment_stats_by_slug`), con logica riusabile e test unitari, **senza** nuove migrazioni SQL.

**Definition of Done (condivisa):**

- [x] Migrazioni: nessun nuovo file in `supabase/migrations/`.
- [x] `npm run ci` verde; test unitari su aggregazione slug/stack.
- [x] UI accessibile (titoli, `title` sulle fasce), `data-testid` per e2e opzionale.
- [x] RLS invariata (solo lettura staff come la pagina esistente).

---

## Storie

### S1 — Grafico slug × stato

- [x] [`lib/gamestore/analytics-campaign-slug-chart.ts`](../lib/gamestore/analytics-campaign-slug-chart.ts) — `buildCampaignSlugStackChart`, `outboxStatusBarClass`.
- [x] [`lib/gamestore/analytics-campaign-slug-chart.test.ts`](../lib/gamestore/analytics-campaign-slug-chart.test.ts).
- [x] Sezione grafico in [`app/admin/analytics/page.tsx`](../app/admin/analytics/page.tsx) sotto la tabella slug.

### S2 — E2E opzionale

- [x] [`e2e/admin-staff-routes.spec.ts`](../e2e/admin-staff-routes.spec.ts) — skip se nessuna riga slug in DB.

---

## Fuori scope

- Nuove RPC o viste materializzate; librerie chart esterne.

---

## Log routine

| Data       | Azione |
|------------|--------|
| 2026-04-15 | Grafico barre slug + test + doc sprint; `npm run ci` |
| 2026-04-15 | Chiusura narrativa: puntatore a sprint `v2-next-6` (comms segmento confermati) |
