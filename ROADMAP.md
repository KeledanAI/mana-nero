---
name: GameStore V1 su Supabase Starter
overview: Bootstrap con template Vercel+Supabase; schema con ruolo singolo su profiles, RLS via has_role, booking solo tramite una RPC SECURITY DEFINER, registrations in una tabella con enum, slug su entità pubbliche, outbox idempotente, jsonb non critico; dominio in lib/domain, UI sottile.
todos:
  - id: bootstrap-starter
    content: Spostare PRD/file se necessario; create-next-app --example with-supabase; package name lowercase; ripristinare docs; .env.local
    status: pending
  - id: audit-starter
    content: Mappare middleware e lib/supabase; helper app has_role(profile.role) allineato a SQL
    status: pending
  - id: sql-schema-rls
    content: "Migrazioni: app_role su profiles, has_role(), event_categories/events+slug, event_registrations+enum+partial unique, posts+slug, newsletter, admin_notes, product_requests+future cols, outbox idempotente; RLS solo con has_role"
    status: pending
  - id: domain-booking
    content: "Una sola RPC SECURITY DEFINER (operazioni enum interne); app chiama solo rpc; lib/domain/booking wrapper tipizzato"
    status: pending
  - id: public-user-features
    content: Pagine pubbliche e area utente; server actions sottili → dominio/RPC
    status: pending
  - id: admin-crm-cms
    content: CRUD staff/admin; CSV; check-in via RPC o update consentito da RLS staff
    status: pending
  - id: product-reservation
    content: Insert con status; campi opzionali quantity, desired_price, priority_flag
    status: pending
  - id: comms-extension
    content: Outbox con idempotency_key UNIQUE; stati retry-safe; adapter enqueue senza dispatch obbligatorio
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

Mappare middleware e `lib/supabase/*`. Aggiungere solo helper lato app es. **`userHasAtLeastRole(role)`** che legge `profiles.role` e rispecchia la gerarchia di `has_role` in SQL.

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
    MW[Middleware cookies]
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
  MW --> SUP
```

## Rischio noto

- Directory non vuota e **npm name**: usare nome package lowercase dopo lo scaffold.
