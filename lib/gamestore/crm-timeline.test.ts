import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatAuditTimelineDetail,
  formatAuditTimelineTitle,
  formatOutboxTimelineDetail,
  formatOutboxTimelineTitle,
  outboxPayloadKindLabel,
} from "./crm-timeline";

describe("outboxPayloadKindLabel", () => {
  it("maps known kinds", () => {
    assert.equal(outboxPayloadKindLabel("campaign_segment"), "Campagna segmentata");
    assert.equal(outboxPayloadKindLabel("event_reminder_24h"), "Reminder evento (24h)");
    assert.equal(outboxPayloadKindLabel("event_reminder_7d"), "Reminder evento (7 giorni)");
  });
});

describe("formatOutboxTimelineTitle", () => {
  it("uses payload kind", () => {
    assert.equal(
      formatOutboxTimelineTitle({
        status: "pending",
        payload: { kind: "campaign_segment" },
      }),
      "Outbox · Campagna segmentata",
    );
  });
});

describe("formatOutboxTimelineDetail", () => {
  it("includes subject and segment for campaigns", () => {
    const d = formatOutboxTimelineDetail({
      status: "sent",
      payload: {
        kind: "campaign_segment",
        subject_line: "Torneo sabato",
        campaign_id: "aprile-tcg",
        segment_kind: "newsletter_opt_in",
      },
      idempotency_key: "campaign:newsletter_opt_in:aprile-tcg:user-1",
      last_error: null,
      scheduled_at: "2026-04-22T10:00:00.000Z",
      attempt_count: 1,
    });
    assert.match(d, /Stato: sent/);
    assert.match(d, /Oggetto: Torneo sabato/);
    assert.match(d, /Campagna: aprile-tcg/);
    assert.match(d, /Segmento: Newsletter/);
    assert.match(d, /Tentativi: 1/);
  });

  it("labels registration_confirmed segment", () => {
    const d = formatOutboxTimelineDetail({
      status: "pending",
      payload: {
        kind: "campaign_segment",
        subject_line: "Grazie per la prenotazione",
        campaign_id: "torneo-maggio",
        segment_kind: "registration_confirmed",
      },
      idempotency_key: "campaign:registration_confirmed:torneo-maggio:user-1",
      last_error: null,
      scheduled_at: null,
      attempt_count: 0,
    });
    assert.match(d, /Segmento: Iscrizioni confermate/);
  });

  it("humanizes OUTBOX_SKIP last_error", () => {
    const d = formatOutboxTimelineDetail({
      status: "cancelled",
      payload: { kind: "campaign_segment" },
      idempotency_key: "k",
      last_error: "OUTBOX_SKIP:marketing_consent_revoked",
      scheduled_at: null,
      attempt_count: 0,
    });
    assert.match(d, /marketing revocato/);
  });

  it("humanizes OUTBOX_SKIP not_confirmed_registration", () => {
    const d = formatOutboxTimelineDetail({
      status: "cancelled",
      payload: { kind: "campaign_segment", segment_kind: "registration_confirmed" },
      idempotency_key: "k",
      last_error: "OUTBOX_SKIP:not_confirmed_registration",
      scheduled_at: null,
      attempt_count: 0,
    });
    assert.match(d, /nessuna iscrizione confermata/);
  });
});

describe("formatAuditTimelineTitle", () => {
  it("uses Italian labels when known", () => {
    assert.equal(
      formatAuditTimelineTitle({
        action_type: "customer_profile_updated",
        entity_type: "profile",
        entity_id: "abc",
        payload: {},
      }),
      "Audit · Profilo cliente aggiornato",
    );
  });
});

describe("formatAuditTimelineDetail", () => {
  it("expands customer_profile_updated payload", () => {
    const d = formatAuditTimelineDetail({
      action_type: "customer_profile_updated",
      entity_type: "profile",
      entity_id: "uuid-here-0000",
      payload: {
        newsletter_opt_in: false,
        marketing_consent: true,
        outbox_newsletter_pending_cancelled: 2,
      },
    });
    assert.match(d, /Newsletter: false/);
    assert.match(d, /Outbox newsletter annullate: 2/);
  });

  it("maps campaign_segment_enqueued audit fields", () => {
    const d = formatAuditTimelineDetail({
      action_type: "campaign_segment_enqueued",
      entity_type: "comms_campaign",
      entity_id: null,
      payload: { campaign_slug: "estate", segment: "marketing_consent", attempted: 42 },
    });
    assert.match(d, /Campagna: estate/);
    assert.match(d, /Segmento: Marketing/);
    assert.match(d, /Tentativi enqueue: 42/);
  });
});
