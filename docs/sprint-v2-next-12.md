# Sprint `v2-next-12` — comms: euristiche su messaggi Postgres

**Riferimenti:** [backlog-crm-v2.md](./backlog-crm-v2.md); sprint precedente [sprint-v2-next-11.md](./sprint-v2-next-11.md); **successivo:** [sprint-v2-next-13.md](./sprint-v2-next-13.md).

**Obiettivo dello sprint (incremento misurabile):** estendere [`formatCommsAdminPageError`](../lib/comms/comms-admin-errors.ts) con **euristiche** su stringhe d’errore tipiche di Postgres/PostgREST restituite in `?error=` dopo insert falliti su `comms_campaigns` (slug **duplicato**, **CHECK** su `segment_kind`, altri **check constraint** con anteprima troncata). I codici simbolici restano gestiti dallo `switch`; i messaggi non riconosciuti restano **invariati**. **Test unitari** aggiornati. **Senza** nuove migrazioni SQL.

**Definition of Done:**

- [x] Helper interno + `default` branch in [`lib/comms/comms-admin-errors.ts`](../lib/comms/comms-admin-errors.ts).
- [x] [`lib/comms/comms-admin-errors.test.ts`](../lib/comms/comms-admin-errors.test.ts) aggiornato.
- [x] `npm run ci` verde; doc sprint, backlog, README, ROADMAP.

---

## Storie

### S1 — Euristiche + test

- [x] Duplicati slug, CHECK segmento, check generico con dettaglio troncato.

---

## Log routine

| Data       | Azione |
|------------|--------|
| 2026-04-15 | Euristiche Postgres + test; doc; `npm run ci` |
| 2026-04-15 | Puntatore a sprint `v2-next-13` (e2e slug duplicato comms) |

