# Sprint `v2-next-2` — estensioni backlog (post `v2-next-1`)

**Riferimenti:** [ROADMAP.md](../ROADMAP.md) §271–277, [backlog-crm-v2.md](./backlog-crm-v2.md) §52–58; sprint precedente [sprint-v2-next.md](./sprint-v2-next.md).

**Obiettivo dello sprint (incremento misurabile):** estendere **comms** con reminder **~7 giorni** prima dell’evento (stesso pattern outbox del 24h, chiavi idempotency distinte) e **qualità** con **e2e staff** su mutazione CRM (salvataggio scheda profilo), senza nuove migrazioni SQL né violare RLS / RPC booking unica.

**Definition of Done (condivisa):**

- [x] Migrazioni: nessuna nuova richiesta per questo slice; su ambienti esistenti resta `supabase db push` solo se arretrati rispetto al repo.
- [x] `npm run ci` verde; test unitari su finestre reminder e timeline `kind` aggiornati.
- [x] Staff: e2e opzionale con `E2E_STAFF_STORAGE_STATE` — percorso salvataggio profilo CRM (`data-testid` stabili).
- [x] Nessun secret o PII in commit; RLS invariata (`has_role`).

---

## Storie

### S1 — Reminder evento 7 giorni (Comms)

- [x] `event_reminder_7d` in outbox: finestra `eventReminder7dWindowIso`, `enqueueEventReminder7dScan`, `enqueueEventReminderScansCombined` usata da [`GET /api/cron/event-reminders`](../app/api/cron/event-reminders/route.ts) e da [`runEventReminderScan`](../app/admin/actions.ts).
- [x] Dispatch email in [`lib/comms/process-outbox.ts`](../lib/comms/process-outbox.ts); etichetta timeline in [`lib/gamestore/crm-timeline.ts`](../lib/gamestore/crm-timeline.ts); UI copy in [`/admin/comms`](../app/admin/comms/page.tsx); design [design-v2-comms-automation.md](./design-v2-comms-automation.md).

### S2 — E2E mutazione CRM (Qualità)

- [x] [`e2e/admin-staff-routes.spec.ts`](../e2e/admin-staff-routes.spec.ts): da elenco CRM aprire prima «Scheda completa», impostare **Fase lead**, inviare **Salva profilo**, attendere messaggio di successo.
- [x] [`app/admin/crm/[profileId]/page.tsx`](../app/admin/crm/%5BprofileId%5D/page.tsx): `data-testid` su form e campo lead; messaggio umano per `success=profile_updated`.

---

## Fuori scope

- Catalogo V3, inventario reale, split `event_registrations`.

---

## Log routine

| Data       | Azione |
|------------|--------|
| 2026-04-15 | Slice S1–S2: reminder `event_reminder_7d`, cron/combined scan, process-outbox + timeline; e2e staff salvataggio lead CRM; `npm run ci` verde |
