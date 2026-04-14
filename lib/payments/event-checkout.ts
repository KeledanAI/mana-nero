/** Amount charged in Stripe Checkout: deposit wins over full price when set. */
export function eventCheckoutAmountCents(event: {
  deposit_cents: number | null | undefined;
  price_cents: number | null | undefined;
}): number {
  const dep = event.deposit_cents ?? 0;
  if (dep > 0) return dep;
  return Math.max(0, event.price_cents ?? 0);
}

export function eventRequiresOnlinePayment(event: {
  deposit_cents: number | null | undefined;
  price_cents: number | null | undefined;
}): boolean {
  return eventCheckoutAmountCents(event) > 0;
}

export function stripeCurrency(event: { currency: string | null | undefined }): string {
  const c = (event.currency ?? "eur").trim().toLowerCase();
  return c.length === 3 ? c : "eur";
}
