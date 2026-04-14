# Checklist operatore — deploy Vercel / Supabase

Usa questa lista in parallelo a [deploy-production-runbook.md](./deploy-production-runbook.md). Spunta le voci quando completate (issue tracker o PR description).

## Variabili e dashboard

- [ ] **Vercel → Environment variables:** stessi nomi di [.env.example](../.env.example) necessari al runtime (`NEXT_PUBLIC_*`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_*`, `OUTBOX_CRON_SECRET` o `CRON_SECRET`, `STRIPE_*` se eventi a pagamento, ecc.).
- [ ] **Supabase → Authentication → URL configuration:** Site URL e redirect consentiti puntano al dominio **produzione** (non `localhost`), in linea con `NEXT_PUBLIC_SITE_URL`.

## Worker e database

- [ ] **Cron worker:** in Vercel imposta `CRON_SECRET` (consigliato) oppure `OUTBOX_CRON_SECRET`; verifica in log che `GET /api/cron/outbox`, `GET /api/cron/expire-pending-event-payments`, `GET /api/cron/event-reminders` e `GET /api/cron/product-stock-notifications` rispondano `200` e che in tabella `communication_outbox` gli `email` passino a `sent` (con `RESEND_API_KEY` valida).
- [ ] **Stripe (se usi pagamenti evento):** webhook verso `/api/webhooks/stripe` con `checkout.session.completed`; `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` su Vercel.
- [ ] **Migrazioni:** l’istanza Postgres del progetto Supabase in produzione ha tutte le migrazioni applicate (`supabase db push` o pipeline equivalente), incluse check-in QR (`20260417120000_event_registration_check_in_token.sql`) e CRM/QR/comms stub (`20260418140000_crm_audit_qr_window_comms_campaigns.sql`: audit `staff_crm_audit_log`, `comms_campaigns`, finestra RPC check-in, `staff_rotate_registration_check_in_token`).

## Verifiche automatiche (locale con env che punta al target)

Dopo aver configurato `.env.local` (o `DEPLOY_ENV_FILE`) verso l’istanza che vuoi validare:

```bash
npm run verify:release-stack
```

Equivale a `npm run verify:supabase` seguito da `npm run smoke:test`. Dopo **`supabase db push`** sul remoto, stesso stack: `npm run verify:after-migrations`.

Per un passaggio unico allineato al ROADMAP §218–229 (release stack **obbligatorio** ok, poi `verify:deploy` strict se l’env mirror prod è completo):

```bash
npm run verify:predeploy
```

Se `verify:deploy` fallisce (tipico in dev: `NEXT_PUBLIC_SITE_URL` su localhost, manca `CRON_SECRET`), le voci **Vercel env**, **log cron 200**, **Auth URL** e **Stripe** restano da chiudere a mano su dashboard.

Per generare comandi verso le route cron GET (Bearer come in produzione): `npm run verify:cron-hints` — con `CRON_VERIFY_SITE_URL` se in locale `NEXT_PUBLIC_SITE_URL` è `http://localhost:3000` (vedi [deploy-production-runbook.md](./deploy-production-runbook.md) §4).

Per controllo strict delle variabili tipo produzione senza lo script composito: `npm run verify:deploy` (richiede HTTPS su `NEXT_PUBLIC_SITE_URL`, cron secret, Resend).

## Post-deploy e CI

- [ ] **Post-deploy manuale:** sito pubblico, `/events`, login magic link; staff su `/admin` e un evento; oppure di nuovo `verify:release-stack` con env di produzione.
- [ ] **CI:** workflow GitHub verde sulla branch principale; in locale `npm run ci` prima del push.

## Dopo merge su `main` (GitHub)

Da eseguire quando il codice su `origin/main` include nuove migrazioni o nuove route cron (allineato a [ROADMAP.md](../ROADMAP.md) §205–231):

- [ ] **Supabase remoto:** `supabase db push` sul progetto collegato alla produzione (o pipeline CI equivalente).
- [ ] **Subito dopo il push DB:** `npm run verify:after-migrations` (o `npm run verify:predeploy` se vuoi anche il gate `verify:deploy` con env mirror prod).
- [ ] **Vercel:** attendi deploy automatico da `main`; controlla log runtime e cron (quattro path GET, incluso `product-stock-notifications`).
- [ ] **Nessuna migrazione nuova in merge:** comunque `npm run verify:release-stack` con `.env.local` che punta al progetto Supabase di produzione prima di considerare il rilascio chiuso.
