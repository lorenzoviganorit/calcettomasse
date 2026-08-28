# Calcio a 7 del Lunedì — bozza locale

## Come avviarla

Serve [Node.js](https://nodejs.org) installato (versione 18 o superiore va bene).

```bash
cd calcio7-app
npm install
npm run dev
```

Poi apri il link che ti mostra il terminale (di solito **http://localhost:5173**).

## Se vedi "Failed to fetch" o dati vuoti

Non è un problema del codice: è quasi certamente **Row Level Security (RLS)** di Supabase che blocca la lettura pubblica. Sul tuo progetto Supabase:

1. **Table Editor** → seleziona una tabella (es. `giocatori`)
2. Tab **RLS** → crea una policy per il comando `SELECT`, condizione `true` (= "consenti la lettura a tutti")
3. Ripeti per `squadre`, `partite`, `giocatori_partite`

## Dove sono le credenziali Supabase

In `src/App.jsx`, in cima al file: `SUPABASE_URL` e `SUPABASE_KEY`. È la chiave "publishable" (pensata per stare nel codice client), non la service key — nessun problema a tenerla lì per ora.

## Stato attuale

- Legge in sola lettura: squadre, giocatori, partita con `stato = 'aperta'` e relative prenotazioni
- Il bottone "Ci sono!" è ancora solo dimostrativo (non scrive nel database)
- Il tab Statistiche mostra dati di esempio, in attesa di partite giocate reali

## Novità: login, profilo, prenotazione e gestione presenze reali

Servono queste policy RLS aggiuntive su Supabase (oltre alle SELECT già fatte):

- `giocatori_partite` → policy per `INSERT` (condizione `true`) — per prenotarsi
- `giocatori_partite` → policy per `UPDATE` (condizione `true`) — per annullare, spostare squadra, rimuovere presenze
- `giocatori` → policy per `UPDATE` (condizione `true`) — per salvare nome/soprannome dal profilo

**Login**: nessun account vero — selezioni il tuo nome dalla lista e inserisci il PIN impostato in anagrafica (colonna `pin`, per ora in chiaro). Il tuo id resta salvato nel browser (localStorage) finché non premi "Esci".

**Nota di sicurezza**: con questa configurazione (chiave pubblica + policy aperte a `true`), chiunque conosca l'URL dell'app può leggere/scrivere le tabelle, PIN compreso. Va benissimo per un gruppo di amici in fase di test, ma prima di condividerla con tutti vale la pena stringere le policy (es. limitare le scritture a chi è effettivamente loggato) — possiamo affinarle quando vuoi.

## Notifiche Telegram (richieste reset PIN)

L'app manda un messaggio Telegram quando qualcuno chiede un nuovo PIN. Setup una tantum:

1. **Crea il bot**: su Telegram cerca **@BotFather**, manda `/newbot`, segui le istruzioni. Alla fine ti dà un **token** (tipo `123456789:ABCdefGhIJKlmNoPQRstuVwxYZ`).
2. **Apri una chat col bot**: cerca il tuo bot per username (quello scelto al passo 1) e mandagli un messaggio qualsiasi (es. "ciao") — Telegram richiede questo passaggio prima che il bot possa scriverti.
3. **Trova il tuo chat_id**: apri nel browser (sostituendo TOKEN col tuo token):
   `https://api.telegram.org/botTOKEN/getUpdates`
   Cerca nel risultato JSON la voce `"chat":{"id":123456789,...}` — quel numero è il tuo `chat_id`.
4. **Configura le variabili su Vercel**: vai sul progetto → Settings → Environment Variables, aggiungi:
   - `TELEGRAM_BOT_TOKEN` = il token del passo 1
   - `TELEGRAM_CHAT_ID` = il numero del passo 3
   Poi fai un redeploy (o un nuovo push) perché le variabili vengano lette.

**Nota**: la funzione `/api/notify-telegram` funziona solo una volta pubblicata su Vercel — in locale con `npm run dev` la chiamata fallisce silenziosamente (non blocca nulla, semplicemente non arriva la notifica finché non sei online).
