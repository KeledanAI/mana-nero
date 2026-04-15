# Sprint `v2-next-10` — comms: form enqueue senza `required` con record selezionato

**Riferimenti:** [backlog-crm-v2.md](./backlog-crm-v2.md); sprint precedente [sprint-v2-next-9.md](./sprint-v2-next-9.md); **successivo:** [sprint-v2-next-11.md](./sprint-v2-next-11.md).

**Obiettivo dello sprint (incremento misurabile):** quando lo staff sceglie un **record** `comms_campaigns` nel picker, slug e oggetto email arrivano già dal DB: i campi manuali «ID campagna» e «Oggetto email» non devono essere obbligatori in HTML5. **Rimuovere `required`** da quei due input; **validare in server action** `runNewsletterCampaignEnqueue` (slug normalizzato + oggetto obbligatori solo senza record). Aggiornare copy in pagina e **e2e** `v2-next-9` (submit senza compilare i campi manuali). **Senza** nuove migrazioni SQL.

**Definition of Done:**

- [x] [`app/admin/actions.ts`](../app/admin/actions.ts) — `normalizeCampaignId` + redirect espliciti `campaign_id_invalid`, `subject_required`, `campaign_slug_invalid_in_record`.
- [x] [`app/admin/comms/page.tsx`](../app/admin/comms/page.tsx) — niente `required` su slug/oggetto; nota UX sotto il blocco campagna segmentata.
- [x] [`e2e/admin-staff-routes.spec.ts`](../e2e/admin-staff-routes.spec.ts) — test binding record senza fill manuali.
- [x] `npm run ci` verde; doc sprint + backlog + README + ROADMAP.

---

## Storie

### S1 — Validazione server

- [x] Normalizzazione slug e controlli prima di `enqueueStaffSegmentCampaign`.

### S2 — UX + e2e

- [x] Input manuali opzionali con record; e2e allineato.

---

## Log routine

| Data       | Azione |
|------------|--------|
| 2026-04-15 | `required` rimosso + validazione action + e2e; doc; `npm run ci` |
| 2026-04-15 | Puntatore a sprint `v2-next-11` (messaggi errore comms leggibili) |

