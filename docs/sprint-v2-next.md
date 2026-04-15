# Sprint dedicato — backlog V2 (post–routine deploy)

**Riferimenti:** [ROADMAP.md](../ROADMAP.md) §251–261, §278–281; epic [backlog-crm-v2.md](./backlog-crm-v2.md); checklist [deploy-operator-checklist.md](./deploy-operator-checklist.md).

**Obiettivo dello sprint:** chiudere almeno **un** incremento misurabile tra comms, CRM dati, analytics o qualità, senza rompere RLS né l’outbox idempotente; ogni story include migrazione additiva solo se necessaria e `npm run verify:after-migrations` dopo il push DB.

**Definition of Done (condivisa):**

- [x] Migrazioni applicate su Supabase remoto usato dallo sprint (`supabase db push` o equivalente). *(Verifica routine 2026-04-14: remoto allineato al repo.)*
- [x] `npm run ci` verde; smoke rilevante (`npm run smoke:test` o e2e mirato) se il flusso tocca RPC/auth pubblica. *(2026-04-14: `verify:after-migrations`, smoke con `SMOKE_TEST_EVENT_PAYMENTS=1`, `npm run ci`; anche `npm run test:e2e` — 13 passed, 2 skipped su `auth-events`.)*
- [x] Staff-only: verifica minima su `/admin/crm`, `/admin/comms`, `/admin/analytics` — accettazione automatizzata con `npx playwright test e2e/admin-staff-routes.spec.ts` (4 test con storage staff: elenco CRM, analytics, comms, **GET CSV profili**; 2026-04-22) e `E2E_STAFF_STORAGE_STATE` / `e2e/auth-staff.json` come in [.env.example](../.env.example).
- [x] Nessun secret o PII in commit; RLS invariata nella semantica (`has_role`). *(Processo: non inserire segreti in doc/commit.)*

---

## Backlog ordinato (storie)

Spunta le righe quando la story è **merged** e verificata in ambiente di riferimento dello sprint.

**Nota (2026-04-22):** completati slice **S2** (newsletter + skip worker + coerenza audit), **S3** (segmento `registration_waitlisted`), **S4** (telefono / tag / lead su `profiles`), **S6** (`data-testid` check-in), **S7** (e2e staff + workflow on-demand). Successivamente in repo: arricchimento UI comms/analytics/CRM (timeline e storico slug, confronto periodi analytics, export CSV profili, workflow **Staging DB verify**). Per DB multi-ambiente resta `supabase link` per ref + comandi del log.

### S1 — Waitlist strutturata (Comms / dominio)

- [x] Modello allineato al ROADMAP: **nessuna** tabella waitlist separata; `event_registrations` con `status = waitlisted`, `waitlist_position`, outbox `booking_waitlist` / `waitlist_promoted` ([`20260414120000_event_registration_payment_flow.sql`](../supabase/migrations/20260414120000_event_registration_payment_flow.sql)); vedi [design-v2-comms-automation.md](./design-v2-comms-automation.md).
- [x] UI staff: export CSV con `waitlist_position`, scheda evento iscritti, funnel [`/admin/analytics`](../app/admin/analytics/page.tsx) (`analytics_waitlist_registration_summary`).
- [x] Idempotency outbox documentata/implementata ([`lib/comms/enqueue.ts`](../lib/comms/enqueue.ts), chiavi deterministiche nei branch RPC booking).

**File probabili:** `supabase/migrations/`, [`app/admin/comms/page.tsx`](../app/admin/comms/page.tsx), [`lib/comms/process-outbox.ts`](../lib/comms/process-outbox.ts).

### S2 — Propagazione revoche consensi sugli enqueue (Comms)

