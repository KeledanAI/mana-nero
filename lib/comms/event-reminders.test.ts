import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { eventReminder24hWindowIso } from "./event-reminders";

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
