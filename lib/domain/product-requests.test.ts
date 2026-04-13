import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createProductRequestRecord } from "./product-requests";

describe("createProductRequestRecord", () => {
  it("inserts mapped row including priority_flag default false", async () => {
    const inserts: unknown[] = [];
    const supabase = {
      from(table: string) {
        assert.equal(table, "product_reservation_requests");
        return {
          insert(payload: Record<string, unknown>) {
            inserts.push(payload);
            return Promise.resolve({ error: null });
          },
        };
      },
    };

    await createProductRequestRecord(supabase as never, {
      userId: "u1",
      productName: "Booster",
      category: "TCG",
      notes: null,
      quantity: 2,
      desiredPrice: 19.99,
    });

    assert.deepEqual(inserts[0], {
      user_id: "u1",
      product_name: "Booster",
      category: "TCG",
      notes: null,
      quantity: 2,
      desired_price: 19.99,
      priority_flag: false,
    });
  });

  it("passes priority_flag true when set", async () => {
    const inserts: unknown[] = [];
    const supabase = {
      from() {
        return {
          insert(payload: Record<string, unknown>) {
            inserts.push(payload);
            return Promise.resolve({ error: null });
          },
        };
      },
    };

    await createProductRequestRecord(supabase as never, {
      userId: "u1",
      productName: "X",
      priorityFlag: true,
    });

    assert.equal((inserts[0] as { priority_flag: boolean }).priority_flag, true);
  });
});
