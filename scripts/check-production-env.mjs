/**
 * Verifica che le variabili necessarie al go-live siano presenti in un file env locale
 * (tipicamente mirror delle variabili impostate su Vercel Production).
 *
 * Uso:
 *   node scripts/check-production-env.mjs              # controlli base + avvisi
 *   node scripts/check-production-env.mjs --production  # strict: dominio non-localhost, cron secret, ecc.
 *
 * File env: `.env.local` oppure percorso in DEPLOY_ENV_FILE.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    console.error(`File env non trovato: ${filePath}`);
    process.exit(1);
  }
  const env = {};
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
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

function isPlaceholder(v) {
  if (!v || !String(v).trim()) return true;
  const s = String(v).toLowerCase();
  return (
    s === "your-project-url" ||
    s.startsWith("your-publishable") ||
    s.startsWith("your-anon") ||
    s === "your-service-role" ||
    s.includes("placeholder")
  );
}

function main() {
  const strict = process.argv.includes("--production");
  const envPath = resolve(
    process.cwd(),
    process.env.DEPLOY_ENV_FILE || ".env.local",
  );
  const env = loadEnvFile(envPath);

  const url = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const publishable =
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    "";
  const siteUrl = (env.NEXT_PUBLIC_SITE_URL || "").trim();
  const serviceRole = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const cronSecret =
    (env.CRON_SECRET || "").trim() || (env.OUTBOX_CRON_SECRET || "").trim();
  const resend = (env.RESEND_API_KEY || "").trim();

  const errors = [];

  if (!url || isPlaceholder(url)) {
    errors.push("NEXT_PUBLIC_SUPABASE_URL mancante o placeholder.");
  }
  if (!publishable || isPlaceholder(publishable)) {
    errors.push(
      "Serve NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY o NEXT_PUBLIC_SUPABASE_ANON_KEY (valore reale).",
    );
  }
  if (!siteUrl) {
    errors.push("NEXT_PUBLIC_SITE_URL obbligatorio per redirect email/auth coerenti.");
  }
  if (!serviceRole || isPlaceholder(serviceRole)) {
    errors.push("SUPABASE_SERVICE_ROLE_KEY obbligatorio per outbox e operazioni server.");
  }

  if (strict) {
    const lower = siteUrl.toLowerCase();
    if (
      !siteUrl.startsWith("https://") ||
      lower.includes("localhost") ||
      lower.includes("127.0.0.1")
    ) {
      errors.push(
        "[--production] NEXT_PUBLIC_SITE_URL deve essere HTTPS su dominio pubblico (non localhost).",
      );
    }
    if (!cronSecret) {
      errors.push(
        "[--production] Imposta CRON_SECRET o OUTBOX_CRON_SECRET per il worker /api/cron/outbox.",
      );
    }
    if (!resend) {
      errors.push(
        "[--production] RESEND_API_KEY richiesta se in produzione devi inviare email dall’outbox.",
      );
    }
  } else {
    if (!cronSecret) {
      console.warn(
        "⚠ CRON_SECRET e OUTBOX_CRON_SECRET assenti: il cron Vercel riceverà 503 finché non ne configuri uno.",
      );
    }
    if (!resend) {
      console.warn(
        "⚠ RESEND_API_KEY assente: le email in outbox non partiranno.",
      );
    }
    const lower = siteUrl.toLowerCase();
    if (siteUrl && (lower.includes("localhost") || lower.includes("127.0.0.1"))) {
      console.warn(
        "⚠ NEXT_PUBLIC_SITE_URL punta a localhost: ok per dev, non per produzione (allinea Supabase Site URL).",
      );
    }
  }

  if (errors.length) {
    console.error("Verifica deploy fallita:\n", errors.map((e) => `  - ${e}`).join("\n"));
    process.exit(1);
  }

  console.log(
    strict
      ? "OK: variabili coerenti con un deploy production (--production)."
      : "OK: variabili minime presenti. Per controllo strict: node scripts/check-production-env.mjs --production",
  );
}

main();
