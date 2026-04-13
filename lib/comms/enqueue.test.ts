import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { enqueueMessageWithClient, type EnqueueMessage } from "./enqueue";

describe("enqueueMessageWithClient", () => {
  it("upserts outbox row with idempotency onConflict ignoreDuplicates", async () => {
    const upserts: unknown[] = [];
    const supabase = {
      from(table: string) {
        assert.equal(table, "communication_outbox");
        return {
          upsert(payload: unknown, options: unknown) {
            upserts.push({ payload, options });
            return Promise.resolve({ error: null });
          },
        };
      },
    };

    const message: EnqueueMessage = {
      idempotencyKey: "test:key:1",
      channel: "email",
      payload: { kind: "unit" },
    };

    await enqueueMessageWithClient(supabase as never, message);

    assert.equal(upserts.length, 1);
    const first = upserts[0] as {
      payload: Record<string, unknown>;
      options: { onConflict: string; ignoreDuplicates: boolean };
    };
    assert.equal(first.payload.idempotency_key, "test:key:1");
    assert.equal(first.payload.channel, "email");
    assert.equal(first.payload.status, "pending");
    assert.equal(first.options.onConflict, "idempotency_key");
    assert.equal(first.options.ignoreDuplicates, true);
  });
});
