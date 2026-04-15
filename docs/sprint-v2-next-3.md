# Sprint `v2-next-3` — qualità CI staging + e2e comms

**Riferimenti:** [ROADMAP.md](../ROADMAP.md) §254–260 (Q2 qualità / staging), [backlog-crm-v2.md](./backlog-crm-v2.md) §52–58; sprint precedente [sprint-v2-next-2.md](./sprint-v2-next-2.md).

**Obiettivo dello sprint (incremento misurabile):** rendere operativo lo smoke **GitHub Actions** sul progetto Supabase staging **senza** file `.env.local` nel runner (merge env + file locale via [`scripts/load-supabase-env.mjs`](../scripts/load-supabase-env.mjs)) e aggiungere **e2e staff** sulla mutazione «scan reminder eventi» in [`/admin/comms`](../app/admin/comms/page.tsx), senza nuove migrazioni SQL.

**Definition of Done (condivisa):**

- [x] Migrazioni: nessun nuovo file in `supabase/migrations/` per questo slice.
- [x] `npm run ci` verde; script `verify:supabase` / `smoke:test` compatibili con env-only in CI.
- [x] Workflow [`.github/workflows/staging-db-verify.yml`](../.github/workflows/staging-db-verify.yml) documentato con secret opzionale `STAGING_SUPABASE_SERVICE_ROLE_KEY`.
- [x] E2e staff (storage): percorso scan reminder con `data-testid` stabili.
- [x] Nessun secret in repo; RLS invariata.

---

## Storie

### S1 — Staging DB verify: env senza `.env.local`

- [x] Modulo [`scripts/load-supabase-env.mjs`](../scripts/load-supabase-env.mjs); [`scripts/check-supabase-env.mjs`](../scripts/check-supabase-env.mjs) e [`scripts/smoke-test-booking.mjs`](../scripts/smoke-test-booking.mjs) usano merge file + `process.env`.
- [x] Workflow: `verify:supabase` sempre con URL+anon; `smoke:test` solo se `STAGING_SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_SERVICE_ROLE_KEY` nel job.
- [x] Documentazione: [docs/deploy-operator-checklist.md](./deploy-operator-checklist.md), [.env.example](../.env.example).

### S2 — E2E: scan reminder da `/admin/comms`

- [x] `data-testid` su form/pulsante/flash in [`app/admin/comms/page.tsx`](../app/admin/comms/page.tsx).
- [x] Test in [`e2e/admin-staff-routes.spec.ts`](../e2e/admin-staff-routes.spec.ts).

---

## Fuori scope

- Nuovi segmenti campagna, reminder aggiuntivi oltre 24h/7g, grafici analytics.

---

## Log routine

| Data       | Azione |
|------------|--------|
| 2026-04-15 | `load-supabase-env`, workflow staging + checklist + e2e comms scan; `npm run ci` |

**Stato:** chiusura documentale sprint `v2-next-3` (DoD soddisfatto). Prossimo tracciamento: [sprint-v2-next-4.md](./sprint-v2-next-4.md).
