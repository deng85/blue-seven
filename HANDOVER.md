# Handover: Blue Seven

Stand: 20.11.2026. Dieses Dokument fasst zusammen, was gebaut wurde, wie der Code aufgebaut ist und was als Nächstes ansteht.

## Kurzfassung

Blue Seven ist eine kleine Loop-DAW für jazzige Akkordfolgen. Sie besteht aus einer einzigen Datei, `index.html`, ohne Build und ohne Abhängigkeiten. Sie ist mobile-first gebaut und läuft; der Nutzer findet den Klang gut.

**Nächster Schritt:** Refactoring in einen `src/`-Ordner plus Build-Prozess, der daraus wieder eine einzelne HTML-Datei baut (siehe unten).

## Was der Nutzer will

- Jazzy 3er- und 4er-Akkord-Loops aus m7- und maj7-Akkorden, „richtig schöne Folgen“, erzeugt von einem intelligenten Generator
- Rhodes-ähnlicher Klang, physikalische Echtheit ist nicht nötig
- Erstmal nur Handy. Desktop-Kompatibilität ist für später vorgesehen
- Versioniert arbeiten, damit sich Änderungen rückgängig machen lassen
- Oberfläche auf Deutsch, lockerer Ton im Gespräch

## Bisher erledigt

| Schritt | Ergebnis |
|---|---|
| Erste Version | Generator, Stimmführung, Rhodes, Bass, Drums, Mixer, Halten, Zurück, Merken |
| Stottern behoben | Größerer Audio-Puffer (`latencyHint: 'playback'`), 0,6 s Vorausplanung statt 0,25 s, Hall 1,5 s statt 2,1 s, kürzere Ausklingzeit der Stimmen |
| Repo | `deng85/blue-seven`, öffentlich, Branch `main`, enthält `index.html`, `README.md`, dieses Dokument |

Rückmeldung nach dem Puffer-Fix: läuft meist ohne Stottern, den Rest schreibt der Nutzer Hintergrundprozessen auf dem Handy zu.

Nur automatisch geprüft: Harmonielogik per Node-Lauf, Oberfläche per Screenshot bei 390 px Breite, keine Konsolenfehler. Den Klang hat nur der Nutzer auf dem Handy beurteilt.

## Aufbau von `index.html`

Die Datei hat drei Teile: `<style>`, das Markup und ein `<script>`. Das Skript ist in Abschnitte gegliedert, die sich fast eins zu eins als Module herauslösen lassen.

| Abschnitt | Wichtige Namen | Aufgabe |
|---|---|---|
| Harmonie | `POOL`, `trans`, `scoreLoop`, `generate`, `chordName`, `voiceLoop` | Akkordpool, Bewertung, Auswahl, Stimmführung. Reine Funktionen ohne DOM und ohne Audio |
| Zustand | `S`, `favs`, `hist`, `recent`, `load`, `save`, `revoice`, `newLoop` | Ein Zustandsobjekt, Speicherung in `localStorage` unter `blueseven.v1` |
| Oberfläche | `buildKeys`, `render`, `renderFavs`, `setActive`, `showNotes` | Kacheln, Klaviatur (SVG), Regler |
| Klang | `initAudio`, `rhodes`, `bass`, `kick`, `hat`, `rim`, `setVols` | Web Audio. Signalweg: Busse → Tremolo → Hall → `gate` → Kompressor |
| Ablauf | `scheduleBar`, `tick`, `frame`, `start`, `stop`, `audition` | Takt-Scheduler mit Vorausplanung, Anzeige des laufenden Akkords |
| Bedienung | `bind`, `boot` | Event-Handler und Start |

Nachtrag: Seit der Umstellung auf ES-Module liegt jeder Abschnitt als eigenes Modul in `src/`, und `build.mjs` führt sie zu einem Skript zusammen (siehe `README.md`). Die Harmonielogik in `src/harmony.js` läuft ohne Browser in Node und wird von den Tests direkt importiert. Der frühere Kommentar `/*--UI--*/` ist entfallen.

### So arbeitet der Generator

1. Pro Tongeschlecht gibt es einen Akkordpool als Stufen (Dur: I, ii, iii, IV, vi plus geliehene ♭II, ♭III, iv, v, ♭VI, ♭VII; Moll entsprechend).
2. `generate` zählt alle möglichen Folgen auf (höchstens 7920) und bewertet jede mit `scoreLoop`.
3. Die Bewertung setzt sich zusammen aus: Qualität jedes Schritts inklusive Rücksprung (Grundtonbewegung plus gemeinsame Töne), Bonus für die Tonika, Bonus für gemischte Akkordtypen, Würze-Regler für geliehene Akkorde.
4. Aus den 40 besten wird gewichtet zufällig gezogen. Die letzten 12 Folgen werden gemieden, gehaltene Akkorde bleiben an ihrem Platz.
5. `voiceLoop` wählt für jeden Akkord die enge Lage, die sich am wenigsten vom vorherigen entfernt, in zwei Runden, damit auch der Rücksprung passt.

