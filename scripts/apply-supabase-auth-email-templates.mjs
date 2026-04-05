/**
 * Applies Italian, Mana Nero–branded Supabase Auth email templates via Management API.
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_ACCESS_TOKEN  (account PAT: dashboard → account → access tokens)
 *
 * Run: node scripts/apply-supabase-auth-email-templates.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadEnvLocal() {
  const p = path.join(root, ".env.local");
  const env = {};
  if (!fs.existsSync(p)) return env;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return env;
}

const supportLine =
  "Assistenza: mananerofumetteria@gmail.com · Tel. 0331 171 2653";

const baseCard = /* html */ `
<div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;line-height:1.65;color:#e5e5e5;background:#141414;padding:32px 24px;max-width:540px;margin:0 auto;">
<p style="margin:0 0 6px;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#a3a3a3;">Mana Nero</p>
<p style="margin:0 0 24px;font-size:13px;color:#737373;">Fumetteria · eventi · community</p>
{{INNER}}
<p style="margin:28px 0 0;padding-top:20px;border-top:1px solid #2a2a2a;font-size:11px;color:#525252;line-height:1.5;">
${supportLine}<br/>
Se non hai richiesto questa email, ignora questo messaggio.
</p>
</div>
`;

function card(innerHtml) {
  return baseCard.replace(
    "{{INNER}}",
    innerHtml.trim().replace(/\n\s+/g, "\n"),
  );
}

const cta = (hrefExpr, label) => /* html */ `
<p style="margin:0 0 8px;">
  <a href="${hrefExpr}" style="display:inline-block;background:#fafafa;color:#141414;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px;">${label}</a>
</p>
`;

const securityCard = (innerHtml) =>
  card(`
<h1 style="margin:0 0 12px;font-size:19px;font-weight:600;color:#fafafa;">Avviso di sicurezza</h1>
${innerHtml.trim()}
<p style="margin:18px 0 0;font-size:13px;color:#d4d4d4;">Se non riconosci questa attività, contattaci subito.</p>
  `);

