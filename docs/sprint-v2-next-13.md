# Sprint `v2-next-13` — qualità: e2e messaggio slug duplicato comms

**Riferimenti:** [backlog-crm-v2.md](./backlog-crm-v2.md); sprint precedente [sprint-v2-next-12.md](./sprint-v2-next-12.md).

**Obiettivo dello sprint (incremento misurabile):** coprire con **Playwright** il fallimento insert su `comms_campaigns` per **slug già esistente** (`UNIQUE (slug)` in migrazione [`20260418140000_crm_audit_qr_window_comms_campaigns.sql`](../supabase/migrations/20260418140000_crm_audit_qr_window_comms_campaigns.sql)): secondo salvataggio con lo stesso slug → `?error=` con messaggio Postgres; la UI deve mostrare il testo **umanizzato** da [`formatCommsAdminPageError`](../lib/comms/comms-admin-errors.ts) (euristica duplicato), senza la sottostringa inglese `duplicate key`. **Senza** nuove migrazioni SQL.

**Definition of Done:**

- [x] Test in [`e2e/admin-staff-routes.spec.ts`](../e2e/admin-staff-routes.spec.ts).
- [x] `npm run ci` verde; doc sprint, backlog, README, ROADMAP.

**Nota:** il messaggio grezzo dipende da PostgREST/Postgres; l’euristica in repo richiede testi che contengono `duplicate key` o `unique constraint` (come nei test unitari).

---

## Storie

### S1 — E2E duplicato

- [x] Doppio submit record con stesso `record_slug`; assert `comms-page-error`.

---

## Log routine

| Data       | Azione |
|------------|--------|
| 2026-04-15 | E2e slug duplicato + doc; `npm run ci` |
