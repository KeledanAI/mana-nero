/**
 * Parser CSV per import risultati torneo (lib pura, no dipendenze).
 *
 * Supporta:
 * - Encoding UTF-8 con o senza BOM.
 * - Separatore auto-detect fra "," e ";" (Excel europeo).
 * - Quoting RFC-4180 con doppi-doppi-apici "" come escape.
 * - Newline CRLF / LF / CR.
 * - Header detection multi-formato (EventLink, Play! Pokémon, Bandai TCG+, generic).
 * - Decimali con `.` o `,` (auto-normalizzati).
 *
 * Output: array di `ParsedTournamentRow` normalizzati. Ogni riga con problemi
 * non blocca il batch: ritorna `errors[]` separato.
 */

export type CsvImportSource =
  | "wizards_eventlink"
  | "play_pokemon"
  | "bandai_tcg_plus"
  | "generic";

export const CSV_IMPORT_SOURCES: readonly CsvImportSource[] = [
  "wizards_eventlink",
  "play_pokemon",
  "bandai_tcg_plus",
  "generic",
] as const;

export const CSV_IMPORT_SOURCE_LABELS: Record<CsvImportSource, string> = {
  wizards_eventlink: "Wizards EventLink (Magic / WPN)",
  play_pokemon: "Play! Pokémon (TOM / RK9)",
  bandai_tcg_plus: "Bandai TCG+ (One Piece / DBSCG)",
  generic: "Generic (display_name, rank, wins, losses, draws[, points, format])",
};

export type ParsedTournamentRow = {
  /** Nome a tabellone (sempre presente, trimmed). */
  display_name: string;
  /** Rank finale (>=1). */
  final_rank: number;
  wins: number;
  losses: number;
  draws: number;
  /** Punti override opzionali (es. SwissPoints di EventLink). */
  points: number | null;
  /** Handle/ID esterno per auto-link (DCI / BNID / Player ID). */
  external_handle: string | null;
  /** Formato torneo opzionale (es. "Standard", "Modern"). */
  format: string | null;
  /** Numero riga sorgente (1-based, escluso header). Per error reporting. */
  source_row: number;
};

export type ParseError = {
  source_row: number;
  reason: string;
  raw?: Record<string, string>;
};

export type ParseResult = {
  source: CsvImportSource;
  rows: ParsedTournamentRow[];
  errors: ParseError[];
  /** Header riconosciuti (chiave canonica → indice colonna sorgente). */
  recognized_headers: Partial<Record<CanonicalField, string>>;
};

type CanonicalField =
  | "display_name"
  | "final_rank"
  | "wins"
  | "losses"
  | "draws"
  | "points"
  | "external_handle"
  | "format";

const HEADER_ALIASES: Record<CanonicalField, string[]> = {
  display_name: [
    "display_name",
    "displayname",
    "name",
    "player",
    "player_name",
    "playername",
    "nome",
    "giocatore",
    "full_name",
  ],
  final_rank: [
    "final_rank",
    "finalrank",
    "rank",
    "place",
    "placement",
    "standing",
    "posizione",
    "piazzamento",
  ],
  wins: ["wins", "w", "vittorie", "match_wins", "matchwins"],
  losses: ["losses", "l", "sconfitte", "match_losses", "matchlosses"],
  draws: ["draws", "d", "ties", "pareggi", "match_draws", "matchdraws"],
  points: [
    "points",
    "match_points",
    "matchpoints",
    "swiss_points",
    "swisspoints",
    "punti",
    "score",
  ],
  external_handle: [
    "external_handle",
    "externalhandle",
    "dci",
    "dci_number",
    "dcinumber",
    "bnid",
    "player_id",
    "playerid",
    "pokemon_id",
    "pokemonid",
    "wizards_id",
    "wizardsid",
    "handle",
  ],
  format: ["format", "formato", "event_format", "eventformat"],
};

const SOURCE_HINTS: Record<Exclude<CsvImportSource, "generic">, RegExp[]> = {
  wizards_eventlink: [/dci/, /eventlink/, /wpn/, /wizards/],
  play_pokemon: [/playerid/, /pokemonid/, /play[!_ ]?pokemon/, /\brk9\b/, /\btom\b/],
  bandai_tcg_plus: [/bandai/, /bnid/, /tcg\s*\+/],
};

/**
 * Tokenize una riga CSV rispettando quoting RFC-4180.
 */
function tokenizeRow(line: string, separator: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === separator) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function detectSeparator(headerLine: string): string {
  const commaCount = (headerLine.match(/,/g) ?? []).length;
  const semiCount = (headerLine.match(/;/g) ?? []).length;
  if (semiCount > commaCount) return ";";
  return ",";
}

