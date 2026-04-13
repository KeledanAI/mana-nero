---
name: GameStore V1 su Supabase Starter
overview: Bootstrap con template Vercel+Supabase; schema con ruolo singolo su profiles, RLS via has_role, booking solo tramite una RPC SECURITY DEFINER, registrations in una tabella con enum, slug su entità pubbliche, outbox idempotente, jsonb non critico; dominio in lib/domain, UI sottile.
todos:
  - id: bootstrap-starter
    content: Spostare PRD/file se necessario; create-next-app --example with-supabase; package name lowercase; ripristinare docs; .env.local
    status: completed
  - id: audit-starter
    content: Mappare middleware e lib/supabase; helper app has_role(profile.role) allineato a SQL
    status: completed
  - id: sql-schema-rls
    content: "Migrazioni: app_role su profiles, has_role(), event_categories/events+slug, event_registrations+enum+partial unique, posts+slug, newsletter, admin_notes, product_requests+future cols, outbox idempotente; RLS solo con has_role"
    status: completed
  - id: domain-booking
    content: "Una sola RPC SECURITY DEFINER (operazioni enum interne); app chiama solo rpc; lib/domain/booking wrapper tipizzato"
    status: completed
  - id: public-user-features
    content: Pagine pubbliche e area utente; server actions sottili → dominio/RPC
    status: completed
  - id: admin-crm-cms
    content: CRUD staff/admin; CSV; check-in via RPC o update consentito da RLS staff
    status: completed
  - id: product-reservation
    content: Insert con status; campi opzionali quantity, desired_price, priority_flag
    status: completed
  - id: comms-extension
    content: Outbox con idempotency_key UNIQUE; stati retry-safe; adapter enqueue senza dispatch obbligatorio
    status: completed
  - id: verify-remote-db
    content: Applicare migrazioni al progetto Supabase remoto; npm run verify:supabase; smoke test manuale (vedi sotto)
    status: completed
  - id: quality-tests-v2
    content: Estendere test automatici (integrazione DB, E2E) oltre i test unitari minimi in lib/**/*.test.ts
    status: completed
  - id: v2-event-payments
    content: "V2 (PRD §4.1): pagamenti/depositi evento, stati registration additivi"
    status: pending
  - id: v2-comms-automation
    content: "V2 (PRD §4.3): reminder, campagne, notifiche waitlist oltre outbox email base"
    status: pending
  - id: v2-product-preorders
    content: "V2 (PRD §4.4): preordini strutturati, stock alerts (estende product_requests)"
    status: pending
---

# Piano V1 — Game Store (estensione dello starter Vercel + Supabase)

## Decisioni architetturali chiuse (pre-implementazione)

Queste scelte sono **vincolanti**; niente alternative parallele in V1.

| # | Decisione | Approccio unico |
|---|-----------|-----------------|
| 1 | **Booking** | **Una sola** entrypoint RPC Postgres `SECURITY DEFINER` per tutto il ciclo prenotazione lato dominio (es. `event_registration_action(p_operation app_registration_action, ...)` con enum operazioni: `book`, `cancel`, `staff_check_in`, …). **Un corpo**, transazioni interne uniche per chiamata; **vietato** orchestrare booking con più RPC o query separate dall’app. L’app invoca **solo** questa `supabase.rpc(...)`. |
| 2 | **RLS** | Funzione SQL riusabile **`public.has_role(required app_role)`** (`STABLE`, `SECURITY DEFINER`, `search_path` fisso). **Tutte** le policy RLS devono usarla (nessuna duplicazione ad hoc di controlli ruolo inline). Semantica: gerarchia **`customer < staff < admin`** — es. `has_role('staff')` vero per `staff` e `admin`. |
| 3 | **Prenotazioni** | **Solo** tabella **`event_registrations`** con enum **`registration_status`** (`confirmed`, `waitlisted`, `cancelled`, `checked_in`, valori futuri additivi es. `pending_payment`). **Nessuna** tabella separata per waitlist. |
| 4 | **Slug** | **`events.slug`** e **`posts.slug`**: obbligatori per entità pubbliche, **UNIQUE** globalmente (o UNIQUE per scope se definito — default: unique globale con vincolo esplicito nel piano implementativo). URL pubblici basati su slug. |
| 5 | **jsonb** | **`metadata` / `payload` jsonb** ammessi solo per estensioni **non critiche** (es. extra outbox, preferenze UI). **Nessuna** regola di booking, capacità, ruolo o pagamento futuro deve dipendere da jsonb in V1. |
| 6 | **Outbox** | Tabella outbox **idempotente** e **retry-safe**: ad es. **`idempotency_key TEXT NOT NULL UNIQUE`**, più stati (`pending`, `processing`, `sent`, `failed`), timestamp di tentativi; inserimenti **ON CONFLICT DO NOTHING** o upsert controllato così i retry non duplicano invii. |
| 7 | **Product requests** | Oltre ai campi base: **`quantity` (int NULL)**, **`desired_price` (numeric NULL)**, **`priority_flag` (boolean default false)** — tutti opzionali per V1, pronti per preorder V2. |
| 8 | **Ruoli V1** | **Un solo ruolo per utente**: colonna **`profiles.role`** di tipo **`app_role`**, `NOT NULL`, default **`customer`**. **Niente** tabella `user_roles` in V1. Se in futuro servissero più ruoli, si aggiunge in modo **additivo** (nuova tabella + migrazione dati) senza rompere la colonna esistente. |
| 9 | **Chiusura decisioni** | Variabili d’ambiente **non** usate per admin. Nessun “forse RPC o query”. **Un** modello di slug, **un** enum registrazioni, **un** punto d’ingresso SQL per booking. |

