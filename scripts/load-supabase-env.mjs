/**
 * Carica variabili Supabase da `.env.local` se presente, con **overlay** da `process.env`
 * (per GitHub Actions: secret `STAGING_*` mappati nel job senza file locale).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const OVERLAY_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SMOKE_TEST_EMAIL",
  "SMOKE_TEST_PASSWORD",
  "SMOKE_TEST_EVENT_PAYMENTS",
];

function parseEnvFile(filePath) {
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

/**
 * @returns {Record<string, string>}
 */
export function loadSupabaseEnv() {
  const path = resolve(process.cwd(), ".env.local");
  let env = {};
  if (existsSync(path)) {
    env = parseEnvFile(path);
  }
  for (const k of OVERLAY_KEYS) {
    const v = process.env[k];
    if (v != null && String(v).trim() !== "") {
      env[k] = String(v).trim();
    }
  }
  if (!(env.NEXT_PUBLIC_SUPABASE_URL || "").trim()) {
    throw new Error(
      "Manca NEXT_PUBLIC_SUPABASE_URL: crea .env.local nella root del repo oppure imposta le variabili d'ambiente (es. job GitHub Actions con secret staging).",
    );
  }
  return env;
}
