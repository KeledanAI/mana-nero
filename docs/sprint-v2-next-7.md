# Sprint `v2-next-7` — qualità: e2e comms + segmento `registration_confirmed`

**Riferimenti:** [backlog-crm-v2.md](./backlog-crm-v2.md) (qualità e2e staff); sprint precedente [sprint-v2-next-6.md](./sprint-v2-next-6.md); **successivo:** [sprint-v2-next-8.md](./sprint-v2-next-8.md).

**Obiettivo dello sprint (incremento misurabile):** ancorare con **`data-testid`** i form comms segmentati e il select segmento del **registro** `comms_campaigns`; aggiungere **Playwright** che salva un record con `segment_kind = registration_confirmed` e verifica la lista, più smoke sulla presenza dell’opzione nel form **accoda campagna** — **senza** nuove migrazioni SQL.

**Definition of Done:**

- [x] `data-testid` su form enqueue, select segmento enqueue e select segmento registro.
- [x] E2E staff (con `E2E_STAFF_STORAGE_STATE`): record `registration_confirmed` + assert opzione enqueue.
- [x] `npm run ci` verde.
- [x] Doc backlog/README/ROADMAP (riga test) aggiornati.

**Nota operativa:** il test di salvataggio record con `registration_confirmed` richiede che sul DB di test sia applicata la migrazione [`20260423103000_comms_campaign_segment_registration_confirmed.sql`](../supabase/migrations/20260423103000_comms_campaign_segment_registration_confirmed.sql) (CHECK su `comms_campaigns`); altrimenti l’insert fallisce e il flash di successo non compare.

---

## Storie

### S1 — Ancoraggi UI

- [x] [`app/admin/comms/page.tsx`](../app/admin/comms/page.tsx) — `comms-segmented-campaign-form`, `comms-campaign-enqueue-segment`, `comms-campaign-record-segment`; copy descrittivo allineato ai segmenti.

### S2 — E2E

- [x] [`e2e/admin-staff-routes.spec.ts`](../e2e/admin-staff-routes.spec.ts) — salvataggio record + assert lista; opzione `registration_confirmed` nel form accoda.

---

## Log routine

| Data       | Azione |
|------------|--------|
| 2026-04-15 | `data-testid` + e2e comms; doc sprint; `npm run ci` |
| 2026-04-15 | Puntatore a sprint `v2-next-8` (e2e enqueue campagna segmentata) |

