# Epic: CRM avanzato e analytics (PRD §4.2 / §4.5)

Riferimenti: [PRD.md](../PRD.md), [ROADMAP.md](../ROADMAP.md) backlog V2. Questo documento spezza il lavoro in fasi tracciabili prima dell’implementazione.

## Obiettivo prodotto

- **§4.2 CRM:** vista unificata cliente (profilo, iscrizioni eventi, richieste prodotto, consensi, note staff), segmentazione operativa, export controllati.
- **§4.5 Analytics:** funnel prenotazioni, campagne outbox, stock alert; dashboard leggibile per staff (non solo query SQL).

## Fase 0 — Fondamenta (completato in V1/V2-lite)

- Note staff per profilo, elenco profili, pagine eventi e richieste prodotto.
- Outbox con metriche per `kind` / `status` in `/admin/comms`.

## Fase 1 — Modello dati e permessi

- Definire entità “contatto” vs riuso `profiles` + tabelle esistenti (`event_registrations`, `product_reservation_requests`, `admin_notes`).
- Policy RLS e ruoli: chi vede export CSV completi, log di accesso sensibili.
- Convenzioni idempotency e audit per azioni staff irreversibili.

**Implementato (primo slice in repo):** tabella `public.staff_crm_audit_log` (actor, `action_type`, `entity_type`, `entity_id`, `payload` jsonb) con RLS: select per staff, insert solo se `actor_id = auth.uid()` e ruolo staff; migrazione [`supabase/migrations/20260418140000_crm_audit_qr_window_comms_campaigns.sql`](../supabase/migrations/20260418140000_crm_audit_qr_window_comms_campaigns.sql). La UI può registrare eventi (es. rotazione token QR check-in) via insert autenticato. Stub `public.comms_campaigns` (slug, segmento, titolo) con RLS staff per iterazioni enqueue legate a record campagna.

## Fase 2 — CRM UI

- Scheda cliente unica: timeline (iscrizioni, email outbox rilevanti, richieste, note).
- Filtri e ricerca (email, nome, telefono se aggiunto in schema).
- Azioni sicure: tag, stato lead (se introdotto), collegamento a campagne future `comms_campaigns`.

