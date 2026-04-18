/**
 * Adapter framework per il sync di risultati torneo da fonti esterne.
 *
 * Filosofia onesta: oggi le piattaforme proprietarie (Wizards Companion,
 * Play! Pokémon RK9, Bandai TCG+) non espongono API pubbliche utilizzabili
 * senza accordi commerciali. Tenere comunque il framework pronto serve a
 * tre scopi:
 *
 * 1. Permettere import remoti generici (URL CSV pubblico) — è l'unico
 *    adapter realmente operativo oggi.
 * 2. Documentare in modo machine-readable lo stato di ogni piattaforma
 *    (`status: 'available' | 'manual_only' | 'requires_partnership'`),
 *    così la UI può mostrare il messaggio corretto.
 * 3. Lasciare il punto di estensione minimo per quando una piattaforma
 *    aprirà API o un tournament organizer regalerà al negozio una
 *    integrazione (es. RK9 partner, EventLink WPN bilateral).
 *
 * Tutti gli adapter ritornano lo stesso payload `AdapterFetchResult`
 * (testo CSV + source) che alimenta la pipeline preview/commit di slice 2-3.
 */

import { safeFetchText, SafeFetchError } from "./safe-fetch";
import type { CsvImportSource } from "./tournament-results-csv";

export type AdapterId =
  | "remote_csv_url"
  | "wizards_companion_oauth"
  | "play_pokemon_rk9"
  | "bandai_tcg_plus"
  | "melee_gg_public";

export type AdapterStatus = "available" | "manual_only" | "requires_partnership";

export type AdapterDescriptor = {
  id: AdapterId;
  name: string;
  status: AdapterStatus;
  /** Source CSV preferita per la pipeline downstream. */
  default_csv_source: CsvImportSource;
  description: string;
  /** Istruzioni di setup mostrate in UI. */
  manual_instructions: string;
};

export type AdapterFetchInput = {
  /** URL pubblico (per remote_csv_url) o ID torneo nei sistemi futuri. */
  reference: string;
};

export type AdapterFetchResult = {
  csv_text: string;
  source: CsvImportSource;
  fetched_url: string | null;
};

export type AdapterFetchErrorReason =
  | "not_implemented"
  | "requires_partnership"
  | "invalid_reference"
  | "fetch_failed"
  | "remote_error";

export class AdapterFetchError extends Error {
  constructor(
    public readonly adapter: AdapterId,
    public readonly reason: AdapterFetchErrorReason,
    message?: string,
  ) {
    super(message ?? `${adapter}:${reason}`);
    this.name = "AdapterFetchError";
  }
}

export interface TournamentResultAdapter {
  descriptor(): AdapterDescriptor;
  fetch(input: AdapterFetchInput): Promise<AdapterFetchResult>;
}

// ---------------------------------------------------------------------------
// remote_csv_url — adapter pienamente operativo
// ---------------------------------------------------------------------------
class RemoteCsvUrlAdapter implements TournamentResultAdapter {
  descriptor(): AdapterDescriptor {
    return {
      id: "remote_csv_url",
      name: "URL CSV pubblico",
      status: "available",
      default_csv_source: "generic",
      description:
        "Scarica un CSV da un URL HTTPS pubblico (Google Sheets export, Dropbox link diretto, S3 signed URL, ecc.) e lo passa al parser standard.",
      manual_instructions:
        "Esporta i risultati in CSV con qualunque tool e pubblica il file su uno storage HTTPS pubblico. Per Google Sheets: File → Condividi → 'Chiunque con link' → File → Scarica → CSV (copia l'URL `export?format=csv` dalla barra). Max 5 MB.",
    };
  }

  async fetch(input: AdapterFetchInput): Promise<AdapterFetchResult> {
    if (!input.reference?.trim()) {
      throw new AdapterFetchError("remote_csv_url", "invalid_reference");
    }
    try {
      const result = await safeFetchText(input.reference.trim());
      return {
        csv_text: result.body,
        source: "generic",
        fetched_url: result.url,
      };
    } catch (e) {
      if (e instanceof SafeFetchError) {
        throw new AdapterFetchError("remote_csv_url", "fetch_failed", e.code);
      }
      throw new AdapterFetchError("remote_csv_url", "remote_error", e instanceof Error ? e.message : undefined);
    }
  }
}

