# Runbook: deploy produzione (Vercel + Supabase)

Ordine consigliato dopo il primo deploy o a ogni cambio di dominio o chiavi. Allinea la [checklist in ROADMAP.md](../ROADMAP.md#checklist-deploy-produzione-vercel--supabase).

## 0. Prerequisiti

- Progetto Supabase di **produzione** con stesso schema del repo (`supabase/migrations/`).
- Progetto Vercel collegato al repository GitHub.
- File locale con le **stesse** variabili che importerai su Vercel (es. copia di `.env.local` dedicata al progetto prod, **mai** committata).

## 1. Database Supabase (prima del traffico)

1. Collega la CLI al progetto remoto: `supabase link --project-ref <ref>` (vedi [Supabase CLI](https://supabase.com/docs/guides/cli)).
2. Elenco file migrazioni locali (controllo pre-push): `npm run verify:migrations`.
3. Applica migrazioni: `supabase db push` (o pipeline CI che esegue le migrazioni sull’istanza prod).
4. Verifica REST: con URL/chiave **di produzione** in env, dalla root:
   - `npm run verify:supabase`
   - opzionale RPC: `npm run smoke:test` (richiede `SUPABASE_SERVICE_ROLE_KEY` e utente/evento coerenti).

## 2. Supabase → Authentication → URL configuration

- **Site URL:** dominio pubblico HTTPS (es. `https://www.tuodominio.it`), **uguale** a `NEXT_PUBLIC_SITE_URL` su Vercel.
- **Redirect URLs:** includi lo stesso dominio e eventuali preview se servono.

## 3. Vercel → Environment variables

Copia i nomi da [.env.example](../.env.example). Minimo tipico in **Production**:

| Variabile | Note |
|-----------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL progetto prod |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` o `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chiave anon/publishable |
| `NEXT_PUBLIC_SITE_URL` | URL canonico pubblico (HTTPS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo server; outbox / operazioni privilegiate |
| `CRON_SECRET` **oppure** `OUTBOX_CRON_SECRET` | Vercel Cron invia `Authorization: Bearer` con `CRON_SECRET` se configurato; la route accetta entrambi ([`app/api/cron/outbox/route.ts`](../app/api/cron/outbox/route.ts)) |
| `RESEND_API_KEY` (+ `RESEND_FROM` se serve) | Email transazionali da outbox |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Se usi captcha su login (allineare secret in Supabase Auth) |
| `STRIPE_SECRET_KEY` | Solo server; creazione sessioni Checkout per eventi con `price_cents` / `deposit_cents` |
| `STRIPE_WEBHOOK_SECRET` | Verifica firma su `POST /api/webhooks/stripe` |
| `EVENT_PAYMENT_PENDING_EXPIRE_HOURS` | Opzionale; ore prima che il cron scada una `pending_payment` (default 24) |

Dopo aver salvato le variabili, ridistribuisci (redeploy) se necessario.

## 4. Cron worker outbox

- In repo: [`vercel.json`](../vercel.json) schedula `GET /api/cron/outbox` ogni 15 minuti.
- In Vercel: imposta `CRON_SECRET` (consigliato) **identico** a quanto la piattaforma usa per le chiamate cron verso la route (vedi documentazione Vercel Cron + `CRON_SECRET`).
- Post-deploy: **Logs** su Vercel → cerca richieste a `/api/cron/outbox` con risposta **200** (non 401/503).
- Per generare da terminale i comandi verso le route cron GET (stesso Bearer del deploy): `npm run verify:cron-hints` (legge `.env.local` o `DEPLOY_ENV_FILE`). Se in locale `NEXT_PUBLIC_SITE_URL` è `http://localhost:3000`, imposta **`CRON_VERIFY_SITE_URL`** (file env o variabile shell) all’URL HTTPS di produzione o preview, così i curl puntano al deploy giusto senza cambiare l’URL usato dal dev server.
- In Supabase **Table Editor** (o SQL): su `communication_outbox`, messaggi `email` dovrebbero passare a `sent` quando `RESEND_API_KEY` è valida.

## 4b. Cron reminder eventi (~24h)

- In repo: [`vercel.json`](../vercel.json) schedula `GET /api/cron/event-reminders` ogni 6 ore.
- Stessi secret Bearer di §4; accoda righe `email` in `communication_outbox` con `kind` `event_reminder_24h` e `event_reminder_7d` (idempotenza su chiavi distinte per finestra).
- Test manuale staff: pagina [`/admin/comms`](../app/admin/comms/page.tsx) → “Esegui scan reminder 24h ora”.

## 4c. Cron scadenza pagamenti evento (`pending_payment`)

- In repo: [`vercel.json`](../vercel.json) schedula anche `GET /api/cron/expire-pending-event-payments` (orario).
- Stessi secret Bearer di §4 (`CRON_SECRET` / `OUTBOX_CRON_SECRET`).
- Post-deploy: in log, risposta **200** con body `{ "expired": n, "errors": m }` (valori dipendono da righe scadute).

## 4d. Stripe (webhook + dashboard)

1. In **Stripe Dashboard** → Developers → Webhooks → **Add endpoint**: URL `https://<tuo-dominio-produzione>/api/webhooks/stripe`.
2. Seleziona almeno l’evento **`checkout.session.completed`** (il codice conferma il pagamento solo su questo tipo).
3. Copia il **Signing secret** in Vercel come `STRIPE_WEBHOOK_SECRET`.
4. Assicurati che `NEXT_PUBLIC_SITE_URL` in produzione coincida con l’origine usata negli URL di successo/annullamento del Checkout.

## 4e. Cron alert stock preordini (`awaiting_stock`)

- In repo: [`vercel.json`](../vercel.json) schedula `GET /api/cron/product-stock-notifications` (una volta al giorno, UTC).
- Stessi secret Bearer di §4 (`CRON_SECRET` / `OUTBOX_CRON_SECRET`).
- Accoda messaggi `email` con `kind` `product_stock_available` per richieste in `awaiting_stock` senza `stock_notified_at`, con `user_id` e finestra su `expected_fulfillment_at` (vedi [`lib/comms/product-stock-notifications.ts`](../lib/comms/product-stock-notifications.ts)).
- Post-deploy: in log, risposta **200** con body `{ "scanned", "enqueued", "marked", "errors" }`.

## 5. Verifica variabili (locale mirror di prod)

Con un file env che riflette la produzione (es. `.env.local` temporaneo con valori prod):

```bash
npm run verify:deploy
```

Catena REST + smoke RPC (stesso target Supabase dell’env):

```bash
npm run verify:release-stack
```

Equivale a `verify:supabase` poi `smoke:test`. Dopo `supabase db push` sul remoto: `npm run verify:after-migrations` (stessa catena). Passaggio unico che esegue anche `verify:deploy` e, se fallisce per env dev, stampa solo i promemoria manuali: `npm run verify:predeploy`. Lista spuntabile lato dashboard: [deploy-operator-checklist.md](./deploy-operator-checklist.md).

## 6. Post-deploy manuale (UI)

- Homepage e `/events` caricano.
- Magic link (o login) con dominio reale.
- Utente **staff**: `/admin`, evento, check-in, CSV partecipanti; `/admin/comms` (reminder, campagne, storico slug); `/admin/crm` (ricerca, **Esporta CSV** profili, schede cliente); `/admin/analytics`; per pagamenti, verifica prezzo/deposito su evento e stato partecipanti.

## 7. CI GitHub

- **CI** ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)): su push/PR verso `main` / `master` / `develop` — `npm ci`, `lint`, `test`, `build` (build con URL Supabase placeholder).
- **E2E on demand** ([`.github/workflows/e2e-on-demand.yml`](../.github/workflows/e2e-on-demand.yml)): solo manuale — input `base_url` (es. preview Vercel); Playwright senza avviare il dev server.
- **Staging DB verify (optional)** ([`.github/workflows/staging-db-verify.yml`](../.github/workflows/staging-db-verify.yml)): solo manuale — `verify:migrations` sempre; con secret `STAGING_NEXT_PUBLIC_SUPABASE_URL` e `STAGING_NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` anche `verify:supabase` (senza `.env.local` nel runner, vedi [`scripts/load-supabase-env.mjs`](../scripts/load-supabase-env.mjs)); con in più `STAGING_SUPABASE_SERVICE_ROLE_KEY` anche `smoke:test`. Dettaglio: [deploy-operator-checklist.md](./deploy-operator-checklist.md) (sezione staging).

In locale prima del push: `npm run ci`.

---

**Sicurezza:** non committare `.env.local` con segreti prod; ruotare `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` / `OUTBOX_CRON_SECRET`, chiavi Resend e segreti Stripe se esposte.
