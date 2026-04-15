import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  campaignSegmentIdempotencyKey,
  normalizeCampaignId,
  parseStaffCampaignSegment,
} from "./campaign-segment-enqueue";

describe("parseStaffCampaignSegment", () => {
  it("maps known segments and defaults", () => {
    assert.equal(parseStaffCampaignSegment("marketing_consent"), "marketing_consent");
    assert.equal(parseStaffCampaignSegment("registration_waitlisted"), "registration_waitlisted");
    assert.equal(parseStaffCampaignSegment("registration_confirmed"), "registration_confirmed");
    assert.equal(parseStaffCampaignSegment("newsletter_opt_in"), "newsletter_opt_in");
    assert.equal(parseStaffCampaignSegment(""), "newsletter_opt_in");
    assert.equal(parseStaffCampaignSegment("other"), "newsletter_opt_in");
  });
});

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
    assert.equal(
      campaignSegmentIdempotencyKey("registration_waitlisted", "promo-wl", "u2"),
      "campaign:registration_waitlisted:promo-wl:u2",
    );
    assert.equal(
      campaignSegmentIdempotencyKey("registration_confirmed", "promo-ok", "u3"),
      "campaign:registration_confirmed:promo-ok:u3",
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
