# Blue Seven

Kleine Loop-DAW für jazzige Akkordfolgen. Am Ende eine einzige HTML-Datei ohne Abhängigkeiten, mobile-first.

## Was sie kann

- Generator für 3er- und 4er-Loops aus m7- und maj7-Akkorden (wahlweise mit None als m9/maj9)
- Bewertung aller möglichen Folgen nach Grundtonbewegung, gemeinsamen Tönen und Rücksprung zum Anfang; gezogen wird zufällig aus den besten
- Würze-Regler für geliehene Akkorde (♭VImaj7, iv m7, ♭IImaj7 …)
- Stimmführung mit möglichst kleinen Bewegungen zwischen den Akkorden
- Rhodes-artiger FM-Sound mit Stereo-Tremolo und Hall, dazu Bass und Drums (Web Audio API)
- Spielweisen liegend, Comping, gebrochen; Tempo, Swing, Mixer
- Akkorde halten, vorherige Folge zurückholen, Folgen merken (localStorage)

## Benutzen

`index.html` im Browser öffnen und auf Play tippen. Auf dem iPhone muss die Lautstärke aufgedreht sein.

Mit GitHub Pages (Settings → Pages → Branch `main`) läuft sie direkt unter `https://deng85.github.io/blue-seven/`.

## Aufbau

Der Quelltext liegt in `src/`, aufgeteilt nach Aufgaben:

| Datei | Inhalt |
|---|---|
| `src/index.html` | Markup mit je einer Platzhalter-Zeile für die Styles (`/*@include styles.css*/`) und das Skript (`/*@bundle app/main.js*/`) |
| `src/styles.css` | Gestaltung |
| `src/chords/jazzy.js` | Akkord-Generator „Jazzy“: Akkordpool, Bewertung, Stimmführung. Liefert Akkordfolgen im Format `blueseven.chords` (ohne DOM, in Node testbar) |
| `src/app/modules.js` | Die eine Stelle, an der steht, welche Module die App anbietet |
| `src/app/state.js` | Zustand `S`, aktuelle Akkordfolge, Speichern in `localStorage` |
| `src/app/player.js` | Baut aus Folge und Einstellungen den Song, Play/Stopp, Anhören, laufender Akkord |
| `src/app/ui.js` | Kacheln, Klaviatur, Regler |
| `src/app/main.js` | Event-Handler und Start |
| `src/core/registry.js` | Verzeichnis der Module (Akkord-Generatoren, Stile, Instrumente, Effekte) |
| `src/core/params.js` | Gemeinsame Parameterbeschreibung: prüfen, Standardwerte, begrenzen |
| `src/core/format.js` | Prüfung der Formate für Akkordfolgen und Songs, Parameteradressen |
| `src/core/notes.js` | Tonnamen und Vorzeichen |
| `src/core/rng.js` | Zufall mit Startwert für reproduzierbare Folgen und Songs |
| `src/core/time.js` | Viertel in Sekunden umrechnen, mit Tempo und Swing |
| `src/core/gain.js` | Reglerwert 0 bis 100 in linearen Pegel und zurück |
| `src/core/voicing.js` | Stimmführung für Akkordfolgen ohne Lage |
| `src/styles/jazzy-beats.js` | Stil „Jazzy Beats“: baut aus einer Akkordfolge einen Song als JSON |
| `src/engine/engine.js` | Spielt jeden gültigen Song ab: Ablauf mit Vorausschau, Werte setzen, Anhören, Position |
| `src/engine/mixer.js` | Kanäle mit Inserts, Fader, Panorama, Mute, Solo und Sends, Effektspuren, Summe |
| `src/engine/timeline.js` | Welche Noten in einem Zeitraum liegen, Aufbau eines Songs (ohne Web Audio, in Node testbar) |
| `src/instruments/` | Rhodes, Bass, Drums mit der bisherigen Klangerzeugung, `voices.js` begrenzt die Stimmen |
| `src/effects/` | Filter, Tremolo, Hall, Kompressor |

Die App holt sich Akkordfolgen über die Registry vom Akkord-Generator und arbeitet mit dem Format `blueseven.chords` weiter. Der Stil Jazzy Beats macht daraus einen Song im Format `blueseven.song`, und die Engine spielt diesen Song ab. Instrumente und Effekte bekommt die Engine nur über die Registry. Bei jeder Änderung (neue Folge, Tonart, Spielweise, Tempo) baut die App den Song neu und gibt ihn der Engine, die ihn ab dem nächsten Takt spielt. Welcher Ordner aus welchem importieren darf, prüft ein Test.

Die Dateien in `src/` sind ES-Module. `node build.mjs` (oder `npm run build`) führt sie zu einem einzigen Inline-Skript zusammen und setzt daraus wieder die einzelne `index.html` im Wurzelordner zusammen. Die gebaute Datei enthält keine `import`-Anweisungen und lädt nichts nach. Die gebaute Datei ist eingecheckt, damit sie per Doppelklick und über GitHub Pages läuft. Nach jeder Änderung in `src/` also neu bauen und `index.html` mit committen.

Damit der Build ohne Pakete auskommt, gilt in `src/` ein eingeschränkter Modulstil:

```js
import {a, b} from './datei.js';   // nur benannte Importe mit relativem Pfad
export {c, d};                     // nur eine Liste von Namen, am Dateiende
```

Nicht erlaubt sind `export default`, `export const`, `import * as`, Umbenennen mit `as`, `import()` und Importe im Kreis. Exportierte Namen müssen `const` oder `function` sein und dürfen nicht neu zugewiesen werden. Bei Verstößen bricht der Build mit einer Meldung ab.

`npm test` prüft die Harmonielogik (inklusive Referenzfolgen mit festem Zufallswert), die Formate, den Stil Jazzy Beats, die Engine mit einem nachgebauten AudioContext (`test/fixtures/fake-audio.js`), den Build und ob `index.html` zum Stand in `src/` passt. Es braucht nur Node 18 oder neuer, keine Pakete.

## Ausblick

Der geplante Umbau zur modularen DAW mit Song-JSON, Akkord- und Stil-Generatoren steht in [`docs/PFLICHTENHEFT.md`](docs/PFLICHTENHEFT.md).
