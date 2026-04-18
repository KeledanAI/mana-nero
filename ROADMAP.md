---
name: GameStore Roadmap - Local Game Store Platform
overview: Piattaforma digitale per un local game store orientata a eventi, community e CRM. Il sito non va trattato come e-commerce generico: deve diventare il layer operativo del negozio fisico, con booking affidabile, contenuti, automazioni leggere, hub per singolo gioco e strumenti staff che aumentano ritorno in negozio e qualità della community.
todos:
  - id: foundation-bootstrap
    content: Verificare e consolidare la base già costruita (starter, schema, auth, ruoli, dominio, admin)
    status: completed
  - id: foundation-docs
    content: Allineare README e documentazione tecnica al progetto reale; introdurre CLAUDE.md o CONTRIBUTING.md con standard di coding e architettura
    status: pending
  - id: v1_5-comms-runtime
    content: Rendere operative le comunicazioni con worker outbox, reminder eventi, notifiche waitlist e template transactional
    status: pending
  - id: v1_5-ops-dashboard
    content: Aggiungere metriche e viste operative per staff: fill rate, partecipanti, waitlist, check-in, no-show proxy, carico prossimi eventi
    status: pending
  - id: v1_5-event-experience
    content: Migliorare UX evento e booking: stati chiari, posti rimanenti, CTA migliori, dettaglio evento più completo, policy e FAQ
    status: pending
  - id: community-os
    content: Trasformare le pagine gioco in hub community con calendario filtrato, copy orientato al gioco, CTA dedicate, onboarding e serate ricorrenti
    status: pending
  - id: crm-operativo
    content: Evolvere il CRM in strumento di lavoro: segmenti, timeline utente, tag automatici, follow-up e insight per staff
    status: pending
  - id: messaging-local
    content: Integrare canali locali e segmentazione leggera per newsletter, Telegram e WhatsApp su base consenso
    status: pending
  - id: demand-capture
    content: Evolvere richieste prodotto verso wishlist e preorder light guidati dagli interessi reali della community
    status: pending
  - id: analytics-loop
    content: Chiudere il loop decisionale con dashboard prodotto-community e metriche di retention
    status: pending
---

# Roadmap Strategica - Game Store

## Identità del progetto

Questo progetto è una **piattaforma digitale per un negozio fisico locale** di giochi, fumetti e TCG.

La direzione corretta è:

> **events + community + CRM first**  
> product reservation e monetizzazione come estensioni  
> e-commerce pieno solo se davvero necessario più avanti

Il sito deve diventare il **layer digitale del negozio fisico**:

- aiuta le persone a scoprire eventi e serate
- rende facile prenotare e tornare
- rende visibile la community per singolo gioco
- aiuta lo staff a seguire clienti, tavoli e interessi
- cattura domanda reale su eventi e prodotti

Il loop principale da ottimizzare è:

`scopro evento -> prenoto -> ricevo reminder -> partecipo -> torno -> entro in una community -> ricevo proposte rilevanti`

---

## Stato Attuale Del Repo

Il repository è già oltre la fase di bootstrap.

### Già presente

- App `Next.js + Supabase` installata e funzionante in root.
- Schema dati V1 già impostato con:
  - `profiles.role`
  - `has_role(required)`
  - `events`, `event_categories`
  - `event_registrations`
  - `posts`
  - `newsletter_subscribers`
  - `admin_notes`
  - `product_reservation_requests`
  - `communication_outbox`
- Booking centralizzato con una sola RPC `SECURITY DEFINER`.
- Area pubblica già costruita: homepage, eventi, news, contatti, hub giochi.
- Area utente già costruita: profilo, prenotazioni, richieste prodotto, preferenze.
- Area admin già costruita: eventi, post, categorie, CRM, newsletter, richieste prodotto, game pages.
- Export CSV partecipanti e check-in staff presenti.

### Non ancora chiuso bene

- README ancora generico dello starter.
- Nessun `CLAUDE.md` o documento esplicito con standard di coding e convenzioni architetturali.
- Outbox presente ma non ancora completato come runtime di comunicazione production-ready.
- Newsletter presente come raccolta dati e vista staff, non come sistema operativo di comunicazione.
- CRM presente ma ancora “anagrafica + note”, non ancora “CRM operativo”.
- Hub community e pagine gioco presenti ma ancora più editoriali che sistemiche.
- Analytics e insight operativi quasi assenti.

