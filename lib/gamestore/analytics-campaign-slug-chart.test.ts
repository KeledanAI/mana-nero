import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCampaignSlugStackChart,
  outboxStatusBarClass,
} from "./analytics-campaign-slug-chart";

describe("buildCampaignSlugStackChart", () => {
  it("aggregates by slug and computes percentages", () => {
    const rows = [
      { campaign_id: "a", status: "sent", n: 10 },
      { campaign_id: "a", status: "failed", n: 5 },
      { campaign_id: "b", status: "sent", n: 3 },
    ];
    const chart = buildCampaignSlugStackChart(rows, 10);
    assert.equal(chart.length, 2);
    assert.equal(chart[0].slug, "a");
    assert.equal(chart[0].total, 15);
    const sent = chart[0].segments.find((s) => s.status === "sent");
    const failed = chart[0].segments.find((s) => s.status === "failed");
    assert.ok(sent && failed);
    assert.ok(Math.abs(sent.pct - (100 * 10) / 15) < 0.01);
    assert.ok(Math.abs(failed.pct - (100 * 5) / 15) < 0.01);
  });

  it("sums duplicate slug+status rows", () => {
    const rows = [
      { campaign_id: "x", status: "pending", n: 2 },
      { campaign_id: "x", status: "pending", n: 3 },
    ];
    const chart = buildCampaignSlugStackChart(rows);
    assert.equal(chart.length, 1);
    assert.equal(chart[0].total, 5);
    assert.equal(chart[0].segments.length, 1);
    assert.equal(chart[0].segments[0].n, 5);
  });

  it("respects maxSlugs", () => {
    const rows = [
      { campaign_id: "s1", status: "sent", n: 1 },
      { campaign_id: "s2", status: "sent", n: 2 },
      { campaign_id: "s3", status: "sent", n: 3 },
    ];
    const chart = buildCampaignSlugStackChart(rows, 2);
    assert.equal(chart.length, 2);
    assert.equal(chart[0].slug, "s3");
    assert.equal(chart[1].slug, "s2");
  });
});

describe("outboxStatusBarClass", () => {
  it("maps known statuses", () => {
    assert.match(outboxStatusBarClass("sent"), /emerald/);
    assert.match(outboxStatusBarClass("FAILED"), /destructive/);
  });
});