---

## Vincoli di stabilità a lungo termine (obbligatori)

Ogni decisione deve superare il test: **«Funzionerà in V2/V3 solo con estensioni additive?»** Se no, non va implementata.

| Regola | Implicazione operativa |
|--------|-------------------------|
| Niente implementazioni usa-e-getta | Niente logica temporanea da sostituire; niente assunzioni che rompono a scala |
| Dominio estensibile | **Ruolo enum su `profiles`** (no boolean `is_staff`); **stati espliciti**; niente seconda tabella per waitlist |
| Preparare il futuro senza costruirlo | Colonne **nullable** per pagamenti su event/registration; campi prodotto opzionali; outbox per canali multipli |
| Disaccoppiamento | Regole in **`lib/domain/*`**; componenti **senza** capacità/booking inline |
| Booking production-ready | **Una RPC** per transazione; vincoli DB + partial unique su coppie attive; waitlist = stesso record, altro `status` |
| Autorizzazione scalabile | **`has_role`** in RLS e stessa semantica in TypeScript per UX (hide admin nav) — **no** `ADMIN_EMAILS` |
| DB = contratto | Slug, enum, timestamp; evoluzione additiva |
| Punti di estensione | Outbox idempotente; colonne pagamento NULL; jsonb solo non critico |

**Failure condition:** riscrivere auth, booking oltre l’aggiunta di RPC additive, split tabella registrations, o ruoli senza migrazione controllata → **INVALID**.

---

## Contesto

- [PRD.md](./PRD.md): V1 in scope; V2/V3 direzione only.
- Bootstrap in **root**; se la cartella non è vuota, spostare temporaneamente file di documentazione.
- **Nome package npm:** usare nome **lowercase** (es. `game-store`) — la cartella può restare `GameStore`, ma `package.json` **name** non può avere maiuscole (vincolo npm).

## Step 0 — Bootstrap ufficiale

1. Svuotare la directory di lavoro dai soli file che bloccano lo scaffold (es. `PRD.md`, `file.md` → backup temporaneo).
2. `npx create-next-app@latest . --example with-supabase` con flag non interattivi; **`package.json` → `"name": "game-store"`** (o simile) se il template deriva dal nome cartella maiuscolo.
3. Ripristinare `PRD.md` e `file.md`.
4. `.env.local`: supportare sia `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` sia documento utente con `NEXT_PUBLIC_SUPABASE_ANON_KEY` (stesso valore se anon legacy).

## Step 1 — Ispezione architettura

Mappare il refresh sessione (nel repo: `proxy.ts` + `lib/supabase/proxy.ts`, equivalente funzionale al middleware dello starter) e `lib/supabase/*`. Helper lato app: **`userMeetsRole`** in `lib/auth/roles.ts` allineato a `has_role` in SQL.

## Step 2 — Modello dati