const patchBody = {
  /* Auth flows */
  mailer_subjects_confirmation: "Conferma la registrazione — Mana Nero",
  mailer_templates_confirmation_content: card(`
<h1 style="margin:0 0 12px;font-size:21px;font-weight:600;color:#fafafa;">Conferma il tuo account</h1>
<p style="margin:0 0 18px;color:#d4d4d4;">Grazie per esserti registrato. Conferma l'indirizzo email per attivare il profilo su Mana Nero.</p>
${cta("{{ .ConfirmationURL }}", "Conferma email")}
<p style="margin:16px 0 0;font-size:13px;color:#737373;">Codice alternativo: <strong style="color:#fafafa;">{{ .Token }}</strong></p>
  `),

  mailer_subjects_magic_link: "Il tuo link per accedere — Mana Nero",
  mailer_templates_magic_link_content: card(`
<h1 style="margin:0 0 12px;font-size:21px;font-weight:600;color:#fafafa;">Accedi a Mana Nero</h1>
<p style="margin:0 0 18px;color:#d4d4d4;">Usa il pulsante per entrare senza password. Il link scade automaticamente, per sicurezza.</p>
${cta("{{ .ConfirmationURL }}", "Accedi ora")}
<p style="margin:16px 0 0;font-size:13px;color:#737373;">Codice alternativo: <strong style="color:#fafafa;">{{ .Token }}</strong></p>
  `),

  mailer_subjects_recovery: "Reimposta l'accesso — Mana Nero",
  mailer_templates_recovery_content: card(`
<h1 style="margin:0 0 12px;font-size:21px;font-weight:600;color:#fafafa;">Reimposta password</h1>
<p style="margin:0 0 18px;color:#d4d4d4;">Hai chiesto di reimpostare la password per l'account collegato a questo indirizzo email.</p>
${cta("{{ .ConfirmationURL }}", "Imposta una nuova password")}
<p style="margin:16px 0 0;font-size:13px;color:#737373;">Se non sei stato tu, puoi ignorare questa email.</p>
  `),

  mailer_subjects_invite: "Invito su Mana Nero",
  mailer_templates_invite_content: card(`
<h1 style="margin:0 0 12px;font-size:21px;font-weight:600;color:#fafafa;">Sei invitato</h1>
<p style="margin:0 0 18px;color:#d4d4d4;">Hai ricevuto un invito a creare l'account Mana Nero ({{ .SiteURL }}).</p>
${cta("{{ .ConfirmationURL }}", "Accetta l'invito")}
  `),

  mailer_subjects_reauthentication: "Conferma l'operazione — Mana Nero",
  mailer_templates_reauthentication_content: card(`
<h1 style="margin:0 0 12px;font-size:21px;font-weight:600;color:#fafafa;">Verifica la richiesta</h1>
<p style="margin:0 0 18px;color:#d4d4d4;">Per completare un'operazione sensibile, inserisci questo codice nel sito quando richiesto.</p>
<p style="margin:0 0 8px;font-size:28px;font-weight:700;letter-spacing:0.14em;color:#fafafa;">{{ .Token }}</p>
<p style="margin:0;font-size:13px;color:#737373;">Non condividere questo codice.</p>
  `),

  mailer_subjects_email_change: "Conferma il nuovo indirizzo email — Mana Nero",
  mailer_templates_email_change_content: card(`
<h1 style="margin:0 0 12px;font-size:21px;font-weight:600;color:#fafafa;">Conferma il nuovo indirizzo</h1>
<p style="margin:0 0 18px;color:#d4d4d4;">È in corso la modifica dell'email del tuo account. Conferma il nuovo indirizzo <strong style="color:#fafafa;">{{ .NewEmail }}</strong> con il pulsante qui sotto.</p>
${cta("{{ .ConfirmationURL }}", "Conferma nuova email")}
  `),

  /* Security notifications (copy stays enabled as already set on project) */
  mailer_subjects_password_changed_notification:
    "La password è stata modificata — Mana Nero",
  mailer_templates_password_changed_notification_content: securityCard(`
<p style="margin:0;color:#d4d4d4;">La password per l'account <strong style="color:#fafafa;">{{ .Email }}</strong> è stata appena aggiornata.</p>
  `),

  mailer_subjects_email_changed_notification:
    "L'indirizzo email è stato aggiornato — Mana Nero",
  mailer_templates_email_changed_notification_content: securityCard(`
<p style="margin:0;color:#d4d4d4;">L'email del tuo account è stata cambiata da <strong style="color:#fafafa;">{{ .OldEmail }}</strong> a <strong style="color:#fafafa;">{{ .Email }}</strong>.</p>
  `),

  mailer_subjects_phone_changed_notification:
    "Il numero di telefono è stato aggiornato — Mana Nero",
  mailer_templates_phone_changed_notification_content: securityCard(`
<p style="margin:0;color:#d4d4d4;">Per l'account <strong style="color:#fafafa;">{{ .Email }}</strong> il numero è stato aggiornato da {{ .OldPhone }} a <strong style="color:#fafafa;">{{ .Phone }}</strong>.</p>
  `),

  mailer_subjects_mfa_factor_enrolled_notification:
    "Nuovo metodo di verifica aggiunto — Mana Nero",
  mailer_templates_mfa_factor_enrolled_notification_content: securityCard(`
<p style="margin:0;color:#d4d4d4;">È stato registrato un nuovo metodo ({{ .FactorType }}) per l'account <strong style="color:#fafafa;">{{ .Email }}</strong>.</p>
  `),

  mailer_subjects_mfa_factor_unenrolled_notification:
    "Metodo di verifica rimosso — Mana Nero",
  mailer_templates_mfa_factor_unenrolled_notification_content: securityCard(`
<p style="margin:0;color:#d4d4d4;">È stato rimosso un metodo ({{ .FactorType }}) dall'account <strong style="color:#fafafa;">{{ .Email }}</strong>.</p>
  `),

  mailer_subjects_identity_linked_notification:
    "Nuovo accesso collegato — Mana Nero",
  mailer_templates_identity_linked_notification_content: securityCard(`
<p style="margin:0;color:#d4d4d4;">È stato collegato un accesso tramite <strong style="color:#fafafa;">{{ .Provider }}</strong> al tuo account <strong style="color:#fafafa;">{{ .Email }}</strong>.</p>
  `),

  mailer_subjects_identity_unlinked_notification:
    "Accesso scollegato — Mana Nero",
  mailer_templates_identity_unlinked_notification_content: securityCard(`
<p style="margin:0;color:#d4d4d4;">L'accesso tramite <strong style="color:#fafafa;">{{ .Provider }}</strong> è stato scollegato dall'account <strong style="color:#fafafa;">{{ .Email }}</strong>.</p>
  `),
};

async function main() {
  const env = { ...process.env, ...loadEnvLocal() };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const token = env.SUPABASE_ACCESS_TOKEN;
  if (!url || !token) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_ACCESS_TOKEN");
    process.exit(1);
  }
  const m = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
  if (!m) {
    console.error("Could not parse project ref from NEXT_PUBLIC_SUPABASE_URL");
    process.exit(1);
  }
  const projectRef = m[1];
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patchBody),
    },
  );
  const text = await res.text();
  if (!res.ok) {
    console.error(res.status, text.slice(0, 2000));
    process.exit(1);
  }
  console.log("OK: email templates and subjects updated (", res.status, ")");
}

main();
