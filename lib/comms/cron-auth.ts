/**
 * Autorizzazione Bearer per job schedulati (outbox worker, ecc.).
 * Accetta un token se coincide con uno dei segreti configurati (es. OUTBOX_CRON_SECRET o CRON_SECRET su Vercel).
 */
export function parseBearerToken(authorizationHeader: string | null | undefined): string | null {
  const raw = authorizationHeader?.trim();
  if (!raw?.toLowerCase().startsWith("bearer ")) return null;
  return raw.slice(7).trim() || null;
}

export function isCronBearerAuthorized(
  authorizationHeader: string | null | undefined,
  allowedSecrets: string[],
): boolean {
  const token = parseBearerToken(authorizationHeader);
  if (!token) return false;
  const set = new Set(allowedSecrets.map((s) => s.trim()).filter(Boolean));
  return set.has(token);
}
