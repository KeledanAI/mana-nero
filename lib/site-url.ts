/**
 * Public origin for auth redirects (signup confirmation, password reset).
 *
 * In production (e.g. Vercel), set NEXT_PUBLIC_SITE_URL to your canonical URL
 * (https://mana-nero.vercel.app) so links in Supabase emails never embed localhost.
 */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

/**
 * `next` from /auth/confirm may be an absolute URL (e.g. http://localhost:3000/protected)
 * if Supabase Site URL was wrong. Strip to pathname+search so redirect stays on this host.
 */
export function safeAuthNextPath(next: string | null): string {
  const fallback = "/protected";
  if (!next || next === "/") return fallback;

  try {
    if (next.startsWith("/") && !next.startsWith("//")) {
      return next;
    }
    const url = new URL(next);
    const path = `${url.pathname}${url.search}`;
    if (path.startsWith("/") && !path.startsWith("//")) {
      return path;
    }
  } catch {
    /* not a valid URL */
  }

  return fallback;
}