### Ruoli e profili

- Enum **`app_role`**: `customer`, `staff`, `admin`.
- **`profiles.role`** `NOT NULL DEFAULT 'customer'` (allineare allo starter: stesso `id` = `auth.users.id`).

### Eventi

- `event_categories`; **`events`** con `status`, `starts_at`/`ends_at`, `capacity`, **`slug` UNIQUE**, colonne nullable `price_cents`, `currency`, `deposit_cents` per V2.

### `event_registrations` (tabella unica)

- `registration_status` enum come sopra; **`waitlist_position` NULL** per ordine waitlist.
- **Partial unique index**: una riga attiva per utente/evento, es. unica su `(event_id, user_id)` dove `status IN ('confirmed','waitlisted')`.

### Booking — implementazione

- **Una sola funzione** `SECURITY DEFINER` con `SET search_path = public` (o schema esplicito): parametro operazione (enum) che instrada a branch interni nella **stessa** definizione PL/pgSQL. Per `book`: lock riga evento (`FOR UPDATE`), conta `confirmed`, insert `confirmed` vs `waitlisted` o errore, `waitlist_position`, eventuale riga **outbox** con `idempotency_key` deterministico (es. `booking:{event_id}:{user_id}`) nella **stessa** transazione. Per `cancel` / `staff_check_in`: stessa funzione, branch atomico. **Vietato** più funzioni RPC per booking o logica capacity dal client.

### CMS, newsletter, CRM, prodotti

- **`posts`**: `status`, **`slug` UNIQUE**, `published_at`, autore.
- `newsletter_subscribers`, `admin_notes` (RLS con `has_role('staff')`).
- **`product_reservation_requests`**: status enum; campi **`quantity`**, **`desired_price`**, **`priority_flag`**; note testuali; **nessuna** dipendenza da jsonb per stati core.

### Outbox

- Colonne minime: `id`, `idempotency_key` UNIQUE, `channel`, `payload` jsonb (solo contenuto messaggio, non regole business), `status`, `scheduled_at`, `attempt_count`, `last_error`, timestamps.
- Worker V1 opzionale; contratto pronto per retry idempotenti.

### RLS

- Ogni policy: **`has_role('staff')`** / **`has_role('admin')`** / `auth.uid() = ...` per dati propri.
- **Nessuna** policy che duplica la logica di `has_role` in linea.

## Step 3 — Applicativo

Server Actions → `lib/domain/booking.ts` (etc.) → **`.rpc()`** verso le funzioni sopra. UI senza logica di capacità.

## Step 4 — Comunicazioni

`lib/comms/enqueue.ts` inserisce in outbox con **idempotency_key** fornito dal dominio (es. dopo RPC booking).

## Diagramma alto livello

```mermaid
flowchart LR
  subgraph public [Public]
    HP[Homepage]
    EV[Events by slug]
    NW[News by slug]
    PR[ProductRequest]
  end
  subgraph auth [Starter Auth]
    SUP[Supabase Auth]
    PRX[Proxy session cookies]
  end
  subgraph user [Logged in]
    PROF[Profile role]
    BOOK[rpc_book_event]
  end
  subgraph sql [Postgres]
    HR[has_role]
    RPC[SECURITY_DEFINER_RPC]
    OBX[outbox idempotent]
  end
  subgraph admin [staffOrAdmin]
    ADM[Admin CRUD]
    CSV[CSV]
    CRM[CRM]
  end
  public --> SUP
  user --> RPC
  RPC --> OBX
  admin --> HR
  PRX --> SUP
```

## Rischio noto

- Directory non vuota e **npm name**: usare nome package lowercase dopo lo scaffold.

---

## Stato implementazione (codice vs piano V1)

