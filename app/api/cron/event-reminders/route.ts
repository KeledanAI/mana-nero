import { NextResponse } from "next/server";

import { isCronBearerAuthorized } from "@/lib/comms/cron-auth";
import { enqueueEventReminder24hScan } from "@/lib/comms/event-reminders";

/**
 * Accoda reminder email ~24h prima degli eventi (outbox idempotente).
 * Stessi secret Bearer di GET /api/cron/outbox.
 */
export async function GET(request: Request) {
  const secrets = [
    process.env.OUTBOX_CRON_SECRET?.trim(),
    process.env.CRON_SECRET?.trim(),
  ].filter((s): s is string => Boolean(s));

  if (secrets.length === 0) {
    return NextResponse.json(
      { error: "Configure OUTBOX_CRON_SECRET or CRON_SECRET" },
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization");
  if (!isCronBearerAuthorized(auth, secrets)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await enqueueEventReminder24hScan();
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
