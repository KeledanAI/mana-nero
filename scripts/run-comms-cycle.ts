import path from "node:path";
import { fileURLToPath } from "node:url";

import { processOutbox } from "@/lib/comms/outbox-runtime";
import { scheduleEventReminders } from "@/scripts/schedule-event-reminders";

import { loadEnvLocal } from "./_load-env-local";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

async function main() {
  loadEnvLocal(root);
  const scheduled = await scheduleEventReminders();
  const processed = await processOutbox();
  console.log(
    JSON.stringify(
      {
        scheduled,
        processed,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