---

## Gap Analysis Rispetto Alla Roadmap Originaria

| Area | Stato | Note |
|------|-------|------|
| Bootstrap starter | **Completato** | Base progetto già installata e coerente |
| Audit architettura starter | **Completato** | Ruoli e access control allineati tra SQL e TypeScript |
| Schema SQL + RLS | **Completato** | Le fondamenta V1 sono già presenti |
| Dominio booking via RPC | **Completato** | Approccio corretto e già implementato |
| Public site + user area | **Completato / parziale** | Esiste, ma UX e loop evento vanno alzati di livello |
| Admin CRM/CMS | **Completato / parziale** | Struttura buona, ancora troppo “tecnica” in alcune sezioni |
| Product reservation | **Completato / parziale** | Buona base, manca evoluzione verso domanda guidata |
| Comms extension | **Parziale** | Schema e enqueue pronti, delivery runtime incompleto |
| Hub community | **Parziale** | Presenza iniziale, non ancora prodotto maturo |
| Analytics / operations | **Mancante** | Serve per guidare il negozio, non solo per reporting |

Conclusione: la **fondazione tecnica V1 è buona**. Il lavoro prioritario non è rifare l’architettura, ma **portarla da “funziona” a “genera valore operativo e ritorno della community”**.

---

## Principi Vincolanti

Queste decisioni restano vincolanti.

| # | Decisione | Approccio unico |
|---|-----------|-----------------|
| 1 | Booking | Una sola entrypoint RPC Postgres per il dominio prenotazioni |
| 2 | RLS | Tutte le policy usano `public.has_role(required)` |
| 3 | Registrazioni | Una sola tabella `event_registrations` con enum espliciti |
| 4 | Slug | `events.slug`, `posts.slug` e pagine pubbliche con URL stabili |
| 5 | jsonb | Ammesso solo per estensioni non critiche |
| 6 | Outbox | Idempotente, retry-safe, separato dal dispatch |
| 7 | Ruoli | Un solo ruolo per utente in V1/V1.5 (`customer`, `staff`, `admin`) |
| 8 | App layering | UI sottile, regole nel dominio, DB come contratto |
| 9 | Evoluzione | Solo estensioni additive; niente rewrite inutili di booking/auth |

Failure conditions:

- spostare logica booking nel client
- duplicare la semantica ruoli fuori da `has_role`
- introdurre workaround che rompono V2
- trattare il sito come mini-ecommerce generico

---

## North Star Product

Lo stato dell’arte per questo progetto non è “più feature”, ma **più qualità nel loop locale**.

### Esperienza target per il pubblico

- Capisco subito che tipo di posto è il negozio.
- Vedo quali community esistono davvero.
- Trovo il mio gioco e le prossime serate in pochi secondi.
- Prenoto senza attrito.
- Ricevo promemoria affidabili.
- Capisco cosa aspettarmi da evento e community.
- Torno perché il sito continua a sembrarmi vivo e rilevante.

### Esperienza target per lo staff

- So quali eventi stanno riempiendosi.
- So chi è in waitlist e chi va ricontattato.
- So quali utenti tornano spesso e quali stanno sparendo.
- So quali giochi e prodotti stanno generando domanda reale.
- Posso pubblicare contenuti e aggiornare pagine senza attrito tecnico.

---

## Piano Master

## Fase 0 - Consolidamento Fondazioni

Obiettivo: mettere ordine nel progetto esistente e formalizzare le convenzioni.

### Deliverable

- README allineato al progetto reale.
- `CLAUDE.md` o `CONTRIBUTING.md` con:
  - architettura applicativa
  - convenzioni Supabase/RLS
  - pattern Server Actions -> domain -> Supabase
  - naming
  - gestione immagini CMS
  - policy su ruoli, slug, enums e outbox
- Audit finale delle migration e dei flussi esistenti.
- Definizione chiara di ambienti, seed e checklist release.

### Outcome

