import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runBookingAction } from "./booking";

describe("runBookingAction", () => {
  it("invokes event_registration_action RPC with book params", async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const supabase = {
      rpc(name: string, args: Record<string, unknown>) {
        calls.push({ name, args });
        return Promise.resolve({
          data: { ok: true, status: "confirmed" },
          error: null,
        });
      },
    };

    await runBookingAction(supabase as never, "book", {
      eventId: "evt-1",
      registrationId: null,
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.name, "event_registration_action");
    assert.deepEqual(calls[0]?.args, {
      p_operation: "book",
      p_event_id: "evt-1",
      p_registration_id: null,
    });
  });

  it("throws when RPC returns error", async () => {
    const supabase = {
      rpc() {
        return Promise.resolve({
          data: null,
          error: { message: "already_registered" },
        });
      },
    };

    await assert.rejects(
      () =>
        runBookingAction(supabase as never, "cancel", {
          eventId: "e",
          registrationId: null,
        }),
      /already_registered/,
    );
  });
});