function normalizeHeader(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .trim()
    .replace(/[\s\-./()]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function buildHeaderMap(rawHeaders: string[]): {
  index: Partial<Record<CanonicalField, number>>;
  recognized: Partial<Record<CanonicalField, string>>;
  normalized: string[];
} {
  const normalized = rawHeaders.map(normalizeHeader);
  const index: Partial<Record<CanonicalField, number>> = {};
  const recognized: Partial<Record<CanonicalField, string>> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [
    CanonicalField,
    string[],
  ][]) {
    for (let i = 0; i < normalized.length; i += 1) {
      if (aliases.includes(normalized[i] ?? "")) {
        index[field] = i;
        recognized[field] = rawHeaders[i] ?? "";
        break;
      }
    }
  }
  return { index, recognized, normalized };
}

function detectSourceFromHeaders(normalized: string[]): CsvImportSource {
  const flat = normalized.join("|");
  for (const [source, patterns] of Object.entries(SOURCE_HINTS) as [
    Exclude<CsvImportSource, "generic">,
    RegExp[],
  ][]) {
    if (patterns.some((re) => re.test(flat))) {
      return source;
    }
  }
  return "generic";
}

function parseInteger(raw: string | undefined): number {
  if (raw == null) return 0;
  const cleaned = String(raw).replace(/[^\d-]/g, "");
  if (cleaned === "" || cleaned === "-") return 0;
  const n = Number.parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : 0;
}

function parseDecimal(raw: string | undefined): number | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (trimmed === "") return null;
  const normalized = trimmed.includes(",") && !trimmed.includes(".")
    ? trimmed.replace(/,/g, ".")
    : trimmed.replace(/(?<=\d),(?=\d{3}\b)/g, "");
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

function splitLines(input: string): string[] {
  return input.replace(/\r\n?/g, "\n").split("\n");
}

export type ParseOptions = {
  /** Forza un source specifico ignorando la detection. */
  forceSource?: CsvImportSource;
  /** Limite max di righe processate. Default 1000. */
  maxRows?: number;
};

export function parseTournamentResultsCsv(
  raw: string,
  options: ParseOptions = {},
): ParseResult {
  const errors: ParseError[] = [];
  const rows: ParsedTournamentRow[] = [];

  const cleaned = (raw ?? "").replace(/^\uFEFF/, "");
  const lines = splitLines(cleaned).filter((line) => line.trim() !== "");
  if (lines.length === 0) {
    return {
      source: options.forceSource ?? "generic",
      rows,
      errors: [{ source_row: 0, reason: "csv_empty" }],
      recognized_headers: {},
    };
  }

  const separator = detectSeparator(lines[0] ?? "");
  const rawHeaders = tokenizeRow(lines[0] ?? "", separator);
  const { index, recognized, normalized } = buildHeaderMap(rawHeaders);
  const source = options.forceSource ?? detectSourceFromHeaders(normalized);

  if (index.display_name == null) {
    errors.push({
      source_row: 1,
      reason: "header_missing_display_name",
    });
    return { source, rows, errors, recognized_headers: recognized };
  }
  if (index.final_rank == null) {
    errors.push({ source_row: 1, reason: "header_missing_final_rank" });
    return { source, rows, errors, recognized_headers: recognized };
  }

  const dataLines = lines.slice(1, 1 + (options.maxRows ?? 1000));
  dataLines.forEach((line, lineIdx) => {
    const sourceRow = lineIdx + 2;
    const cells = tokenizeRow(line, separator);
    const fieldAt = (field: CanonicalField): string | undefined => {
      const i = index[field];
      if (i == null) return undefined;
      return cells[i]?.trim();
    };

    const rawForError = (): Record<string, string> => {
      const out: Record<string, string> = {};
      for (let i = 0; i < cells.length; i += 1) {
        out[rawHeaders[i] ?? `col_${i}`] = (cells[i] ?? "").trim();
      }
      return out;
    };

    const displayName = (fieldAt("display_name") ?? "").trim();
    if (!displayName) {
      errors.push({
        source_row: sourceRow,
        reason: "display_name_empty",
        raw: rawForError(),
      });
      return;
    }

    const rankRaw = fieldAt("final_rank");
    const rank = parseInteger(rankRaw);
    if (!Number.isFinite(rank) || rank < 1) {
      errors.push({
        source_row: sourceRow,
        reason: "final_rank_invalid",
        raw: rawForError(),
      });
      return;
    }

    rows.push({
      display_name: displayName,
      final_rank: rank,
      wins: Math.max(0, parseInteger(fieldAt("wins"))),
      losses: Math.max(0, parseInteger(fieldAt("losses"))),
      draws: Math.max(0, parseInteger(fieldAt("draws"))),
      points: parseDecimal(fieldAt("points")),
      external_handle: (fieldAt("external_handle") ?? "") || null,
      format: (fieldAt("format") ?? "") || null,
      source_row: sourceRow,
    });
  });

  return {
    source,
    rows,
    errors,
    recognized_headers: recognized,
  };
}
