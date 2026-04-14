import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isEligibleForStockArrivalNotification,
  stockArrivalIdempotencyKey,
} from "./product-stock-notifications";

describe("stockArrivalIdempotencyKey", () => {
  it("is stable per request id", () => {
    assert.equal(
      stockArrivalIdempotencyKey("550e8400-e29b-41d4-a716-446655440000"),
      "product_stock_arrival:550e8400-e29b-41d4-a716-446655440000",
    );
  });
});

describe("isEligibleForStockArrivalNotification", () => {
  const base = {
    id: "r1",
    user_id: "u1",
    product_name: "Box X",
    status: "awaiting_stock" as const,
    expected_fulfillment_at: null as string | null,
    stock_notified_at: null as string | null,
  };

  it("accepts awaiting_stock with user and no expected date", () => {
    assert.equal(isEligibleForStockArrivalNotification(base, new Date("2026-06-01")), true);
  });

  it("rejects without user_id", () => {
    assert.equal(
      isEligibleForStockArrivalNotification({ ...base, user_id: null }, new Date("2026-06-01")),
      false,
    );
  });

  it("rejects if stock_notified_at set", () => {
    assert.equal(
      isEligibleForStockArrivalNotification(
        { ...base, stock_notified_at: "2026-05-01T00:00:00.000Z" },
        new Date("2026-06-01"),
      ),
      false,
    );
  });

  it("rejects wrong status", () => {
    assert.equal(
      isEligibleForStockArrivalNotification({ ...base, status: "new" }, new Date("2026-06-01")),
      false,
    );
  });

  it("rejects expected date in future", () => {
    assert.equal(
      isEligibleForStockArrivalNotification(
        { ...base, expected_fulfillment_at: "2026-12-31T12:00:00.000Z" },
        new Date("2026-06-01"),
      ),
      false,
    );
  });

  it("accepts expected date in past", () => {
    assert.equal(
      isEligibleForStockArrivalNotification(
        { ...base, expected_fulfillment_at: "2026-01-01T12:00:00.000Z" },
        new Date("2026-06-01"),
      ),
      true,
    );
  });
});
