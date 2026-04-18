# Import risultati torneo

Questa guida spiega come portare in Mana Nero i risultati di un torneo
giocato sulle piattaforme ufficiali, in modo che alimentino la
**classifica locale** (`/giochi/<slug>/ranking`) e siano collegati ai
profili Mana Nero che hanno linkato la propria identità esterna in
`/protected#identita-esterne`.

## Quale modalità scegliere

| Modalità | Quando | Come |
|---|---|---|
| **Sync da URL pubblico** | Hai un CSV pubblicato online (Google Sheets, Dropbox, S3) | `/admin/events/<id>/scoring/import` → "Sync da fonte remota" → URL CSV pubblico |
| **CSV paste** | Hai il file ma non vuoi pubblicarlo | Apri il CSV, copia il contenuto e incollalo nel textarea |
| **CSV upload** | Hai il file in locale | Stesso schermo, campo "File CSV" |

> Per ogni import puoi rivedere riga-per-riga, forzare walk-in, **collegare
> manualmente a un profilo Mana Nero** via search picker, o saltare.

## Format dei CSV riconosciuti automaticamente

Il parser fa **auto-detect** in base agli header. Funziona con virgola o
punto e virgola, BOM Excel, virgolette, decimali con virgola o punto.

### Wizards EventLink (Magic the Gathering)

Header tipici:
```
Place,Name,DCI #,Match Points,Wins,Losses,Draws
```
Auto-link: `DCI #` → `player_external_identities.platform = wizards_companion`.

**Come esportare**:
1. EventLink → seleziona il torneo
2. Standings → "Export to CSV"
3. Salva il file localmente

> Wizards non espone API pubbliche per il sync diretto: solo i WPN
> Premium con accordo bilaterale potrebbero ottenere accesso. Per ora
> l'import è **manuale (CSV)**.

### Play! Pokémon (TOM / RK9)

Header tipici:
```
Place,Player,Player ID,W-L-T,Match Points
```
Auto-link: `Player ID` → `player_external_identities.platform = play_pokemon`.

**Come esportare**:
- TOM (TCG Tournament Manager): Reports → Standings → Export CSV
- RK9: copia la tabella standings dalla pagina pubblica del torneo
  in un foglio Excel/Google Sheets, salva come CSV

### Bandai TCG+ (One Piece, Dragon Ball Super, ecc.)

Header tipici:
```
Rank,Name,BNID,W,L,D,Points
```
Auto-link: `BNID` → `player_external_identities.platform = bandai_tcg_plus`.

**Come esportare**:
- TCG+ Dashboard organizer → tournament → Standings → Export

### Melee.gg

Header tipici (export organizer):
```
Player,Place,Wins,Losses,Draws,Points
```
Source CSV: `generic`.

**Come esportare**:
- Melee.gg → Tournament → Standings → Export to CSV

### Generico

Qualsiasi CSV con header almeno tra:
- `display_name` / `name` / `player`
- `final_rank` / `place` / `rank`
- (opzionali) `wins`, `losses`, `draws`, `points`, `external_handle`,
  `format`

## Come funziona l'auto-link

1. Il giocatore va in `/protected#identita-esterne` e collega il proprio
   account ufficiale (es. DCI 1234567 per Magic).
2. Lo staff importa il CSV.
3. Per ogni riga, il sistema cerca un'identità esterna che corrisponda
   a `external_handle` (preferibilmente `external_id`, in fallback
   `external_username`).
4. Se trovata, la riga è **auto-linked** (badge verde). Altrimenti è
   trattata come **walk-in** (`profile_id = NULL`, ma il `display_name`
   resta in classifica).
5. Lo staff può confermare, forzare walk-in, **collegare manualmente** a
   un profilo Mana Nero via search picker, o saltare la riga.

## Idempotenza

Gli upsert sono idempotenti grazie a due UNIQUE index:

- `(event_id, profile_id)` — un profilo Mana Nero ha un solo risultato
  per evento.
- `(event_id, lower(display_name))` parziale — i walk-in non si
  duplicano sullo stesso nome.

Re-importare lo stesso CSV **aggiorna** i record esistenti senza
duplicare. Per un reset completo c'è il pulsante "Cancella tutti i
risultati" sulla pagina scoring (richiede conferma testuale `CANCELLA`).

## Sicurezza

- **Chi può importare**: solo utenti con ruolo `staff` o `admin`.
- **RLS**: i risultati `tournament_results` sono leggibili pubblicamente
  in forma aggregata via `local_player_ranking()` (SECURITY DEFINER); le
  identità esterne sono leggibili solo dall'utente proprietario o dallo
  staff.
- **Audit**: ogni import è loggato in `crm_audit_log` con
  `action_type = 'csv_import_tournament_results'` (sorgente, righe
  totali, override, walk-in, fallimenti).
- **SSRF**: il fetcher per URL remoti accetta solo HTTPS, blocca IP
  privati / loopback / link-local / metadata cloud, limita la dimensione
  a 5 MB con stream cap.

## Limiti attuali

- Max **1000 righe per import** (per file più grandi splittare).
- Max **5 MB** per URL remoto, **2 MB** per file upload.
- Le piattaforme proprietarie (Wizards Companion, RK9, Bandai TCG+) non
  espongono API pubbliche: il sync richiede sempre un export manuale.
- Adapter `melee_gg_public` esiste come stub: l'API interna richiede
  autenticazione che non vogliamo automatizzare. Esporta dal dashboard
  Melee come CSV.
