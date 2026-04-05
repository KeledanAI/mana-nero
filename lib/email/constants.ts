/**
 * Default transactional sender (must match a Resend-verified domain).
 * Override with RESEND_FROM e.g. "Mana Nero <notifiche@email.mananero.it>".
 */
export const manaNeroEmailFrom = (): string =>
  process.env.RESEND_FROM?.trim() ||
  "Mana Nero <noreply@email.mananero.it>";

export const manaNeroSupportLine =
  "Assistenza: mananerofumetteria@gmail.com · Tel. 0331 171 2653";

export const manaNeroTagline = "Fumetteria · eventi · community";
