import { sendManaNeroEmail } from "@/lib/email/send-transactional";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/site-url";
import { outboxSkipError, parseOutboxSkipCode } from "@/lib/comms/outbox-skip";

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

async function dispatchProductStockAvailableEmail(
  supabase: ReturnType<typeof createAdminClient>,
  payload: Record<string, unknown>,
): Promise<void> {
  const userId = payload.user_id;
  const productNameRaw = payload.product_name;
  const productName =
    typeof productNameRaw === "string" && productNameRaw.trim()
      ? productNameRaw.trim()
      : "la tua richiesta";

  if (typeof userId !== "string") {
    throw new Error("email_payload_missing_user_id");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", userId)
    .maybeSingle();

  const to = profile?.email?.trim();
  if (!to) {
    throw new Error("recipient_email_missing");
  }

  const origin = getSiteUrl();
  const areaUrl = `${origin}/protected`;

  const subject = `Aggiornamento richiesta prodotto — ${escapeHtml(productName)}`;
  let bodyHtml = `<p>Ciao${profile?.full_name ? ` ${escapeHtml(profile.full_name)}` : ""},</p>`;
  bodyHtml += `<p>Abbiamo un aggiornamento sulla tua richiesta <strong>${escapeHtml(productName)}</strong> in stato <strong>in attesa merce</strong>: controlla l&apos;area riservata per i dettagli o passa in negozio.</p>`;
  bodyHtml += `<p><a href="${escapeHtml(areaUrl)}" style="color:#fafafa;">Apri area riservata</a></p>`;

  await sendManaNeroEmail({
    to,
    subject,
    sections: [{ title: "Mana Nero", bodyHtml }],
  });
}

async function dispatchProductStockStaffSummaryEmail(payload: Record<string, unknown>): Promise<void> {
  const toRaw = payload.staff_email;
  const to = typeof toRaw === "string" ? toRaw.trim() : "";
  if (!to || !to.includes("@")) {
    throw new Error("staff_summary_email_missing");
  }

  const enqueued =
    typeof payload.enqueued === "number"
      ? payload.enqueued
      : Number.parseInt(String(payload.enqueued ?? "0"), 10) || 0;
  const marked =
    typeof payload.marked === "number"
      ? payload.marked
      : Number.parseInt(String(payload.marked ?? "0"), 10) || 0;
  const linesRaw = payload.lines;
  const lines = Array.isArray(linesRaw)
    ? linesRaw.filter((l): l is string => typeof l === "string").join("\n")
    : "";

  const subject = `Mana Nero — digest stock (${enqueued} notifiche accodate)`;
  let bodyHtml = `<p>Riepilogo esecuzione cron <code>product-stock-notifications</code>.</p>`;
  bodyHtml += `<p>Email cliente accodate in outbox: <strong>${escapeHtml(String(enqueued))}</strong> · Richieste marcate <code>stock_notified_at</code>: <strong>${escapeHtml(String(marked))}</strong></p>`;
  if (lines) {
    bodyHtml += `<pre style="white-space:pre-wrap;font-size:12px;">${escapeHtml(lines)}</pre>`;
  }

  await sendManaNeroEmail({
    to,
    subject,
    sections: [{ title: "Mana Nero", bodyHtml }],
  });
}

async function dispatchCampaignSegmentEmail(
  supabase: ReturnType<typeof createAdminClient>,
  payload: Record<string, unknown>,
): Promise<void> {
  const userId = payload.user_id;
  const campaignId = payload.campaign_id;
  const subjectLineRaw = payload.subject_line;
  const teaserRaw = payload.teaser;
  const segmentKindRaw = payload.segment_kind;
  const segmentKindStr = typeof segmentKindRaw === "string" ? segmentKindRaw : "";

  if (typeof userId !== "string" || typeof campaignId !== "string") {
    throw new Error("campaign_payload_missing_ids");
  }

  const subjectLine =
    typeof subjectLineRaw === "string" && subjectLineRaw.trim()
      ? subjectLineRaw.trim().replace(/[\r\n<>{}\x00-\x08]/g, " ").slice(0, 120)
      : "Mana Nero — aggiornamento";
  const teaser = typeof teaserRaw === "string" ? teaserRaw.trim() : "";

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, newsletter_opt_in, marketing_consent")
    .eq("id", userId)
    .maybeSingle();

  const to = profile?.email?.trim();
  if (!to) {
    throw new Error("recipient_email_missing");
  }

  const sk =
    segmentKindStr === "marketing_consent"
      ? "marketing_consent"
      : segmentKindStr === "registration_waitlisted"
        ? "registration_waitlisted"
        : segmentKindStr === "registration_confirmed"
          ? "registration_confirmed"
          : "newsletter_opt_in";

  if (sk === "marketing_consent" && !profile?.marketing_consent) {
    throw outboxSkipError("marketing_consent_revoked");
  }
  if (sk === "newsletter_opt_in" && !profile?.newsletter_opt_in) {
    throw outboxSkipError("newsletter_opt_in_revoked");
  }
  if (sk === "registration_waitlisted") {
    const { count, error: cErr } = await supabase
      .from("event_registrations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "waitlisted");
    if (cErr) {
      throw new Error(cErr.message);
    }
    if (!count || count < 1) {
      throw outboxSkipError("not_on_waitlist");
    }
  }
  if (sk === "registration_confirmed") {
    const { count, error: cErr } = await supabase
      .from("event_registrations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "confirmed");
    if (cErr) {
      throw new Error(cErr.message);
    }
    if (!count || count < 1) {
      throw outboxSkipError("not_confirmed_registration");
    }
  }

  const origin = getSiteUrl();
  const newsUrl = `${origin}/news`;
  const protectedUrl = `${origin}/protected`;

  const bodyParagraphs = teaser
    ? teaser
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0)
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join("")
    : `<p>${escapeHtml(`Novità per te (campagna «${campaignId}»).`)}</p>`;

  let bodyHtml = `<p>Ciao${profile?.full_name ? ` ${escapeHtml(profile.full_name)}` : ""},</p>`;
  bodyHtml += bodyParagraphs;
  bodyHtml += `<p><a href="${escapeHtml(newsUrl)}" style="color:#fafafa;">Novità</a> · <a href="${escapeHtml(protectedUrl)}" style="color:#fafafa;">Area riservata</a></p>`;

  const segmentLabel =
    segmentKindStr === "marketing_consent"
      ? "Marketing (consenso profilo)"
      : segmentKindStr === "registration_waitlisted"
        ? "Lista d'attesa (iscrizioni waitlisted)"
        : segmentKindStr === "registration_confirmed"
          ? "Iscrizioni confermate (almeno un evento)"
          : "Newsletter opt-in";
  bodyHtml += `<p style="font-size:11px;color:#888;">Segmento: ${escapeHtml(segmentLabel)}</p>`;

  await sendManaNeroEmail({
    to,
    subject: subjectLine,
    sections: [{ title: "Mana Nero", bodyHtml }],
  });
}

async function dispatchEmail(
  supabase: ReturnType<typeof createAdminClient>,
  row: OutboxRow,
): Promise<void> {
  const kind = payloadKind(row.payload);
  if (kind === "product_stock_available") {
    await dispatchProductStockAvailableEmail(supabase, row.payload);
    return;
  }
  if (kind === "product_stock_staff_summary") {
    await dispatchProductStockStaffSummaryEmail(row.payload);
    return;
  }
  if (kind === "campaign_segment") {
    await dispatchCampaignSegmentEmail(supabase, row.payload);
    return;
  }

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
  } else if (kind === "booking_pending_payment") {
    subject = `Completa il pagamento — ${escapeHtml(title)}`;
    bodyHtml += `<p>La tua iscrizione a <strong>${escapeHtml(title)}</strong> è in <strong>attesa di pagamento</strong>.</p>`;
    if (startsAt) bodyHtml += `<p>Data evento: ${escapeHtml(startsAt)}</p>`;
    bodyHtml += `<p>Apri la scheda evento e usa il pulsante <strong>Completa pagamento</strong> entro il termine indicato.</p>`;
    bodyHtml += `<p><a href="${escapeHtml(eventUrl)}" style="color:#fafafa;">Vai all&apos;evento</a></p>`;
  } else if (kind === "payment_confirmed") {
    subject = `Pagamento ricevuto — ${escapeHtml(title)}`;
    bodyHtml += `<p>Abbiamo registrato il pagamento per <strong>${escapeHtml(title)}</strong>. La tua iscrizione è <strong>confermata</strong>.</p>`;
    if (startsAt) bodyHtml += `<p>Data: ${escapeHtml(startsAt)}</p>`;
    bodyHtml += `<p><a href="${escapeHtml(eventUrl)}" style="color:#fafafa;">Apri scheda evento</a></p>`;
  } else if (kind === "event_reminder_24h") {
    subject = `Promemoria — ${escapeHtml(title)} domani`;
    bodyHtml += `<p><strong>${escapeHtml(title)}</strong> in programma tra circa 24 ore.</p>`;
    if (startsAt) bodyHtml += `<p>Data e ora: ${escapeHtml(startsAt)}</p>`;
    bodyHtml += `<p><a href="${escapeHtml(eventUrl)}" style="color:#fafafa;">Apri scheda evento</a></p>`;
  } else if (kind === "event_reminder_7d") {
    subject = `Promemoria — ${escapeHtml(title)} tra una settimana`;
    bodyHtml += `<p><strong>${escapeHtml(title)}</strong> in programma tra circa sette giorni.</p>`;
    if (startsAt) bodyHtml += `<p>Data e ora: ${escapeHtml(startsAt)}</p>`;
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
      const skipCode = parseOutboxSkipCode(msg);
      if (skipCode) {
        const { error: cancelErr } = await supabase
          .from("communication_outbox")
          .update({
            status: "cancelled",
            last_error: skipCode.slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq("id", working.id);
        if (cancelErr) {
          errors.push(`${working.id}: ${cancelErr.message}`);
        }
        continue;
      }
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