| Area | Stato |
|------|--------|
| Migrazioni SQL V1 (`supabase/migrations/20260404170000_gamestore_v1.sql` e successive) | Implementate nel repo |
| RPC unica `event_registration_action`, RLS via `has_role`, outbox idempotente | Implementate |
| Dominio `lib/domain/booking.ts`, `lib/comms/enqueue.ts`, worker batch `lib/comms/process-outbox.ts` | Implementate |
| Route cron worker | `GET /api/cron/outbox` con `Authorization: Bearer` + `OUTBOX_CRON_SECRET` e/o `CRON_SECRET` (Vercel) |
| UI pubblica, `/protected`, `/admin`, CSV partecipanti | Implementate |
| Enum `pending_payment` / altre estensioni additive | Non in V1 (solo quando servirà una migrazione) |
| Test automatici | `npm run test` (unit); `npm run smoke:test` (RPC remoto); `npm run test:e2e` (Playwright: home, eventi, news, giochi, contatti, reserve, community; prima volta `npx playwright install chromium`); con `E2E_STORAGE_STATE` anche [e2e/auth-events.spec.ts](e2e/auth-events.spec.ts); CI GitHub [`.github/workflows/ci.yml`](.github/workflows/ci.yml) su push/PR (`lint`, `test`, `build`) |

**Gap operativo:** le migrazioni vanno applicate al **progetto Supabase remoto** usato da `.env.local` (CLI `supabase db push` o SQL editor). Il codice nel repo non sostituisce questo passo.

---

## Deploy database e smoke test

1. **Variabili:** copia [.env.example](.env.example) in `.env.local` e imposta almeno `NEXT_PUBLIC_SUPABASE_URL`, chiave anon/publishable, `NEXT_PUBLIC_SITE_URL` per redirect coerenti.
2. **Migrazioni:** applica in ordine i file in `supabase/migrations/` al progetto collegato (documentazione Supabase: *Database migrations*).
3. **Controllo rapido:** dalla root esegui `npm run verify:supabase` — verifica raggiungibilità REST e presenza tabella `events`.
4. **Smoke test (automatico o manuale):**
   - **Automatico:** con `SUPABASE_SERVICE_ROLE_KEY` + URL/anon in `.env.local`, esegui `npm run smoke:test`. Senza `SMOKE_TEST_EMAIL` / `SMOKE_TEST_PASSWORD` viene creato ed eliminato un utente effimero; altrimenti si riusa l’account indicato.
   - **Manuale (UI):** registrazione / login (Turnstile se attivo); evento `published`; da `/events` prova `book` e `cancel`; promuovi un utente a `staff` (SQL o CRM); in `/admin/events/...` check-in e download CSV partecipanti.
5. **Email da outbox:** configurare `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` in produzione; per il worker impostare `OUTBOX_CRON_SECRET` e/o `CRON_SECRET` (Vercel) — la route `GET /api/cron/outbox` accetta `Authorization: Bearer` con uno dei due. In deploy su Vercel è incluso [`vercel.json`](vercel.json) con cron ogni 15 minuti sul path del worker (allinea il secret nel progetto Vercel). Senza cron, le righe `email` restano in `pending` finché il worker non gira.

### Checklist deploy produzione (Vercel / Supabase)

Usala dopo il primo deploy o ad ogni cambio di dominio / chiavi.

