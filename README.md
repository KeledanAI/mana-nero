# Mana Nero — Game Store (Next.js + Supabase)

Applicazione per eventi, prenotazioni, CRM staff, comunicazioni via outbox e preordini leggeri. Stack: **Next.js** (App Router), **Supabase** (Auth, Postgres, RLS), deploy tipico su **Vercel**.

## Documentazione di prodotto e progetto

| Documento | Contenuto |
|-----------|------------|
| [PRD.md](PRD.md) | Visione, V1–V3, principi |
| [ROADMAP.md](ROADMAP.md) | Decisioni architetturali, stato implementazione, backlog Q2, checklist deploy |
| [docs/deploy-operator-checklist.md](docs/deploy-operator-checklist.md) | Checklist operatore (env, cron, migrazioni, CI opzionale staging) |
| [docs/deploy-production-runbook.md](docs/deploy-production-runbook.md) | Runbook deploy produzione |
| [docs/sprint-v2-next.md](docs/sprint-v2-next.md) | Sprint `v2-next-1` (chiuso): storie S1–S7, DoD, log routine |
| [docs/sprint-v2-next-2.md](docs/sprint-v2-next-2.md) | Sprint `v2-next-2`: reminder 7g + e2e mutazione CRM |
| [docs/sprint-v2-next-3.md](docs/sprint-v2-next-3.md) | Sprint `v2-next-3`: CI staging env merge + e2e scan comms |
| [docs/sprint-v2-next-4.md](docs/sprint-v2-next-4.md) | Sprint `v2-next-4`: e2e staff record `comms_campaigns` |
| [docs/sprint-v2-next-5.md](docs/sprint-v2-next-5.md) | Sprint `v2-next-5`: grafico analytics campagne per slug |
| [docs/sprint-v2-next-6.md](docs/sprint-v2-next-6.md) | Sprint `v2-next-6`: segmento comms `registration_confirmed` |
| [docs/sprint-v2-next-7.md](docs/sprint-v2-next-7.md) | Sprint `v2-next-7`: e2e comms + `data-testid` segmenti |
| [docs/sprint-v2-next-8.md](docs/sprint-v2-next-8.md) | Sprint `v2-next-8`: e2e enqueue campagna segmentata |
| [docs/sprint-v2-next-9.md](docs/sprint-v2-next-9.md) | Sprint `v2-next-9`: e2e enqueue da record `comms_campaigns` |
| [docs/sprint-v2-next-10.md](docs/sprint-v2-next-10.md) | Sprint `v2-next-10`: UX form enqueue + validazione server |
| [docs/sprint-v2-next-11.md](docs/sprint-v2-next-11.md) | Sprint `v2-next-11`: messaggi errore comms leggibili |
| [docs/sprint-v2-next-12.md](docs/sprint-v2-next-12.md) | Sprint `v2-next-12`: euristiche errori Postgres su comms |
| [docs/sprint-v2-next-13.md](docs/sprint-v2-next-13.md) | Sprint `v2-next-13`: e2e slug duplicato comms |
| [docs/backlog-crm-v2.md](docs/backlog-crm-v2.md) | Epic CRM / analytics e priorità successive |
| [docs/design-v2-comms-automation.md](docs/design-v2-comms-automation.md) | Outbox, reminder, campagne segmentate staff (`newsletter_opt_in`, `marketing_consent`, `registration_waitlisted`, `registration_confirmed`) |
| [docs/design-v2-event-payments.md](docs/design-v2-event-payments.md) | Design pagamenti evento (Stripe + RPC) |

## Sviluppo locale

1. Crea un progetto su [Supabase](https://supabase.com/dashboard) (o usa Supabase locale).
2. Copia [`.env.example`](.env.example) in `.env.local` e imposta almeno `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` dove serve.
3. Applica le migrazioni: dalla root del repo, con [Supabase CLI](https://supabase.com/docs/guides/cli) collegato al DB: `supabase db push` (oppure reset locale).
4. Avvio dev server:

```bash
npm install
npm run dev
```

Il progetto espone in genere l’app su [http://localhost:3000](http://localhost:3000).

## Script npm principali

| Script | Scopo |
|--------|--------|
| `npm run dev` | Server di sviluppo Next.js |
| `npm run build` | Build di produzione |
| `npm run lint` | ESLint |
| `npm run test` | Test unitari (`tsx --test`, file in `lib/**/*.test.ts`) |
| `npm run test:e2e` | Playwright (richiede env in `.env.example`, es. `PLAYWRIGHT_BASE_URL`) |
| `npm run ci` | `lint` + `test` + `build` (come CI GitHub) |
| `npm run verify:migrations` | Elenco file in `supabase/migrations/` |
| `npm run verify:supabase` | Controllo REST / schema minimo |
| `npm run smoke:test` | Smoke RPC contro il DB configurato in env |
| `npm run verify:after-migrations` | `verify:supabase` + `smoke:test` (dopo `db push`) |
| `npm run verify:predeploy` | Gate predeploy (vedi script in `package.json`) |

## Database

- **Migrazioni:** `supabase/migrations/` (ordine cronologico nel nome file). Il numero di file nel repo è la fonte per `verify:migrations`.
- **Regola d’oro:** una RPC principale per il ciclo prenotazione (`event_registration_action`), RLS tramite `has_role`, outbox con `idempotency_key` univoca — vedi ROADMAP.

## CI / GitHub Actions

- **CI** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)): su push/PR — `lint`, `test`, `build` (env Supabase placeholder in build).
- **E2E on demand** ([`.github/workflows/e2e-on-demand.yml`](.github/workflows/e2e-on-demand.yml)): `workflow_dispatch` con input `base_url` (Playwright contro preview/staging/prod).
- **Staging DB verify (optional)** ([`.github/workflows/staging-db-verify.yml`](.github/workflows/staging-db-verify.yml)): `workflow_dispatch` — `verify:migrations` sempre; con secret `STAGING_NEXT_PUBLIC_SUPABASE_*` anche `verify:supabase` + `smoke:test`. Dettaglio in [docs/deploy-operator-checklist.md](docs/deploy-operator-checklist.md).

## Licenza / upstream

Il repository deriva da un bootstrap Next.js + Supabase; la documentazione di prodotto e le convenzioni del dominio sono nel repo (`PRD.md`, `ROADMAP.md`, `docs/`).
