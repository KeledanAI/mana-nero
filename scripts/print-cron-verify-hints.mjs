/**
 * Stampa comandi curl / PowerShell per verificare le route cron GET (stesso Bearer di Vercel Cron).
 *
 * Priorità host (primo valorizzato vince):
 *   1. process.env.CRON_VERIFY_SITE_URL
 *   2. process.env.NEXT_PUBLIC_SITE_URL
 *   3. file env: CRON_VERIFY_SITE_URL (consigliato se in dev `NEXT_PUBLIC_SITE_URL` è localhost)
 *   4. file env: NEXT_PUBLIC_SITE_URL
 *
 * Secret: CRON_SECRET o OUTBOX_CRON_SECRET (stesso ordine da process.env poi file).
 *
 * File: `.env.local` se esiste, altrimenti `{}`; path alternativo: `DEPLOY_ENV_FILE`.
 *
 * Uso: npm run verify:cron-hints
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function parseEnvLines(text) {
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function loadEnvMerged() {
  const envPath = resolve(
    process.cwd(),
    process.env.DEPLOY_ENV_FILE || ".env.local",
  );
  const fromFile = existsSync(envPath)
    ? parseEnvLines(readFileSync(envPath, "utf8"))
    : {};

  const keys = [
    "CRON_VERIFY_SITE_URL",
    "NEXT_PUBLIC_SITE_URL",
    "CRON_SECRET",
    "OUTBOX_CRON_SECRET",
  ];
  const merged = { ...fromFile };
  for (const k of keys) {
    const v = process.env[k];
    if (v != null && String(v).trim() !== "") {
      merged[k] = v;
    }
  }
  return { merged, envPath, hadFile: existsSync(envPath) };
}

function resolveBase(env) {
  return (env.CRON_VERIFY_SITE_URL || env.NEXT_PUBLIC_SITE_URL || "")
    .trim()
    .replace(/\/$/, "");
}

function main() {
  const { merged: env, envPath, hadFile } = loadEnvMerged();
  const base = resolveBase(env);
  const secret =
    (env.CRON_SECRET || "").trim() || (env.OUTBOX_CRON_SECRET || "").trim();

  if (!base) {
    console.error(
      "Serve un URL senza slash finale per le route cron, ad esempio:\n" +
        "  • variabile in file env: CRON_VERIFY_SITE_URL=https://tuo-dominio.it (consigliata: non sovrascrive localhost in dev)\n" +
        "  • oppure NEXT_PUBLIC_SITE_URL verso produzione/preview\n" +
        "  • oppure da shell (PowerShell): $env:CRON_VERIFY_SITE_URL=\"https://tuo-dominio.it\"; npm run verify:cron-hints\n",
    );
    if (!hadFile) {
      console.error(
        `Nessun file trovato in ${envPath} (opzionale se imposti le variabili da shell).`,
      );
    }
    process.exit(1);
  }

  if (!hadFile) {
    console.log(`(Nessun file ${envPath}; solo variabili d'ambiente del processo.)\n`);
  }

  const paths = [
    "/api/cron/outbox",
    "/api/cron/event-reminders",
    "/api/cron/expire-pending-event-payments",
    "/api/cron/product-stock-notifications",
  ];

  console.log(
    "Atteso: HTTP 200 (401 = secret errato; 503 = secret non configurato sul server).\n",
  );

  console.log("URL da controllare nei log Vercel (GET):");
  for (const p of paths) {
    console.log(`  ${base}${p}`);
  }
  console.log("");

  const placeholder = "YOUR_CRON_SECRET";
  if (!secret) {
    console.log(
      "(CRON_SECRET / OUTBOX_CRON_SECRET assenti: comandi sotto con placeholder; copia il valore da Vercel → Environment Variables o esporta $env:CRON_SECRET prima del comando.)\n",
    );
  }

  console.log("# Bash / Git Bash / WSL — esporta il secret poi curl (codice HTTP in coda):");
  if (secret) {
    console.log(`export CRON_SECRET=${JSON.stringify(secret)}`);
  } else {
    console.log(`export CRON_SECRET="${placeholder}"`);
  }
  for (const p of paths) {
    const url = `${base}${p}`;
    console.log(
      `curl -sS -o /dev/null -w "%{http_code}\\n" -H "Authorization: Bearer $CRON_SECRET" "${url}"`,
    );
  }
  console.log("");
  console.log("# PowerShell:");
  if (secret) {
    console.log(`$env:CRON_SECRET = ${JSON.stringify(secret)}`);
  } else {
    console.log(`$env:CRON_SECRET = "${placeholder}"`);
  }
  for (const p of paths) {
    const url = `${base}${p}`;
    console.log(
      `Invoke-WebRequest -Uri "${url}" -Headers @{ Authorization = "Bearer $env:CRON_SECRET" } -UseBasicParsing | Select-Object -ExpandProperty StatusCode`,
    );
  }
  console.log("");

  console.log(
    "Stripe (se Checkout eventi): POST /api/webhooks/stripe + STRIPE_WEBHOOK_SECRET in Vercel; vedi docs/deploy-production-runbook.md sezione 4d.",
  );
}

main();
