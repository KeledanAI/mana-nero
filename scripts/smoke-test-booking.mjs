/**
 * Smoke test automatico: utente → book → cancel → book → promozione staff → check-in RPC.
 *
 * Richiede in .env.local: NEXT_PUBLIC_SUPABASE_URL, chiave anon/publishable, SUPABASE_SERVICE_ROLE_KEY.
 *
 * Opzionale: SMOKE_TEST_EMAIL + SMOKE_TEST_PASSWORD (account dedicato riusabile).
 * Se mancano, lo script crea un utente effimero (email random) e lo elimina a fine run.
 *
 * Uso: npm run smoke:test
 * Opzionale da terminale: SMOKE_TEST_EVENT_PAYMENTS=1 (anche senza riga in .env.local) per il ramo RPC pagamenti.
 */
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

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

function hintForPostgrestRpcError(message) {
  const msg = message ?? "";
  if (msg.includes("Could not find the function")) {
    return (
      `${msg}\n\nSuggerimento: le migrazioni SQL del repo potrebbero non essere ancora applicate al progetto Supabase usato in .env.local. ` +
      `Esegui \`supabase db push\` (o la pipeline equivalente), attendi il reload dello schema PostgREST, poi riesegui \`npm run smoke:test\`.`
    );
  }
  return msg;
}

function rpcError(label, err) {
  return new Error(hintForPostgrestRpcError(`${label}: ${err?.message ?? String(err)}`));
}

