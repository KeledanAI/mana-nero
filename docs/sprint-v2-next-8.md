# Sprint `v2-next-8` — qualità: e2e enqueue campagna segmentata

**Riferimenti:** [backlog-crm-v2.md](./backlog-crm-v2.md); sprint precedente [sprint-v2-next-7.md](./sprint-v2-next-7.md); **successivo:** [sprint-v2-next-9.md](./sprint-v2-next-9.md).

**Obiettivo dello sprint (incremento misurabile):** coprire con **Playwright** la **server action** `runNewsletterCampaignEnqueue` (form «Accoda campagna segmentata»): slug univoco, oggetto, segmento `registration_confirmed`, assert sul flash «Ultima campagna: *N* destinatari considerati»; aggiungere **`data-testid`** su input slug/oggetto, pulsante submit e flash — **senza** nuove migrazioni SQL.

**Definition of Done:**

- [x] `data-testid` su flash enqueue, `campaign_id`, `campaign_subject`, submit form segmentato.
- [x] E2E staff: submit form → flash visibile con pattern destinatari.
- [x] `npm run ci` verde.
- [x] Doc sprint + backlog + README + ROADMAP (riga test).

**Nota prodotto:** l’enqueue inserisce righe `communication_outbox` in `pending` per ciascun destinatario (processate dal worker). Lo test usa slug **`e2e-seg-${timestamp}`** e segmento **`registration_confirmed`** per ridurre la probabilità di molti destinatari in DB di sviluppo; in ambienti con molte iscrizioni confermate il conteggio può essere maggiore di zero.

---

## Storie

### S1 — UI testabile

- [x] [`app/admin/comms/page.tsx`](../app/admin/comms/page.tsx) — `comms-campaign-enqueue-flash`, `comms-campaign-id-input`, `comms-campaign-subject-input`, `comms-segmented-campaign-submit`.

### S2 — E2E

- [x] [`e2e/admin-staff-routes.spec.ts`](../e2e/admin-staff-routes.spec.ts) — flusso accoda campagna segmentata.

---

## Log routine

| Data       | Azione |
|------------|--------|
| 2026-04-15 | E2e enqueue + `data-testid`; doc; `npm run ci` |
| 2026-04-15 | Puntatore a sprint `v2-next-9` (e2e enqueue da record `comms_campaigns`) |

