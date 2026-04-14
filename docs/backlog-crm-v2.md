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

**Primo slice in repo:** nella [scheda CRM profilo](../app/admin/crm/%5BprofileId%5D/page.tsx) (`app/admin/crm/[profileId]/page.tsx`) la sezione **Timeline (Fase 2)** unifica in ordine cronologico note staff, iscrizioni evento, richieste prodotto, righe outbox email con `payload.user_id` = profilo, e righe `staff_crm_audit_log` con `entity_id` = profilo o iscrizioni del cliente (lettura via [`lib/gamestore/data.ts`](../lib/gamestore/data.ts)). In [`/admin/crm`](../app/admin/crm/page.tsx) sono disponibili **ricerca** (GET `?q=`, min. 2 caratteri su email/nome) e **filtri** (ruolo, newsletter opt-in, marketing consent). Scritture audit best-effort da [`lib/gamestore/crm-audit.ts`](../lib/gamestore/crm-audit.ts) su nota profilo, aggiornamento scheda cliente, aggiornamento richiesta prodotto, salvataggio/enqueue campagne, **check-in manuale iscrizione** e **revoca marketing** (azione dedicata in scheda profilo).

## Fase 3 — Analytics

- Viste materializzate o RPC aggregate: iscrizioni per evento/stato, conversione waitlist, performance campagne (`sent`/`failed` per campagna).
- Dashboard `/admin/analytics` (o sezione in `/admin`) con grafici essenziali e intervalli data.
- Allineamento privacy: nessun dato non necessario in chart pubblici.

**Primo slice in repo:** pagina staff [`app/admin/analytics/page.tsx`](../app/admin/analytics/page.tsx) con conteggi ad alta livello (eventi per stato, registrazioni, outbox email in `pending`, richieste prodotto / `awaiting_stock`) — base per RPC e grafici successivi. RPC aggregata [`analytics_staff_summary`](../supabase/migrations/20260419120000_analytics_staff_summary_for_staff.sql) con filtro `p_since` e link intervallo (7/30/90 giorni o tutto); breakdown iscrizioni per stato con barre proporzionali; fallback legacy se la migrazione non è ancora applicata. Migrazione [`20260420140000_checkin_policy_analytics_campaign_waitlist_profile_stock.sql`](../supabase/migrations/20260420140000_checkin_policy_analytics_campaign_waitlist_profile_stock.sql): RPC `analytics_outbox_campaign_segment_stats` (conteggi outbox `campaign_segment` per `status`) e `analytics_waitlist_registration_summary` (funnel iscrizioni nel periodo); messaggio in UI se non ancora applicate.

## Fase 4 — Integrazioni

- Export verso strumenti esterni (CSV/JSON schedulato) oppure webhook controllati.
- Estensioni campagne: tabella `comms_campaigns` è già presente come stub (Fase 1); **primo binding:** enqueue da [`/admin/comms`](../app/admin/comms/page.tsx) con select opzionale record DB (slug/segmento/copy) e **storico outbox** per slug (`?campaign_slug=`). La **revoca marketing** da CRM annulla consenso sul profilo e registra audit; restano propagazione più ampia agli enqueue e metriche avanzate oltre le RPC analytics di segmento.

## Sprint dedicato (tracciamento)

Backlog V2 prossimo lavoro operativo: **[docs/sprint-v2-next.md](./sprint-v2-next.md)** (storie S1–S7, DoD, fuori scope).

## Priorità successive (prodotto)

Punti coerenti con [ROADMAP.md](../ROADMAP.md) §251–261 e §278–281, da pianificare dopo la routine deploy:

- **Comms:** waitlist strutturata oltre i conteggi RPC/UI attuali; propagazione più ampia delle revoche consensi sugli enqueue; altri segmenti campagna; audit invii più ricco.
- **CRM:** telefono in schema se serve; tag/lead se introdotti in modello dati.
- **Analytics:** metriche campagna (es. sent/failed per campagna), eventuali viste/materializzate, grafici oltre barre e tabelle attuali.
- **QR:** policy ancora più granulari per singolo evento se richiesto dal dominio.
- **Qualità:** ampliare [`e2e/`](../e2e/) (es. [`e2e/event-check-in-public.spec.ts`](../e2e/event-check-in-public.spec.ts) per errori link check-in senza login); esecuzione Playwright on-demand tramite [`.github/workflows/e2e-on-demand.yml`](../.github/workflows/e2e-on-demand.yml) (la CI principale non lancia e2e su ogni PR).

## Criteri di chiusura epic (bozza)

- Staff compie i compiti CRM quotidiani senza SQL manuale.
- Metriche campagne e prenotazioni verificabili in UI con stesso dato dell’outbox.
- Revisione sicurezza e checklist deploy aggiornata.
