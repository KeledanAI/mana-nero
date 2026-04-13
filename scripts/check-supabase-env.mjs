/**
 * Verifica che .env.local contenga le variabili Supabase e che l'API REST risponda
 * (tabella `events` presente = migrazioni applicate in linea di massima).
 *
 * Uso: dalla root del repo
 *   node scripts/check-supabase-env.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import https from "node:https";
import { resolve } from "node:path";
import { URL } from "node:url";

function httpsGetJson(urlString, headers) {
  return new Promise((resolvePromise, rejectPromise) => {
    const u = new URL(urlString);
    const req = https.request(
      {
        hostname: u.hostname,
        path: `${u.pathname}${u.search}`,
        method: "GET",
        headers,
      },
      (res) => {
        res.resume();
        res.on("end", () => {
          resolvePromise(res.statusCode ?? 0);
        });
      },
    );
    req.on("error", rejectPromise);
    req.end();
  });
}

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) {
    console.error("Manca .env.local nella root del progetto.");
    throw new Error("missing .env.local");
  }
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
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

async function main() {
  const env = loadEnvLocal();
  const url = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key =
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    "";

  if (!url || !key) {
    console.error(
      "Configura NEXT_PUBLIC_SUPABASE_URL e una chiave publishable/anon in .env.local",
    );
    throw new Error("missing Supabase URL or anon key in .env.local");
  }

  const rest = `${url}/rest/v1/events?select=id&limit=1`;
  const statusCode = await httpsGetJson(rest, {
    apikey: key,
    Authorization: `Bearer ${key}`,
  });

  if (statusCode < 200 || statusCode >= 300) {
    console.error(`REST /events non OK (${statusCode}).`);
    console.error(
      "\nSe vedi errore sulla relazione events: applica le migrazioni in supabase/migrations/ (Supabase CLI db push o SQL editor).",
    );
    throw new Error(`REST /events failed: ${statusCode}`);
  }

  console.log("OK: Supabase raggiungibile e tabella events risponde.");
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
