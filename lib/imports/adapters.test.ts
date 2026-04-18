import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  AdapterFetchError,
  ADAPTER_IDS,
  getAdapter,
  listAdapters,
} from "./adapters";

describe("adapter registry", () => {
  it("exposes all 5 known adapters", () => {
    assert.equal(ADAPTER_IDS.length, 5);
    const ids = listAdapters().map((d) => d.id).sort();
    assert.deepEqual(ids.sort(), [
      "bandai_tcg_plus",
      "melee_gg_public",
      "play_pokemon_rk9",
      "remote_csv_url",
      "wizards_companion_oauth",
    ]);
  });

  it("each adapter exposes a non-empty manual_instructions", () => {
    for (const desc of listAdapters()) {
      assert.ok(desc.manual_instructions.length > 20, `instructions missing for ${desc.id}`);
      assert.ok(desc.description.length > 20, `description missing for ${desc.id}`);
    }
  });

  it("only remote_csv_url has status=available", () => {
    const available = listAdapters().filter((d) => d.status === "available");
    assert.equal(available.length, 1);
    assert.equal(available[0]?.id, "remote_csv_url");
  });
});

describe("RemoteCsvUrlAdapter", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("rejects empty reference with invalid_reference", async () => {
    const adapter = getAdapter("remote_csv_url");
    await assert.rejects(
      () => adapter.fetch({ reference: "" }),
      (e) => e instanceof AdapterFetchError && e.reason === "invalid_reference",
    );
  });

  it("returns csv_text + source 'generic' on success", async () => {
    globalThis.fetch = (async () =>
      new Response("name,rank\nMario,1\n", {
        status: 200,
        headers: { "content-type": "text/csv" },
      })) as typeof fetch;
    const adapter = getAdapter("remote_csv_url");
    const result = await adapter.fetch({ reference: "https://example.com/r.csv" });
    assert.match(result.csv_text, /Mario,1/);
    assert.equal(result.source, "generic");
  });

  it("wraps SafeFetchError into AdapterFetchError(fetch_failed)", async () => {
    globalThis.fetch = (async () => new Response("nope", { status: 500 })) as typeof fetch;
    const adapter = getAdapter("remote_csv_url");
    await assert.rejects(
      () => adapter.fetch({ reference: "https://example.com/x" }),
      (e) => e instanceof AdapterFetchError && e.reason === "fetch_failed",
    );
  });

  it("blocks SSRF (private IP) before fetching", async () => {
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response("");
    }) as typeof fetch;
    const adapter = getAdapter("remote_csv_url");
    await assert.rejects(
      () => adapter.fetch({ reference: "https://10.0.0.1/foo" }),
      (e) => e instanceof AdapterFetchError && e.reason === "fetch_failed",
    );
    assert.equal(called, false);
  });
});

describe("stub adapters", () => {
  it("wizards_companion_oauth throws requires_partnership", async () => {
    const a = getAdapter("wizards_companion_oauth");
    await assert.rejects(
      () => a.fetch({ reference: "any" }),
      (e) => e instanceof AdapterFetchError && e.reason === "requires_partnership",
    );
  });

  it("play_pokemon_rk9 throws not_implemented", async () => {
    await assert.rejects(
      () => getAdapter("play_pokemon_rk9").fetch({ reference: "any" }),
      (e) => e instanceof AdapterFetchError && e.reason === "not_implemented",
    );
  });

  it("bandai_tcg_plus throws not_implemented", async () => {
    await assert.rejects(
      () => getAdapter("bandai_tcg_plus").fetch({ reference: "any" }),
      (e) => e instanceof AdapterFetchError && e.reason === "not_implemented",
    );
  });

  it("melee_gg_public throws not_implemented", async () => {
    await assert.rejects(
      () => getAdapter("melee_gg_public").fetch({ reference: "any" }),
      (e) => e instanceof AdapterFetchError && e.reason === "not_implemented",
    );
  });
});
