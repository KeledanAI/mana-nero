# Report stato codice - 18 aprile 2026

## Executive summary

Il progetto oggi è **molto più di un MVP**. Non è un semplice sito eventi: è già una piattaforma operativa per un negozio fisico con queste aree sostanzialmente presenti:

- sito pubblico con homepage, news, eventi e pagine gioco;
- autenticazione e area utente;
- prenotazioni evento con waitlist e stato `pending_payment`;
- pagamenti evento con Stripe;
- check-in staff e check-in via QR/token;
- CRM staff con scheda profilo, timeline, note e export CSV;
- comunicazioni via outbox con reminder, campagne segmentate e cron;
- analytics staff;
- richieste prodotto evolute verso preorder/stock alert;
- test unitari e pipeline CI già impostate.

La base è quindi **seria e riutilizzabile**. Il codice non dà l’impressione di un prototipo improvvisato: l’architettura è coerente con la direzione “events + community + CRM first”, la separazione dei layer è leggibile e la parte SQL/Supabase è trattata come contratto di dominio, non come dettaglio secondario.

Detto questo, il progetto **non è ancora “chiuso” come prodotto**. È in una fase in cui molte cose importanti esistono già, ma vanno rese più solide, più leggibili per lo staff e più complete sul piano operativo.

## Come ho verificato il repository

Ho controllato:

- struttura del repo e documentazione (`README.md`, `PRD.md`, `ROADMAP.md`, `CLAUDE.md`, `docs/`);
- aree chiave del codice (`app/`, `lib/`, `components/`, `scripts/`, `supabase/migrations/`);
- test automatici;
- build di produzione;
- stato dipendenze;
- audit dipendenze npm.

Esito pratico:

- `npm run test`: **passa** (`62` test verdi, `0` falliti).
- `npm run build`: **passa**, dopo allineamento dipendenze locali con `npm install`.
- `npm audit --json`: segnala **1 vulnerabilità high** su `next` (`16.2.2`, advisory DoS sui Server Components; fix disponibile `16.2.4`).
- `npm run test:e2e`: **non eseguito** in questa analisi.

## Stato attuale del prodotto

### 1. Fondazione tecnica

La fondazione è buona.

Punti forti:

- struttura chiara dei layer:
  - `app/*` per route e server actions;
  - `lib/domain/*` per il dominio;
  - `lib/gamestore/*` per query helper e data shaping;
  - `lib/comms/*` per outbox e runtime comunicazioni;
  - `lib/supabase/*` per client ed env;
  - `supabase/migrations/*` per il contratto dati.
- scelta architetturale forte e corretta sul booking: tutto passa dalla RPC `event_registration_action`;
- RLS trattata come regola vera e non come dettaglio opzionale;
- slugs, enum e schema evoluti in modo additivo;
- convenzioni documentate abbastanza bene in [`CLAUDE.md`](../CLAUDE.md), [`PRD.md`](../PRD.md) e [`ROADMAP.md`](../ROADMAP.md).

Tradotto in linguaggio semplice: **la codebase ha una direzione**. Non sembra un insieme casuale di pagine React.

### 2. Feature già sviluppate davvero

#### Pubblico / front office

Funzionano o risultano chiaramente implementate:

- homepage editoriale e orientata alla community;
- elenco eventi e dettaglio evento;
- news e dettaglio news;
- hub giochi e pagine gioco dedicate;
- contatti;
- richieste prodotto;
- login, signup, reset password;
- area utente con stato iscrizioni e richieste prodotto.

#### Eventi e prenotazioni

La parte eventi è già corposa:

- creazione e gestione eventi da admin;
- booking e cancellazione;
- waitlist;
- stato `pending_payment`;
- checkout Stripe;
- webhook Stripe;
- check-in staff;
- QR check-in pubblico tramite token;
- export CSV partecipanti.

#### CRM e staff operations

È già oltre il “CRM lite”:

- elenco profili;
- ricerca e filtri;
- scheda cliente;
- note staff;
- timeline unificata;
- export CSV;
- campi CRM aggiuntivi come telefono, tag e lead stage;
- audit trail per alcune azioni staff.

#### Comunicazioni

La parte comunicazioni è una delle aree più mature:

- outbox con idempotenza;
- worker batch dedicato;
- reminder eventi 24h e 7 giorni;
- campagne segmentate staff;
- logica di skip consenso;
- cron route protette da bearer secret;
- metriche base outbox in admin.

