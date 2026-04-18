import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseTournamentResultsCsv } from "@/lib/imports/tournament-results-csv";

import {
  commitImport,
  deleteAllTournamentResultsForEvent,
  previewImport,
  type PreviewRow,
  type RowOverrides,
} from "./tournament-import";

type StubBuilder = {
  table: string;
  filters: Array<{ kind: string; value: unknown }>;
  response: unknown;
};

function makeSupabase(handlers: Record<string, (b: StubBuilder) => unknown>) {
  return {
    from(table: string) {
      const builder: StubBuilder = { table, filters: [], response: null };
      const proxy: Record<string, unknown> = {
        select() {
          return proxy;
        },
        in(_col: string, value: unknown) {
          builder.filters.push({ kind: "in", value });
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

describe("previewImport", () => {
  it("auto-links via external_id match (wizards_eventlink → wizards_companion)", async () => {
    const csv = [
      "Player Name,DCI,Final Rank,Match Wins,Match Losses,Match Draws,Match Points",
      "Mario Rossi,1234567,1,4,0,0,12",
      "Walk In Wonder,,2,3,1,0,9",
    ].join("\n");
    const parsed = parseTournamentResultsCsv(csv);
    assert.equal(parsed.source, "wizards_eventlink");

    const supabase = makeSupabase({
      player_external_identities: (b) => {
        const inFilters = b.filters.filter((f) => f.kind === "in");
        const platformFilter = (inFilters[0]?.value as string[]) ?? [];
        const handleFilter = (inFilters[1]?.value as string[]) ?? [];
        if (!platformFilter.includes("wizards_companion")) return [];
        if (handleFilter.includes("1234567")) {
          return [
            {
              profile_id: "p-mario",
              external_id: "1234567",
              external_username: "mario#0001",
              platform: "wizards_companion",
            },
          ];
        }
        return [];
      },
      profiles: () => [{ id: "p-mario", full_name: "Mario Rossi", email: null }],
    });

    const preview = await previewImport(supabase as never, parsed.source, parsed.rows);
    assert.equal(preview.total_participants, 2);
    assert.equal(preview.auto_link_count, 1);
    assert.equal(preview.walk_in_count, 1);
    const mario = preview.rows.find((r) => r.display_name === "Mario Rossi");
    assert.equal(mario?.proposed_profile_id, "p-mario");
    assert.equal(mario?.proposed_profile_label, "Mario Rossi");
    assert.equal(mario?.resolved_points, 12);
  });

  it("falls back to defaultPointsForRank when CSV has no points column", async () => {
    const csv = ["name,rank", "A,1", "B,2"].join("\n");
    const parsed = parseTournamentResultsCsv(csv);
    const supabase = makeSupabase({
      player_external_identities: () => [],
      profiles: () => [],
    });
    const preview = await previewImport(supabase as never, parsed.source, parsed.rows);
    assert.equal(preview.rows[0]?.resolved_points, 1);
    assert.equal(preview.rows[1]?.resolved_points, 0);
  });

  it("auto-links via username when external_id missing", async () => {
    const csv = ["name,handle,rank", "Anna,anna#0001,1"].join("\n");
    const parsed = parseTournamentResultsCsv(csv);
    const supabase = makeSupabase({
      player_external_identities: (b) => {
        const inFilters = b.filters.filter((f) => f.kind === "in");
        const handleFilter = (inFilters[1]?.value as string[]) ?? [];
        if (handleFilter.includes("anna#0001")) {
          return [
            {
              profile_id: "p-anna",
              external_id: "",
              external_username: "anna#0001",
              platform: "discord",
            },
          ];
        }
        return [];
      },
      profiles: () => [{ id: "p-anna", full_name: null, email: "anna@example.com" }],
    });

    const preview = await previewImport(supabase as never, parsed.source, parsed.rows);
    assert.equal(preview.auto_link_count, 1);
    assert.equal(preview.rows[0]?.proposed_profile_label, "anna@example.com");
  });

  it("returns walk-in only when no handles supplied", async () => {
    const csv = ["name,rank", "Mario,1", "Luigi,2"].join("\n");
    const parsed = parseTournamentResultsCsv(csv);
    const supabase = makeSupabase({});
    const preview = await previewImport(supabase as never, parsed.source, parsed.rows);
    assert.equal(preview.auto_link_count, 0);
    assert.equal(preview.walk_in_count, 2);
    for (const row of preview.rows) {
      assert.equal(row.proposed_profile_id, null);
    }
  });
});

describe("commitImport", () => {
  function makeUpsertSupabase(behavior: (payload: Record<string, unknown>) => "ok" | string) {
    return {
      from() {
        return {
          upsert(payload: Record<string, unknown>) {
            const verdict = behavior(payload);
            return {
              select() {
                return {
                  single: async () => {
                    if (verdict === "ok") {
                      return {
                        data: {
                          id: "r-" + Math.random().toString(36).slice(2),
                          ...payload,
                        },
                        error: null,
                      };
                    }
                    return { data: null, error: { message: verdict } };
                  },
                };
              },
            };
          },
        };
      },
    };
  }

  const sampleRows: PreviewRow[] = [
    {
      display_name: "Mario",
      final_rank: 1,
      wins: 3,
      losses: 0,
      draws: 0,
      points: null,
      external_handle: null,
      format: null,
      source_row: 2,
      proposed_profile_id: "p-mario",
      proposed_profile_label: "Mario",
      resolved_points: 1,
    },
    {
      display_name: "Walkin",
      final_rank: 2,
      wins: 2,
      losses: 1,
      draws: 0,
      points: null,
      external_handle: null,
      format: null,
      source_row: 3,
      proposed_profile_id: null,
      proposed_profile_label: null,
      resolved_points: 0.5,
    },
  ];

  it("rejects without event_id", async () => {
    await assert.rejects(
      () => commitImport({} as never, { eventId: "", rows: sampleRows }),
      /event_id_required/,
    );
  });

  it("counts inserted_or_updated rows", async () => {
    const supabase = makeUpsertSupabase(() => "ok");
    const result = await commitImport(supabase as never, {
      eventId: "evt-1",
      rows: sampleRows,
      recordedBy: "staff-1",
    });
    assert.equal(result.inserted_or_updated, 2);
    assert.equal(result.failed.length, 0);
  });

  it("isolates per-row failures and continues batch", async () => {
    const supabase = makeUpsertSupabase((payload) => {
      if (payload.display_name === "Walkin") return "duplicate_walkin";
      return "ok";
    });
    const result = await commitImport(supabase as never, {
      eventId: "evt-1",
      rows: sampleRows,
    });
    assert.equal(result.inserted_or_updated, 1);
    assert.equal(result.failed.length, 1);
    assert.equal(result.failed[0]?.display_name, "Walkin");
    assert.match(result.failed[0]?.reason ?? "", /duplicate_walkin/);
  });

  it("respects per-row 'skip' override and counts skipped", async () => {
    const supabase = makeUpsertSupabase(() => "ok");
    const overrides: RowOverrides = new Map([
      [3, { action: "skip" }],
    ]);
    const result = await commitImport(supabase as never, {
      eventId: "evt-1",
      rows: sampleRows,
      overrides,
    });
    assert.equal(result.inserted_or_updated, 1);
    assert.equal(result.skipped, 1);
  });

  it("respects 'walk_in' override clearing proposed_profile_id", async () => {
    let observedProfileId: unknown = "still-mario";
    const supabase = {
      from() {
        return {
          upsert(payload: Record<string, unknown>) {
            observedProfileId = payload.profile_id;
            return {
              select() {
                return {
                  single: async () => ({ data: { id: "x", ...payload }, error: null }),
                };
              },
            };
          },
        };
      },
    };
    const overrides: RowOverrides = new Map([
      [2, { action: "walk_in" }],
    ]);
    const result = await commitImport(supabase as never, {
      eventId: "evt-1",
      rows: [sampleRows[0]!],
      overrides,
    });
    assert.equal(result.inserted_or_updated, 1);
    assert.equal(observedProfileId, null);
  });

  it("respects 'link_to_profile' override forcing a specific profile_id", async () => {
    let observedProfileId: unknown = null;
    const supabase = {
      from() {
        return {
          upsert(payload: Record<string, unknown>) {
            observedProfileId = payload.profile_id;
            return {
              select() {
                return {
                  single: async () => ({ data: { id: "x", ...payload }, error: null }),
                };
              },
            };
          },
        };
      },
    };
    const overrides: RowOverrides = new Map([
      [3, { action: "link_to_profile", profile_id: "p-walkin-now-linked" }],
    ]);
    const result = await commitImport(supabase as never, {
      eventId: "evt-1",
      rows: [sampleRows[1]!],
      overrides,
    });
    assert.equal(result.inserted_or_updated, 1);
    assert.equal(observedProfileId, "p-walkin-now-linked");
  });

  it("fails 'link_to_profile' override when profile_id missing", async () => {
    const supabase = makeUpsertSupabase(() => "ok");
    const overrides: RowOverrides = new Map([
      [3, { action: "link_to_profile" }],
    ]);
    const result = await commitImport(supabase as never, {
      eventId: "evt-1",
      rows: [sampleRows[1]!],
      overrides,
    });
    assert.equal(result.inserted_or_updated, 0);
    assert.equal(result.failed.length, 1);
    assert.equal(result.failed[0]?.reason, "override_profile_id_required");
  });
});

describe("deleteAllTournamentResultsForEvent", () => {
  it("rejects without event_id", async () => {
    await assert.rejects(
      () => deleteAllTournamentResultsForEvent({} as never, ""),
      /event_id_required/,
    );
  });

  it("returns deleted count from supabase response", async () => {
    let observedFilter: unknown;
    const supabase = {
      from() {
        return {
          delete() {
            return {
              eq(_col: string, val: unknown) {
                observedFilter = val;
                return {
                  select: async () => ({
                    data: [{ id: "r-1" }, { id: "r-2" }, { id: "r-3" }],
                    error: null,
                  }),
                };
              },
            };
          },
        };
      },
    };
    const result = await deleteAllTournamentResultsForEvent(supabase as never, "evt-9");
    assert.equal(observedFilter, "evt-9");
    assert.equal(result.deleted, 3);
  });

  it("propagates supabase error", async () => {
    const supabase = {
      from() {
        return {
          delete() {
            return {
              eq() {
                return {
                  select: async () => ({ data: null, error: { message: "rls_violation" } }),
                };
              },
            };
          },
        };
      },
    };
    await assert.rejects(
      () => deleteAllTournamentResultsForEvent(supabase as never, "evt-1"),
      /rls_violation/,
    );
  });
});
