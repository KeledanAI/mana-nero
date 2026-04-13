# Runbook: deploy produzione (Vercel + Supabase)

Ordine consigliato dopo il primo deploy o a ogni cambio di dominio o chiavi. Allinea la [checklist in ROADMAP.md](../ROADMAP.md#checklist-deploy-produzione-vercel--supabase).

## 0. Prerequisiti

- Progetto Supabase di **produzione** con stesso schema del repo (`supabase/migrations/`).
- Progetto Vercel collegato al repository GitHub.
- File locale con le **stesse** variabili che importerai su Vercel (es. copia di `.env.local` dedicata al progetto prod, **mai** committata).

## 1. Database Supabase (prima del traffico)

1. Collega la CLI al progetto remoto: `supabase link --project-ref <ref>` (vedi [Supabase CLI](https://supabase.com/docs/guides/cli)).
2. Applica migrazioni: `supabase db push` (o pipeline CI che esegue le migrazioni sull’istanza prod).
3. Verifica REST: con URL/chiave **di produzione** in env, dalla root:
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

Dopo aver salvato le variabili, ridistribuisci (redeploy) se necessario.

## 4. Cron worker outbox

- In repo: [`vercel.json`](../vercel.json) schedula `GET /api/cron/outbox` ogni 15 minuti.
- In Vercel: imposta `CRON_SECRET` (consigliato) **identico** a quanto la piattaforma usa per le chiamate cron verso la route (vedi documentazione Vercel Cron + `CRON_SECRET`).
- Post-deploy: **Logs** su Vercel → cerca richieste a `/api/cron/outbox` con risposta **200** (non 401/503).
- In Supabase **Table Editor** (o SQL): su `communication_outbox`, messaggi `email` dovrebbero passare a `sent` quando `RESEND_API_KEY` è valida.

## 5. Verifica variabili (locale mirror di prod)

Con un file env che riflette la produzione (es. `.env.local` temporaneo con valori prod):

```bash
npm run verify:deploy
```

Catena REST + smoke RPC (stesso target Supabase dell’env):

```bash
npm run verify:release-stack
```

Equivale a `verify:supabase` poi `smoke:test`. Lista spuntabile lato dashboard: [deploy-operator-checklist.md](./deploy-operator-checklist.md).

## 6. Post-deploy manuale (UI)

- Homepage e `/events` caricano.
- Magic link (o login) con dominio reale.
- Utente **staff**: `/admin`, evento, check-in, CSV partecipanti.

## 7. CI GitHub

Su ogni PR: workflow verde (lint, test, build). In locale prima del push: `npm run ci`.

---

**Sicurezza:** non committare `.env.local` con segreti prod; ruotare `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` / `OUTBOX_CRON_SECRET` e chiavi Resend se esposte.