#### Analytics

La dashboard staff esiste già e non è solo cosmetica:

- riepiloghi eventi / registrazioni / outbox / richieste prodotto;
- metriche waitlist;
- breakdown campagne;
- breakdown per slug campagna;
- confronto con finestra precedente.

## Cosa oggi è solido

### Booking e dominio

La scelta di centralizzare il booking nella RPC è una delle decisioni migliori del progetto. Riduce il rischio di:

- incoerenze fra UI e database;
- logica duplicata fra frontend e backend;
- bug di capacità / waitlist sparsi in più punti.

### Comunicazioni

L’outbox è trattato bene: c’è una distinzione chiara fra enqueue e dispatch, c’è idempotenza, ci sono test dedicati, ci sono route cron separate. È una base sensata per crescere.

### CRM staff

Per un prodotto di questa dimensione, la combinazione di:

- scheda profilo,
- timeline,
- audit,
- export,
- campagne segmentate

è già un set utile davvero per un negozio.

### Qualità tecnica minima

Il fatto che oggi:

- i test unitari passino;
- la build passi;
- esistano anche E2E e workflow dedicati;
- ci siano script di smoke/verify

significa che il progetto è già in un territorio abbastanza professionale.

## Cosa manca ancora per considerarlo “maturo”

Questa sezione non indica bug gravi. Indica piuttosto le aree che esistono, ma non sono ancora chiuse come prodotto.

### 1. Community experience ancora incompleta

Le pagine gioco ci sono, ma il “community OS” descritto nei documenti non è ancora completo.

Da sviluppare:

- onboarding per nuovi giocatori;
- pagine format davvero forti per singolo gioco;
- serate ricorrenti come oggetto di prodotto, non solo come eventi sparsi;
- CTA più mirate per ciascuna community;
- percorso chiaro “sono nuovo, da dove comincio?”.

### 2. CRM ancora più descrittivo che prescrittivo

Il CRM oggi racconta molto bene la storia del cliente, ma aiuta meno nel suggerire l’azione successiva.

Da sviluppare:

- segmenti operativi automatici;
- “next best action” per staff;
- segnali di retention / clienti inattivi;
- priorità di follow-up;
- viste più orientate al lavoro giornaliero.

### 3. Messaging ancora centrato soprattutto su email

La base è ottima, ma il prodotto non ha ancora completato la parte “messaging locale”.

Da sviluppare:

- modelli più ricchi di campagne;
- segmenti aggiuntivi;
- orchestrazione reale di newsletter operative;
- eventuale ponte Telegram / WhatsApp, ma solo con consenso e casi d’uso chiari.

### 4. Product demand capture ancora a metà strada

Le richieste prodotto sono cresciute oltre il form base, ma non sono ancora una vera macchina di domanda.

Da sviluppare:

- wishlist più esplicite;
- preorder light più leggibile lato staff;
- ranking della domanda;
- raggruppamenti per gioco/categoria davvero utili agli acquisti.

### 5. Analytics ancora in fase “buon primo slice”

La dashboard staff è valida, ma non ancora completa come strumento decisionale pieno.

Da sviluppare:

- trend temporali più leggibili;
- retention;
- repeat booking;
- no-show proxy più chiaro;
- insight per community / linea di gioco;
- viste aggregate/materializzate se i volumi crescono.

## Bug da fixare o attenzioni concrete

Questa è la parte più pratica.

### 1. Vulnerabilità high su Next.js

Stato:

- `npm audit` segnala una vulnerabilità high su `next 16.2.2`;
- advisory: DoS con Server Components;
- fix disponibile: `16.2.4`.

Impatto:

- non significa che il sito sia già compromesso;
- significa però che la base framework è sotto la versione di sicurezza consigliata.

Priorità:

- **alta**.

Azione consigliata:

- aggiornare `next` alla patch disponibile e rifare `build` + test.

### 2. Ambiente locale inizialmente non allineato alle nuove dipendenze

Stato:

- prima di `npm install`, la build locale falliva perché `qrcode` e `stripe` non risultavano installati;
- dopo `npm install`, la build è passata.

Impatto:

- non sembra un bug del codice;
- è un problema operativo reale: dopo l’ultimo merge, l’ambiente locale non era ancora riallineato.

Priorità:

- **media**.

Azione consigliata:

- documentare meglio il passaggio post-merge (`npm install`) oppure usare una routine più esplicita nei check locali.

