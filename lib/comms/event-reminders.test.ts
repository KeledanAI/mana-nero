import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { eventReminder24hWindowIso, eventReminder7dWindowIso } from "./event-reminders";

describe("eventReminder24hWindowIso", () => {
  it("returns an 8-hour window starting ~22h from now", () => {
    const t0 = Date.UTC(2026, 3, 10, 12, 0, 0);
    const { lower, upper } = eventReminder24hWindowIso(t0);
    const lowMs = new Date(lower).getTime();
    const upMs = new Date(upper).getTime();
    assert.ok(upMs - lowMs >= 7.9 * 3600 * 1000 && upMs - lowMs <= 8.1 * 3600 * 1000);
    assert.ok(lowMs >= t0 + 21.9 * 3600 * 1000);
    assert.ok(upMs <= t0 + 30.1 * 3600 * 1000);
  });
});

describe("eventReminder7dWindowIso", () => {
  it("returns an 8-hour window centered ~7 days from now", () => {
    const t0 = Date.UTC(2026, 3, 10, 12, 0, 0);
    const sevenDays = 7 * 24 * 3600 * 1000;
    const { lower, upper } = eventReminder7dWindowIso(t0);
    const lowMs = new Date(lower).getTime();
    const upMs = new Date(upper).getTime();
    assert.ok(upMs - lowMs >= 7.9 * 3600 * 1000 && upMs - lowMs <= 8.1 * 3600 * 1000);
    const mid = (lowMs + upMs) / 2;
    assert.ok(mid >= t0 + sevenDays - 2 * 3600 * 1000);
    assert.ok(mid <= t0 + sevenDays + 2 * 3600 * 1000);
  });
});