- [ ] **Vercel → Environment variables:** stessi nomi di [.env.example](.env.example) necessari al runtime (`NEXT_PUBLIC_*`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_*`, `OUTBOX_CRON_SECRET` o `CRON_SECRET`, ecc.).
- [ ] **Supabase → Authentication → URL configuration:** Site URL e redirect consentiti puntano al dominio **produzione** (non `localhost`), in linea con `NEXT_PUBLIC_SITE_URL`.
- [ ] **Cron worker:** in Vercel imposta `CRON_SECRET` (consigliato) oppure `OUTBOX_CRON_SECRET`; verifica in log che `GET /api/cron/outbox` risponda `200` e che in tabella `communication_outbox` gli `email` passino a `sent` (con `RESEND_API_KEY` valida).
- [ ] **Migrazioni:** l’istanza Postgres collegata al progetto Supabase in produzione ha tutte le migrazioni applicate (`supabase db push` o pipeline equivalente).
- [ ] **Post-deploy manuale:** apri sito pubblico, `/events`, login magic link reale; da staff `/admin` e un evento; oppure `npm run verify:supabase` / `npm run smoke:test` contro l’URL Supabase di produzione solo se usi variabili che puntano a quel progetto.
- [ ] **CI:** su ogni PR verifica che il workflow **CI** su GitHub sia verde (lint, unit test, build con env placeholder); in locale esegui `npm run ci` prima del push.

**Esecuzione guidata:** runbook passo-passo in [docs/deploy-production-runbook.md](docs/deploy-production-runbook.md). Con un file `.env.local` (o `DEPLOY_ENV_FILE`) che riflette le variabili di produzione: `npm run verify:deploy` (controllo strict) e poi `npm run verify:supabase` / `npm run smoke:test`.

---

## Backlog V2 (da [PRD.md](PRD.md) sezione 4)

Priorità suggerita: monetizzazione eventi e automazione comunicazioni prima del catalogo commerce (V3).

| PRD | Tema | Todo YAML |
|-----|------|-------------|
| §4.1 | Pagamenti online, depositi, QR check-in, reminder | `v2-event-payments` |
| §4.3 | Campagne, reminder, notifiche waitlist strutturate | `v2-comms-automation` |
| §4.4 | Preordini, quantità, priorità, alert arrivo merce | `v2-product-preorders` |
| §4.2 / §4.5 | CRM avanzato, analytics dashboard | da spezzare in todo quando si inizia |

I todo `v2-*` nel frontmatter sono **pending** finché non si apre uno sprint V2; aggiorna `status` quando completi un incremento.

**Primo incremento consigliato:** `v2-event-payments` (allinea DB additivo: colonne già presenti su `events` / `event_registrations` per pagamenti; nuovo stato enum solo con migrazione; **nessuna** seconda RPC booking: estensioni alla RPC esistente o flusso pagamento esterno + stato — da decidere in design review prima del codice). Bozza di design e checklist pre-codice: [docs/design-v2-event-payments.md](docs/design-v2-event-payments.md).

**Criteri di accettazione (bozza) per `v2-event-payments`:**

- Migrazione **additiva** sola: nessuna rimozione di colonne/tabelle V1; enum `registration_status` esteso (es. `pending_payment`) con default invariato per righe esistenti.
- **Un solo** entrypoint mutazione prenotazione lato DB: resta `event_registration_action` (nuovi branch o parametri opzionali), oppure pagamento orchestrato da provider esterno che aggiorna solo stato tramite quella RPC.
- RLS invariata nella semantica: solo `has_role` per privilegi staff/admin; niente bypass env-based.
- UI: stato “in attesa di pagamento” visibile a utente e staff; nessuna logica capacità nel client oltre a messaggi/CTA.
- Test: estendere `npm run smoke:test` o script dedicato quando esistono operazioni RPC nuove verificabili senza carta reale (mock provider / flag test).

**Criteri di accettazione (bozza) per `v2-comms-automation`:**

- Nessun invio duplicato: riuso **outbox** con `idempotency_key` stabile per ogni tipo di messaggio (reminder, campagna, waitlist).
- Worker o cron esistente esteso (stesso path o job dedicato) con canali aggiuntivi solo dove già previsti dall’enum `outbox_channel` o con migrazione enum **additiva**.
- Staff non invia messaggi “a mano” bypassando outbox per flussi che devono essere tracciati; UI admin solo enqueue / template.
- Metriche minime: conteggio `sent` / `failed` consultabile (SQL o vista) per debug.

**Criteri di accettazione (bozza) per `v2-product-preorders`:**

- Schema **additivo** su `product_reservation_requests` (o tabella figlia) senza rompere il form V1; stati espliciti se servono oltre l’enum attuale.
- Priorità e quantità restano coerenti con RLS: utente vede le proprie richieste; staff vede tutto come oggi.
- Nessun inventario “vero” in V2-lite: solo stati richiesta e notifiche (allineato PRD §4.4 prima del catalogo V3).

### Osservabilità e operatività ricorrente

Da tenere fuori dal codice ma dentro la routine del progetto:

- **Log:** Vercel (runtime / cron) e Supabase (API, Auth, Postgres) per errori 5xx, timeout outbox, spike su `event_registration_action`.
- **Segreti:** rotazione periodica di `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` / `OUTBOX_CRON_SECRET`, chiavi Resend; aggiornare env su Vercel e `.env.local` locale.
- **Backup:** policy backup / PITR del progetto Supabase in linea con il rischio accettato.
- **Locale vs CI:** prima di una PR esegui `npm run ci` (stesso ordine della [CI GitHub](.github/workflows/ci.yml): lint, test, build). Il build in CI usa URL Supabase placeholder; in locale `next build` usa `.env.local` se presente.
