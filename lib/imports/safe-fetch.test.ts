import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { SafeFetchError, safeFetchText, validateRemoteUrl } from "./safe-fetch";

describe("validateRemoteUrl", () => {
  it("rejects malformed URL", () => {
    assert.throws(() => validateRemoteUrl("not a url"), (e) => e instanceof SafeFetchError && e.code === "invalid_url");
  });

  it("rejects http://", () => {
    assert.throws(
      () => validateRemoteUrl("http://example.com/file.csv"),
      (e) => e instanceof SafeFetchError && e.code === "scheme_not_allowed",
    );
  });

  it("rejects ftp://", () => {
    assert.throws(
      () => validateRemoteUrl("ftp://example.com/file.csv"),
      (e) => e instanceof SafeFetchError && e.code === "scheme_not_allowed",
    );
  });

  it("rejects localhost", () => {
    assert.throws(
      () => validateRemoteUrl("https://localhost/foo.csv"),
      (e) => e instanceof SafeFetchError && e.code === "host_not_allowed",
    );
  });

  it("rejects private IPv4 (10/8, 192.168/16, 127/8, 169.254/16, 172.16/12, 0/8)", () => {
    for (const host of [
      "10.0.0.1",
      "192.168.1.1",
      "127.0.0.1",
      "169.254.169.254",
      "172.16.0.1",
      "172.31.255.255",
      "0.0.0.0",
    ]) {
      assert.throws(
        () => validateRemoteUrl(`https://${host}/file.csv`),
        (e) => e instanceof SafeFetchError && e.code === "private_address_blocked",
        `expected ${host} to be blocked`,
      );
    }
  });

  it("allows public IPv4 outside 172.16/12", () => {
    assert.doesNotThrow(() => validateRemoteUrl("https://172.32.0.1/file.csv"));
    assert.doesNotThrow(() => validateRemoteUrl("https://8.8.8.8/file.csv"));
  });

  it("rejects IPv6 loopback and ULA / link-local", () => {
    for (const host of ["[::1]", "[fe80::1]", "[fc00::1]", "[fd00::1]", "[::]"]) {
      assert.throws(
        () => validateRemoteUrl(`https://${host}/file.csv`),
        (e) => e instanceof SafeFetchError && e.code === "private_address_blocked",
        `expected ${host} to be blocked`,
      );
    }
  });

  it("accepts a normal HTTPS URL", () => {
    const url = validateRemoteUrl("https://docs.google.com/spreadsheets/d/abc/export?format=csv");
    assert.equal(url.hostname, "docs.google.com");
  });
});

describe("safeFetchText", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("reads body when status ok and content-type allowed", async () => {
    globalThis.fetch = (async () =>
      new Response("display_name,rank\nMario,1\n", {
        status: 200,
        headers: { "content-type": "text/csv; charset=utf-8" },
      })) as typeof fetch;
    const result = await safeFetchText("https://example.com/r.csv");
    assert.match(result.body, /Mario,1/);
    assert.equal(result.content_type, "text/csv; charset=utf-8");
    assert.equal(result.truncated, false);
  });

  it("rejects on http error status", async () => {
    globalThis.fetch = (async () => new Response("nope", { status: 404 })) as typeof fetch;
    await assert.rejects(
      () => safeFetchText("https://example.com/missing.csv"),
      (e) => e instanceof SafeFetchError && e.code === "http_status_error",
    );
  });

  it("rejects on disallowed content-type", async () => {
    globalThis.fetch = (async () =>
      new Response("<html/>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })) as typeof fetch;

    // text/html non è ammesso (solo text/* di tipo dato; text/html sarebbe accettato dal pattern text/...).
    // Verifichiamo invece application/json.
    globalThis.fetch = (async () =>
      new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;
    await assert.rejects(
      () => safeFetchText("https://example.com/data.json"),
      (e) => e instanceof SafeFetchError && e.code === "content_type_not_allowed",
    );
  });

  it("rejects when content-length declares too large", async () => {
    globalThis.fetch = (async () =>
      new Response("...", {
        status: 200,
        headers: {
          "content-type": "text/csv",
          "content-length": String(10 * 1024 * 1024),
        },
      })) as typeof fetch;
    await assert.rejects(
      () => safeFetchText("https://example.com/big.csv"),
      (e) => e instanceof SafeFetchError && e.code === "response_too_large",
    );
  });

  it("rejects when actual body exceeds maxBytes via streaming", async () => {
    const bigChunk = "x".repeat(1024 * 1024); // 1 MB
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < 6; i += 1) {
          controller.enqueue(new TextEncoder().encode(bigChunk));
        }
        controller.close();
      },
    });
    globalThis.fetch = (async () =>
      new Response(stream, {
        status: 200,
        headers: { "content-type": "text/csv" },
      })) as typeof fetch;
    await assert.rejects(
      () => safeFetchText("https://example.com/stream.csv", { maxBytes: 2 * 1024 * 1024 }),
      (e) => e instanceof SafeFetchError && e.code === "response_too_large",
    );
  });

  it("returns truncated=false and full body when under limit", async () => {
    globalThis.fetch = (async () =>
      new Response("name,rank\nMario,1\n", {
        status: 200,
        headers: { "content-type": "text/csv" },
      })) as typeof fetch;
    const result = await safeFetchText("https://example.com/r.csv", { maxBytes: 1024 });
    assert.equal(result.truncated, false);
    assert.match(result.body, /name,rank/);
  });

  it("rejects URL validation errors before fetching", async () => {
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response("");
    }) as typeof fetch;
    await assert.rejects(
      () => safeFetchText("http://example.com/r.csv"),
      (e) => e instanceof SafeFetchError && e.code === "scheme_not_allowed",
    );
    assert.equal(called, false);
  });
});