async function main() {
  const env = loadEnvLocal();
  // Consente `SMOKE_TEST_EVENT_PAYMENTS=1` da shell senza duplicare la riga in .env.local
  if (process.env.SMOKE_TEST_EVENT_PAYMENTS) {
    env.SMOKE_TEST_EVENT_PAYMENTS = process.env.SMOKE_TEST_EVENT_PAYMENTS;
  }
  const url = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey =
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    "";
  const serviceKey = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  let email = (env.SMOKE_TEST_EMAIL || "").trim();
  let password = (env.SMOKE_TEST_PASSWORD || "").trim();
  const ephemeral = !email || !password;
  if (ephemeral) {
    email = `smoke+${randomUUID().slice(0, 12)}@mana-nero-smoke.invalid`;
    password = `Tmp${randomUUID().slice(0, 8)}Aa9!`;
    console.log("Modalità effimera (nessun SMOKE_TEST_* in .env.local): creo ed elimino utente di test.");
  }

  if (!url || !anonKey) {
    throw new Error("Servono NEXT_PUBLIC_SUPABASE_URL e chiave anon/publishable in .env.local");
  }
  if (!serviceKey) {
    throw new Error("Serve SUPABASE_SERVICE_ROLE_KEY in .env.local per preparare l’evento e il ruolo staff.");
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("1) Assicuro utente di test…");
  let userId;

  if (ephemeral) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Smoke Test (effimero)" },
    });
    if (createErr || !created.user) {
      throw new Error(`Creazione utente effimero: ${createErr?.message ?? "unknown"}`);
    }
    userId = created.user.id;
    console.log("   Creato utente effimero:", userId);
  } else {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
    userId = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;

    if (!userId) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: "Smoke Test" },
      });
      if (createErr || !created.user) {
        throw new Error(`Creazione utente fallita: ${createErr?.message ?? "unknown"}`);
      }
      userId = created.user.id;
      console.log("   Creato nuovo utente:", userId);
    } else {
      const { error: pwdErr } = await admin.auth.admin.updateUserById(userId, { password });
      if (pwdErr) {
        throw new Error(`Aggiornamento password utente: ${pwdErr.message}`);
      }
      console.log("   Utente esistente:", userId);
    }
  }

  console.log("2) Assicuro evento published…");
  let eventId;
  const { data: existingEvents } = await admin
    .from("events")
    .select("id")
    .eq("status", "published")
    .limit(1);

  if (existingEvents?.length) {
    eventId = existingEvents[0].id;
    console.log("   Uso evento published:", eventId);
  } else {
    const slug = `smoke-${Date.now()}`;
    const startsAt = new Date(Date.now() + 7 * 86400000).toISOString();
    const { data: ins, error: insErr } = await admin
      .from("events")
      .insert({
        title: "Smoke test (auto)",
        slug,
        status: "published",
        starts_at: startsAt,
        capacity: 20,
        description: "Creato da scripts/smoke-test-booking.mjs",
      })
      .select("id")
      .single();
    if (insErr || !ins) {
      throw new Error(`Insert evento: ${insErr?.message ?? "unknown"}`);
    }
    eventId = ins.id;
    console.log("   Creato evento:", eventId, slug);
  }

  console.log("3) Pulizia registrazioni precedenti utente/evento…");
  await admin.from("event_registrations").delete().eq("event_id", eventId).eq("user_id", userId);

  console.log("4) Login utente (anon)…");
  const { data: signIn, error: signErr } = await userClient.auth.signInWithPassword({
    email,
    password,
  });
  if (signErr || !signIn.session) {
    throw new Error(`Login: ${signErr?.message ?? "no session"}`);
  }

  console.log("5) RPC book…");
  const { data: bookData, error: bookErr } = await userClient.rpc("event_registration_action", {
    p_operation: "book",
    p_event_id: eventId,
    p_registration_id: null,
    p_payment_intent_id: null,
  });
  if (bookErr) {
    throw rpcError("book", bookErr);
  }
  console.log("   →", bookData);

  console.log("6) RPC cancel…");
  const { data: cancelData, error: cancelErr } = await userClient.rpc("event_registration_action", {
    p_operation: "cancel",
    p_event_id: eventId,
    p_registration_id: null,
    p_payment_intent_id: null,
  });
  if (cancelErr) {
    throw rpcError("cancel", cancelErr);
  }
  console.log("   →", cancelData);

  console.log("7) RPC book di nuovo (per check-in)…");
  const { error: book2Err } = await userClient.rpc("event_registration_action", {
    p_operation: "book",
    p_event_id: eventId,
    p_registration_id: null,
    p_payment_intent_id: null,
  });
  if (book2Err) {
    throw rpcError("book2", book2Err);
  }

  const { data: regRow, error: regErr } = await userClient
    .from("event_registrations")
    .select("id, status")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .in("status", ["confirmed", "waitlisted"])
    .maybeSingle();

  if (regErr || !regRow) {
    throw new Error(`Lettura registration: ${regErr?.message ?? "not found"}`);
  }
  console.log("   Registration:", regRow.id, regRow.status);

  console.log("8) Promuovo profilo a staff (service role)…");
  const { error: roleErr } = await admin
    .from("profiles")
    .update({ role: "staff", updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (roleErr) {
    throw new Error(`Update role staff: ${roleErr.message}`);
  }

  console.log("9) RPC staff_check_in (stessa sessione JWT)…");
  const { data: checkData, error: checkErr } = await userClient.rpc("event_registration_action", {
    p_operation: "staff_check_in",
    p_event_id: null,
    p_registration_id: regRow.id,
    p_payment_intent_id: null,
  });
  if (checkErr) {
    throw rpcError("staff_check_in", checkErr);
  }
  console.log("   →", checkData);

  const { data: finalReg, error: finErr } = await admin
    .from("event_registrations")
    .select("status")
    .eq("id", regRow.id)
    .single();
  if (finErr || finalReg?.status !== "checked_in") {
    throw new Error(
      `Stato finale atteso checked_in, ottenuto: ${finalReg?.status ?? finErr?.message}`,
    );
  }

  console.log("10) Verifica dati export CSV (stesse colonne della route admin)…");
  const { data: csvRows, error: csvErr } = await admin
    .from("event_registrations")
    .select("id, user_id, status, waitlist_position")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (csvErr) {
    throw new Error(`Query export-style: ${csvErr.message}`);
  }
  const checked = csvRows?.filter((r) => r.status === "checked_in").length ?? 0;
  console.log("   Righe evento:", csvRows?.length ?? 0, "| checked_in:", checked);

  console.log("11) Ripristino ruolo customer sul profilo di test…");
  await admin
    .from("profiles")
    .update({ role: "customer", updated_at: new Date().toISOString() })
    .eq("id", userId);

  if ((env.SMOKE_TEST_EVENT_PAYMENTS || "").trim() === "1") {
    console.log("11b) Opzionale: evento a deposito → pending_payment → confirm_payment (service_role)…");
    const paidSlug = `smoke-pay-${Date.now()}`;
    const paidStarts = new Date(Date.now() + 9 * 86400000).toISOString();
    const { data: paidEvt, error: paidInsErr } = await admin
      .from("events")
      .insert({
        title: "Smoke paid (auto)",
        slug: paidSlug,
        status: "published",
        starts_at: paidStarts,
        capacity: 15,
        deposit_cents: 100,
        price_cents: null,
        currency: "eur",
        description: "Creato da smoke per pagamenti RPC",
      })
      .select("id")
      .single();
    if (paidInsErr || !paidEvt) {
      throw new Error(`Insert evento pagato: ${paidInsErr?.message ?? "unknown"}`);
    }
    await admin.from("event_registrations").delete().eq("event_id", paidEvt.id).eq("user_id", userId);

    const { data: bookPay, error: bookPayErr } = await userClient.rpc("event_registration_action", {
      p_operation: "book",
      p_event_id: paidEvt.id,
      p_registration_id: null,
      p_payment_intent_id: null,
    });
    if (bookPayErr) {
      throw rpcError("book paid event", bookPayErr);
    }
    if (bookPay?.status !== "pending_payment") {
      throw new Error(`Atteso pending_payment, ottenuto: ${JSON.stringify(bookPay)}`);
    }

    const { data: payReg, error: payRegErr } = await admin
      .from("event_registrations")
      .select("id")
      .eq("event_id", paidEvt.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (payRegErr || !payReg) {
      throw new Error(`Lettura registration pending: ${payRegErr?.message ?? "not found"}`);
    }

    const { data: confData, error: confErr } = await admin.rpc("event_registration_action", {
      p_operation: "confirm_payment",
      p_event_id: null,
      p_registration_id: payReg.id,
      p_payment_intent_id: "pi_smoke_test",
    });
    if (confErr) {
      throw rpcError("confirm_payment", confErr);
    }
    if (confData?.status !== "confirmed") {
      throw new Error(`Atteso confirmed dopo pagamento, ottenuto: ${JSON.stringify(confData)}`);
    }

    const { error: delPaidErr } = await admin.from("events").delete().eq("id", paidEvt.id);
    if (delPaidErr) {
      console.warn("   (warn) eliminazione evento smoke paid:", delPaidErr.message);
    }
    console.log("   → OK pagamenti RPC");
  }

  if (ephemeral) {
    console.log("12) Elimino utente effimero (cascade su registrations/profile)…");
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      throw new Error(`Eliminazione utente effimero: ${delErr.message}`);
    }
  }

  console.log("\nOK: smoke test prenotazione + check-in completato.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
