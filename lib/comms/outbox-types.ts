export const emailOutboxKinds = [
  "booking_confirmation",
  "booking_waitlist",
  "waitlist_promoted",
  "event_reminder_24h",
  "event_reminder_2h",
] as const;

export const internalOutboxKinds = ["post_saved"] as const;

export type EmailOutboxKind = (typeof emailOutboxKinds)[number];
export type InternalOutboxKind = (typeof internalOutboxKinds)[number];
export type OutboxKind = EmailOutboxKind | InternalOutboxKind;

export type BookingConfirmationPayload = {
  kind: "booking_confirmation";
  event_id: string;
  user_id: string;
  registration_status: "confirmed";
};

export type BookingWaitlistPayload = {
  kind: "booking_waitlist";
  event_id: string;
  user_id: string;
};

export type WaitlistPromotedPayload = {
  kind: "waitlist_promoted";
  event_id: string;
  user_id: string;
};

export type EventReminderPayload = {
  kind: "event_reminder_24h" | "event_reminder_2h";
  event_id: string;
  user_id: string;
  registration_id: string;
};

export type PostSavedPayload = {
  kind: "post_saved";
  slug: string;
  status: string;
  title: string;
};

export type OutboxPayload =
  | BookingConfirmationPayload
  | BookingWaitlistPayload
  | WaitlistPromotedPayload
  | EventReminderPayload
  | PostSavedPayload;

export type OutboxChannel = "email" | "telegram" | "whatsapp" | "internal";

export type OutboxRow = {
  id: string;
  idempotency_key: string;
  channel: OutboxChannel;
  payload: OutboxPayload | Record<string, unknown>;
  status: "pending" | "processing" | "sent" | "failed";
  scheduled_at: string;
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export function isEmailOutboxKind(value: string): value is EmailOutboxKind {
  return emailOutboxKinds.includes(value as EmailOutboxKind);
}

export function isInternalOutboxKind(value: string): value is InternalOutboxKind {
  return internalOutboxKinds.includes(value as InternalOutboxKind);
}

export function parseOutboxPayload(payload: unknown): OutboxPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("invalid_outbox_payload");
  }

  const kind = (payload as { kind?: unknown }).kind;
  if (typeof kind !== "string") {
    throw new Error("outbox_payload_kind_required");
  }

  if (!isEmailOutboxKind(kind) && !isInternalOutboxKind(kind)) {
    throw new Error(`unsupported_outbox_kind:${kind}`);
  }

  return payload as OutboxPayload;
}