Ridurre ambiguità e impedire che il progetto deragli in implementazioni incoerenti.

---

## Fase 1 - V1.5 Operational Excellence

Obiettivo: chiudere bene il prodotto già presente e renderlo davvero production-ready per un negozio locale.

### 1. Comunicazioni operative

- Worker outbox reale con retry e update stato.
- Template email transactional:
  - booking confermato
  - ingresso in waitlist
  - promozione da waitlist
  - reminder pre-evento
  - evento annullato o cambiato
- Scheduling messaggi con `scheduled_at`.
- Log errori e dead-letter strategy minima.

### 2. Event experience

- Pagine evento più ricche:
  - posti rimanenti o stato capienza
  - FAQ
  - cosa portare
  - livello target
  - durata prevista
  - regole speciali
  - CTA più forti
- Stati booking comprensibili e non tecnici.
- UX migliore per waitlist e cancellazione.
- Canonical flow per eventi passati/cancellati/futuri.

### 3. Staff operations

- Dashboard staff con:
  - prossimi eventi
  - fill rate
  - waitlist aperte
  - checked-in
  - eventi da completare
- Vista rapida “eventi a rischio”:
  - pochi iscritti
  - troppe persone in waitlist
  - metadata incompleti

### 4. Qualità e affidabilità

- Handling errori coerente lato actions/domain.
- Test mirati sui flussi booking e waitlist.
- Verifica idempotenza outbox.
- Protezione migliore su upload CMS e dati form.

### Outcome

Passare da “buona base V1” a “sistema affidabile per gestione eventi reali”.

---

## Fase 2 - Community OS

Obiettivo: trasformare il sito da vetrina + admin a **motore della community locale**.

### 1. Hub per singolo gioco

Ogni gioco importante deve avere una pagina che unisca:

- identità della community
- prossimi eventi filtrati
- tono e cultura di quel gioco
- call to action dedicate
- guida rapida per chi è nuovo

### 2. Format pages vere, non solo contenuto statico

Per esempio:

- Magic: commander, prerelease, draft, standard
- Pokemon: league, beginner, family-friendly
- One Piece: competitive nights, learn-to-play
- Board games: serate prova, tavoli aperti, gioco guidato

### 3. Serate ricorrenti

Introdurre una struttura editoriale e operativa per:

- weekly commander night
- monthly prerelease
- beginner night
- family board game night
- league / season

Le serate ricorrenti devono avere identità, CTA e comunicazione coerente.

### 4. Community onboarding

- percorsi “sono nuovo qui”
- pagine “come funziona una serata da noi”
- copy più rassicurante per neofiti
- CTA che riducono l’ansia da primo ingresso

### Outcome

Il sito smette di essere solo un calendario e diventa un **community OS locale**.

---

## Fase 3 - CRM Operativo

Obiettivo: dare allo staff strumenti semplici ma utili per seguire persone, gruppi e comportamenti.

### Funzioni chiave

- Timeline cliente:
  - prenotazioni
  - richieste prodotto
  - note staff
  - opt-in
  - interessi
- Segmenti dinamici:
  - nuovi iscritti
  - inattivi 30/60 giorni
  - regulars
  - utenti waitlist frequenti
  - clienti interessati per singolo gioco
- Tag automatici derivati da comportamento.
- Vista “next best action” per staff.

### Outcome

Da anagrafica passiva a CRM realmente utile per retention e qualità della community.

---

## Fase 4 - Messaging Locale

Obiettivo: usare canali locali dove la community vive davvero.

### Priorità

- Newsletter semplice ma segmentata.
- Telegram broadcast o bridge informativo.
- WhatsApp solo dove c’è valore chiaro e consenso.
- Template comunicazioni per:
  - reminder
  - posti liberati
  - annuncio nuova serata
  - arrivo prodotto richiesto

### Regola

Nessuna comunicazione va costruita come marketing rumoroso. Deve essere:

- utile
- contestuale
- segmentata
- locale

---

## Fase 5 - Demand Capture E Monetizzazione Leggera

Obiettivo: capire cosa vuole davvero la community prima di costruire e-commerce pieno.

### Priorità

