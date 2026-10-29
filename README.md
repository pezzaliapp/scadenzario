# 📅 Scadenziario Professionale

PWA gratuita per gestire scadenze fiscali, contributi, contratti, assicurazioni, incassi e pagamenti.

**👉 App online:** https://pezzaliapp.github.io/scadenzario/

## Caratteristiche
- **100% gratuita**: nessun abbonamento, nessuna registrazione, nessuna API a pagamento, nessun server.
- **Privacy**: i dati restano solo sul tuo dispositivo (localStorage del browser).
- **Funziona offline** e si installa come app su Android, iPhone/iPad, Windows, macOS e Linux.
- Riepilogo con scadute, oggi, prossimi 7 e 30 giorni e relativi importi.
- Elenco con ricerca e filtri (stato, categoria, periodo) e totali.
- Calendario mensile con festività italiane evidenziate.
- **Ricorrenze** (settimanale, mensile, bimestrale, trimestrale, semestrale, annuale): quando completi una scadenza ricorrente viene creata automaticamente la successiva.
- Avviso quando una scadenza cade di sabato, domenica o in un festivo nazionale (slittamento al primo giorno lavorativo).
- Categorie personalizzabili con colori, priorità, cliente/riferimento, importo, note.
- **Notifiche** del dispositivo in base ai giorni di preavviso.
- **Esporta in calendario (.ics)** con allarmi e ricorrenze: importabile gratis in Google Calendar, Apple Calendario, Outlook.
- Esporta in CSV (Excel), backup e ripristino JSON.
- Tema chiaro/scuro automatico.

## Pubblicazione su GitHub Pages
1. Repository → **Settings** → **Pages**.
2. *Source*: **Deploy from a branch** → branch `main`, cartella `/ (root)` → **Save**.
3. Dopo un minuto l'app è su `https://pezzaliapp.github.io/scadenzario/`.

## Installazione sul telefono
- **Android / Chrome / Edge**: apri il link e tocca *Installa* (o menu ⋮ → *Installa app*).
- **iPhone / iPad (Safari)**: Condividi ⬆︎ → *Aggiungi alla schermata Home*.

## Struttura
```
index.html            interfaccia
styles.css            stile
app.js                logica dell'app
sw.js                 service worker (offline + promemoria)
manifest.webmanifest  manifest PWA
icons/                icone
```

Per pubblicare una nuova versione aggiorna `VERSIONE` in `app.js` e `CACHE` in `sw.js`, così i dispositivi scaricano i file aggiornati.

## Note
Le notifiche web senza server arrivano quando l'app viene aperta (e, su Chrome/Edge con app installata, anche in background tramite *Periodic Background Sync*). Per promemoria sempre garantiti usa **Esporta calendario (.ics)**.

Lo strumento è un supporto organizzativo: verifica sempre le scadenze ufficiali con il tuo consulente.

## Licenza
MIT
