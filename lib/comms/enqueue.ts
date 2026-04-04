import { createAdminClient } from "@/lib/supabase/admin";

type EnqueueMessage = {
  idempotencyKey: string;
  channel: "email" | "telegram" | "whatsapp" | "internal";
  payload: Record<string, unknown>;
  scheduledAt?: string;
};

export async function enqueueMessage(message: EnqueueMessage) {
  const supabase = createAdminClient();

  const { error } = await supabase.from("communication_outbox").upsert(
    {
      idempotency_key: message.idempotencyKey,
      channel: message.channel,
      payload: message.payload,
      status: "pending",
      scheduled_at: message.scheduledAt ?? new Date().toISOString(),
    },
    {
      onConflict: "idempotency_key",
      ignoreDuplicates: true,
    },
  );

  if (error) {
    throw new Error(error.message);
  }
}