**Primo slice in repo:** nella [scheda CRM profilo](../app/admin/crm/%5BprofileId%5D/page.tsx) (`app/admin/crm/[profileId]/page.tsx`) la sezione **Timeline (Fase 2)** unifica in ordine cronologico note staff, iscrizioni evento, richieste prodotto, righe outbox email con `payload.user_id` = profilo, e righe `staff_crm_audit_log` con `entity_id` = profilo o iscrizioni del cliente (lettura via [`lib/gamestore/data.ts`](../lib/gamestore/data.ts)). Titoli e dettagli leggibili (tipo messaggio, oggetto campagna, errori/skip, audit in italiano) tramite [`lib/gamestore/crm-timeline.ts`](../lib/gamestore/crm-timeline.ts). In [`/admin/crm`](../app/admin/crm/page.tsx): **ricerca** (GET `?q=`, min. 2 caratteri su email/nome/**telefono**) e **filtri** (ruolo, newsletter, marketing); link **Esporta CSV** → [`GET /admin/crm/profiles.csv`](../app/admin/crm/profiles.csv/route.ts) (tutti i profili visibili allo staff). Scritture audit da [`lib/gamestore/crm-audit.ts`](../lib/gamestore/crm-audit.ts) su nota, scheda cliente (incl. revoche outbox su consensi), richiesta prodotto, campagne, check-in manuale, revoche newsletter/marketing dedicate.

## Fase 3 — Analytics

- Viste materializzate o RPC aggregate: iscrizioni per evento/stato, conversione waitlist, performance campagne (`sent`/`failed` per campagna).
- Dashboard `/admin/analytics` (o sezione in `/admin`) con grafici essenziali e intervalli data.
- Allineamento privacy: nessun dato non necessario in chart pubblici.

**Primo slice in repo:** pagina staff [`app/admin/analytics/page.tsx`](../app/admin/analytics/page.tsx) con conteggi ad alta livello (eventi per stato, registrazioni, outbox `pending`, richieste prodotto / `awaiting_stock`). RPC [`analytics_staff_summary`](../supabase/migrations/20260419120000_analytics_staff_summary_for_staff.sql) con `p_since` e link intervallo (7/30/90 giorni o tutto); breakdown iscrizioni per stato con barre proporzionali; RPC `analytics_outbox_campaign_segment_stats` e **`analytics_outbox_campaign_segment_stats_by_slug`** ([`20260421120000_analytics_campaign_outbox_by_slug.sql`](../supabase/migrations/20260421120000_analytics_campaign_outbox_by_slug.sql)); `analytics_waitlist_registration_summary`. Per intervalli a giorni fissi: blocco **confronto con la finestra precedente** (iscrizioni totali/confermate e richieste prodotto) con query per intervallo in [`lib/gamestore/data.ts`](../lib/gamestore/data.ts). Fallback legacy in UI se le RPC non sono ancora applicate.

## Fase 4 — Integrazioni

- Export verso strumenti esterni (CSV on-demand o schedulato) o webhook controllati.
- **In repo:** export CSV elenco profili staff [`GET /admin/crm/profiles.csv`](../app/admin/crm/profiles.csv/route.ts). Campagne: tabella `comms_campaigns`; enqueue da [`/admin/comms`](../app/admin/comms/page.tsx) con record opzionale e **storico outbox** per slug (`?campaign_slug=`) con colonne tipo/oggetto/dettaglio. Revoche newsletter/marketing da CRM + RPC annullamento righe `pending` e worker con `OUTBOX_SKIP:*` ([`lib/comms/process-outbox.ts`](../lib/comms/process-outbox.ts)).

## Sprint dedicato (tracciamento)

- Chiuso: **[docs/sprint-v2-next.md](./sprint-v2-next.md)** (`v2-next-1`, S1–S7).
- Chiuso: **[docs/sprint-v2-next-2.md](./sprint-v2-next-2.md)** (`v2-next-2`, reminder 7g + e2e CRM).
- Chiuso: **[docs/sprint-v2-next-3.md](./sprint-v2-next-3.md)** (`v2-next-3`, CI staging + e2e comms scan).
- Chiuso: **[docs/sprint-v2-next-4.md](./sprint-v2-next-4.md)** (`v2-next-4`, e2e record `comms_campaigns`).
- Chiuso: **[docs/sprint-v2-next-5.md](./sprint-v2-next-5.md)** (`v2-next-5`, grafico analytics slug campagne).
- Chiuso: **[docs/sprint-v2-next-6.md](./sprint-v2-next-6.md)** (`v2-next-6`, segmento comms `registration_confirmed`).
- Chiuso: **[docs/sprint-v2-next-7.md](./sprint-v2-next-7.md)** (`v2-next-7`, e2e + `data-testid` comms per `registration_confirmed`).
- Chiuso: **[docs/sprint-v2-next-8.md](./sprint-v2-next-8.md)** (`v2-next-8`, e2e enqueue campagna segmentata).
- Chiuso: **[docs/sprint-v2-next-9.md](./sprint-v2-next-9.md)** (`v2-next-9`, e2e enqueue da record `comms_campaigns`).
- Chiuso: **[docs/sprint-v2-next-10.md](./sprint-v2-next-10.md)** (`v2-next-10`, UX form enqueue + validazione server).
- Chiuso: **[docs/sprint-v2-next-11.md](./sprint-v2-next-11.md)** (`v2-next-11`, messaggi errore comms leggibili).
- Chiuso: **[docs/sprint-v2-next-12.md](./sprint-v2-next-12.md)** (`v2-next-12`, euristiche messaggi Postgres su comms).
- Attivo / ultimo incremento documentato: **[docs/sprint-v2-next-13.md](./sprint-v2-next-13.md)** (`v2-next-13`, e2e slug duplicato comms + messaggio leggibile).

## Priorità successive (prodotto)

Ordine Q2 in [ROADMAP.md](../ROADMAP.md) (**Backlog prioritizzato Q2**). **Stato (chiusura sprint `v2-next-1`, 2026-04-22):** i primi slice per waitlist strutturata (`event_registrations` + outbox), revoche consensi (RPC + worker + audit su scheda CRM), segmento `registration_waitlisted`, telefono/tag/lead su `profiles`, metriche campagna per slug in `/admin/analytics`, policy QR per evento (`check_in_*`), e2e staff (`e2e/admin-staff-routes.spec.ts`) e workflow on-demand sono **in repo** — dettaglio in [docs/sprint-v2-next.md](./sprint-v2-next.md). Estensioni `v2-next-2` … `v2-next-13`: [sprint-v2-next-2.md](./sprint-v2-next-2.md), [sprint-v2-next-3.md](./sprint-v2-next-3.md), [sprint-v2-next-4.md](./sprint-v2-next-4.md), [sprint-v2-next-5.md](./sprint-v2-next-5.md), [sprint-v2-next-6.md](./sprint-v2-next-6.md), [sprint-v2-next-7.md](./sprint-v2-next-7.md), [sprint-v2-next-8.md](./sprint-v2-next-8.md), [sprint-v2-next-9.md](./sprint-v2-next-9.md), [sprint-v2-next-10.md](./sprint-v2-next-10.md), [sprint-v2-next-11.md](./sprint-v2-next-11.md), [sprint-v2-next-12.md](./sprint-v2-next-12.md), [sprint-v2-next-13.md](./sprint-v2-next-13.md).

**Estensioni da pianificare (non bloccanti):**

- **Comms:** reminder **~7 giorni** (`event_reminder_7d`) — **in repo** con cron/scan esistenti ([sprint-v2-next-2.md](./sprint-v2-next-2.md)); altri segmenti, regole waitlist/promozione più fini, vista SQL metriche se serve.
- **CRM:** altre fonti in timeline, export schedulati o filtrati come da policy, campi aggiuntivi dopo feedback staff.
- **Analytics:** **primo grafico in repo:** barre impilate slug × stato outbox in [`/admin/analytics`](../app/admin/analytics/page.tsx) ([sprint-v2-next-5.md](./sprint-v2-next-5.md)); restano viste materializzate, altre metriche e confronti più ricchi.
- **QR:** policy ancora più granulari se il dominio lo richiede oltre `events.check_in_*`.
- **Qualità:** e2e su mutazioni staff (form CRM/comms) — slice: lead CRM ([sprint-v2-next-2.md](./sprint-v2-next-2.md)), scan reminder + **record campagna** ([sprint-v2-next-3.md](./sprint-v2-next-3.md), [sprint-v2-next-4.md](./sprint-v2-next-4.md)), **record campagna `registration_confirmed`** ([sprint-v2-next-7.md](./sprint-v2-next-7.md)), **enqueue campagna segmentata** ([sprint-v2-next-8.md](./sprint-v2-next-8.md)), **enqueue da record DB** ([sprint-v2-next-9.md](./sprint-v2-next-9.md), UX validazione [sprint-v2-next-10.md](./sprint-v2-next-10.md)), **messaggi errore comms** ([sprint-v2-next-11.md](./sprint-v2-next-11.md), euristiche DB [sprint-v2-next-12.md](./sprint-v2-next-12.md), e2e duplicato [sprint-v2-next-13.md](./sprint-v2-next-13.md)), [`e2e/admin-staff-routes.spec.ts`](../e2e/admin-staff-routes.spec.ts); workflow [`.github/workflows/e2e-on-demand.yml`](../.github/workflows/e2e-on-demand.yml) e [`.github/workflows/staging-db-verify.yml`](../.github/workflows/staging-db-verify.yml) (smoke staging — [deploy-operator-checklist.md](./deploy-operator-checklist.md)).

## Criteri di chiusura epic (bozza)

- Staff compie i compiti CRM quotidiani senza SQL manuale.
- Metriche campagne e prenotazioni verificabili in UI con stesso dato dell’outbox.
- Revisione sicurezza e checklist deploy aggiornata.
