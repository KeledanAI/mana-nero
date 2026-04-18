import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseTournamentResultsCsv } from "./tournament-results-csv";

describe("parseTournamentResultsCsv", () => {
  it("returns csv_empty error on blank input", () => {
    const r = parseTournamentResultsCsv("");
    assert.equal(r.rows.length, 0);
    assert.equal(r.errors[0]?.reason, "csv_empty");
  });

  it("parses generic CSV with comma separator", () => {
    const csv = [
      "display_name,final_rank,wins,losses,draws",
      "Mario Rossi,1,3,0,1",
      "Luigi Bianchi,2,2,1,1",
    ].join("\n");
    const r = parseTournamentResultsCsv(csv);
    assert.equal(r.source, "generic");
    assert.equal(r.rows.length, 2);
    assert.equal(r.rows[0]?.display_name, "Mario Rossi");
    assert.equal(r.rows[0]?.final_rank, 1);
    assert.equal(r.rows[0]?.wins, 3);
    assert.equal(r.rows[0]?.draws, 1);
  });

  it("auto-detects semicolon separator (Excel europeo)", () => {
    const csv = [
      "name;rank;w;l;d",
      "Anna;1;3;0;0",
    ].join("\n");
    const r = parseTournamentResultsCsv(csv);
    assert.equal(r.rows.length, 1);
    assert.equal(r.rows[0]?.display_name, "Anna");
    assert.equal(r.rows[0]?.final_rank, 1);
    assert.equal(r.rows[0]?.wins, 3);
  });

  it("strips UTF-8 BOM", () => {
    const csv = `\uFEFFname,rank\nGianni,5`;
    const r = parseTournamentResultsCsv(csv);
    assert.equal(r.rows.length, 1);
    assert.equal(r.rows[0]?.display_name, "Gianni");
  });

  it("handles quoted fields with embedded commas", () => {
    const csv = [
      `name,rank,wins`,
      `"Rossi, Mario",1,3`,
    ].join("\n");
    const r = parseTournamentResultsCsv(csv);
    assert.equal(r.rows[0]?.display_name, "Rossi, Mario");
    assert.equal(r.rows[0]?.wins, 3);
  });

  it("handles RFC-4180 escaped double quotes", () => {
    const csv = [
      `name,rank`,
      `"Mario ""The Wizard"" Rossi",1`,
    ].join("\n");
    const r = parseTournamentResultsCsv(csv);
    assert.equal(r.rows[0]?.display_name, 'Mario "The Wizard" Rossi');
  });

  it("normalizes decimal commas in points", () => {
    const csv = [
      "name;rank;points",
      "Anna;1;1,50",
    ].join("\n");
    const r = parseTournamentResultsCsv(csv);
    assert.equal(r.rows[0]?.points, 1.5);
  });

  it("detects Wizards EventLink via DCI header", () => {
    const csv = [
      "Player Name,DCI,Final Rank,Match Wins,Match Losses,Match Draws,Match Points",
      "Mario Rossi,1234567,1,4,0,0,12",
    ].join("\n");
    const r = parseTournamentResultsCsv(csv);
    assert.equal(r.source, "wizards_eventlink");
    assert.equal(r.rows[0]?.external_handle, "1234567");
    assert.equal(r.rows[0]?.points, 12);
    assert.equal(r.rows[0]?.wins, 4);
  });

  it("detects Play! Pokémon via PlayerID header", () => {
    const csv = [
      "Player Name,PlayerID,Standing,Wins,Losses,Ties",
      "Ash Ketchum,9876543,1,5,0,0",
    ].join("\n");
    const r = parseTournamentResultsCsv(csv);
    assert.equal(r.source, "play_pokemon");
    assert.equal(r.rows[0]?.external_handle, "9876543");
    assert.equal(r.rows[0]?.draws, 0);
  });

  it("detects Bandai TCG+ via BNID header", () => {
    const csv = [
      "Name,BNID,Place,W,L,D",
      "Luffy,bnid-001,1,3,0,1",
    ].join("\n");
    const r = parseTournamentResultsCsv(csv);
    assert.equal(r.source, "bandai_tcg_plus");
    assert.equal(r.rows[0]?.external_handle, "bnid-001");
  });

  it("skips rows missing display_name with explicit error", () => {
    const csv = [
      "name,rank,wins",
      ",1,3",
      "Mario,2,2",
    ].join("\n");
    const r = parseTournamentResultsCsv(csv);
    assert.equal(r.rows.length, 1);
    assert.equal(r.errors.length, 1);
    assert.equal(r.errors[0]?.reason, "display_name_empty");
    assert.equal(r.errors[0]?.source_row, 2);
  });

  it("skips rows with invalid rank with explicit error", () => {
    const csv = [
      "name,rank,wins",
      "Mario,0,3",
      "Luigi,abc,2",
      "Peach,1,4",
    ].join("\n");
    const r = parseTournamentResultsCsv(csv);
    assert.equal(r.rows.length, 1);
    assert.equal(r.rows[0]?.display_name, "Peach");
    assert.equal(r.errors.length, 2);
    assert.ok(r.errors.every((e) => e.reason === "final_rank_invalid"));
  });

  it("returns header_missing_display_name when impossible to map", () => {
    const csv = ["foo,bar,baz", "1,2,3"].join("\n");
    const r = parseTournamentResultsCsv(csv);
    assert.equal(r.errors[0]?.reason, "header_missing_display_name");
    assert.equal(r.rows.length, 0);
  });

  it("returns header_missing_final_rank when only display_name present", () => {
    const csv = ["name,wins", "Mario,3"].join("\n");
    const r = parseTournamentResultsCsv(csv);
    assert.equal(r.errors[0]?.reason, "header_missing_final_rank");
  });

  it("clamps negative numeric fields to 0", () => {
    const csv = [
      "name,rank,wins,losses,draws",
      "Mario,1,-3,-1,-2",
    ].join("\n");
    const r = parseTournamentResultsCsv(csv);
    assert.equal(r.rows[0]?.wins, 0);
    assert.equal(r.rows[0]?.losses, 0);
    assert.equal(r.rows[0]?.draws, 0);
  });

  it("respects forceSource option", () => {
    const csv = ["name,rank", "Mario,1"].join("\n");
    const r = parseTournamentResultsCsv(csv, { forceSource: "wizards_eventlink" });
    assert.equal(r.source, "wizards_eventlink");
  });

  it("handles CRLF line endings", () => {
    const csv = "name,rank\r\nMario,1\r\nLuigi,2\r\n";
    const r = parseTournamentResultsCsv(csv);
    assert.equal(r.rows.length, 2);
  });

  it("respects maxRows limit", () => {
    const csv = ["name,rank", "A,1", "B,2", "C,3"].join("\n");
    const r = parseTournamentResultsCsv(csv, { maxRows: 2 });
    assert.equal(r.rows.length, 2);
  });

  it("source_row is 1-based pointing at original line", () => {
    const csv = ["name,rank", "Mario,1", "Luigi,2"].join("\n");
    const r = parseTournamentResultsCsv(csv);
    assert.equal(r.rows[0]?.source_row, 2);
    assert.equal(r.rows[1]?.source_row, 3);
  });
});