- [x] Revoca **marketing** da CRM: outbox `campaign_segment` / `marketing_consent` in `pending` → `cancelled` (RPC `staff_cancel_pending_marketing_campaign_outbox`, delega a funzione interna in [`20260422130000_q2_crm_comms_outbox_consolidated.sql`](../supabase/migrations/20260422130000_q2_crm_comms_outbox_consolidated.sql)); audit in [`app/admin/actions.ts`](../app/admin/actions.ts).
- [x] Revoca **newsletter**: RPC `staff_cancel_pending_newsletter_campaign_outbox` + azione dedicata e annullamento best-effort al salvataggio profilo se opt-in disattivato; worker [`lib/comms/process-outbox.ts`](../lib/comms/process-outbox.ts) verifica consensi prima dell’invio e marca `cancelled` su skip (`OUTBOX_SKIP:*`).
- [x] Coerenza audit / messaggi: convenzione `action_type` documentata in [`lib/gamestore/crm-audit.ts`](../lib/gamestore/crm-audit.ts); salvataggio scheda CRM (`updateCustomerProfile`) annulla outbox campagna in sospeso quando i consensi sono disattivati e registra conteggi nel payload audit (allineato alle RPC dedicate di revoca).

**File probabili:** [`lib/comms/campaign-segment-enqueue.ts`](../lib/comms/campaign-segment-enqueue.ts), worker/cron outbox, eventuali RPC di supporto.

### S3 — Segmenti campagna aggiuntivi (Comms)

- [x] Segmento **`registration_waitlisted`**: destinatari = profili con almeno un’iscrizione `event_registrations.status = waitlisted` ([`lib/comms/campaign-segment-enqueue.ts`](../lib/comms/campaign-segment-enqueue.ts)); CHECK su [`comms_campaigns`](../supabase/migrations/20260422130000_q2_crm_comms_outbox_consolidated.sql); RLS invariata.
- [x] Segmento **`registration_confirmed`**: destinatari = profili con almeno un’iscrizione `event_registrations.status = confirmed`; CHECK esteso in [`20260423103000_comms_campaign_segment_registration_confirmed.sql`](../supabase/migrations/20260423103000_comms_campaign_segment_registration_confirmed.sql); worker con skip `OUTBOX_SKIP:not_confirmed_registration` se l’iscrizione non è più confermata al dispatch ([`lib/comms/process-outbox.ts`](../lib/comms/process-outbox.ts)); dettaglio sprint [sprint-v2-next-6.md](./sprint-v2-next-6.md).
- [x] UI [`/admin/comms`](../app/admin/comms/page.tsx) + test [`lib/comms/campaign-segment-enqueue.test.ts`](../lib/comms/campaign-segment-enqueue.test.ts).

### S4 — CRM: telefono + / o tag e lead (schema + UI)

- [x] Colonne `profiles.phone`, `profiles.crm_tags` (`text[]`), `profiles.lead_stage` ([`20260422130000_q2_crm_comms_outbox_consolidated.sql`](../supabase/migrations/20260422130000_q2_crm_comms_outbox_consolidated.sql)); policy staff esistenti su `profiles`.
- [x] Form scheda CRM + ricerca per telefono in [`getProfilesForStaffSearch`](../lib/gamestore/data.ts); riepilogo in elenco [`/admin/crm`](../app/admin/crm/page.tsx).

**File probabili:** [`lib/gamestore/data.ts`](../lib/gamestore/data.ts), [`app/admin/crm/`](../app/admin/crm/), migrazioni.

### S5 — Analytics: sent / failed per campagna (slug)

- [x] RPC `analytics_outbox_campaign_segment_stats_by_slug(p_since)` — migrazione [`20260421120000_analytics_campaign_outbox_by_slug.sql`](../supabase/migrations/20260421120000_analytics_campaign_outbox_by_slug.sql); aggrega `payload.campaign_id` × stato outbox nel periodo (o tutto lo storico se `p_since` null).
- [x] Tabella in [`app/admin/analytics/page.tsx`](../app/admin/analytics/page.tsx) (stesso intervallo giorni della pagina).

### S6 — QR: policy per evento ancora più granulari

- [x] Primo slice: colonne `events.check_in_early_days` / `check_in_late_hours` + enforcement in `event_check_in_by_token` ([`20260420140000_checkin_policy_analytics_campaign_waitlist_profile_stock.sql`](../supabase/migrations/20260420140000_checkin_policy_analytics_campaign_waitlist_profile_stock.sql)); form staff su eventi.
- [x] Ancoraggio e2e: `data-testid` su stati pagina check-in ([`app/events/check-in/[token]/page.tsx`](../app/events/check-in/[token]/page.tsx)) + assert in [`e2e/event-check-in-public.spec.ts`](../e2e/event-check-in-public.spec.ts).

