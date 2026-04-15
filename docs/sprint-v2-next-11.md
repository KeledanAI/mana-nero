# Sprint `v2-next-11` — comms: messaggi errore staff leggibili

**Riferimenti:** [backlog-crm-v2.md](./backlog-crm-v2.md); sprint precedente [sprint-v2-next-10.md](./sprint-v2-next-10.md); **successivo:** [sprint-v2-next-12.md](./sprint-v2-next-12.md).

**Obiettivo dello sprint (incremento misurabile):** sostituire la visualizzazione grezza di `?error=` su [`/admin/comms`](../app/admin/comms/page.tsx) con **testi in italiano** per i codici noti (validazione record, enqueue manuale, record picker, scan reminder fallito, ecc.), tramite helper riusabile [`lib/comms/comms-admin-errors.ts`](../lib/comms/comms-admin-errors.ts) con **test unitari**; messaggi tecnici non mappati (es. Postgres) restano **invariati** per il debug staff. **E2E** su errore `campaign_id_invalid` senza mostrare il codice raw. **Senza** nuove migrazioni SQL.

**Definition of Done:**

- [x] `formatCommsAdminPageError` + [`lib/comms/comms-admin-errors.test.ts`](../lib/comms/comms-admin-errors.test.ts); script `npm run test` aggiornato.
- [x] Pagina comms: `data-testid="comms-page-error"` + uso formatter.
- [x] E2E assert messaggio umano.
- [x] `npm run ci` verde; doc sprint, backlog, README, ROADMAP.

---

## Storie

### S1 — Formatter + test

- [x] Mapping codici comuni da [`app/admin/actions.ts`](../app/admin/actions.ts) e da throw in [`lib/comms/campaign-segment-enqueue.ts`](../lib/comms/campaign-segment-enqueue.ts) (stessi codici già gestiti in redirect).

### S2 — UI + e2e

- [x] Flash errore staff; copertura Playwright.

---

## Log routine

| Data       | Azione |
|------------|--------|
| 2026-04-15 | Formatter + UI + e2e + doc; `npm run ci` |
| 2026-04-15 | Puntatore a sprint `v2-next-12` (euristiche messaggi Postgres comms) |

