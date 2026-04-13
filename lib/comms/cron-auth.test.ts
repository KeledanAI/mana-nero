import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isCronBearerAuthorized, parseBearerToken } from "./cron-auth";

describe("parseBearerToken", () => {
  it("extracts token from Bearer header", () => {
    assert.equal(parseBearerToken("Bearer abc"), "abc");
    assert.equal(parseBearerToken("bearer  xyz "), "xyz");
  });

  it("returns null for invalid", () => {
    assert.equal(parseBearerToken(null), null);
    assert.equal(parseBearerToken("Basic x"), null);
  });
});

describe("isCronBearerAuthorized", () => {
  it("accepts when token matches any secret", () => {
    assert.equal(
      isCronBearerAuthorized("Bearer secret-a", ["secret-a", "secret-b"]),
      true,
    );
    assert.equal(
      isCronBearerAuthorized("Bearer secret-b", ["secret-a", "secret-b"]),
      true,
    );
    assert.equal(isCronBearerAuthorized("Bearer wrong", ["secret-a"]), false);
  });
});
