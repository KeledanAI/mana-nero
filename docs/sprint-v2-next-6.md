# Sprint `v2-next-6` — comms: segmento `registration_confirmed`

**Riferimenti:** [ROADMAP.md](../ROADMAP.md) (campagne segmentate), [backlog-crm-v2.md](./backlog-crm-v2.md); sprint precedente [sprint-v2-next-5.md](./sprint-v2-next-5.md); **successivo (qualità e2e):** [sprint-v2-next-7.md](./sprint-v2-next-7.md); design [design-v2-comms-automation.md](./design-v2-comms-automation.md).

**Obiettivo dello sprint (incremento misurabile):** consentire campagne staff verso profili con **almeno un’iscrizione** `event_registrations.status = 'confirmed'`, in simmetria al segmento `registration_waitlisted`, con **migrazione additiva** sul CHECK `comms_campaigns.segment_kind`, enqueue, dispatch worker con skip se al momento dell’invio non risulta più confermato, UI `/admin/comms` e etichette timeline.

**Definition of Done:**

- [x] Migrazione [`20260423103000_comms_campaign_segment_registration_confirmed.sql`](../supabase/migrations/20260423103000_comms_campaign_segment_registration_confirmed.sql) (valore `registration_confirmed` nel CHECK).
- [x] [`lib/comms/campaign-segment-enqueue.ts`](../lib/comms/campaign-segment-enqueue.ts) + [`lib/comms/process-outbox.ts`](../lib/comms/process-outbox.ts) + [`lib/gamestore/crm-timeline.ts`](../lib/gamestore/crm-timeline.ts).
- [x] [`app/admin/comms/page.tsx`](../app/admin/comms/page.tsx) — opzioni form enqueue e registro campagne.
- [x] Test unitari aggiornati; `npm run ci` verde.
- [x] Doc ROADMAP/README/backlog/design allineati; conteggio migrazioni **18**.

---

## Storie

### S1 — Schema + enqueue + worker

- [x] Estensione CHECK `comms_campaigns_segment_kind_check`.
- [x] `StaffCampaignSegment` / `parseStaffCampaignSegment` / idempotency `campaign:registration_confirmed:…`.
- [x] Dispatch: verifica count `confirmed` prima dell’invio; `OUTBOX_SKIP:not_confirmed_registration` se assente; footer segmento coerente.

### S2 — UI e timeline

- [x] Select staff per segmento confermati.
- [x] `segmentKindLabel` e skip human-readable in timeline.

---

## Fuori scope

- Nuove RPC analytics; estensione `staff_cancel_pending_campaign_segment_outbox` (resta solo newsletter/marketing).

---

## Log routine

| Data       | Azione |
|------------|--------|
| 2026-04-15 | Segmento `registration_confirmed` end-to-end repo + doc; `npm run ci` |
| 2026-04-15 | Puntatore a sprint `v2-next-7` (e2e + `data-testid` comms) |