// ---------------------------------------------------------------------------
// Stub adapters — esistono per documentare lo status e dare alla UI la lista
// completa. Quando un giorno sarà disponibile un'API ufficiale, basterà
// implementarne il body e cambiare `status` a 'available'.
// ---------------------------------------------------------------------------
class WizardsCompanionAdapter implements TournamentResultAdapter {
  descriptor(): AdapterDescriptor {
    return {
      id: "wizards_companion_oauth",
      name: "Wizards Companion (Magic / WPN)",
      status: "requires_partnership",
      default_csv_source: "wizards_eventlink",
      description:
        "Sync diretto da Wizards Companion. Wizards non espone OAuth pubblico: l'integrazione è disponibile solo a WPN Premium con accordo bilaterale.",
      manual_instructions:
        "EventLink → torneo → Standings → Export CSV → carica con il tab 'CSV'. La colonna DCI nel CSV ufficiale viene auto-collegata ai profili Mana Nero che hanno linkato il proprio DCI in /protected#identita-esterne.",
    };
  }

  async fetch(): Promise<AdapterFetchResult> {
    throw new AdapterFetchError(
      "wizards_companion_oauth",
      "requires_partnership",
      "Wizards Companion non espone API pubbliche. Usa il tab 'CSV' con l'export di EventLink.",
    );
  }
}

class PlayPokemonAdapter implements TournamentResultAdapter {
  descriptor(): AdapterDescriptor {
    return {
      id: "play_pokemon_rk9",
      name: "Play! Pokémon (RK9 / TOM)",
      status: "manual_only",
      default_csv_source: "play_pokemon",
      description:
        "Sync da RK9 / TOM. Le pagine pubbliche non espongono JSON e lo scraping HTML è instabile e contrattualmente sconsigliato.",
      manual_instructions:
        "TOM → Reports → Standings (CSV) — oppure copia la tabella standings dalla pagina pubblica RK9 in un foglio Excel e salva come CSV. Importalo con il tab 'CSV'. La colonna PlayerID viene auto-collegata.",
    };
  }

  async fetch(): Promise<AdapterFetchResult> {
    throw new AdapterFetchError(
      "play_pokemon_rk9",
      "not_implemented",
      "Importa l'export TOM/RK9 con il tab 'CSV'.",
    );
  }
}

class BandaiTcgPlusAdapter implements TournamentResultAdapter {
  descriptor(): AdapterDescriptor {
    return {
      id: "bandai_tcg_plus",
      name: "Bandai TCG+ (One Piece, DBSCG, ecc.)",
      status: "manual_only",
      default_csv_source: "bandai_tcg_plus",
      description:
        "Bandai TCG+ non offre export pubblico per le sale. L'OP può usare il proprio dashboard per esportare i risultati in CSV manuale.",
      manual_instructions:
        "TCG+ Dashboard → tournament → Standings → Export. Il CSV deve contenere almeno colonne Name, BNID, Place, W/L/D. Importalo con il tab 'CSV'.",
    };
  }

  async fetch(): Promise<AdapterFetchResult> {
    throw new AdapterFetchError(
      "bandai_tcg_plus",
      "not_implemented",
      "Importa l'export del dashboard TCG+ con il tab 'CSV'.",
    );
  }
}

class MeleeGgAdapter implements TournamentResultAdapter {
  descriptor(): AdapterDescriptor {
    return {
      id: "melee_gg_public",
      name: "Melee.gg (eventi pubblici)",
      status: "manual_only",
      default_csv_source: "generic",
      description:
        "Melee.gg ha un'API interna autenticata; le pagine pubbliche degli standings sono scaricabili come CSV dall'organizzatore loggato.",
      manual_instructions:
        "Da Melee.gg, come organizer del torneo: Tournament → Standings → Export to CSV. Importa con il tab 'CSV' o, se hai un URL pubblico al CSV esportato, usa il tab 'URL'.",
    };
  }

  async fetch(): Promise<AdapterFetchResult> {
    throw new AdapterFetchError(
      "melee_gg_public",
      "not_implemented",
      "Esporta dal dashboard Melee.gg e usa CSV o URL.",
    );
  }
}

const REGISTRY: Record<AdapterId, TournamentResultAdapter> = {
  remote_csv_url: new RemoteCsvUrlAdapter(),
  wizards_companion_oauth: new WizardsCompanionAdapter(),
  play_pokemon_rk9: new PlayPokemonAdapter(),
  bandai_tcg_plus: new BandaiTcgPlusAdapter(),
  melee_gg_public: new MeleeGgAdapter(),
};

export const ADAPTER_IDS: readonly AdapterId[] = Object.keys(REGISTRY) as AdapterId[];

export function getAdapter(id: AdapterId): TournamentResultAdapter {
  const adapter = REGISTRY[id];
  if (!adapter) {
    throw new AdapterFetchError("remote_csv_url", "invalid_reference", `unknown adapter: ${id}`);
  }
  return adapter;
}

export function listAdapters(): AdapterDescriptor[] {
  return ADAPTER_IDS.map((id) => REGISTRY[id].descriptor());
}