### Zustand `S`

`key` (0–11), `mode` (`dur`/`moll`), `n` (3/4), `bpm`, `swing`, `spice`, `feel` (`pad`/`comp`/`arp`), `nine` (0/1), `volR`, `volB`, `volD`, `loop` (Stufen-IDs), `locks` (Wahrheitswerte pro Platz).

## Dinge, die man wissen muss

- **Audio-Start:** Der `AudioContext` wird erst beim ersten Tippen erzeugt, sonst blockiert der Browser den Ton.
- **iPhone:** `iosUnmute` spielt ein stummes `<audio>` in Schleife, damit Web Audio auch bei aktivem Stummschalter klingt. Auf dem iPhone des Nutzers nicht verifiziert.
- **Verzögerung:** Der große Puffer ist Absicht. Antippen eines Akkords klingt dadurch einen Tick später; `frame` gleicht die Anzeige über `outputLatency` aus.
- **Änderungen im Lauf:** Tempo, Akkorde und Spielweise greifen erst ab dem nächsten Takt, weil immer ein ganzer Takt auf einmal geplant wird.
- **Stopp:** Laufende Klangquellen stehen in `live` und werden über `gate` ausgeblendet und dann beendet.
- **Speicher:** Gemerkte Folgen liegen nur im Browser des Geräts.
- **Gestaltung:** Ein festes dunkles Farbschema (Blau, Papierweiß, ein Orange als Akzent), Schriften Barlow Condensed und Instrument Sans von Google Fonts. Farben stehen als Variablen im `:root`-Block.
- **Zweite Kopie:** Die Seite ist zusätzlich als Claude-Artifact veröffentlicht. Das aktualisiert sich nicht von selbst aus dem Repo. Dort gelten Einschränkungen: keine Downloads per Skript, Schriften nur von Google Fonts, Skripte nur inline oder von wenigen CDNs.

## Nächster Schritt: `src/` und Build

Ziel des Nutzers: Quelltext in einen `src/`-Ordner aufteilen und per Build wieder eine einzelne HTML-Datei erzeugen.

Vorschlag für die Aufteilung, passend zu den Abschnitten oben:

```
src/
  index.html      Markup mit Platzhaltern für Styles und Skript
  styles.css
  harmony.js      POOL, generate, voiceLoop (ohne DOM)
  state.js
  ui.js
  audio.js
  sequencer.js
  main.js         bind, boot
build.mjs         setzt alles zu einer HTML-Datei zusammen
test/harmony.test.mjs
```

Offene Entscheidungen für den Nutzer:

1. **Build-Werkzeug:** ein eigenes kleines Node-Skript ohne Abhängigkeiten oder ein Bundler wie esbuild. Das eigene Skript reicht für diese Größe und hält das Projekt abhängigkeitsfrei.
2. **Ablage der gebauten Datei:** Wird sie eingecheckt (zum Beispiel `index.html` im Wurzelordner oder `docs/`), funktioniert GitHub Pages ohne weiteres Zutun. Wird sie nicht eingecheckt, braucht es eine GitHub Action, die baut und veröffentlicht.
3. **Module:** ES-Module in `src/` machen die Harmonielogik direkt testbar; der Build muss sie dann zu einem Inline-Skript zusammenführen.

Worauf beim Refactoring zu achten ist:

- Verhalten und Klang dürfen sich nicht ändern. Vorher und nachher dieselbe Folge mit festem Zufallswert vergleichen (`generate` nimmt einen Zufallsgenerator als dritten Parameter).
- Die fertige Datei muss weiter ohne Server per Doppelklick laufen.
- Der Schlüssel `blueseven.v1` bleibt gleich, sonst gehen gemerkte Folgen verloren.

## Ideen für später

- MIDI-Export der Folge
- Desktop-Layout
- Hall abschaltbar und weniger Stimmen für schwächere Handys
- Akkordlänge wählbar (halber Takt, zwei Takte)

## Arbeitsweise

- Jede Änderung als eigener Commit auf `main`, damit sie sich einzeln zurücknehmen lässt.
- Ein neues Repo anlegen kann eine Claude-Sitzung nicht; Schreibzugriff gibt es nur auf angehängte Repos.
- Das Repo im Claude-Projekt ist nur zum Lesen. Zum Ändern und Pushen braucht es eine Code-Sitzung mit `deng85/blue-seven`.
- GitHub Pages ist noch nicht eingeschaltet (Settings → Pages → Branch `main`).
