import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { userMeetsRole } from "./roles";

describe("userMeetsRole", () => {
  it("denies when role missing", () => {
    assert.equal(userMeetsRole(null, "customer"), false);
    assert.equal(userMeetsRole(undefined, "staff"), false);
  });

  it("matches SQL has_role hierarchy", () => {
    assert.equal(userMeetsRole("customer", "customer"), true);
    assert.equal(userMeetsRole("customer", "staff"), false);
    assert.equal(userMeetsRole("customer", "admin"), false);

    assert.equal(userMeetsRole("staff", "customer"), true);
    assert.equal(userMeetsRole("staff", "staff"), true);
    assert.equal(userMeetsRole("staff", "admin"), false);

    assert.equal(userMeetsRole("admin", "customer"), true);
    assert.equal(userMeetsRole("admin", "staff"), true);
    assert.equal(userMeetsRole("admin", "admin"), true);
  });
});
