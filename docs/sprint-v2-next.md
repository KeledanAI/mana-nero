# Sprint dedicato — backlog V2 (post–routine deploy)

**Riferimenti:** [ROADMAP.md](../ROADMAP.md) §251–261, §278–281; epic [backlog-crm-v2.md](./backlog-crm-v2.md); checklist [deploy-operator-checklist.md](./deploy-operator-checklist.md).

**Obiettivo dello sprint:** chiudere almeno **un** incremento misurabile tra comms, CRM dati, analytics o qualità, senza rompere RLS né l’outbox idempotente; ogni story include migrazione additiva solo se necessaria e `npm run verify:after-migrations` dopo il push DB.

**Definition of Done (condivisa):**

- [x] Migrazioni applicate su Supabase remoto usato dallo sprint (`supabase db push` o equivalente). *(Verifica routine 2026-04-14: remoto allineato al repo.)*
- [x] `npm run ci` verde; smoke rilevante (`npm run smoke:test` o e2e mirato) se il flusso tocca RPC/auth pubblica. *(2026-04-14: `verify:after-migrations`, smoke con `SMOKE_TEST_EVENT_PAYMENTS=1`, `npm run ci`; anche `npm run test:e2e` — 13 passed, 2 skipped su `auth-events`.)*
- [ ] Staff-only: verifica manuale minima su `/admin/...` coinvolto.
- [x] Nessun secret o PII in commit; RLS invariata nella semantica (`has_role`). *(Processo: non inserire segreti in doc/commit.)*

---

## Backlog ordinato (storie)

Spunta le righe quando la story è **merged** e verificata in ambiente di riferimento dello sprint.

**Nota:** S1–S6 restano da implementare nel codice; in questa passata si è aggiornata solo la **routine** (DoD / log) e la verifica **S7** (e2e già presenti + `npm run test:e2e`).

### S1 — Waitlist strutturata (Comms / dominio)

- [ ] Modello: cosa significa “strutturata” (es. tabella `waitlist_entries` / stato su `event_registrations` + notifiche outbox `kind` dedicato) allineato a [design-v2-comms-automation.md](./design-v2-comms-automation.md).
- [ ] UI staff: visibilità lista o export controllato dove serve.
- [ ] Outbox: idempotency key stabile documentata nel codice ([`lib/comms/enqueue.ts`](../lib/comms/enqueue.ts) pattern esistente).

**File probabili:** `supabase/migrations/`, [`app/admin/comms/page.tsx`](../app/admin/comms/page.tsx), [`lib/comms/process-outbox.ts`](../lib/comms/process-outbox.ts).

### S2 — Propagazione revoche consensi sugli enqueue (Comms)

- [ ] Comportamento atteso: revoca newsletter/marketing → gestione righe `communication_outbox` in `pending` (cancellazione, skip dispatch, o flag) con audit.
- [ ] Coerenza con revoca marketing già in CRM ([`app/admin/actions.ts`](../app/admin/actions.ts), [`lib/gamestore/crm-audit.ts`](../lib/gamestore/crm-audit.ts)).

**File probabili:** [`lib/comms/campaign-segment-enqueue.ts`](../lib/comms/campaign-segment-enqueue.ts), worker/cron outbox, eventuali RPC di supporto.

### S3 — Segmenti campagna aggiuntivi (Comms)

- [ ] Nuovo segmento (es. waitlist confermabile) con enum/const additiva e RLS invariata.
- [ ] UI [`/admin/comms`](../app/admin/comms/page.tsx) + test unit su idempotency key.

### S4 — CRM: telefono + / o tag e lead (schema + UI)

- [ ] Migrazione additiva su `profiles` (o tabella figlia) + RLS.
- [ ] Form scheda CRM e filtri elenco se i campi diventano ricercabili.

**File probabili:** [`lib/gamestore/data.ts`](../lib/gamestore/data.ts), [`app/admin/crm/`](../app/admin/crm/), migrazioni.

### S5 — Analytics: sent / failed per campagna (slug)

- [ ] RPC o vista che legge `communication_outbox` filtrando payload campagna (`campaign_segment` + metadata slug) con intervallo opzionale.
- [ ] Sezione in [`app/admin/analytics/page.tsx`](../app/admin/analytics/page.tsx) o link da `/admin/comms`.

### S6 — QR: policy per evento ancora più granulari

- [ ] Requisito prodotto scritto (finestre, eccezioni staff); poi estensione RPC `event_check_in_by_token` / colonne `events` se serve.
- [ ] Aggiornare copy in [`app/events/check-in/[token]/page.tsx`](../app/events/check-in/[token]/page.tsx) e e2e se cambiano messaggi stabili.

### S7 — Qualità: e2e aggiuntivi

- [x] e2e pubblici pagina check-in token (formato non valido / UUID sconosciuto): [`e2e/event-check-in-public.spec.ts`](../e2e/event-check-in-public.spec.ts) — eseguire con `npm run test:e2e`.
- [ ] Estendere [`e2e/`](../e2e/) con flussi **staff** autenticati (credenziali di test in `.env.example` / `SMOKE_TEST_*` dove documentato).
- [ ] Eseguire on-demand: [`.github/workflows/e2e-on-demand.yml`](../.github/workflows/e2e-on-demand.yml).

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
| Data fine   | _aperto_ |
| Ambiente DB | Progetto Supabase collegato in locale (`supabase link`); routine deploy verificata al 2026-04-14 (vedi log) |

Quando lo sprint è chiuso, aggiornare [backlog-crm-v2.md](./backlog-crm-v2.md) (sezione «Priorità successive») spuntando o rimuovendo le voci coperte.

## Log routine (automazione / verifica)

| Data       | Azione |
|------------|--------|
| 2026-04-14 | `supabase db push` (up to date), `verify:after-migrations`, `SMOKE_TEST_EVENT_PAYMENTS=1` + `smoke:test`, `verify:predeploy` (incl. `verify:deploy` locale atteso fallito), `verify:cron-hints`, `verify:migrations`, `npm run ci` |
| 2026-04-14 | Stessa routine ripetuta (piano roadmap passi operativi): comandi sopra + `npm run test:e2e` (13 passed, 2 skipped) |
