# Sprint `v2-next-9` — qualità: e2e enqueue da record `comms_campaigns`

**Riferimenti:** [backlog-crm-v2.md](./backlog-crm-v2.md); sprint precedente [sprint-v2-next-8.md](./sprint-v2-next-8.md); **successivo:** [sprint-v2-next-10.md](./sprint-v2-next-10.md).

**Obiettivo dello sprint (incremento misurabile):** verificare con **Playwright** il percorso **record → dropdown → enqueue**: salvataggio di un record in `comms_campaigns`, selezione dell’opzione nel picker (per `value` UUID, stabile rispetto al carattere `—` nell’etichetta), submit della server action `runNewsletterCampaignEnqueue` con campi manuali compilati solo per soddisfare `required` HTML (il server legge slug/segmento/copy dal record). Aggiungere **`data-testid`** al select `comms_campaign_id` — **senza** nuove migrazioni SQL.

**Definition of Done:**

- [x] `data-testid="comms-campaign-record-picker"` su [`app/admin/comms/page.tsx`](../app/admin/comms/page.tsx).
- [x] E2E in [`e2e/admin-staff-routes.spec.ts`](../e2e/admin-staff-routes.spec.ts): save + pick option + enqueue + flash.
- [x] `npm run ci` verde.
- [x] Doc sprint, backlog, README, ROADMAP.

**Nota:** il record usa `registration_confirmed` come negli sprint 7–8; richiede migrazione CHECK su `comms_campaigns` già documentata per l’e2e record confermati.

---

## Storie

### S1 — Picker testabile

- [x] Select record campagna con `data-testid` dedicato.

### S2 — E2E binding

- [x] Flusso end-to-end save → selectOption by option `value` → enqueue → assert flash destinatari.

---

## Log routine

| Data       | Azione |
|------------|--------|
| 2026-04-15 | Picker `data-testid` + e2e binding record; doc; `npm run ci` |
| 2026-04-15 | Puntatore a sprint `v2-next-10` (UX form enqueue + validazione server) |

