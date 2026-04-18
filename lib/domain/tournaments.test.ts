import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  defaultPointsForRank,
  deleteOwnExternalIdentity,
  deleteTournamentResult,
  fetchLocalRanking,
  fetchLocalRankingSummary,
  isExternalPlatform,
  recordTournamentResult,
  upsertOwnExternalIdentity,
} from "./tournaments";

type RpcCall = { name: string; args: Record<string, unknown> };

function makeStubBuilder(captured: { table?: string; payload?: unknown; onConflict?: string }, response: unknown) {
  return {
    upsert(payload: unknown, options?: { onConflict?: string }) {
      captured.payload = payload;
      captured.onConflict = options?.onConflict;
      return {
        select() {
          return {
            single: async () => ({ data: response, error: null }),
          };
        },
      };
    },
    delete() {
      return {
        eq: async () => ({ data: null, error: null }),
      };
    },
  };
}

describe("isExternalPlatform", () => {
  it("recognises supported platforms", () => {
    assert.equal(isExternalPlatform("wizards_companion"), true);
    assert.equal(isExternalPlatform("bandai_tcg_plus"), true);
    assert.equal(isExternalPlatform("world_beyblade_organization"), true);
    assert.equal(isExternalPlatform("nope"), false);
  });
});

describe("defaultPointsForRank", () => {
  it("returns 1 for solo participant", () => {
    assert.equal(defaultPointsForRank(1, 1), 1);
  });

  it("returns 1 for first place in larger field", () => {
    assert.equal(defaultPointsForRank(1, 16), 1);
  });

  it("returns 0 for last place", () => {
    assert.equal(defaultPointsForRank(16, 16), 0);
  });

  it("clamps invalid ranks safely", () => {
    assert.equal(defaultPointsForRank(0, 8), 0);
    assert.equal(defaultPointsForRank(9, 8), 0);
    assert.equal(defaultPointsForRank(NaN, 8), 0);
  });

  it("rounds to two decimal places", () => {
    const value = defaultPointsForRank(2, 7);
    assert.equal(value, Math.round(value * 100) / 100);
  });
});

describe("upsertOwnExternalIdentity", () => {
  it("rejects unsupported platforms", async () => {
    await assert.rejects(
      () =>
        upsertOwnExternalIdentity({} as never, {
          profileId: "p1",
          platform: "unknown",
          externalUsername: "x",
        }),
      /platform_not_supported/,
    );
  });

  it("requires at least an external id or username", async () => {
    await assert.rejects(
      () =>
        upsertOwnExternalIdentity({} as never, {
          profileId: "p1",
          platform: "discord",
        }),
      /identity_required_id_or_username/,
    );
  });

  it("upserts on (profile_id, platform)", async () => {
    const captured: { table?: string; payload?: unknown; onConflict?: string } = {};
    const supabase = {
      from(table: string) {
        captured.table = table;
        return makeStubBuilder(captured, {
          id: "id-1",
          profile_id: "p1",
          platform: "discord",
          external_id: "",
          external_username: "mario#0001",
          verified: false,
          notes: null,
          created_at: "",
          updated_at: "",
        });
      },
    };

    const result = await upsertOwnExternalIdentity(supabase as never, {
      profileId: "p1",
      platform: "discord",
      externalUsername: "mario#0001",
    });

    assert.equal(captured.table, "player_external_identities");
    assert.equal((captured.payload as Record<string, unknown>).profile_id, "p1");
    assert.equal((captured.payload as Record<string, unknown>).platform, "discord");
    assert.equal(result.platform, "discord");
  });
});

describe("deleteOwnExternalIdentity", () => {
  it("requires identity id", async () => {
    await assert.rejects(() => deleteOwnExternalIdentity({} as never, ""), /identity_id_required/);
  });
});

