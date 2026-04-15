import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatCommsAdminPageError } from "./comms-admin-errors";

describe("formatCommsAdminPageError", () => {
  it("maps known enqueue / record codes", () => {
    assert.match(formatCommsAdminPageError("campaign_id_invalid"), /slug campagna valido/);
    assert.match(formatCommsAdminPageError("subject_required"), /oggetto email/);
    assert.match(formatCommsAdminPageError("campaign_record_not_found"), /non trovato/);
  });

  it("passes through unknown short messages", () => {
    assert.equal(formatCommsAdminPageError("something_unmapped_xyz"), "something_unmapped_xyz");
  });

  it("humanizes duplicate key / unique constraint", () => {
    assert.match(
      formatCommsAdminPageError("duplicate key value violates unique constraint \"comms_campaigns_slug_key\""),
      /slug/,
    );
  });

  it("humanizes segment_kind check constraint hints", () => {
    assert.match(
      formatCommsAdminPageError(
        'new row for relation "comms_campaigns" violates check constraint "comms_campaigns_segment_kind_check"',
      ),
      /migrazioni Supabase/,
    );
  });

  it("prefixes generic check constraint with truncated detail", () => {
    const msg = formatCommsAdminPageError('new row violates check constraint "some_other_check" on table x');
    assert.match(msg, /vincolo del database/);
    assert.match(msg, /Dettaglio:/);
  });
});
