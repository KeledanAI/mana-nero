import path from "node:path";
import { fileURLToPath } from "node:url";

import { processOutbox } from "@/lib/comms/outbox-runtime";

import { loadEnvLocal } from "./_load-env-local";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

async function main() {
  loadEnvLocal(root);

  const batchSize = Number.parseInt(process.env.OUTBOX_BATCH_SIZE || "20", 10);
  const maxAttempts = Number.parseInt(process.env.OUTBOX_MAX_ATTEMPTS || "5", 10);

  const result = await processOutbox({
    batchSize: Number.isFinite(batchSize) ? batchSize : 20,
    maxAttempts: Number.isFinite(maxAttempts) ? maxAttempts : 5,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