- richieste prodotto migliorate
- wishlist per gioco/categoria
- preorder light
- alert “arrivato in negozio”
- ranking domanda prodotti per aiutare acquisti e stock

### Outcome

La domanda reale guida inventory e preorder, senza costruire troppo presto un catalogo complesso.

---

## Fase 6 - Analytics E Decision Loop

Obiettivo: dare al team numeri utili a decidere, non vanity metrics.

### Metriche da avere

- fill rate per evento e per tipo evento
- tasso repeat booking
- iscritti nuovi vs utenti di ritorno
- conversione waitlist -> confirmed
- richieste prodotto per categoria
- community growth per linea di gioco
- utenti inattivi da riattivare

### Outcome

Il prodotto diventa uno strumento decisionale, non solo esecutivo.

---

## Backlog Prioritizzato

## Now

- Allineare documentazione repo.
- Creare `CLAUDE.md` o equivalente.
- Chiudere worker outbox.
- Introdurre reminder eventi e notifiche waitlist.
- Migliorare dettaglio evento e UX booking.
- Creare dashboard staff minima con KPI operativi.

## Next

- Rifare le pagine gioco come community hubs veri.
- Aggiungere segmenti CRM e timeline utente.
- Migliorare newsletter e canali locali.
- Introdurre serate ricorrenti come concetto di prodotto.

## Later

- Wishlist/preorder light.
- analytics avanzate
- loyalty/community score leggero
- monetizzazione più strutturata

---

## Mega Piano Esecutivo

## Track A - Product Foundation

1. Aggiornare `README.md`.
2. Creare `CLAUDE.md` con coding standards e architecture notes.
3. Mappare i flussi “happy path” del prodotto:
   - signup
   - booking
   - cancel
   - waitlist
   - check-in
   - product request
4. Scrivere checklist release per staff.

## Track B - Messaging Runtime

1. Definire contratto payload outbox per ogni tipo messaggio.
2. Implementare worker dispatch.
3. Gestire retry, logging e failure states.
4. Collegare reminder automatici e promozione waitlist.
5. Aggiungere anteprima template.

## Track C - Event Experience

1. Ridisegnare pagina evento.
2. Mostrare disponibilità in modo utile.
3. Migliorare feedback booking/cancel/waitlist.
4. Aggiungere blocchi informativi per serata.
5. Uniformare CTA homepage, hub giochi ed eventi.

## Track D - Staff OS

1. Dashboard con KPI essenziali.
2. Vista eventi in arrivo con stato operativo.
3. Vista utenti da seguire.
4. Vista richieste prodotto aggregate.
5. Export e check-in rifiniti.

## Track E - Community OS

1. Definire 4-6 linee di gioco prioritarie.
2. Costruire template di pagina community.
3. Collegare eventi filtrati per gioco.
4. Aggiungere onboarding “nuovo giocatore”.
5. Introdurre strutture per serate ricorrenti.

## Track F - CRM Evoluto

1. Timeline utente.
2. Segmenti dinamici.
3. Tag automatici.
4. Filtri e quick actions per staff.
5. Report utenti da riattivare.

---

## Ordine Di Esecuzione Consigliato

1. Documentazione e standard di sviluppo.
2. Runtime comunicazioni.
3. Miglioramento esperienza evento.
4. Dashboard e workflow staff.
5. Hub community.
6. CRM operativo.
7. Messaging locale avanzato.
8. Demand capture e analytics avanzate.

Questo ordine massimizza il valore senza buttare via il lavoro già fatto.

---

## Rischi Da Evitare

- Deviare verso e-commerce full-stack troppo presto.
- Aggiungere feature isolate senza migliorare il loop evento -> ritorno.
- Aumentare la complessità admin senza insight operativi.
- Usare canali messaging senza consenso e segmentazione.
- Fare rewrite architetturali invece di completare i loop esistenti.

---

## Definizione Di Successo

La roadmap sta funzionando se, entro la prossima fase, il negozio può dire:

- gli eventi si scoprono e si prenotano facilmente
- i no-show si riducono
- la waitlist viene gestita bene
- lo staff sa chi seguire e cosa pubblicare
- ogni community di gioco ha una casa digitale credibile
- le persone tornano più spesso in negozio
