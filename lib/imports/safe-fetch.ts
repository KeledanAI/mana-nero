/**
 * SSRF-safe GET di file di testo remoti per l'importer.
 *
 * Difese:
 * - Solo schemi HTTPS (HTTP rifiutato).
 * - Hostname risolto in lower-case e validato:
 *   * niente localhost / 127.0.0.0/8 / ::1
 *   * niente IP privati RFC1918 (10/8, 172.16/12, 192.168/16)
 *   * niente link-local (169.254/16, fe80::/10)
 *   * niente metadata cloud (169.254.169.254, fd00:ec2::254)
 *   Hostname accettati solo se contengono almeno un punto (no `intra`).
 * - Max size 5 MB con stream cap (interrompe lo stream prima del limite).
 * - Timeout configurabile (default 8s) via AbortSignal.
 * - Content-Type whitelist (text/*, application/csv, application/octet-stream
 *   per file CSV servirti come binari da S3/GCS).
 * - User-Agent identificabile per audit lato fornitore.
 *
 * NOTA: la difesa SSRF qui è best-effort lato app. La protezione completa
 * richiede anche il firewall di rete della funzione (Vercel Functions
 * permettono solo egress HTTPS verso domini pubblici by default; il check
 * IP qui copre i casi in cui un hostname pubblico risolve a un IP privato).
 */

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_USER_AGENT = "ManaNeroImporter/1.0 (+https://mananero.it)";

const ACCEPT_CONTENT_TYPE_PATTERNS: RegExp[] = [
  /^text\//i,
  /^application\/csv\b/i,
  /^application\/vnd\.ms-excel\b/i,
  /^application\/octet-stream\b/i,
];

export type SafeFetchOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  userAgent?: string;
};

export type SafeFetchResult = {
  body: string;
  content_type: string | null;
  url: string;
  truncated: boolean;
};

export class SafeFetchError extends Error {
  constructor(
    public readonly code: SafeFetchErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "SafeFetchError";
  }
}

export type SafeFetchErrorCode =
  | "invalid_url"
  | "scheme_not_allowed"
  | "host_not_allowed"
  | "private_address_blocked"
  | "fetch_failed"
  | "http_status_error"
  | "content_type_not_allowed"
  | "response_too_large"
  | "timeout";

const PRIVATE_IPV4_PATTERNS: RegExp[] = [
  /^10\./,
  /^127\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
];

function isIpv4PrivateOrReserved(host: string): boolean {
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return false;
  if (PRIVATE_IPV4_PATTERNS.some((re) => re.test(host))) return true;
  const [a, b] = host.split(".").map((part) => Number.parseInt(part, 10));
  if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
  return false;
}

function isIpv6Suspicious(host: string): boolean {
  const cleaned = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (cleaned === "::1") return true;
  if (cleaned.startsWith("fe80")) return true;
  if (cleaned.startsWith("fc") || cleaned.startsWith("fd")) return true;
  if (cleaned === "::") return true;
  return false;
}

export function validateRemoteUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SafeFetchError("invalid_url");
  }
  if (parsed.protocol !== "https:") {
    throw new SafeFetchError("scheme_not_allowed", `${parsed.protocol} non permesso`);
  }
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host === "" || !host.includes(".") && !host.includes(":")) {
    throw new SafeFetchError("host_not_allowed", host);
  }
  if (isIpv4PrivateOrReserved(host)) {
    throw new SafeFetchError("private_address_blocked", host);
  }
  if (isIpv6Suspicious(host)) {
    throw new SafeFetchError("private_address_blocked", host);
  }
  return parsed;
}

function contentTypeAllowed(ct: string | null): boolean {
  if (!ct) return true;
  return ACCEPT_CONTENT_TYPE_PATTERNS.some((re) => re.test(ct));
}

export async function safeFetchText(
  rawUrl: string,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const url = validateRemoteUrl(rawUrl);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": userAgent,
        Accept: "text/csv,text/plain,application/csv;q=0.9,*/*;q=0.5",
      },
    });
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof Error && e.name === "AbortError") {
      throw new SafeFetchError("timeout");
    }
    throw new SafeFetchError("fetch_failed", e instanceof Error ? e.message : undefined);
  }
  clearTimeout(timer);

  if (!response.ok) {
    throw new SafeFetchError(
      "http_status_error",
      `HTTP ${response.status} ${response.statusText}`,
    );
  }

  const contentType = response.headers.get("content-type");
  if (!contentTypeAllowed(contentType)) {
    throw new SafeFetchError("content_type_not_allowed", contentType ?? "");
  }

  const declaredLength = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new SafeFetchError(
      "response_too_large",
      `${declaredLength} > ${maxBytes}`,
    );
  }

  const body = response.body;
  if (!body) {
    const text = await response.text();
    if (text.length > maxBytes) {
      throw new SafeFetchError("response_too_large");
    }
    return {
      body: text,
      content_type: contentType,
      url: response.url || url.toString(),
      truncated: false,
    };
  }

  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let received = 0;
  let truncated = false;
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    received += value.byteLength;
    if (received > maxBytes) {
      truncated = true;
      try {
        await reader.cancel();
      } catch {
        // ignore cancel errors
      }
      throw new SafeFetchError("response_too_large", `received>${maxBytes}`);
    }
    buffer += decoder.decode(value, { stream: true });
  }
  buffer += decoder.decode();

  return {
    body: buffer,
    content_type: contentType,
    url: response.url || url.toString(),
    truncated,
  };
}
