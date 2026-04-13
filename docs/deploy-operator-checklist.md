# Checklist operatore — deploy Vercel / Supabase

Usa questa lista in parallelo a [deploy-production-runbook.md](./deploy-production-runbook.md). Spunta le voci quando completate (issue tracker o PR description).

## Variabili e dashboard

- [ ] **Vercel → Environment variables:** stessi nomi di [.env.example](../.env.example) necessari al runtime (`NEXT_PUBLIC_*`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_*`, `OUTBOX_CRON_SECRET` o `CRON_SECRET`, ecc.).
- [ ] **Supabase → Authentication → URL configuration:** Site URL e redirect consentiti puntano al dominio **produzione** (non `localhost`), in linea con `NEXT_PUBLIC_SITE_URL`.

## Worker e database

- [ ] **Cron worker:** in Vercel imposta `CRON_SECRET` (consigliato) oppure `OUTBOX_CRON_SECRET`; verifica in log che `GET /api/cron/outbox` risponda `200` e che in tabella `communication_outbox` gli `email` passino a `sent` (con `RESEND_API_KEY` valida).
- [ ] **Migrazioni:** l’istanza Postgres del progetto Supabase in produzione ha tutte le migrazioni applicate (`supabase db push` o pipeline equivalente).

## Verifiche automatiche (locale con env che punta al target)

Dopo aver configurato `.env.local` (o `DEPLOY_ENV_FILE`) verso l’istanza che vuoi validare:

```bash
npm run verify:release-stack
```

Equivale a `npm run verify:supabase` seguito da `npm run smoke:test`. Per controllo strict delle variabili tipo produzione: `npm run verify:deploy` (richiede HTTPS su `NEXT_PUBLIC_SITE_URL`, cron secret, Resend).

## Post-deploy e CI

- [ ] **Post-deploy manuale:** sito pubblico, `/events`, login magic link; staff su `/admin` e un evento; oppure di nuovo `verify:release-stack` con env di produzione.
- [ ] **CI:** workflow GitHub verde sulla branch principale; in locale `npm run ci` prima del push.