describe("recordTournamentResult", () => {
  it("rejects empty display_name", async () => {
    await assert.rejects(
      () =>
        recordTournamentResult({} as never, {
          eventId: "e1",
          displayName: "   ",
          finalRank: 1,
        }),
      /display_name_required/,
    );
  });

  it("rejects invalid final_rank", async () => {
    await assert.rejects(
      () =>
        recordTournamentResult({} as never, {
          eventId: "e1",
          displayName: "Mario",
          finalRank: 0,
        }),
      /final_rank_invalid/,
    );
  });

  it("uses (event_id, profile_id) onConflict for registered players", async () => {
    const captured: { table?: string; payload?: unknown; onConflict?: string } = {};
    const supabase = {
      from(table: string) {
        captured.table = table;
        return makeStubBuilder(captured, {
          id: "r1",
          event_id: "e1",
          profile_id: "p1",
          display_name: "Mario",
          external_handle: null,
          format: null,
          final_rank: 1,
          wins: 3,
          losses: 0,
          draws: 0,
          points: 1,
          meta: {},
          recorded_by: "staff-1",
          created_at: "",
          updated_at: "",
        });
      },
    };

    await recordTournamentResult(supabase as never, {
      eventId: "e1",
      profileId: "p1",
      displayName: "Mario",
      finalRank: 1,
      wins: 3,
      points: 1,
      recordedBy: "staff-1",
    });

    assert.equal(captured.onConflict, "event_id,profile_id");
    const payload = captured.payload as Record<string, unknown>;
    assert.equal(payload.profile_id, "p1");
    assert.equal(payload.wins, 3);
    assert.equal(payload.points, 1);
  });

  it("omits onConflict for walk-in (profile_id null)", async () => {
    const captured: { table?: string; payload?: unknown; onConflict?: string } = {};
    const supabase = {
      from() {
        return makeStubBuilder(captured, {
          id: "r2",
          event_id: "e1",
          profile_id: null,
          display_name: "Walkin Wonder",
          external_handle: null,
          format: null,
          final_rank: 4,
          wins: 1,
          losses: 2,
          draws: 0,
          points: 0,
          meta: {},
          recorded_by: null,
          created_at: "",
          updated_at: "",
        });
      },
    };

    await recordTournamentResult(supabase as never, {
      eventId: "e1",
      displayName: "Walkin Wonder",
      finalRank: 4,
    });

    assert.equal(captured.onConflict, undefined);
  });

  it("clamps negative wins/losses/draws", async () => {
    const captured: { table?: string; payload?: unknown; onConflict?: string } = {};
    const supabase = {
      from() {
        return makeStubBuilder(captured, {
          id: "r3",
          event_id: "e1",
          profile_id: null,
          display_name: "X",
          external_handle: null,
          format: null,
          final_rank: 2,
          wins: 0,
          losses: 0,
          draws: 0,
          points: 0,
          meta: {},
          recorded_by: null,
          created_at: "",
          updated_at: "",
        });
      },
    };

    await recordTournamentResult(supabase as never, {
      eventId: "e1",
      displayName: "X",
      finalRank: 2,
      wins: -3,
      losses: -1,
      draws: -2,
    });

    const payload = captured.payload as Record<string, unknown>;
    assert.equal(payload.wins, 0);
    assert.equal(payload.losses, 0);
    assert.equal(payload.draws, 0);
  });
});

describe("deleteTournamentResult", () => {
  it("requires result id", async () => {
    await assert.rejects(() => deleteTournamentResult({} as never, ""), /result_id_required/);
  });
});

describe("fetchLocalRanking", () => {
  it("returns empty array when slug is empty", async () => {
    const result = await fetchLocalRanking({} as never, "", 10);
    assert.deepEqual(result, []);
  });

  it("invokes local_player_ranking RPC and normalizes rows", async () => {
    const calls: RpcCall[] = [];
    const supabase = {
      rpc(name: string, args: Record<string, unknown>) {
        calls.push({ name, args });
        return Promise.resolve({
          data: [
            {
              player_key: "abc",
              display_name: "Luigi",
              profile_id: null,
              events_played: 4,
              total_points: 3.5,
              best_finish: 1,
              last_event_at: "2026-04-10T00:00:00Z",
            },
          ],
          error: null,
        });
      },
    };

    const rows = await fetchLocalRanking(supabase as never, "magic-the-gathering", 10);
    assert.equal(calls[0]?.name, "local_player_ranking");
    assert.deepEqual(calls[0]?.args, { p_game_slug: "magic-the-gathering", p_limit: 10 });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.events_played, 4);
    assert.equal(rows[0]?.total_points, 3.5);
    assert.equal(rows[0]?.best_finish, 1);
  });
});

describe("fetchLocalRankingSummary", () => {
  it("returns zero summary on empty slug", async () => {
    const summary = await fetchLocalRankingSummary({} as never, "");
    assert.equal(summary.total_players, 0);
    assert.equal(summary.total_results, 0);
    assert.equal(summary.last_event_at, null);
  });

  it("invokes local_ranking_summary RPC", async () => {
    const calls: RpcCall[] = [];
    const supabase = {
      rpc(name: string, args: Record<string, unknown>) {
        calls.push({ name, args });
        return Promise.resolve({
          data: { total_players: 12, total_results: 47, last_event_at: "2026-04-10T00:00:00Z" },
          error: null,
        });
      },
    };
    const summary = await fetchLocalRankingSummary(supabase as never, "beyblade-x");
    assert.equal(calls[0]?.name, "local_ranking_summary");
    assert.equal(summary.total_players, 12);
    assert.equal(summary.total_results, 47);
  });
});
