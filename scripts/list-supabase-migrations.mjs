/**
 * Elenca i file SQL in supabase/migrations/ (ordine alfabetico = ordine di applicazione tipico).
 * Non modifica il database: ricorda all'operatore di eseguire `supabase db push` sul progetto remoto.
 *
 * Uso: npm run verify:migrations
 */
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "supabase", "migrations");
if (!existsSync(dir)) {
  console.error("Cartella supabase/migrations non trovata.");
  process.exit(1);
}

const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
console.log("Migrazioni SQL locali (applica in ordine al progetto Supabase remoto):\n");
for (const f of files) {
  console.log(`  ${f}`);
}
console.log(
  "\n→ Applica al remoto: supabase link --project-ref <ref> && supabase db push",
);
console.log("→ Poi: npm run verify:after-migrations");
console.log(
  "  (equivale a verify:supabase + smoke:test; opz. SMOKE_TEST_EVENT_PAYMENTS=1 per ramo pagamenti RPC senza carta)",
);
console.log("→ Checklist deploy automatizzabile: npm run verify:predeploy\n");
process.exit(0);
