/**
 * Messaggi staff leggibili per `?error=` su `/admin/comms`
 * (codici da server action o testi tecnici da Postgres / PostgREST).
 */
const MAX_DB_DETAIL = 220;

function truncDetail(s: string, max = MAX_DB_DETAIL): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}...`;
}

/** Messaggio italiano per errori DB ricorrenti su `comms_campaigns` / enqueue; altrimenti `null`. */
function formatDatabaseHeuristicMessage(raw: string): string | null {
  const u = raw;
  if (/duplicate key|unique constraint/i.test(u)) {
    return "Esiste già un record campagna con questo slug. Scegli un altro slug o aggiorna il record esistente.";
  }
  if (/comms_campaigns_segment_kind|segment_kind.*check/i.test(u)) {
    return "Il segmento non è accettato dal database: applica le migrazioni Supabase aggiornate (CHECK su comms_campaigns) oppure usa un segmento consentito.";
  }
  if (/violates check constraint/i.test(u)) {
    return `I dati non rispettano un vincolo del database. Dettaglio: ${truncDetail(raw)}`;
  }
  return null;
}

export function formatCommsAdminPageError(codeOrMessage: string): string {
  const s = codeOrMessage.trim();
  if (!s) return "";

  switch (s) {
    case "slug_invalid":
      return "Lo slug campagna non è valido (lettere minuscole, numeri e trattini; massimo 64 caratteri).";
    case "title_required":
      return "Il titolo interno del record campagna è obbligatorio.";
    case "campaign_id_invalid":
      return "Inserisci uno slug campagna valido per l'accodamento manuale, oppure scegli un record salvato.";
    case "subject_required":
      return "L'oggetto email è obbligatorio quando non usi un record salvato.";
    case "subject_required_for_record":
      return "Il record campagna non ha né oggetto né titolo utilizzabile come oggetto email.";
    case "campaign_slug_invalid_in_record":
      return "Il record campagna contiene uno slug non valido; aggiorna il record o ricrealo.";
    case "campaign_record_not_found":
      return "Record campagna non trovato o non accessibile.";
    case "reminder_scan_failed":
      return "Scan reminder non riuscito. Riprova o controlla i log / configurazione cron.";
    case "campaign_enqueue_failed":
      return "Accodamento campagna non riuscito. Verifica i dati o i log server.";
    default: {
      const db = formatDatabaseHeuristicMessage(s);
      return db ?? s;
    }
  }
}
