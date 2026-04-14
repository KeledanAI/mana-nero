import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { outboxSkipError, parseOutboxSkipCode } from "./outbox-skip";

describe("parseOutboxSkipCode", () => {
  it("extracts code from outbox skip errors", () => {
    const e = outboxSkipError("newsletter_opt_in_revoked");
    assert.equal(parseOutboxSkipCode(e.message), "newsletter_opt_in_revoked");
  });

  it("returns null for normal errors", () => {
    assert.equal(parseOutboxSkipCode("RESEND_API_KEY is not set"), null);
  });
});
