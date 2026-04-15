import { parseOutboxSkipCode } from "@/lib/comms/outbox-skip";

const MAX_DETAIL = 280;

function trunc(s: string, max = MAX_DETAIL): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function str(payload: Record<string, unknown>, key: string): string | null {
  const v = payload[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function segmentKindLabel(segment: string): string {
  switch (segment) {
    case "newsletter_opt_in":
      return "Newsletter";
    case "marketing_consent":
      return "Marketing";
    case "registration_waitlisted":
      return "Waitlist iscrizioni";
    case "registration_confirmed":
      return "Iscrizioni confermate";
    default:
      return segment.replaceAll("_", " ");
  }
}

/** Etichetta breve per `payload.kind` in timeline staff. */
export function outboxPayloadKindLabel(kind: string): string {
  switch (kind) {
    case "campaign_segment":
      return "Campagna segmentata";
    case "event_reminder_24h":
      return "Reminder evento (24h)";
    case "event_reminder_7d":
      return "Reminder evento (7 giorni)";
    case "product_stock_available":
      return "Stock disponibile";
    case "product_stock_staff_summary":
      return "Digest stock (staff)";
    case "booking_waitlist":
      return "Waitlist prenotazione";
    case "waitlist_promoted":
      return "Promozione da waitlist";
    default:
      return kind.replaceAll("_", " ");
  }
}

export type OutboxTimelineRow = {
  status: string;
  payload: Record<string, unknown>;
  idempotency_key?: string | null;
  last_error?: string | null;
  scheduled_at?: string | null;
  attempt_count?: number | null;
};

export function formatOutboxTimelineTitle(row: OutboxTimelineRow): string {
  const kind = str(row.payload, "kind") ?? "email";
  return `Outbox · ${outboxPayloadKindLabel(kind)}`;
}

export function formatOutboxTimelineDetail(row: OutboxTimelineRow): string {
  const parts: string[] = [`Stato: ${row.status}`];

  const subject = str(row.payload, "subject_line");
  if (subject) parts.push(`Oggetto: ${trunc(subject, 120)}`);

  const campaignId = str(row.payload, "campaign_id");
  if (campaignId) parts.push(`Campagna: ${campaignId}`);

  const seg = str(row.payload, "segment_kind");
  if (seg) parts.push(`Segmento: ${segmentKindLabel(seg)}`);

  const eventId = str(row.payload, "event_id");
  if (eventId) parts.push(`Evento: ${eventId.slice(0, 8)}…`);

  if (row.scheduled_at && row.scheduled_at.length >= 10) {
    parts.push(`Programmata: ${row.scheduled_at.slice(0, 16).replace("T", " ")}`);
  }

  const attempts = row.attempt_count ?? 0;
  if (attempts > 0) parts.push(`Tentativi: ${attempts}`);

  const err = row.last_error?.trim();
  if (err) {
    const skip = parseOutboxSkipCode(err);
    if (skip) {
      parts.push(`Esito: ${formatOutboxSkipLabel(skip)}`);
    } else if (row.status === "failed" || row.status === "cancelled") {
      parts.push(`Dettaglio: ${trunc(err, 160)}`);
    }
  }

  if (row.idempotency_key) {
    parts.push(`Chiave: ${trunc(row.idempotency_key, 96)}`);
  }

  return parts.join(" · ");
}

function formatOutboxSkipLabel(code: string): string {
  switch (code) {
    case "newsletter_opt_in_revoked":
      return "saltato (newsletter revocata)";
    case "marketing_consent_revoked":
      return "saltato (marketing revocato)";
    case "not_on_waitlist":
      return "saltato (non in lista d'attesa)";
    case "not_confirmed_registration":
      return "saltato (nessuna iscrizione confermata)";
    default:
      return `saltato (${code.replaceAll("_", " ")})`;
  }
}

export type AuditTimelineRow = {
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  payload: Record<string, unknown>;
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  admin_note_created: "Nota interna creata",
  staff_check_in: "Check-in manuale",
  marketing_consent_revoked: "Marketing revocato",
  newsletter_opt_in_revoked: "Newsletter revocata",
  rotate_check_in_token: "Token check-in ruotato",
  comms_campaign_record_saved: "Record campagna salvato",
  campaign_segment_enqueued: "Campagna segmentata accodata",
  product_request_updated: "Richiesta prodotto aggiornata",
  customer_profile_updated: "Profilo cliente aggiornato",
};

export function formatAuditTimelineTitle(row: AuditTimelineRow): string {
  const label = AUDIT_ACTION_LABELS[row.action_type] ?? row.action_type.replaceAll("_", " ");
  return `Audit · ${label}`;
}

export function formatAuditTimelineDetail(row: AuditTimelineRow): string {
  const p = row.payload;
  const base = `${row.entity_type}${row.entity_id ? ` · ${row.entity_id.slice(0, 8)}…` : ""}`;

  switch (row.action_type) {
    case "customer_profile_updated": {
      const bits: string[] = [base];
      if ("newsletter_opt_in" in p) bits.push(`Newsletter: ${Boolean(p.newsletter_opt_in)}`);
      if ("marketing_consent" in p) bits.push(`Marketing: ${Boolean(p.marketing_consent)}`);
      const nl = p.outbox_newsletter_pending_cancelled;
      if (typeof nl === "number" && nl > 0) bits.push(`Outbox newsletter annullate: ${nl}`);
      const mk = p.outbox_marketing_pending_cancelled;
      if (typeof mk === "number" && mk > 0) bits.push(`Outbox marketing annullate: ${mk}`);
      const nn = p.outbox_newsletter_cancel_note;
      if (typeof nn === "string" && nn) bits.push(`Nota newsletter: ${trunc(nn, 100)}`);
      const mn = p.outbox_marketing_cancel_note;
      if (typeof mn === "string" && mn) bits.push(`Nota marketing: ${trunc(mn, 100)}`);
      if (p.phone_set === true) bits.push("Telefono impostato");
      if (typeof p.crm_tags_count === "number") bits.push(`Tag CRM: ${p.crm_tags_count}`);
      if (p.lead_stage_set === true) bits.push("Lead stage impostato");
      return bits.join(" · ");
    }
    case "marketing_consent_revoked":
    case "newsletter_opt_in_revoked": {
      const bits: string[] = [base];
      const c = p.outbox_campaign_pending_cancelled;
      if (typeof c === "number" && c > 0) bits.push(`Righe outbox annullate: ${c}`);
      const note = str(p, "outbox_cancel_note");
      if (note) bits.push(`Nota: ${trunc(note, 120)}`);
      return bits.join(" · ");
    }
    case "campaign_segment_enqueued": {
      const bits: string[] = [base];
      const seg = str(p, "segment");
      if (seg) bits.push(`Segmento: ${segmentKindLabel(seg)}`);
      const slug = str(p, "campaign_slug");
      if (slug) bits.push(`Campagna: ${slug}`);
      const attempted = p.attempted;
      if (typeof attempted === "number") bits.push(`Tentativi enqueue: ${attempted}`);
      return bits.join(" · ");
    }
    case "comms_campaign_record_saved": {
      const bits: string[] = [base];
      const slug = str(p, "slug");
      if (slug) bits.push(`Slug: ${slug}`);
      return bits.join(" · ");
    }
    case "product_request_updated": {
      const bits: string[] = [base];
      const st = str(p, "status");
      if (st) bits.push(`Stato: ${st}`);
      return bits.join(" · ");
    }
    default:
      return base;
  }
}
