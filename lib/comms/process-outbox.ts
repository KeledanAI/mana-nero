import { sendManaNeroEmail } from "@/lib/email/send-transactional";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/site-url";

type OutboxRow = {
  id: string;
  channel: string;
  payload: Record<string, unknown>;
  status: string;
  scheduled_at: string;
  attempt_count: number;
};

const MAX_ATTEMPTS = 5;

function payloadKind(payload: Record<string, unknown>): string | undefined {
  const k = payload.kind;
  return typeof k === "string" ? k : undefined;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function dispatchEmail(
  supabase: ReturnType<typeof createAdminClient>,
  row: OutboxRow,
): Promise<void> {
  const kind = payloadKind(row.payload);
  const userId = row.payload.user_id;
  const eventId = row.payload.event_id;

  if (typeof userId !== "string" || typeof eventId !== "string") {
    throw new Error("email_payload_missing_user_or_event");
  }

  const [{ data: profile }, { data: event }] = await Promise.all([
    supabase.from("profiles").select("email, full_name").eq("id", userId).maybeSingle(),
    supabase.from("events").select("title, slug, starts_at").eq("id", eventId).maybeSingle(),
  ]);

  const to = profile?.email?.trim();
  if (!to) {
    throw new Error("recipient_email_missing");
  }

  const title = event?.title ?? "Evento";
  const slug = event?.slug ?? "";
  const startsAt = event?.starts_at
    ? new Date(event.starts_at).toLocaleString("it-IT", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";
  const origin = getSiteUrl();
  const eventUrl = slug ? `${origin}/events/${slug}` : `${origin}/events`;

  let subject = "Mana Nero — aggiornamento prenotazione";
  let bodyHtml = `<p>Ciao${profile?.full_name ? ` ${escapeHtml(profile.full_name)}` : ""},</p>`;

  if (kind === "booking_confirmation") {
    subject = `Iscrizione confermata — ${escapeHtml(title)}`;
    bodyHtml += `<p>La tua iscrizione a <strong>${escapeHtml(title)}</strong> è <strong>confermata</strong>.</p>`;
    if (startsAt) bodyHtml += `<p>Data: ${escapeHtml(startsAt)}</p>`;
    bodyHtml += `<p><a href="${escapeHtml(eventUrl)}" style="color:#fafafa;">Apri scheda evento</a></p>`;
  } else if (kind === "booking_waitlist") {
    subject = `Lista d'attesa — ${escapeHtml(title)}`;
    bodyHtml += `<p>Sei in <strong>lista d'attesa</strong> per <strong>${escapeHtml(title)}</strong>.</p>`;
    if (startsAt) bodyHtml += `<p>Data evento: ${escapeHtml(startsAt)}</p>`;
    bodyHtml += `<p><a href="${escapeHtml(eventUrl)}" style="color:#fafafa;">Scheda evento</a></p>`;
  } else if (kind === "waitlist_promoted") {
    subject = `Posto disponibile — ${escapeHtml(title)}`;
    bodyHtml += `<p>È libero un posto: la tua iscrizione a <strong>${escapeHtml(title)}</strong> è ora <strong>confermata</strong>.</p>`;
    if (startsAt) bodyHtml += `<p>Data: ${escapeHtml(startsAt)}</p>`;
    bodyHtml += `<p><a href="${escapeHtml(eventUrl)}" style="color:#fafafa;">Apri scheda evento</a></p>`;
  } else {
    subject = `Mana Nero — notifica (${escapeHtml(kind ?? "sconosciuto")})`;
    bodyHtml += `<p>Aggiornamento relativo a <strong>${escapeHtml(title)}</strong>.</p>`;
    bodyHtml += `<p><a href="${escapeHtml(eventUrl)}" style="color:#fafafa;">Scheda evento</a></p>`;
  }

  await sendManaNeroEmail({
    to,
    subject,
    sections: [{ title: "Mana Nero", bodyHtml }],
  });
}

async function dispatchOne(
  supabase: ReturnType<typeof createAdminClient>,
  row: OutboxRow,
): Promise<void> {
  if (row.channel === "internal") {
    return;
  }

  if (row.channel === "email") {
    if (!process.env.RESEND_API_KEY?.trim()) {
      throw new Error("RESEND_API_KEY is not set");
    }
    await dispatchEmail(supabase, row);
    return;
  }
  throw new Error(`channel_not_implemented:${row.channel}`);
}

/**
 * Elabora fino a `maxItems` messaggi in stato `pending` con `scheduled_at` nel passato.
 * Usa confronto ottimistico su `attempt_count` per ridurre elaborazioni duplicate in parallelo.
 */
export async function processOutboxBatch(maxItems: number): Promise<{
  examined: number;
  claimed: number;
  completed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: pending, error: listError } = await supabase
    .from("communication_outbox")
    .select("id, channel, payload, status, scheduled_at, attempt_count")
    .eq("status", "pending")
    .lte("scheduled_at", now)
    .order("created_at", { ascending: true })
    .limit(maxItems);

  if (listError) {
    errors.push(listError.message);
    return { examined: 0, claimed: 0, completed: 0, errors };
  }

  const rows = (pending ?? []) as OutboxRow[];
  let claimed = 0;
  let completed = 0;

  for (const row of rows) {
    const nextAttempt = row.attempt_count + 1;
    const { data: locked, error: claimError } = await supabase
      .from("communication_outbox")
      .update({
        status: "processing",
        attempt_count: nextAttempt,
        updated_at: now,
      })
      .eq("id", row.id)
      .eq("status", "pending")
      .eq("attempt_count", row.attempt_count)
      .select("id, channel, payload, attempt_count")
      .maybeSingle();

    if (claimError) {
      errors.push(`${row.id}: ${claimError.message}`);
      continue;
    }
    if (!locked) continue;
    claimed++;

    const working: OutboxRow = {
      id: locked.id,
      channel: locked.channel,
      payload: (locked.payload ?? {}) as Record<string, unknown>,
      status: "processing",
      scheduled_at: row.scheduled_at,
      attempt_count: locked.attempt_count,
    };

    try {
      await dispatchOne(supabase, working);
      const { error: sentErr } = await supabase
        .from("communication_outbox")
        .update({
          status: "sent",
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", working.id);
      if (sentErr) {
        throw new Error(sentErr.message);
      }
      completed++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const terminal = nextAttempt >= MAX_ATTEMPTS;
      const { error: failErr } = await supabase
        .from("communication_outbox")
        .update({
          status: terminal ? "failed" : "pending",
          last_error: msg.slice(0, 2000),
          updated_at: new Date().toISOString(),
        })
        .eq("id", working.id);
      if (failErr) {
        errors.push(`${working.id}: ${failErr.message}`);
      } else {
        errors.push(`${working.id}: ${msg}`);
      }
    }
  }

  return { examined: rows.length, claimed, completed, errors };
}
