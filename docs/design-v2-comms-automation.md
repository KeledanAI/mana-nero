# Design: V2 comunicazioni automatizzate (`v2-comms-automation`)

Riferimenti: [PRD.md](../PRD.md) §4.3, [ROADMAP.md](../ROADMAP.md) criteri §254–258, outbox esistente in [`supabase/migrations/20260404170000_gamestore_v1.sql`](../supabase/migrations/20260404170000_gamestore_v1.sql).

## 1. Obiettivo

Reminder evento, messaggi segmentati e flussi waitlist **senza** bypass dell’outbox: tutto passa da `communication_outbox` con `idempotency_key` stabile, processato dal worker [`lib/comms/process-outbox.ts`](../lib/comms/process-outbox.ts).

## 2. Vincoli (ROADMAP)

| Vincolo | Implicazione |
|---------|----------------|
| Nessun duplicato | `ON CONFLICT (idempotency_key) DO NOTHING` / upsert come [`lib/comms/enqueue.ts`](../lib/comms/enqueue.ts) |
| Worker / cron | Stesso pattern Bearer di [`app/api/cron/outbox/route.ts`](../app/api/cron/outbox/route.ts); job dedicati per enqueue-only |
| Staff non bypassa outbox | UI admin solo **enqueue** o **trigger scan** che inserisce righe outbox, niente `sendEmail` diretto dal browser |
| Metriche minime | Query su `communication_outbox` per `sent` / `failed` per `kind` (in `payload`) |

## 3. Modello messaggi (payload `kind`)

Estensioni additive al JSON (non regole business in jsonb critico oltre a `kind`, `event_id`, `user_id`):

| kind | Quando | idempotency_key (pattern) |
|------|--------|----------------------------|
| `event_reminder_24h` | ~24h prima di `events.starts_at` | `event_reminder_24h:{event_id}:{user_id}` |
| (futuro) `event_reminder_7d` | 7 giorni prima | `event_reminder_7d:{event_id}:{user_id}` |
| `campaign_segment` | Campagna staff (`/admin/comms`: newsletter opt-in, marketing consent, **registration_waitlisted**) | `campaign:{segment}:{campaign_id}:{user_id}` |
| `product_stock_staff_summary` | Digest opzionale per staff dopo cron stock (env `PRODUCT_STOCK_STAFF_SUMMARY_EMAIL`) | `product_stock_staff_summary:YYYY-MM-DDTHH` (ora UTC) |
| (futuro) `waitlist_digest` | Digest posizione waitlist | `waitlist_digest:{registration_id}:{period}` |

## 4. Flusso reminder 24h

```mermaid
sequenceDiagram
  participant Cron as CronVercel
  participant API as GET_api_cron_event_reminders
  participant Lib as enqueueEventReminder24hScan
  participant OB as communication_outbox
  participant W as processOutboxBatch

  Cron->>API: Bearer secret
  API->>Lib: scan events in window
  Lib->>OB: upsert email rows idempotent
  Note over W: Worker outbox separato o stesso cron
  W->>OB: claim pending
  W->>OB: sent or failed
```

- **Finestra temporale:** eventi `published` con `starts_at` tra `now + 22h` e `now + 30h` (tollera cron ogni 6h; idempotenza evita doppi invii).
- **Destinatari:** iscrizioni con `status` in (`confirmed`, `waitlisted`, `pending_payment`).
- **Canale:** `email`; `scheduled_at = now()` (invio al prossimo passaggio worker).

## 5. UI staff minima

- Pagina [`/admin/comms`](../app/admin/comms/page.tsx): descrizione flusso + pulsante “Esegui scan reminder ora” (server action staff); metriche outbox per `kind` × `status`; form **campagna segmentata** (segmenti newsletter / marketing / waitlisted); registro `comms_campaigns` + link **storico outbox** per slug (`?campaign_slug=`).

## 6. Testing

- Unit: logica di calcolo finestra / chiavi (mock client).
- Integrazione: dopo `supabase db reset` locale, evento + iscrizione + scan + `processOutboxBatch` (opzionale script).

## 7. Incrementi futuri

- Reminder 7d / multi-fuso orario per `starts_at`.
- Metadati campagna avanzati su `comms_campaigns` (stato, owner staff, versioning) oltre lo CRUD attuale.
- Vista SQL `v_outbox_stats_by_kind` per metriche se serve oltre l’RPC `outbox_email_stats_for_staff`.
- Regole waitlist/promozione oltre gli enqueue già presenti su `event_registration_action` / outbox booking.

## 8. Implementato in repo (primo slice e successive)

- [`lib/comms/event-reminders.ts`](../lib/comms/event-reminders.ts) — scan finestra 22h–30h, enqueue `event_reminder_24h`.
- [`app/api/cron/event-reminders/route.ts`](../app/api/cron/event-reminders/route.ts) — GET con Bearer come outbox.
- [`lib/comms/process-outbox.ts`](../lib/comms/process-outbox.ts) — template `event_reminder_24h`, `campaign_segment`, digest stock staff opzionale; **skip** con errore `OUTBOX_SKIP:*` e stato `cancelled` se consenso revocato prima dell’invio.
- [`app/admin/comms/page.tsx`](../app/admin/comms/page.tsx) — scan reminder manuale, form campagna segmentata, record `comms_campaigns`, storico per `?campaign_slug=` (tipo/oggetto/dettaglio tramite [`lib/gamestore/crm-timeline.ts`](../lib/gamestore/crm-timeline.ts)); tabella metriche con **etichette italiane** sui `kind`.
- [`lib/comms/campaign-segment-enqueue.ts`](../lib/comms/campaign-segment-enqueue.ts) — enqueue `campaign_segment` per `newsletter_opt_in`, `marketing_consent`, **`registration_waitlisted`**; chiave `campaign:{segment}:{campaign_id}:{user_id}`.
- RPC revoca outbox pending su consensi ([`20260421103000_outbox_cancelled_marketing_revoke.sql`](../supabase/migrations/20260421103000_outbox_cancelled_marketing_revoke.sql), [`20260422130000_q2_crm_comms_outbox_consolidated.sql`](../supabase/migrations/20260422130000_q2_crm_comms_outbox_consolidated.sql)) invocate da [`app/admin/actions.ts`](../app/admin/actions.ts) (revoche dedicate + aggiornamento profilo).
- [`vercel.json`](../vercel.json) — cron ogni 6 ore su `event-reminders`.
