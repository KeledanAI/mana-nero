import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  campaignSegmentIdempotencyKey,
  normalizeCampaignId,
} from "./campaign-segment-enqueue";

describe("campaignSegmentIdempotencyKey", () => {
  it("follows design pattern with segment", () => {
    assert.equal(
      campaignSegmentIdempotencyKey("newsletter_opt_in", "estate-2026", "u1"),
      "campaign:newsletter_opt_in:estate-2026:u1",
    );
    assert.equal(
      campaignSegmentIdempotencyKey("marketing_consent", "estate-2026", "u1"),
      "campaign:marketing_consent:estate-2026:u1",
    );
  });
});

describe("normalizeCampaignId", () => {
  it("accepts slug", () => {
    assert.equal(normalizeCampaignId("  Estate_2026  "), "estate-2026");
  });

  it("rejects empty", () => {
    assert.equal(normalizeCampaignId("   "), null);
  });

  it("rejects too long", () => {
    assert.equal(normalizeCampaignId("a".repeat(70)), null);
  });
});
