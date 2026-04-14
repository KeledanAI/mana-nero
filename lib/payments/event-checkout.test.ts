import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  eventCheckoutAmountCents,
  eventRequiresOnlinePayment,
  stripeCurrency,
} from "./event-checkout";

describe("eventCheckoutAmountCents", () => {
  it("prefers deposit over price when deposit > 0", () => {
    assert.equal(
      eventCheckoutAmountCents({ deposit_cents: 500, price_cents: 2000 }),
      500,
    );
  });

  it("uses price when deposit is zero or null", () => {
    assert.equal(
      eventCheckoutAmountCents({ deposit_cents: 0, price_cents: 1500 }),
      1500,
    );
    assert.equal(
      eventCheckoutAmountCents({ deposit_cents: null, price_cents: 800 }),
      800,
    );
  });

  it("returns 0 when both unset", () => {
    assert.equal(
      eventCheckoutAmountCents({ deposit_cents: null, price_cents: null }),
      0,
    );
  });
});

describe("eventRequiresOnlinePayment", () => {
  it("is true when deposit or price positive", () => {
    assert.equal(eventRequiresOnlinePayment({ deposit_cents: 1, price_cents: 0 }), true);
    assert.equal(eventRequiresOnlinePayment({ deposit_cents: 0, price_cents: 1 }), true);
  });

  it("is false when both zero", () => {
    assert.equal(eventRequiresOnlinePayment({ deposit_cents: 0, price_cents: 0 }), false);
  });
});

describe("stripeCurrency", () => {
  it("defaults to eur", () => {
    assert.equal(stripeCurrency({ currency: null }), "eur");
    assert.equal(stripeCurrency({ currency: "   " }), "eur");
  });

  it("lowercases 3-letter code", () => {
    assert.equal(stripeCurrency({ currency: "EUR" }), "eur");
  });

  it("falls back for invalid length", () => {
    assert.equal(stripeCurrency({ currency: "e" }), "eur");
  });
});
