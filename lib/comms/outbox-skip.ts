const PREFIX = "OUTBOX_SKIP:";

/** Segnala annullamento outbox senza contare come fallimento retry (consenso revocato, ecc.). */
export function outboxSkipError(code: string): Error {
  const e = new Error(`${PREFIX}${code}`);
  e.name = "OutboxSkipError";
  return e;
}

export function parseOutboxSkipCode(message: string): string | null {
  return message.startsWith(PREFIX) ? message.slice(PREFIX.length) : null;
}
