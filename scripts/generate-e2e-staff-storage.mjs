/**
 * Genera `e2e/auth-staff.json` (Playwright storageState) per account con password,
 * promuovendo il profilo a `staff` via service_role.
 *
 * Credenziali (in ordine di priorità):
 *   1) E2E_STAFF_EMAIL + E2E_STAFF_PASSWORD
 *   2) SMOKE_TEST_EMAIL + SMOKE_TEST_PASSWORD
 *   3) E2E_STAFF_AUTO_SEED=1 (una tantum): crea utente `e2e-staff+*@mana-nero-e2e.invalid` con password casuale,
 *      ruolo staff, scrive solo `e2e/auth-staff.json` (nessuna riga da aggiungere in .env.local).
 *
 * Richiede in .env.local: NEXT_PUBLIC_SUPABASE_URL, chiave anon/publishable, SUPABASE_SERVICE_ROLE_KEY.
 *
 * Uso: node scripts/generate-e2e-staff-storage.mjs
 *      E2E_STAFF_AUTO_SEED=1 node scripts/generate-e2e-staff-storage.mjs
 * Poi: E2E_STAFF_STORAGE_STATE=e2e/auth-staff.json npx playwright test e2e/admin-staff-routes.spec.ts
 * (con `npm run dev` attivo su PLAYWRIGHT_BASE_URL, default http://localhost:3000)
 */
import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) {
    throw new Error("Manca .env.local nella root del progetto.");
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

function supabaseProjectRefFromUrl(urlRaw) {
  const u = String(urlRaw || "").trim().replace(/\/$/, "");
  const m = u.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m ? m[1] : null;
}

function cookieDomainForPlaywright(baseUrl) {
  try {
    return new URL(baseUrl).hostname || "localhost";
  } catch {
    return "localhost";
  }
}

async function main() {
  const env = loadEnvLocal();
  const url = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey =
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    "";
  const serviceKey = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  const autoSeed =
    process.env.E2E_STAFF_AUTO_SEED === "1" ||
    String(process.env.E2E_STAFF_AUTO_SEED || "").toLowerCase() === "true";

  let email = (env.E2E_STAFF_EMAIL || env.SMOKE_TEST_EMAIL || "").trim();
  let password = (env.E2E_STAFF_PASSWORD || env.SMOKE_TEST_PASSWORD || "").trim();

  if (autoSeed) {
    const tag = randomUUID().replace(/-/g, "").slice(0, 12);
    email = `e2e-staff+${tag}@mana-nero-e2e.invalid`;
    password = `E2e${randomUUID().slice(0, 10)}Aa9!`;
    console.log("Modalità E2E_STAFF_AUTO_SEED: creo utente effimero staff-only per Playwright.");
  }

  if (!url || !anonKey) {
    throw new Error("Servono NEXT_PUBLIC_SUPABASE_URL e chiave anon/publishable in .env.local");
  }
  if (!serviceKey) {
    throw new Error("Serve SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }
  if (!email || !password) {
    throw new Error(
      "Imposta E2E_STAFF_EMAIL + E2E_STAFF_PASSWORD, oppure SMOKE_TEST_* con password, oppure esegui con E2E_STAFF_AUTO_SEED=1.",
    );
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
  let userId = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;

  if (!userId) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: autoSeed ? "E2E staff (auto-seed)" : "E2E staff seed" },
    });
    if (createErr || !created.user) {
      throw new Error(`Creazione utente: ${createErr?.message ?? "unknown"}`);
    }
    userId = created.user.id;
    console.log("Creato utente Auth:", userId);
  } else if (!autoSeed) {
    const { error: pwdErr } = await admin.auth.admin.updateUserById(userId, { password });
    if (pwdErr) {
      throw new Error(`Aggiornamento password: ${pwdErr.message}`);
    }
    console.log("Utente Auth esistente:", userId);
  } else {
    console.log("Utente Auth esistente (auto-seed, password già nota solo a questa esecuzione):", userId);
  }

  const { data: profRow, error: selErr } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (selErr) {
    throw new Error(`Lettura profilo: ${selErr.message}`);
  }
  if (!profRow) {
    const { error: insErr } = await admin.from("profiles").insert({
      id: userId,
      email,
      full_name: "E2E staff seed",
    });
    if (insErr) {
      throw new Error(`Insert profilo: ${insErr.message}`);
    }
  }
  const { error: roleErr } = await admin.from("profiles").update({ role: "staff" }).eq("id", userId);
  if (roleErr) {
    throw new Error(`Aggiornamento ruolo: ${roleErr.message}`);
  }
  console.log("Ruolo profilo impostato su staff.");

  const jar = [];
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return jar.map(({ name, value }) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          const idx = jar.findIndex((c) => c.name === name);
          if (value == null || value === "") {
            if (idx >= 0) jar.splice(idx, 1);
            continue;
          }
          if (idx >= 0) jar[idx] = { name, value };
          else jar.push({ name, value });
        }
      },
    },
  });

  const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
  if (signErr) {
    throw new Error(`Login: ${signErr.message}`);
  }

  if (jar.length === 0) {
    throw new Error("Nessun cookie di sessione catturato dopo signInWithPassword.");
  }

  const baseUrl = (process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  const domain = cookieDomainForPlaywright(baseUrl);
  const ref = supabaseProjectRefFromUrl(url);
  console.log("Cookie names:", jar.map((c) => c.name).join(", "));
  if (ref) {
    console.log("Project ref (URL):", ref);
  }

  const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 14;
  const storageState = {
    cookies: jar.map(({ name, value }) => ({
      name,
      value,
      domain,
      path: "/",
      expires,
      httpOnly: true,
      secure: baseUrl.startsWith("https:"),
      sameSite: "Lax",
    })),
    origins: [],
  };

  const outPath = resolve(process.cwd(), "e2e", "auth-staff.json");
  writeFileSync(outPath, JSON.stringify(storageState, null, 2), "utf8");
  console.log("Scritto:", outPath);
  console.log("Prossimo passo (con dev server attivo su " + baseUrl + "):");
  console.log(
    "  set E2E_STAFF_STORAGE_STATE=e2e/auth-staff.json && npx playwright test e2e/admin-staff-routes.spec.ts",
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
