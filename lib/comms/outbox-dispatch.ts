import { sendManaNeroEmail, type ManaNeroEmailSection } from "@/lib/email/send-transactional";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  parseOutboxPayload,
  type EmailOutboxKind,
  type EventReminderPayload,
  type OutboxPayload,
  type OutboxRow,
} from "@/lib/comms/outbox-types";

type EventSummary = {
  id: string;
  title: string;
  slug: string;
  starts_at: string;
  game_type: string | null;
};

type ProfileSummary = {
  id: string;
  email: string | null;
  full_name: string | null;
};

function formatEventDate(dateIso: string) {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Rome",
  }).format(new Date(dateIso));
}

function greeting(name: string | null) {
  return name ? `Ciao ${name},` : "Ciao,";
}

async function getEventById(supabase: SupabaseClient, eventId: string): Promise<EventSummary> {
  const { data, error } = await supabase
    .from("events")
    .select("id, title, slug, starts_at, game_type")
    .eq("id", eventId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`event_not_found:${eventId}`);
  }

  return data as EventSummary;
}

async function getProfileById(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileSummary> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`profile_not_found:${userId}`);
  }

  return data as ProfileSummary;
}

function eventDetailUrl(eventSlug: string) {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.VERCEL_URL?.trim();

  if (!siteUrl) {
    return `/events/${eventSlug}`;
  }

  const base = siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`;
  return `${base.replace(/\/$/, "")}/events/${eventSlug}`;
}

function buildEmailContent(
  kind: EmailOutboxKind,
  event: EventSummary,
  profile: ProfileSummary,
): { subject: string; sections: ManaNeroEmailSection[] } {
  const dateText = formatEventDate(event.starts_at);
  const eventUrl = eventDetailUrl(event.slug);
  const hello = greeting(profile.full_name);

  switch (kind) {
    case "booking_confirmation":
      return {
        subject: `[Mana Nero] Prenotazione confermata: ${event.title}`,
        sections: [
          {
            title: "Prenotazione confermata",
            bodyHtml: `
<p style="margin:0 0 12px;">${hello}</p>
<p style="margin:0 0 12px;">il tuo posto per <strong>${event.title}</strong> è confermato.</p>
<p style="margin:0 0 12px;"><strong>Quando:</strong> ${dateText}</p>
<p style="margin:0;"><a href="${eventUrl}" style="color:#fbbf24;">Apri la scheda evento</a></p>
            `.trim(),
          },
        ],
      };
    case "booking_waitlist":
      return {
        subject: `[Mana Nero] Sei in lista d'attesa: ${event.title}`,
        sections: [
          {
            title: "Lista d'attesa",
            bodyHtml: `
<p style="margin:0 0 12px;">${hello}</p>
<p style="margin:0 0 12px;">al momento l'evento <strong>${event.title}</strong> è pieno e sei entrato in lista d'attesa.</p>
<p style="margin:0 0 12px;">Se si libera un posto ti avviseremo automaticamente.</p>
<p style="margin:0;"><a href="${eventUrl}" style="color:#fbbf24;">Vedi i dettagli evento</a></p>
            `.trim(),
          },
        ],
      };
    case "waitlist_promoted":
      return {
        subject: `[Mana Nero] Posto liberato: ${event.title}`,
        sections: [
          {
            title: "Sei stato promosso dalla lista d'attesa",
            bodyHtml: `
<p style="margin:0 0 12px;">${hello}</p>
<p style="margin:0 0 12px;">si è liberato un posto per <strong>${event.title}</strong> e la tua prenotazione è ora confermata.</p>
<p style="margin:0 0 12px;"><strong>Quando:</strong> ${dateText}</p>
<p style="margin:0;"><a href="${eventUrl}" style="color:#fbbf24;">Apri la scheda evento</a></p>
            `.trim(),
          },
        ],
      };
    case "event_reminder_24h":
      return {
        subject: `[Mana Nero] Promemoria: ${event.title} domani`,
        sections: [
          {
            title: "Promemoria evento",
            bodyHtml: `
<p style="margin:0 0 12px;">${hello}</p>
<p style="margin:0 0 12px;">ti ricordiamo che domani hai una prenotazione per <strong>${event.title}</strong>.</p>
<p style="margin:0 0 12px;"><strong>Data e ora:</strong> ${dateText}</p>
<p style="margin:0;"><a href="${eventUrl}" style="color:#fbbf24;">Rivedi i dettagli</a></p>
            `.trim(),
          },
        ],
      };
    case "event_reminder_2h":
      return {
        subject: `[Mana Nero] Ci vediamo tra poco: ${event.title}`,
        sections: [
          {
            title: "L'evento inizia a breve",
            bodyHtml: `
<p style="margin:0 0 12px;">${hello}</p>
<p style="margin:0 0 12px;">mancano circa due ore a <strong>${event.title}</strong>.</p>
<p style="margin:0 0 12px;"><strong>Quando:</strong> ${dateText}</p>
<p style="margin:0;"><a href="${eventUrl}" style="color:#fbbf24;">Apri la scheda evento</a></p>
            `.trim(),
          },
        ],
      };
  }
}

async function dispatchEmailPayload(
  supabase: SupabaseClient,
  payload: OutboxPayload,
) {
  if (payload.kind === "post_saved") {
    return { transport: "internal", transportId: null };
  }

  const event = await getEventById(supabase, payload.event_id);
  const profile = await getProfileById(supabase, payload.user_id);

  if (!profile.email) {
    throw new Error(`profile_email_missing:${profile.id}`);
  }

  const email = buildEmailContent(payload.kind, event, profile);
  const { id } = await sendManaNeroEmail({
    to: profile.email,
    subject: email.subject,
    sections: email.sections,
  });

  return { transport: "resend", transportId: id };
}

export async function dispatchOutboxMessage(
  supabase: SupabaseClient,
  row: Pick<OutboxRow, "channel" | "payload">,
) {
  const payload = parseOutboxPayload(row.payload);

  if (row.channel === "internal") {
    return { transport: "internal", transportId: null };
  }

  if (row.channel !== "email") {
    throw new Error(`unsupported_outbox_channel:${row.channel}`);
  }

  return dispatchEmailPayload(supabase, payload);
}

export function buildReminderPayload(
  kind: EventReminderPayload["kind"],
  input: { eventId: string; userId: string; registrationId: string },
): EventReminderPayload {
  return {
    kind,
    event_id: input.eventId,
    user_id: input.userId,
    registration_id: input.registrationId,
  };
}
