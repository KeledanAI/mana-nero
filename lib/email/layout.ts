import {
  manaNeroSupportLine,
  manaNeroTagline,
} from "@/lib/email/constants";

export type ManaNeroEmailSection = {
  /** Escaped in output. Omit for no heading. */
  title?: string;
  /** Trusted HTML from server code only (paragraphs, links, lists). */
  bodyHtml: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Full-width HTML fragment for Resend / mail clients (inline styles).
 */
export function buildManaNeroEmailHtml(sections: ManaNeroEmailSection[]): string {
  const blocks = sections
    .map((s) => {
      const heading = s.title
        ? `<h1 style="margin:0 0 12px;font-size:21px;font-weight:600;color:#fafafa;">${escapeHtml(s.title)}</h1>`
        : "";
      return `${heading}<div style="margin:0 0 22px;color:#d4d4d4;">${s.bodyHtml}</div>`;
    })
    .join("");

  return `
<div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;line-height:1.65;color:#e5e5e5;background:#141414;padding:32px 24px;max-width:540px;margin:0 auto;">
<p style="margin:0 0 6px;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#a3a3a3;">Mana Nero</p>
<p style="margin:0 0 24px;font-size:13px;color:#737373;">${manaNeroTagline}</p>
${blocks.trim()}
<p style="margin:28px 0 0;padding-top:20px;border-top:1px solid #2a2a2a;font-size:11px;color:#525252;line-height:1.5;">
${manaNeroSupportLine}
</p>
</div>
`.trim();
}