### 3. Fallimento Vercel osservato durante la PR appena mergiata

Stato:

- la PR appena chiusa mostrava `Vercel: Deployment failed`;
- in locale, dopo `npm install`, la build è passata.

Cosa significa:

- il problema potrebbe essere stato:
  - preview environment non allineato;
  - env mancanti;
  - failure temporanea di deploy;
  - differenza fra ambiente preview e locale.

Priorità:

- **alta**, perché tocca il deploy reale.

Azione consigliata:

- controllare il log della preview Vercel collegata alla PR;
- verificare env obbligatorie per Stripe, Supabase, cron e site URL.

### 4. Presenza di file `.DS_Store` nel repository

Stato:

- risultano presenti file `.DS_Store` in `app/`, `lib/`, `components/`.

Impatto:

- non è un bug applicativo;
- è rumore nel repo e peggiora la pulizia del progetto.

Priorità:

- **bassa**, ma da sistemare.

Azione consigliata:

- rimuoverli e aggiungere regola `.gitignore` se non già sufficiente.

### 5. Copertura qualità ancora sbilanciata verso unit test

Stato:

- i test unitari sono buoni;
- gli E2E esistono, ma in questa analisi non risultano verificati;
- molte feature sensibili dipendono da integrazione vera: auth, Supabase, webhook, cron, CRM, Stripe.

Impatto:

- il rischio non è tanto “codice che non compila”;
- il rischio è “flusso che si rompe solo in ambiente reale”.

Priorità:

- **media-alta**.

Azione consigliata:

- far girare più spesso `test:e2e` sulle route staff e sui flussi evento/pagamento/comms.

## Feature da sviluppare dopo i fix più urgenti

Se dovessi scegliere un ordine pragmatico, farei così.

### Priorità 1: sicurezza e stabilità

- aggiornamento Next.js alla patch sicura;
- verifica del motivo del fallimento Vercel;
- routine chiara post-merge / post-pull per dipendenze e build;
- eventuale hardening deploy/checklist.

### Priorità 2: chiudere il loop eventi

- UX evento più ricca;
- più chiarezza sugli stati booking;
- gestione più leggibile di waitlist e pagamento pending;
- no-show / post-event insight.

### Priorità 3: far diventare il CRM uno strumento d’azione

- segmenti automatici;
- trigger di follow-up;
- viste “chi contattare oggi”;
- priorità di contatto per staff.

### Priorità 4: trasformare le pagine gioco in community hub veri

- onboarding;
- serate ricorrenti;
- copy specifico per community;
- calendario filtrato veramente utile.

### Priorità 5: evolvere analytics e demand capture

- retention;
- repeat booking;
- community growth;
- ranking reale della domanda prodotto.

## Valutazione finale

### Giudizio sintetico

Il repository oggi è in uno stato **buono / molto buono** per una piattaforma di questo tipo.

Non lo definirei “finito”, ma lo definirei:

- **coerente** a livello architetturale;
- **già utile** a livello operativo;
- **abbastanza testato** sui mattoni principali;
- **pronto a crescere** senza dover essere riscritto.

### Rischio principale oggi

Il rischio principale non è un errore macroscopico nel dominio.

I rischi più concreti sono:

- stabilità di deploy / ambienti;
- patching dipendenze di sicurezza;
- completamento dei flussi operativi più maturi;
- evitare che il prodotto cresca in ampiezza più velocemente di quanto cresca in chiarezza.

### Conclusione in linguaggio semplice

Il progetto è già serio.

La base non va rifatta: va **consolidata, chiarita e completata**.

Le parti migliori oggi sono:

- booking;
- outbox/comunicazioni;
- CRM staff;
- struttura dati e migrazioni.

Le parti da far crescere adesso sono:

- community experience;
- CRM operativo “action-oriented”;
- analytics più utili al negozio;
- hardening di deploy e sicurezza framework.

## Allegato tecnico breve

Controlli eseguiti durante questa analisi:

- `npm run test` -> OK
- `npm run build` -> OK
- `npm audit --json` -> 1 high su `next`, fix disponibile `16.2.4`

Note:

- la build inizialmente falliva solo perché mancavano localmente dipendenze nuove (`qrcode`, `stripe`) prima di eseguire `npm install`;
- non ho eseguito `npm run test:e2e`;
- non ho verificato direttamente il log dettagliato del deployment Vercel fallito.