### S7 — Qualità: e2e aggiuntivi

- [x] e2e pubblici pagina check-in token (formato non valido / UUID sconosciuto): [`e2e/event-check-in-public.spec.ts`](../e2e/event-check-in-public.spec.ts) — eseguire con `npm run test:e2e`.
- [x] e2e staff opzionale: [`e2e/admin-staff-routes.spec.ts`](../e2e/admin-staff-routes.spec.ts) con `E2E_STAFF_STORAGE_STATE` (vedi [.env.example](../.env.example)) — smoke route admin + **GET `/admin/crm/profiles.csv`** (CSV profili).
- [x] Workflow on-demand: [`.github/workflows/e2e-on-demand.yml`](../.github/workflows/e2e-on-demand.yml) esegue check-in pubblico e spec staff (skipped senza storage).
- [x] Workflow opzionale verifica staging: [`.github/workflows/staging-db-verify.yml`](../.github/workflows/staging-db-verify.yml) (`verify:migrations` + smoke se secret `STAGING_NEXT_PUBLIC_SUPABASE_*` — [deploy-operator-checklist.md](./deploy-operator-checklist.md)).

---

## Fuori scope (per questo sprint documentato)

- Catalogo commerce V3, inventario “vero”.
- Riscrittura auth/booking o split tabella `event_registrations` (failure condition ROADMAP).

---

## Stato sprint (manuale)

| Campo        | Valore |
|-------------|--------|
| Sprint ID   | `v2-next-1` |
| Data inizio | 2026-04-14 |
| Data fine   | 2026-04-22 (chiusura documentale `v2-next-1`) |
| Ambiente DB | Progetto Supabase collegato in locale (`supabase link`); routine deploy verificata al 2026-04-14 (vedi log) |

Il backlog epic è aggiornato in [backlog-crm-v2.md](./backlog-crm-v2.md) («Priorità successive»). Sprint successivi: **[sprint-v2-next-2.md](./sprint-v2-next-2.md)** (`v2-next-2`), **[sprint-v2-next-3.md](./sprint-v2-next-3.md)** (`v2-next-3`), **[sprint-v2-next-4.md](./sprint-v2-next-4.md)** (`v2-next-4`), **[sprint-v2-next-5.md](./sprint-v2-next-5.md)** (`v2-next-5`).

## Log routine (automazione / verifica)

| Data       | Azione |
|------------|--------|
| 2026-04-14 | `supabase db push` (up to date), `verify:after-migrations`, `SMOKE_TEST_EVENT_PAYMENTS=1` + `smoke:test`, `verify:predeploy` (incl. `verify:deploy` locale atteso fallito), `verify:cron-hints`, `verify:migrations`, `npm run ci` |
| 2026-04-14 | Stessa routine ripetuta (piano roadmap passi operativi): comandi sopra + `npm run test:e2e` (13 passed, 2 skipped) |
| 2026-04-14 | `supabase db push` (`20260421103000_outbox_cancelled_marketing_revoke`, `20260421120000_analytics_campaign_outbox_by_slug`), `verify:after-migrations`, `verify:predeploy`, `verify:deploy` (fallimento atteso in locale), `verify:cron-hints`, `npm run ci` |
| 2026-04-22 | `supabase db push` (`20260422130000_q2_crm_comms_outbox_consolidated`), `verify:after-migrations`, `npm run ci` |
| 2026-04-22 | DoD staff: `npx playwright test e2e/admin-staff-routes.spec.ts` (3 passed); allineamento narrativo ROADMAP §266–274 + `docs/backlog-crm-v2.md` |
| 2026-04-22 | Incrementi trasversali: `lib/gamestore/crm-timeline.ts` (timeline CRM + comms), confronto periodi `/admin/analytics`, export `profiles.csv`, e2e CSV, `staging-db-verify.yml` + checklist/.env.example |
