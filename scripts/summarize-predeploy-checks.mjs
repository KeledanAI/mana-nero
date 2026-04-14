/**
 * Esegue in sequenza i gate automatizzabili allineati al ROADMAP §218–229 e alla checklist operatore.
 *
 * 1. `verify:release-stack` — deve passare (Supabase + smoke RPC sul progetto puntato da .env.local).
 * 2. `verify:deploy` — strict produzione; se fallisce (es. localhost o manca CRON_SECRET), stampa promemoria
 *    voci manuali (Vercel log 200, Auth URL, Stripe) senza far fallire lo script (exit 0).
 *
 * Uso: npm run verify:predeploy
 */
import { execSync } from "node:child_process";

const cwd = process.cwd();

console.log("=== 1/2 verify:release-stack (REST + smoke RPC) ===\n");
try {
  execSync("npm run verify:release-stack", { stdio: "inherit", cwd });
} catch {
  console.error("\nverify:predeploy: verify:release-stack fallito. Controlla .env.local e il progetto Supabase.");
  process.exit(1);
}

console.log("\n=== 2/2 verify:deploy (--production, mirror Vercel) ===\n");
try {
  execSync("npm run verify:deploy", { stdio: "inherit", cwd });
  console.log(
    "\nOK: anche verify:deploy (strict) è passato — env locale coerente con produzione.",
  );
} catch {
  console.log(
    "\nNota: verify:deploy non superato (normale in dev: NEXT_PUBLIC_SITE_URL su localhost, " +
      "manca CRON_SECRET, ecc.). Completare a mano: Vercel env, log 200 sulle route cron (incl. product-stock-notifications), " +
      "Supabase Auth URL, Stripe se usi pagamenti — vedi docs/deploy-operator-checklist.md.",
  );
}

console.log(
  "\nCron: comandi curl/iwr con `npm run verify:cron-hints` (CRON_VERIFY_SITE_URL + CRON_SECRET consigliati).",
);
process.exit(0);
