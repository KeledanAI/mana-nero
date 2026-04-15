/**
 * Verifica che le variabili Supabase siano disponibili (.env.local e/o process.env)
 * e che l'API REST risponda (tabella `events` presente = migrazioni applicate in linea di massima).
 *
 * Uso: dalla root del repo
 *   node scripts/check-supabase-env.mjs
 */
import https from "node:https";
import { URL } from "node:url";

import { loadSupabaseEnv } from "./load-supabase-env.mjs";

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

async function main() {
  const env = loadSupabaseEnv();
  const url = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key =
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    "";

  if (!url || !key) {
    console.error(
      "Configura NEXT_PUBLIC_SUPABASE_URL e una chiave publishable/anon in .env.local o nelle variabili d'ambiente.",
    );
    throw new Error("missing Supabase URL or anon key");
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
