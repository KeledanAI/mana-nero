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

## Fase 3 — Analytics

- Viste materializzate o RPC aggregate: iscrizioni per evento/stato, conversione waitlist, performance campagne (`sent`/`failed` per campagna).
- Dashboard `/admin/analytics` (o sezione in `/admin`) con grafici essenziali e intervalli data.
- Allineamento privacy: nessun dato non necessario in chart pubblici.

## Fase 4 — Integrazioni

- Export verso strumenti esterni (CSV/JSON schedulato) oppure webhook controllati.
- Estensioni campagne: tabella `comms_campaigns`, storico invii per campagna, revoca consensi propagata agli enqueue.

## Criteri di chiusura epic (bozza)

- Staff compie i compiti CRM quotidiani senza SQL manuale.
- Metriche campagne e prenotazioni verificabili in UI con stesso dato dell’outbox.
- Revisione sicurezza e checklist deploy aggiornata.
