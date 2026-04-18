import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { searchProfiles } from "./profile-search";

type Builder = {
  table: string;
  filters: Array<{ kind: string; col?: string; value?: unknown }>;
  limit?: number;
};

function makeSupabase(handlers: Record<string, (b: Builder) => unknown>) {
  return {
    from(table: string) {
      const builder: Builder = { table, filters: [] };
      const proxy: Record<string, unknown> = {
        select() {
          return proxy;
        },
        or(filter: string) {
          builder.filters.push({ kind: "or", value: filter });
          return proxy;
        },
        in(col: string, value: unknown) {
          builder.filters.push({ kind: "in", col, value });
          return proxy;
        },
        limit(n: number) {
          builder.limit = n;
          return proxy;
        },
        then(resolve: (value: { data: unknown; error: null }) => void) {
          const handler = handlers[builder.table];
          const data = handler ? handler(builder) : [];
          resolve({ data, error: null });
        },
      };
      return proxy;
    },
  };
}

describe("searchProfiles", () => {
  it("returns empty array for short queries", async () => {
    const supa = makeSupabase({});
    assert.deepEqual(await searchProfiles(supa as never, ""), []);
    assert.deepEqual(await searchProfiles(supa as never, "a"), []);
    assert.deepEqual(await searchProfiles(supa as never, "  "), []);
  });

  it("returns empty when query reduces to no usable chars", async () => {
    const supa = makeSupabase({});
    assert.deepEqual(await searchProfiles(supa as never, "%%,,"), []);
  });

  it("queries profiles by full_name/email/telegram and joins identities", async () => {
    const supa = makeSupabase({
      profiles: (b) => {
        const orFilter = b.filters.find((f) => f.kind === "or")?.value as string;
        assert.match(orFilter, /full_name\.ilike\.%mario%/);
        assert.match(orFilter, /email\.ilike\.%mario%/);
        assert.match(orFilter, /telegram_username\.ilike\.%mario%/);
        assert.equal(b.limit, 8);
        return [
          { id: "p-1", full_name: "Mario Rossi", email: "mario@test.it", telegram_username: null },
          { id: "p-2", full_name: null, email: "mario_l@test.it", telegram_username: "mario_l" },
        ];
      },
      player_external_identities: (b) => {
        const inIds = b.filters.find((f) => f.kind === "in" && f.col === "profile_id")?.value as string[];
        assert.deepEqual(inIds.sort(), ["p-1", "p-2"]);
        return [
          { profile_id: "p-1", platform: "wizards_companion", external_id: "1234567", external_username: null },
          { profile_id: "p-1", platform: "discord", external_id: "", external_username: "mario#0001" },
          { profile_id: "p-2", platform: "play_pokemon", external_id: "9876543", external_username: null },
        ];
      },
    });

    const results = await searchProfiles(supa as never, "mario");
    assert.equal(results.length, 2);
    const mario = results.find((r) => r.id === "p-1")!;
    assert.equal(mario.full_name, "Mario Rossi");
    assert.equal(mario.external_handles.length, 2);
    const mario2 = results.find((r) => r.id === "p-2")!;
    assert.equal(mario2.email, "mario_l@test.it");
    assert.equal(mario2.external_handles[0]?.platform, "play_pokemon");
  });

  it("clamps limit between 1 and 25", async () => {
    let observedLimit: number | undefined;
    const supa = makeSupabase({
      profiles: (b) => {
        observedLimit = b.limit;
        return [];
      },
    });
    await searchProfiles(supa as never, "mario", 100);
    assert.equal(observedLimit, 25);
    await searchProfiles(supa as never, "mario", 0);
    assert.equal(observedLimit, 1);
  });

  it("strips %, and , from the user query before building the like pattern", async () => {
    const supa = makeSupabase({
      profiles: (b) => {
        const orFilter = b.filters.find((f) => f.kind === "or")?.value as string;
        assert.doesNotMatch(orFilter, /%hac%kill,/);
        assert.match(orFilter, /full_name\.ilike\.%hac kill%/);
        return [];
      },
    });
    await searchProfiles(supa as never, "hac%kill,");
  });

  it("returns empty when profiles query yields no rows (skips identities lookup)", async () => {
    let identitiesCalled = false;
    const supa = makeSupabase({
      profiles: () => [],
      player_external_identities: () => {
        identitiesCalled = true;
        return [];
      },
    });
    const results = await searchProfiles(supa as never, "ghost");
    assert.equal(results.length, 0);
    assert.equal(identitiesCalled, false);
  });
});
