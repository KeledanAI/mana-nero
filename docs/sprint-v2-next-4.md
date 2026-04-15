# Sprint `v2-next-4` — e2e staff record campagna comms

**Riferimenti:** [ROADMAP.md](../ROADMAP.md) §260 (qualità / e2e staff), [backlog-crm-v2.md](./backlog-crm-v2.md) §58; sprint precedente [sprint-v2-next-3.md](./sprint-v2-next-3.md).

**Obiettivo dello sprint (incremento misurabile):** coprire con **Playwright** (sessione staff) il salvataggio di un record **`comms_campaigns`** da [`/admin/comms`](../app/admin/comms/page.tsx), senza enqueue massivo né nuove migrazioni SQL.

**Definition of Done (condivisa):**

- [x] Migrazioni: nessun nuovo file in `supabase/migrations/`.
- [x] `npm run ci` verde.
- [x] `data-testid` stabili su form record campagna e messaggio di successo.
- [x] Test in [`e2e/admin-staff-routes.spec.ts`](../e2e/admin-staff-routes.spec.ts) con slug univoco per evitare collisioni su `comms_campaigns.slug`.

---

## Storie

### S1 — E2E: `saveCommsCampaignRecord`

- [x] Form «Registro campagne» con `data-testid` in [`app/admin/comms/page.tsx`](../app/admin/comms/page.tsx).
- [x] Assert su flash `record_saved` dopo server action [`saveCommsCampaignRecord`](../app/admin/actions.ts).

---

## Fuori scope

- Nuovi segmenti DB, campagne segmentate enqueue di massa in e2e.

---

## Log routine

| Data       | Azione |
|------------|--------|
| 2026-04-15 | e2e salva record campagna + doc sprint; `npm run ci` |

**Stato:** chiusura documentale sprint `v2-next-4`. Prossimo: [sprint-v2-next-5.md](./sprint-v2-next-5.md).
