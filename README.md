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
| `src/index.html` | Markup mit je einer Platzhalter-Zeile für die Styles (`/*@include styles.css*/`) und das Skript (`/*@bundle main.js*/`) |
| `src/styles.css` | Gestaltung |
| `src/harmony.js` | Akkordpool, `generate`, `voiceLoop` (ohne DOM, in Node testbar) |
| `src/state.js` | Zustand `S`, Speichern in `localStorage` |
| `src/ui.js` | Kacheln, Klaviatur, Regler |
| `src/audio.js` | Rhodes, Bass, Drums (Web Audio) |
| `src/sequencer.js` | Takt-Scheduler, Start/Stopp |
| `src/main.js` | Event-Handler und Start |

Die Dateien in `src/` sind ES-Module. `node build.mjs` (oder `npm run build`) führt sie zu einem einzigen Inline-Skript zusammen und setzt daraus wieder die einzelne `index.html` im Wurzelordner zusammen. Die gebaute Datei enthält keine `import`-Anweisungen und lädt nichts nach. Die gebaute Datei ist eingecheckt, damit sie per Doppelklick und über GitHub Pages läuft. Nach jeder Änderung in `src/` also neu bauen und `index.html` mit committen.

Damit der Build ohne Pakete auskommt, gilt in `src/` ein eingeschränkter Modulstil:

```js
import {a, b} from './datei.js';   // nur benannte Importe mit relativem Pfad
export {c, d};                     // nur eine Liste von Namen, am Dateiende
```

Nicht erlaubt sind `export default`, `export const`, `import * as`, Umbenennen mit `as`, `import()` und Importe im Kreis. Exportierte Namen müssen `const` oder `function` sein und dürfen nicht neu zugewiesen werden. Bei Verstößen bricht der Build mit einer Meldung ab.

`npm test` prüft die Harmonielogik (inklusive Referenzfolgen mit festem Zufallswert), den Build und ob `index.html` zum Stand in `src/` passt. Es braucht nur Node 18 oder neuer, keine Pakete.

## Ausblick

Der geplante Umbau zur modularen DAW mit Song-JSON, Akkord- und Stil-Generatoren steht in [`docs/PFLICHTENHEFT.md`](docs/PFLICHTENHEFT.md).
