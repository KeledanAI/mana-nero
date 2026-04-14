import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isEligibleForStockArrivalNotification,
  staffStockSummaryIdempotencyKey,
  stockArrivalIdempotencyKey,
  stockAutoCancelGraceDaysFromEnv,
  stockExpectedLookaheadDaysFromEnv,
  stockScanBatchLimitFromEnv,
} from "./product-stock-notifications";

describe("stockArrivalIdempotencyKey", () => {
  it("is stable per request id", () => {
    assert.equal(
      stockArrivalIdempotencyKey("550e8400-e29b-41d4-a716-446655440000"),
      "product_stock_arrival:550e8400-e29b-41d4-a716-446655440000",
    );
  });
});

describe("staffStockSummaryIdempotencyKey", () => {
  it("buckets by UTC hour", () => {
    assert.match(
      staffStockSummaryIdempotencyKey(new Date("2026-06-15T14:30:00.000Z")),
      /^product_stock_staff_summary:2026-06-15T14$/,
    );
  });
});

describe("stockScanBatchLimitFromEnv", () => {
  it("defaults to 40 when unset", () => {
    delete process.env.PRODUCT_STOCK_SCAN_BATCH_LIMIT;
    assert.equal(stockScanBatchLimitFromEnv(), 40);
  });

  it("parses positive integer and caps at 500", () => {
    process.env.PRODUCT_STOCK_SCAN_BATCH_LIMIT = "80";
    assert.equal(stockScanBatchLimitFromEnv(), 80);
    process.env.PRODUCT_STOCK_SCAN_BATCH_LIMIT = "9999";
    assert.equal(stockScanBatchLimitFromEnv(), 500);
    delete process.env.PRODUCT_STOCK_SCAN_BATCH_LIMIT;
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

  it("prefers profile lookahead over env when larger window needed", () => {
    const now = new Date("2026-06-01T12:00:00.000Z");
    assert.equal(
      isEligibleForStockArrivalNotification(
        {
          ...base,
          expected_fulfillment_at: "2026-12-01T12:00:00.000Z",
          profile_stock_lookahead_days: 200,
        },
        now,
        7,
      ),
      true,
    );
    assert.equal(
      isEligibleForStockArrivalNotification(
        { ...base, expected_fulfillment_at: "2026-12-01T12:00:00.000Z", profile_stock_lookahead_days: 10 },
        now,
        7,
      ),
      false,
    );
  });

  it("with lookahead accepts expected within horizon even if future", () => {
    const now = new Date("2026-06-01T12:00:00.000Z");
    assert.equal(
      isEligibleForStockArrivalNotification(
        { ...base, expected_fulfillment_at: "2026-06-05T12:00:00.000Z" },
        now,
        10,
      ),
      true,
    );
    assert.equal(
      isEligibleForStockArrivalNotification(
        { ...base, expected_fulfillment_at: "2026-08-01T12:00:00.000Z" },
        now,
        10,
      ),
      false,
    );
  });
});

describe("stockExpectedLookaheadDaysFromEnv", () => {
  it("returns null when unset", () => {
    delete process.env.PRODUCT_STOCK_EXPECTED_LOOKAHEAD_DAYS;
    assert.equal(stockExpectedLookaheadDaysFromEnv(), null);
  });

  it("parses positive integer with cap", () => {
    process.env.PRODUCT_STOCK_EXPECTED_LOOKAHEAD_DAYS = "21";
    assert.equal(stockExpectedLookaheadDaysFromEnv(), 21);
    process.env.PRODUCT_STOCK_EXPECTED_LOOKAHEAD_DAYS = "9000";
    assert.equal(stockExpectedLookaheadDaysFromEnv(), 730);
    delete process.env.PRODUCT_STOCK_EXPECTED_LOOKAHEAD_DAYS;
  });
});

describe("stockAutoCancelGraceDaysFromEnv", () => {
  it("returns null when unset", () => {
    delete process.env.PRODUCT_STOCK_AUTO_CANCEL_GRACE_DAYS;
    assert.equal(stockAutoCancelGraceDaysFromEnv(), null);
  });

  it("parses positive integer with cap", () => {
    process.env.PRODUCT_STOCK_AUTO_CANCEL_GRACE_DAYS = "120";
    assert.equal(stockAutoCancelGraceDaysFromEnv(), 120);
    process.env.PRODUCT_STOCK_AUTO_CANCEL_GRACE_DAYS = "99999";
    assert.equal(stockAutoCancelGraceDaysFromEnv(), 3650);
    delete process.env.PRODUCT_STOCK_AUTO_CANCEL_GRACE_DAYS;
  });
});
