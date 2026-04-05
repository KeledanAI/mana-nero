/**
 * Loads .env.local, then sends a branded test message via Resend.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.json scripts/send-test-email.ts [email]
 *
 * Or: npm run email:test -- you@example.com
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sendManaNeroEmail } from "../lib/email/send-transactional";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadEnvLocal() {
  const p = path.join(root, ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadEnvLocal();
  const to =
    process.argv[2]?.trim() || "roberto.buonanno@gmail.com";

  const { id } = await sendManaNeroEmail({
    to,
    subject: "[Mana Nero] Prova modulo email",
    sections: [
      {
        title: "Modulo transazionale attivo",
        bodyHtml: `
<p style="margin:0 0 12px;">Ciao Roberto,</p>
<p style="margin:0 0 12px;">questa è una prova inviata dal <strong>modulo email comune</strong> del sito (layout Mana Nero + Resend).</p>
<p style="margin:0;font-size:13px;color:#a3a3a3;">Se la ricevi correttamente, mittente e template sono ok.</p>
        `.trim(),
      },
    ],
  });

  console.log("Sent OK, Resend id:", id);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
