# Pflichtenheft: Blue Seven als modulare DAW

| | |
|---|---|
| Stand | 20.11.2026, Entwurf 1 |
| Bezug | `HANDOVER.md`, Quelltext in `src/` nach PR 1 (Commit `6014916`) |
| Status | Zur Abstimmung. Es ist noch nichts davon umgesetzt. |

## 1. Zusammenfassung

Blue Seven ist heute ein Loop-Maker: Ein Generator würfelt eine jazzige Akkordfolge, und ein fest verdrahteter Ablauf spielt sie mit Rhodes, Bass und Drums ab. Akkordlogik, Begleitmuster, Klangerzeugung und Mixer hängen direkt aneinander.

Ziel dieses Umbaus ist eine kleine DAW im Browser mit vier sauber getrennten Schichten:

1. **Akkord-Generatoren** erzeugen eine Akkordfolge in einem festen Format. „Jazzy“ ist der erste.
2. **Stil-Generatoren** nehmen irgendeine Akkordfolge und bauen daraus einen Song als JSON. „Jazzy Beats“ bildet das heutige Verhalten ab, „Deep House“ erzeugt ganze Songs mit Aufbau.
3. **Die Engine** spielt jedes gültige Song-JSON ab. Sie besteht aus Instrumenten, Effekten, Mixer und Transport, jeweils hinter einer kleinen Schnittstelle.
4. **Die Oberfläche** bedient Generatoren und Engine und zeigt Spuren, Mixer und Effektregler.

Die wichtigste Regel: Generatoren erzeugen nur Daten und spielen nie selbst Ton ab. Ein Stil-Generator kennt keinen bestimmten Akkord-Generator, sondern nur das Akkordfolgen-Format.

```
 Akkord-Generator          Stil-Generator            Engine
 (Jazzy, …)                (Jazzy Beats,             (Transport, Instrumente,
                            Deep House, …)            Effekte, Mixer)
      │                         │                         │
      │   Akkordfolge (JSON)    │      Song (JSON)        │    Web Audio
      └────────────────────────►└────────────────────────►└──────────────► Ton
```

## 2. Ausgangslage

Der heutige Stand, soweit er für den Umbau zählt:

| Datei | Heute | Problem für die neue Architektur |
|---|---|---|
| `src/harmony.js` | Akkordpool, `generate`, `voiceLoop`. Rein, ohne DOM und Audio | Liefert Stufen-IDs und ein eigenes Voicing-Format, kein allgemeines Akkordformat |
| `src/sequencer.js` | `scheduleBar` enthält die Begleitmuster (liegend, Comping, gebrochen), Basslauf und Drum-Pattern und ruft die Klangfunktionen direkt auf | Musikalischer Inhalt und Abspielen sind eins. Es gibt kein Song-Objekt |
| `src/audio.js` | `rhodes`, `bass`, `kick`, `hat`, `rim` als freie Funktionen. Signalweg fest: Busse, Tiefpass, Tremolo, Hall, `gate`, Kompressor | Instrumente und Effekte sind nicht austauschbar, der Signalweg ist nicht beschreibbar |
| `src/state.js` | Ein Zustandsobjekt `S`, gespeichert unter `blueseven.v1` | Mixerwerte sind drei feste Felder (`volR`, `volB`, `volD`) |
| `src/ui.js`, `src/main.js` | Kacheln, Klaviatur, Regler, Event-Handler | Greifen direkt auf `S`, `voiced` und die Klangfunktionen zu |

Technische Festlegungen aus PR 1, die bestehen bleiben: Quelltext in `src/` als normale Skripte ohne ES-Module, `build.mjs` ohne Abhängigkeiten setzt daraus eine einzelne `index.html`, die gebaute Datei ist eingecheckt, GitHub Pages liefert `main` aus dem Wurzelordner aus.

## 3. Ziele

- **Z1** Ein versioniertes Song-Format als JSON, das einen Song vollständig beschreibt: Tempo, Abschnitte, Spuren, Noten, Instrumente, Mixer, Effekte, Automation.
- **Z2** Generatoren sind reine Funktionen. Sie liefern JSON und berühren weder Web Audio noch das DOM.
- **Z3** Akkord-Generatoren sind eigenständige Module hinter einer Akkordfolgen-Schnittstelle. Jazzy ist der erste.
- **Z4** Stil-Generatoren verarbeiten jede gültige Akkordfolge. Jeder Akkord-Generator lässt sich mit jedem Stil kombinieren.
- **Z5** Eine Engine, die jedes gültige Song-JSON abspielt, mit Spuren wie in einer DAW, einem Mixer mit Kanälen, Effektspuren mit Sends und steuerbaren Effektparametern.
- **Z6** Instrumente, Effekte, Mixer und Transport haben klare, dokumentierte Schnittstellen. Ein neues Instrument oder ein neuer Effekt ist eine neue Datei plus eine Registrierung.
- **Z7** „Jazzy Beats“ klingt und verhält sich wie die heutige App.
- **Z8** „Deep House“ erzeugt ganze Songs mit Arrangement aus Intro, Aufbau, Drop, Break und Outro.

## 4. Nicht-Ziele

Diese Punkte gehören ausdrücklich nicht zu diesem Vorhaben:

- Kein Server, kein Konto, keine Synchronisation zwischen Geräten.
- Keine Audioaufnahme und keine Samples aus Dateien. Alle Klänge werden weiter synthetisch erzeugt.
- Kein Noten-Editor (Piano Roll) und kein freies Verschieben von Clips. Der Nutzer steuert Generatoren, Mixer und Effekte, bearbeitet aber keine einzelnen Noten.
- Kein Plug-in-Standard wie VST oder WAM und kein Laden fremder Module zur Laufzeit.
- Kein MIDI-Eingang, kein MIDI-Export und kein WAV-Export in diesem Schritt. Das Song-Format soll beides später möglich machen.
- Kein Desktop-Layout. Es bleibt bei „erstmal nur Handy“.
- Kein Wechsel des Build-Werkzeugs und keine Laufzeit-Abhängigkeiten.

## 5. Randbedingungen

- **R1 Browser ohne Server:** Die App läuft vollständig im Browser mit der Web Audio API. Die gebaute `index.html` startet weiter per Doppelklick und über GitHub Pages.
- **R2 Handy zuerst:** Bedienbar bei 390 px Breite mit dem Daumen. Die Audiolast muss auf einem Mittelklasse-Handy ohne Aussetzer laufen.
- **R3 Klangtreue:** Der Jazzy-Klang und das Jazzy-Verhalten ändern sich nicht. Die Referenzfolgen in `test/harmony.test.mjs` bleiben gültig.
- **R4 Speicher:** Der Schlüssel `blueseven.v1` bleibt. Gemerkte Folgen und Einstellungen aus der heutigen Version werden ohne Verlust geladen.
- **R5 Build:** Weiter `build.mjs` ohne Abhängigkeiten, eine Ausgabedatei, `index.html` eingecheckt, `npm test` braucht nur Node.
- **R6 Bekannte Eigenheiten bleiben:** `AudioContext` erst nach dem ersten Tippen, `iosUnmute`, großer Puffer mit `latencyHint: 'playback'`, Anzeige mit Ausgleich über `outputLatency`.
- **R7 Sprache:** Oberfläche auf Deutsch.

## 6. Architektur

### 6.1 Schichten und erlaubte Abhängigkeiten

| Schicht | Darf kennen | Darf nicht kennen |
|---|---|---|
| Kern (Registry, Parameter, Zufall, Formatprüfung) | nichts | alles andere |
| Akkord-Generator | Kern | Stile, Engine, DOM, Web Audio, andere Akkord-Generatoren |
| Stil-Generator | Kern, Akkordfolgen-Format, Song-Format | einzelne Akkord-Generatoren, Engine, DOM, Web Audio |
| Instrument, Effekt | Kern, Web Audio | Generatoren, Mixer, DOM, App-Zustand |
| Mixer, Transport, Engine | Kern, Song-Format, Instrumente und Effekte nur über die Registry | Generatoren, DOM, App-Zustand |
| App (Zustand, Oberfläche) | alles, aber nur über die öffentlichen Schnittstellen | Interna der Module |

Die Regel „Stil kennt keinen Akkord-Generator“ wird per Test abgesichert (siehe Abnahmekriterium A4).

### 6.2 Module ohne ES-Module

Da `src/` aus normalen Skripten besteht, die zu einem Inline-Skript verkettet werden, registrieren sich Module in einem einzigen globalen Namensraum. Vorschlag `BS`:

```js
BS.register('chords',     { id: 'jazzy',       ... });
BS.register('style',      { id: 'jazzy-beats', ... });
BS.register('instrument', { type: 'rhodes',    ... });
BS.register('effect',     { type: 'reverb',    ... });

BS.get('style', 'deep-house');   // ein Modul
BS.list('chords');               // alle Akkord-Generatoren, zum Beispiel für die Auswahl in der Oberfläche
```

Jede Moduldatei kapselt ihre Interna in einer Funktion und legt nur die Registrierung nach außen. Globale Namen wie heute `POOL`, `S` oder `rhodes` entfallen schrittweise.

### 6.3 Vorgeschlagene Ordnerstruktur

```
src/
  index.html
  styles.css
  core/         registry.js  params.js  rng.js  format.js
  chords/       jazzy.js
  styles/       jazzy-beats.js  deep-house.js
  engine/       transport.js  mixer.js  engine.js
  instruments/  rhodes.js  bass.js  drums.js  …
  effects/      filter.js  tremolo.js  reverb.js  compressor.js  delay.js  ducker.js
  app/          state.js  ui.js  ui-mixer.js  main.js
test/
docs/
```

`build.mjs` muss dafür Pfade mit Unterordnern in den `/*@include …*/`-Zeilen erlauben. Das ist die einzige nötige Änderung am Build.

### 6.4 Gemeinsame Parameterbeschreibung

Generatoren, Instrumente und Effekte beschreiben ihre Parameter im selben Format. Die Oberfläche baut daraus die Regler, und die Engine prüft damit Werte.

```js
{ id: 'frequency', name: 'Grenzfrequenz', type: 'number',
  min: 80, max: 12000, step: 1, default: 3600, unit: 'Hz', curve: 'exp' }
{ id: 'feel', name: 'Spielweise', type: 'enum', default: 'comp',
  options: [{ value: 'pad', name: 'Liegend' }, { value: 'comp', name: 'Comping' }, { value: 'arp', name: 'Gebrochen' }] }
{ id: 'nine', name: 'Mit None', type: 'bool', default: true }
```

Erlaubte Typen: `number`, `enum`, `bool`. Fehlende Werte werden mit `default` gefüllt, Werte außerhalb von `min` und `max` werden begrenzt.

## 7. Schnittstelle Akkordfolge

### 7.1 Format

```json
{
  "format": "blueseven.chords",
  "version": 1,
  "key": 0,
  "mode": "dur",
  "generator": { "id": "jazzy", "version": 1, "params": { "n": 4, "spice": 35, "nine": true } },
  "chords": [
    {
      "root": 0,
      "tones": [0, 4, 7, 11, 14],
      "duration": 4,
      "voicing": [57, 60, 64, 67],
      "bass": 0,
      "label": { "roman": "I", "root": "C", "suffix": "maj9" },
      "source": { "id": "I", "color": false }
    }
  ]
}
```

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `format`, `version` | ja | Kennung und Formatversion |
| `key` | ja | Tonart als Tonklasse 0 bis 11 (0 = C) |
| `mode` | ja | `dur` oder `moll`, wie im heutigen Zustand |
| `generator` | nein | Herkunft, nur zur Anzeige und zum Wiederherstellen |
| `chords[].root` | ja | Grundton als absolute Tonklasse 0 bis 11 |
| `chords[].tones` | ja | Akkordtöne als Halbtöne über dem Grundton, aufsteigend, inklusive Erweiterungen (14 = None) |
| `chords[].duration` | ja | Länge in Vierteln. Jazzy liefert 4, also einen Takt |
| `chords[].voicing` | nein | Vorgeschlagene Lage als MIDI-Noten, tiefste zuerst |
| `chords[].bass` | nein | Basston als Tonklasse, falls er vom Grundton abweicht |
| `chords[].label` | nein | Texte für die Anzeige |
| `chords[].source` | nein | Daten, die nur der erzeugende Generator versteht, zum Beispiel die Stufen-ID |

Regeln für Stil-Generatoren:

- Musikalisch zählen nur `key`, `mode`, `root`, `tones`, `duration`, `voicing` und `bass`. `label` ist nur Anzeige, `generator` und `source` dürfen nicht gelesen werden.
- Ein Stil muss mit jeder Anzahl Akkorde ab 1, mit beliebigen `duration`-Werten und mit Voicings aus 3 oder mehr Tönen zurechtkommen.
- Fehlt `voicing`, erzeugt der Stil eine Lage aus `root` und `tones`. Dafür stellt der Kern eine Hilfsfunktion bereit, damit nicht jeder Stil eine eigene Stimmführung braucht.

### 7.2 Akkord-Generator

```js
BS.register('chords', {
  id: 'jazzy',
  name: 'Jazzy',
  version: 1,
  params: [ /* Parameterbeschreibungen: n, spice, nine */ ],

  // Neue Folge erzeugen.
  generate(params, ctx) { return progression; },

  // Optional: dieselbe Folge unter geänderten Parametern neu ausgeben,
  // zum Beispiel andere Tonart oder None an/aus, ohne neu zu würfeln.
  update(progression, params, ctx) { return progression; }
});
```

`ctx` enthält:

| Feld | Bedeutung |
|---|---|
| `key`, `mode` | Tonart und Tongeschlecht. Sie gehören der App, nicht dem Generator, damit sie beim Wechsel des Generators stehen bleiben |
| `rnd` | Zufallsfunktion wie `Math.random`. Mit festem Startwert ist das Ergebnis reproduzierbar |
| `previous` | Die bisherige Folge oder `null` |
| `locked` | Wahrheitswerte pro Platz. Gehaltene Akkorde aus `previous` bleiben an ihrem Platz |
| `avoid` | Zuletzt erzeugte Folgen, die gemieden werden sollen |

Anforderungen:

- **F-C1** Ein Akkord-Generator ist eine reine Funktion seiner Eingaben und läuft in Node ohne Browser.
- **F-C2** Jazzy übernimmt `POOL`, `scoreLoop`, `generate` und `voiceLoop` aus `src/harmony.js` unverändert in der Logik und liefert zusätzlich das Format aus 7.1.
- **F-C3** Halten, Würze, 3 oder 4 Akkorde, None an oder aus, Tonartwechsel ohne neues Würfeln und das Meiden der letzten 12 Folgen funktionieren wie heute.
- **F-C4** Die Oberfläche zeigt die Parameter des gewählten Akkord-Generators aus dessen Parameterbeschreibung. Generatoren ohne `update` werden bei Parameteränderung neu gewürfelt.
- **F-C5** Ein zweiter, sehr einfacher Akkord-Generator (zum Beispiel feste Kadenzen aus Dreiklängen) wird als Beweis der Schnittstelle mitgeliefert, mindestens als Test-Fixture.

## 8. Schnittstelle Stil-Generator

```js
BS.register('style', {
  id: 'deep-house',
  name: 'Deep House',
  version: 1,
  params: [ /* Parameterbeschreibungen */ ],
  tempo: { default: 122, min: 116, max: 128 },

  // Baut aus einer Akkordfolge einen vollständigen Song.
  generate(progression, params, ctx) { return song; }
});
```

`ctx` enthält `rnd` und `bpm`. Der Rückgabewert ist ein Song nach Abschnitt 9.

- **F-S1** Ein Stil-Generator ist eine reine Funktion und läuft in Node ohne Browser. Er erzeugt keinen Ton.
- **F-S2** Ein Stil-Generator liest von der Akkordfolge nur die in 7.1 als musikalisch markierten Felder.
- **F-S3** Kanal- und Spur-IDs eines Stils sind stabil. Mixer-Einstellungen des Nutzers bleiben dadurch beim erneuten Würfeln erhalten.
- **F-S4** Der erzeugte Song besteht die Formatprüfung aus 9.6.
- **F-S5** Gleiche Eingaben und gleicher Zufallsstartwert ergeben denselben Song.

### 8.1 Stil „Jazzy Beats“

Bildet `scheduleBar` aus `src/sequencer.js` als Daten ab:

- Parameter `feel` mit `pad`, `comp`, `arp` und denselben Zeiten, Längen und Anschlagstärken wie heute, inklusive der kleinen Versätze zwischen den Akkordtönen (16 ms, 8 ms).
- Bass auf 1 und 2-und sowie ein Durchgangston einen Halbton unter dem nächsten Grundton auf 4-und.
- Hi-Hat in Achteln, Kick auf 1 und 2-und, Rim auf 2 und 4.
- Drei Spuren: Rhodes, Bass, Drums. Ein Abschnitt, der endlos wiederholt wird.
- Mixer wie heute: Rhodes mit Tiefpass 3600 Hz und Stereo-Tremolo 4,4 Hz, Send 0,24 auf den Hall; Drums mit Send 0,06 auf den Hall; Bass trocken; Kompressor auf der Summe (Schwelle −16 dB, Verhältnis 4).
- Tempo 56 bis 132 BPM, Standard 84, Swing wie heute.

### 8.2 Stil „Deep House“

- **F-D1 Tempo:** 116 bis 128 BPM, Standard 122. Kein Swing als Standard, aber einstellbar.
- **F-D2 Harmonie:** Die Akkordfolge wird als Schleife über den ganzen Song gelegt. Der Stil darf die Akkordlängen strecken (zum Beispiel jeder Akkord zwei Takte), ändert aber weder Reihenfolge noch Töne.
- **F-D3 Arrangement:** Abschnitte in Phrasen von 8 oder 16 Takten, mindestens Intro, Aufbau, Drop, Break, zweiter Drop und Outro. Gesamtlänge etwa 3 bis 5 Minuten, über einen Parameter in Stufen wählbar (kurz, mittel, lang).
- **F-D4 Spuren:** mindestens Kick (Four on the Floor), Clap auf 2 und 4, geschlossene Hi-Hat, offene Hi-Hat im Offbeat, Percussion, Bass, Akkord-Stabs, Pad. Welche Spuren in welchem Abschnitt spielen, ist Teil des Arrangements.
- **F-D5 Bass:** Linie aus Grundton und Akkordtönen der jeweiligen Akkorde, rhythmisch zwischen die Kicks gesetzt.
- **F-D6 Bewegung:** Filterfahrten auf Stabs oder Pad als Automation im Song-JSON, zum Beispiel Öffnen des Tiefpasses im Aufbau.
- **F-D7 Pumpen:** Das typische Sidechain-Pumpen wird über den Effekt `ducker` beschrieben (siehe 10.3), nicht durch Sonderlogik in der Engine.
- **F-D8 Übergänge:** Kurze Fills oder ein Rauschanstieg vor Drop und Break.
- **F-D9 Parameter:** mindestens Länge, Energie (Dichte von Percussion und Bass), Stab-Rhythmus aus zwei bis drei Varianten.
- **F-D10 Neue Klänge:** Clap, offene Hi-Hat, Pad- oder Stab-Synth und ein House-Bass kommen als neue Instrumente oder als Voreinstellungen bestehender Instrumente. Welche Variante gewählt wird, entscheidet die Umsetzung.

Der Klang von Deep House ist Geschmackssache und wird in Runden mit dem Nutzer abgestimmt. Dieses Pflichtenheft legt nur Struktur und Mindestumfang fest.

## 9. Song-Format

### 9.1 Grundsätze

- Ein Song ist reines JSON ohne Funktionen und ohne Verweise auf Laufzeitobjekte.
- Zeiten stehen in Vierteln ab Songanfang oder ab Pattern-Anfang, als Kommazahl. Das Tempo lässt sich dadurch ändern, ohne den Song neu zu erzeugen.
- Swing ist eine Eigenschaft des Tempos. Die Engine wendet ihn beim Abspielen auf die Achtel zwischen den Schlägen an, wie heute.
- Wiederholungen werden nicht ausgeschrieben. Noten stehen in Patterns, Spuren setzen Patterns als Clips auf die Zeitachse.
- Der Song enthält die Mixer-Einstellungen. Er ist die einzige Quelle für das, was die Engine spielt.

### 9.2 Beispiel (gekürzt)

```json
{
  "format": "blueseven.song",
  "version": 1,
  "meta": {
    "title": "Deep House in F-Moll",
    "style": { "id": "deep-house", "version": 1, "params": { "length": "mittel", "energy": 60 } },
    "seed": 184467,
    "chords": { "format": "blueseven.chords", "version": 1, "key": 5, "mode": "moll", "chords": [] }
  },
  "tempo": { "bpm": 122, "swing": 0, "beatsPerBar": 4 },
  "length": 384,
  "loop": false,
  "sections": [
    { "id": "intro", "name": "Intro", "start": 0,  "length": 64 },
    { "id": "build", "name": "Aufbau", "start": 64, "length": 32 },
    { "id": "drop1", "name": "Drop",   "start": 96, "length": 64 }
  ],
  "patterns": {
    "kick4": { "length": 4,  "notes": [ { "t": 0, "d": 0.25, "p": 36, "v": 1 }, { "t": 1, "d": 0.25, "p": 36, "v": 1 },
                                        { "t": 2, "d": 0.25, "p": 36, "v": 1 }, { "t": 3, "d": 0.25, "p": 36, "v": 1 } ] },
    "stabA": { "length": 16, "notes": [ { "t": 0.5, "d": 0.4, "p": 56, "v": 0.7 }, { "t": 0.5, "d": 0.4, "p": 60, "v": 0.7, "o": 0.008 } ] }
  },
  "tracks": [
    { "id": "kick",  "name": "Kick",  "channel": "drums",
      "instrument": { "type": "drums", "params": {} },
      "clips": [ { "pattern": "kick4", "start": 32, "length": 352 } ] },
    { "id": "stabs", "name": "Stabs", "channel": "keys",
      "instrument": { "type": "rhodes", "params": {} },
      "clips": [ { "pattern": "stabA", "start": 96, "length": 64 } ] }
  ],
  "mixer": {
    "channels": [
      { "id": "keys", "name": "Keys", "gain": 0.77, "pan": 0, "mute": false, "solo": false,
        "inserts": [ { "id": "lp", "type": "filter", "params": { "mode": "lowpass", "frequency": 3600, "q": 0.3 } },
                     { "id": "duck", "type": "ducker", "params": { "source": "kick", "depth": 0.5, "release": 0.18 } } ],
        "sends": [ { "to": "hall", "gain": 0.24 } ] },
      { "id": "drums", "name": "Drums", "gain": 0.25, "pan": 0, "mute": false, "solo": false,
        "inserts": [], "sends": [ { "to": "hall", "gain": 0.06 } ] }
    ],
    "returns": [
      { "id": "hall", "name": "Hall", "gain": 1, "mute": false,
        "inserts": [ { "id": "rev", "type": "reverb", "params": { "seconds": 1.5 } } ] }
    ],
    "master": { "gain": 1, "inserts": [ { "id": "comp", "type": "compressor", "params": { "threshold": -16, "ratio": 4 } } ] }
  },
  "automation": [
    { "target": "channel/keys/insert/lp/frequency",
      "points": [ { "t": 64, "v": 400 }, { "t": 96, "v": 3600, "curve": "exp" } ] }
  ]
}
```

### 9.3 Felder

| Bereich | Feld | Bedeutung |
|---|---|---|
| Kopf | `format`, `version` | `blueseven.song` und Formatversion als ganze Zahl |
| | `meta` | Titel, erzeugender Stil mit Parametern, Zufallsstartwert, eingebettete Akkordfolge. Für die Wiedergabe nicht nötig |
| Zeit | `tempo.bpm`, `tempo.swing`, `tempo.beatsPerBar` | Tempo, Swing in Prozent, Viertel pro Takt |
| | `length` | Songlänge in Vierteln |
| | `loop` | `true`: Der Song beginnt am Ende wieder von vorn (Jazzy Beats). `false`: Er endet (Deep House) |
| | `sections[]` | Benannte Abschnitte mit Start und Länge, lückenlos und ohne Überlappung. Dienen der Anzeige und dem Springen |
| Inhalt | `patterns{}` | Notenmuster mit Länge in Vierteln |
| | `notes[].t`, `.d` | Startzeit und Dauer in Vierteln |
| | `notes[].p` | Tonhöhe als MIDI-Note. Drums nutzen die General-MIDI-Belegung (36 Kick, 37 Rim, 39 Clap, 42 Hi-Hat zu, 46 Hi-Hat offen) |
| | `notes[].v` | Anschlagstärke 0 bis 1 |
| | `notes[].o` | Optionaler Versatz in Sekunden, unabhängig vom Tempo. Für das leichte Auffächern von Akkordtönen |
| Spuren | `tracks[].instrument` | Typ aus der Registry plus Parameterwerte |
| | `tracks[].channel` | Mixerkanal, in den die Spur spielt. Mehrere Spuren dürfen einen Kanal teilen |
| | `tracks[].clips[]` | `pattern`, `start` und `length` in Vierteln. Ist `length` größer als das Pattern, wird es wiederholt. Optional `transpose` in Halbtönen |
| Mixer | `channels[]` | `gain` (linear), `pan` (−1 bis 1), `mute`, `solo`, `inserts[]`, `sends[]` |
| | `returns[]` | Effektspuren. Sie haben keinen Noteninhalt und bekommen ihr Signal nur über Sends |
| | `master` | Summe mit eigenen Inserts |
| | `inserts[]` | Effektkette in Reihenfolge, jeder Eintrag mit eigener `id`, `type`, `params` und optional `bypass` |
| | `sends[]` | Ziel (`to`) und Pegel, abgegriffen nach Fader und Inserts des Kanals |
| Automation | `target` | Adresse eines Parameters, siehe 9.4 |
| | `points[]` | Stützpunkte mit Zeit in Vierteln, Wert und optional `curve` (`step`, `lin`, `exp`) |

### 9.4 Parameteradressen

Jeder steuerbare Wert hat eine Adresse. Dieselben Adressen nutzen Automation, Oberfläche und `engine.setParam`.

```
tempo/bpm
tempo/swing
channel/<kanal>/gain | pan | mute | solo
channel/<kanal>/send/<ziel>
channel/<kanal>/insert/<insert>/<parameter>
return/<effektspur>/gain
return/<effektspur>/insert/<insert>/<parameter>
master/gain
master/insert/<insert>/<parameter>
track/<spur>/instrument/<parameter>
```

### 9.5 Versionierung

- **F-V1** `version` ist eine ganze Zahl und steigt nur bei Änderungen, die alte Engines nicht verstehen. Zusätzliche optionale Felder erhöhen die Version nicht.
- **F-V2** Für jeden Versionssprung gibt es eine Migrationsfunktion von Version n nach n+1. Die Engine lädt jeden Song mit Version kleiner oder gleich der eigenen, indem sie die Migrationen der Reihe nach anwendet.
- **F-V3** Ein Song mit höherer Version wird nicht abgespielt. Die App zeigt eine verständliche Meldung.
- **F-V4** Unbekannte Felder werden ignoriert und beim erneuten Speichern erhalten.
- **F-V5** Ein unbekannter Instrument- oder Effekttyp bringt die Wiedergabe nicht zum Absturz. Die Spur bleibt stumm oder der Effekt wird übersprungen, und die App weist darauf hin.
- **F-V6** Die Akkordfolge hat mit `blueseven.chords` eine eigene Versionsnummer nach denselben Regeln.

### 9.6 Formatprüfung

Der Kern stellt `BS.format.checkSong(song)` und `BS.format.checkChords(progression)` bereit. Sie liefern eine Liste verständlicher Fehler, zum Beispiel „Spur ‚stabs‘ verweist auf unbekanntes Pattern ‚stabB‘“. Geprüft werden Pflichtfelder, Typen, Wertebereiche und Verweise (Pattern, Kanal, Send-Ziel, Automationsadresse). Die Prüfung läuft in Node und wird in den Tests auf jeden Generator angewendet.

## 10. Engine

### 10.1 Öffentliche Schnittstelle

```js
const engine = BS.createEngine();

engine.init();                         // AudioContext anlegen, nur nach Nutzeraktion
engine.load(song);                     // Song prüfen, Instrumente, Effekte und Mixer aufbauen
engine.swap(song, { at: 'bar' });      // Song im Lauf ersetzen, Position bleibt erhalten
engine.play({ from: 0 });              // Start an einer Position in Vierteln
engine.stop();
engine.seek(beats);                    // zu einer Position oder einem Abschnitt springen
engine.setParam(address, value);       // Wert sofort ändern, Adressen aus 9.4
engine.audition(trackId, notes);       // einzelne Noten sofort anspielen (Akkord antippen)
engine.on('position', fn);             // Takt, Abschnitt, laufender Akkord, mit Ausgleich der Ausgabelatenz
engine.on('ended', fn);
engine.on('warning', fn);
```

- **F-E1** Die Engine spielt jedes Song-JSON ab, das die Formatprüfung besteht. Sie enthält keine Sonderfälle für einzelne Stile.
- **F-E2** Die Engine greift nicht auf das DOM und nicht auf den App-Zustand zu. Meldungen gehen über Ereignisse an die App.
- **F-E3** Geplant wird wie heute mit Vorausschau: ein Zeitgeber alle 50 ms plant alle Noten der nächsten 0,6 s. Geplant wird nach Zeitfenster, nicht mehr taktweise, damit lange Songs den Speicher nicht füllen.
- **F-E4** `setParam` wirkt sofort und ohne Knackser (geglättet wie heute mit etwa 20 ms). Tempo und Swing wirken ab den noch nicht geplanten Noten.
- **F-E5** `swap` ersetzt den Song an der nächsten Taktgrenze, ohne dass die Wiedergabe abreißt. Das deckt das heutige Verhalten ab, dass neue Akkorde und eine andere Spielweise ab dem nächsten Takt greifen.
- **F-E6** Vom Nutzer gesetzte Werte haben Vorrang vor Automation, bis der Song neu geladen wird oder der Nutzer den Wert zurücksetzt.
- **F-E7** Stopp blendet wie heute über ein Gate in etwa 15 ms aus und beendet alle laufenden Klangquellen.
- **F-E8** `iosUnmute` und der Start des `AudioContext` nach dem ersten Tippen bleiben erhalten.

### 10.2 Instrument

```js
BS.register('instrument', {
  type: 'rhodes',
  name: 'Rhodes',
  params: [ /* Parameterbeschreibungen */ ],

  create(ac, params) {
    return {
      output,                                  // AudioNode, wird vom Mixer an den Kanal gehängt
      play(note, time, seconds) {},            // note = { p, v }, time in AudioContext-Zeit
      setParam(id, value, time) {},
      stopAll(time) {},                        // alle laufenden Stimmen beenden
      dispose() {}
    };
  }
});
```

- **F-I1** Ein Instrument kennt nur den `AudioContext` und seinen Ausgang. Es weiß nichts von Takten, Songs oder dem Mixer.
- **F-I2** Die heutigen Klänge werden zu den Instrumenten `rhodes`, `bass` und `drums` (Kick, Hi-Hat, Rim) mit unveränderter Synthese. Tiefpass und Tremolo des Rhodes wandern als Effekte in den Kanal.
- **F-I3** Jedes Instrument begrenzt die Zahl gleichzeitiger Stimmen und beendet bei Überschreitung die älteste.
- **F-I4** Zufall im Klang selbst (leichte Verstimmung des Rhodes, Startpunkt im Rauschen) bleibt im Instrument und steht nicht im Song.

### 10.3 Effekt

```js
BS.register('effect', {
  type: 'filter',
  name: 'Filter',
  params: [ /* Parameterbeschreibungen */ ],

  create(ac, params) {
    return {
      input, output,                           // AudioNodes
      setParam(id, value, time) {},
      automate(id, points) {},                 // optional: Stützpunkte direkt als AudioParam-Rampen planen
      trigger(time) {},                        // optional: nur für Effekte, die auf Noten reagieren
      dispose() {}
    };
  }
});
```

Mindestumfang an Effekten:

| Typ | Parameter | Herkunft |
|---|---|---|
| `filter` | Modus, Grenzfrequenz, Güte | heute fest im Rhodes-Weg |
| `tremolo` | Tempo, Tiefe (Stereo-Wandern) | heute fest im Rhodes-Weg |
| `reverb` | Dauer | heutiger Faltungshall mit erzeugter Impulsantwort |
| `compressor` | Schwelle, Verhältnis | heute auf der Summe |
| `delay` | Zeit in Notenwerten, Rückkopplung, Höhendämpfung | neu |
| `ducker` | Quellspur, Tiefe, Erholzeit | neu, für das Pumpen in Deep House |

- **F-X1** Jeder Effekt lässt sich als Insert in einem Kanal, in einer Effektspur und auf der Summe einsetzen.
- **F-X2** Jeder Effektparameter aus der Parameterbeschreibung ist über die Oberfläche steuerbar und über Automation ansprechbar.
- **F-X3** `bypass` schaltet einen Effekt ohne Knackser aus dem Signalweg.
- **F-X4** `ducker` senkt den Pegel kurz zu jedem Notenbeginn der Quellspur. Die Engine ruft dafür `trigger` mit den geplanten Zeiten auf. Es wird kein Audiosignal analysiert.

### 10.4 Mixer

- **F-M1** Pro Kanal: Lautstärke, Panorama, Mute, Solo, Insert-Kette, Sends auf Effektspuren.
- **F-M2** Effektspuren haben Lautstärke, Mute und eine eigene Insert-Kette. Sie führen in die Summe.
- **F-M3** Die Summe hat Lautstärke und Insert-Kette. Dahinter liegt das Gate für den Stopp.
- **F-M4** Signalweg eines Kanals: Instrumente → Inserts → Fader → Panorama → Summe. Sends greifen nach dem Fader ab.
- **F-M5** Solo schaltet alle anderen Kanäle stumm. Effektspuren bleiben hörbar.
- **F-M6** Die Regler der Oberfläche gehen von 0 bis 100 und werden wie heute mit dem Exponenten 1,6 in den linearen Pegel umgerechnet. Im Song steht der lineare Pegel.

Wichtig für die Klangtreue: Heute greift der Hall-Send des Rhodes hinter Tiefpass, Tremolo und Lautstärke ab. Die Reihenfolge aus F-M4 muss für Jazzy Beats hörbar dasselbe Ergebnis liefern. Falls nicht, wird die Position des Faders im Kanal angepasst, nicht der Klang.

## 11. App und Oberfläche

- **F-U1 Auswahl:** Der Nutzer wählt einen Akkord-Generator und einen Stil unabhängig voneinander. Beide Listen kommen aus der Registry.
- **F-U2 Akkordbereich:** Kacheln, Halten, Antippen zum Anhören, Klaviatur, Würfeln, Zurück und Merken bleiben wie heute und arbeiten auf der Akkordfolge.
- **F-U3 Stilparameter:** Die Regler des gewählten Stils werden aus dessen Parameterbeschreibung erzeugt. Für Jazzy Beats ist das die Spielweise.
- **F-U4 Songübersicht:** Bei Songs mit mehreren Abschnitten zeigt eine kompakte Leiste die Abschnitte und die aktuelle Position. Antippen eines Abschnitts springt dorthin.
- **F-U5 Spuren:** Eine Liste der Spuren mit Name und Mute, bei Songs mit Arrangement mit einer einfachen Balkenansicht, in welchen Abschnitten die Spur spielt. Nur Anzeige, kein Bearbeiten.
- **F-U6 Mixer:** Für jeden Kanal Lautstärke, Mute und Solo sofort sichtbar. Panorama, Sends und Effekte liegen in einer aufklappbaren Detailansicht pro Kanal.
- **F-U7 Effekte:** Jeder Effekt zeigt seine Parameter als Regler aus der Parameterbeschreibung sowie einen Schalter für Bypass. Das gilt auch für Effektspuren und Summe.
- **F-U8 Handy:** Alles ist bei 390 px Breite ohne waagerechtes Scrollen der Seite bedienbar. Bedienelemente haben mindestens 44 px Höhe. Der Mixer darf als eigener Bereich waagerecht scrollen.
- **F-U9 Neu erzeugen:** Würfeln erzeugt eine neue Akkordfolge und daraus einen neuen Song. Zusätzlich gibt es „Song neu bauen“, das bei gleicher Akkordfolge nur den Stil neu würfelt. Mixer-Einstellungen des Nutzers bleiben in beiden Fällen erhalten.
- **F-U10 Export und Import:** Der aktuelle Song lässt sich als JSON-Datei speichern und in die Zwischenablage kopieren. Eine JSON-Datei oder eingefügter Text lässt sich laden und abspielen, auch wenn sie nicht aus einem der eingebauten Generatoren stammt.
- **F-U11 Fehlermeldungen:** Ungültige Songs und fehlende Module werden in normalem Deutsch gemeldet.

## 12. Speicherung und Kompatibilität

- **F-P1** Der Schlüssel `blueseven.v1` und seine Struktur `{ S, favs }` bleiben bestehen.
- **F-P2** Ein gespeicherter Stand der heutigen Version wird ohne Verlust geladen: Tonart, Tongeschlecht, Anzahl, Tempo, Swing, Würze, Spielweise, None, die drei Lautstärken, die aktuelle Folge, gehaltene Plätze und alle gemerkten Folgen.
- **F-P3** Neue Einstellungen kommen nur als zusätzliche Felder hinzu. Bestehende Felder behalten Namen und Bedeutung, sodass auch eine ältere Version der App einen neueren Stand noch lesen kann.
- **F-P4** `volR`, `volB` und `volD` werden weiter gepflegt und entsprechen den Kanälen Rhodes, Bass und Drums von Jazzy Beats.
- **F-P5** Gemerkte Folgen bleiben Akkordfolgen im heutigen Format (`key`, `mode`, `loop`). Sie lassen sich mit jedem Stil laden.
- **F-P6** Vom Nutzer gespeicherte Songs liegen unter einem eigenen, neuen Schlüssel, damit `blueseven.v1` klein bleibt und die Speichergrenze des Browsers nicht die Einstellungen gefährdet.
- **F-P7** Die Anbindung an `window.claude.hot` in `src/main.js` bleibt funktionsfähig.

## 13. Qualitätsanforderungen

- **Q1 Flüssigkeit:** Jazzy Beats läuft auf dem Handy des Nutzers nicht schlechter als heute. Deep House läuft im dichtesten Abschnitt ohne Aussetzer.
- **Q2 Last:** Höchstens 32 gleichzeitige Stimmen über alle Instrumente, höchstens ein Faltungshall pro Song als Standard der eingebauten Stile.
- **Q3 Erzeugungszeit:** Ein Stil-Generator braucht für einen ganzen Song auf dem Handy unter 200 ms. Die Bedienung bleibt dabei flüssig.
- **Q4 Größe:** Ein Deep-House-Song bleibt als JSON unter 200 kB. Die gebaute `index.html` bleibt unter 300 kB.
- **Q5 Testbarkeit:** Kern, Akkord-Generatoren, Stil-Generatoren und Formatprüfung laufen in Node. `npm test` bleibt ohne Pakete lauffähig.
- **Q6 Erweiterbarkeit:** Ein neuer Akkord-Generator, Stil, Effekt oder ein neues Instrument braucht eine neue Datei, eine Zeile in `src/index.html` und keine Änderung an bestehenden Modulen.
- **Q7 Rückverfolgbarkeit:** Jede Phase aus Abschnitt 14 kommt als eigener Pull Request, innerhalb davon ein Commit pro Änderung.

## 14. Migrationsplan in Phasen

Nach jeder Phase ist die App vollständig benutzbar und klingt wie zuvor. Jede Phase wird einzeln abgenommen.

| Phase | Inhalt | Ergebnis | Nachweis |
|---|---|---|---|
| 0 Fundament | Namensraum `BS` mit Registry, Parameterbeschreibung, Zufallsfunktion mit Startwert. `build.mjs` erlaubt Unterordner. Ordnerstruktur anlegen | Keine sichtbare Änderung | Bestehende Tests grün, `index.html` funktional unverändert |
| 1 Akkord-Schnittstelle | `harmony.js` wird zum Modul `chords/jazzy.js`. Format `blueseven.chords` und dessen Prüfung. App arbeitet intern mit der Akkordfolge | Keine sichtbare Änderung | Referenzfolgen aus `test/harmony.test.mjs` unverändert, neue Tests für das Format |
| 2 Song-Format und Jazzy Beats | Format `blueseven.song` mit Prüfung. Stil `jazzy-beats` erzeugt den Song aus der Akkordfolge. Noch keine Wiedergabe daraus | Keine sichtbare Änderung | Test vergleicht die Noten des Songs mit einer Aufzeichnung der Aufrufe des heutigen `scheduleBar` für alle drei Spielweisen |
| 3 Engine | Instrumente, Effekte, Mixer und Transport nach Abschnitt 10. `audio.js` und `sequencer.js` entfallen. Die App spielt nur noch Song-JSON | Klang und Verhalten wie zuvor | Vergleich der geplanten Ereignisse alt gegen neu, Hörprobe durch den Nutzer auf dem Handy |
| 4 Mixer und Effekte in der Oberfläche | Kanäle mit Mute, Solo, Panorama, Sends, Effektspuren, Effektregler aus Parameterbeschreibung. Auswahl von Akkord-Generator und Stil | Erste sichtbare Erweiterung | Screenshot bei 390 px, Bedienprobe |
| 5 Deep House | Neue Instrumente, Effekte `delay` und `ducker`, Automation, Stil `deep-house`, Songübersicht mit Abschnitten | Ganze Songs | Formatprüfung, Unabhängigkeitstest, Hörproben in Runden |
| 6 Songs sichern | Export, Import, Speichern von Songs, Migrationen für Formatversionen | Songs bleiben erhalten | Test mit gespeichertem Song der Version 1 |

Die Phasen 0 bis 3 sind reiner Umbau ohne neue Funktion. Sie tragen das größte Risiko für den Klang und werden deshalb klein gehalten und einzeln geprüft. Die Phasen 4 und 5 lassen sich bei Bedarf tauschen.

## 15. Abnahmekriterien

| Nr. | Kriterium | Prüfung |
|---|---|---|
| A1 | Die Referenzfolgen und Referenz-Voicings in `test/harmony.test.mjs` sind unverändert gültig | `npm test` |
| A2 | Jazzy Beats erzeugt für alle drei Spielweisen dieselben Noten (Zeit, Dauer, Tonhöhe, Anschlag, Versatz) wie das heutige `scheduleBar` | Automatischer Vergleich mit Aufzeichnung vom Stand `6014916` |
| A3 | Jazzy Beats klingt auf dem Handy des Nutzers wie vor dem Umbau | Hörprobe durch den Nutzer |
| A4 | Jeder Stil-Generator läuft in einer Umgebung, in der kein Akkord-Generator geladen ist, mit einer von Hand geschriebenen Akkordfolge und liefert einen gültigen Song | Automatischer Test |
| A5 | Jeder Stil liefert mit einer Akkordfolge aus einem zweiten Akkord-Generator, mit 1, 3, 4 und 8 Akkorden und mit ungleichen Akkordlängen einen gültigen Song | Automatischer Test |
| A6 | Kein Generator verwendet `AudioContext`, `document` oder `window` | Automatischer Test: Die Generatoren laufen in einem leeren Kontext |
| A7 | Die Engine spielt einen von Hand geschriebenen Song ab, der aus keinem Generator stammt, mit zwei Spuren, einem Insert und einer Effektspur | Beispieldatei in `test/`, Hörprobe |
| A8 | Ein mit der heutigen Version gespeicherter Stand unter `blueseven.v1` wird mit allen Einstellungen und gemerkten Folgen geladen | Automatischer Test mit gespeichertem Beispielstand |
| A9 | Ein Deep-House-Song hat mindestens sechs Abschnitte, dauert 3 bis 5 Minuten und nutzt mindestens die Spuren aus F-D4 | Automatischer Test auf dem Song-JSON |
| A10 | Lautstärke, Mute, Solo, Panorama und Send jedes Kanals sowie jeder Effektparameter lassen sich im Lauf verstellen, ohne Knackser und ohne Neustart | Bedienprobe |
| A11 | Gleicher Zufallsstartwert und gleiche Eingaben ergeben einen identischen Song | Automatischer Test |
| A12 | Ein Song mit höherer Formatversion oder unbekanntem Instrument führt zu einer Meldung, nicht zu einem Absturz | Automatischer Test und Bedienprobe |
| A13 | Die gebaute `index.html` läuft per Doppelklick ohne Server und ohne Konsolenfehler, bei 390 px Breite ohne waagerechtes Scrollen der Seite | Screenshot und Konsole |
| A14 | Ein exportierter Song lässt sich wieder importieren und ergibt dieselbe Wiedergabe | Automatischer Vergleich des JSON, Hörprobe |
| A15 | Ein Deep-House-Song läuft auf dem Handy des Nutzers ohne Aussetzer durch | Hörprobe durch den Nutzer |

## 16. Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| Der Klang von Jazzy ändert sich unbemerkt durch den neuen Signalweg | Phasen 0 bis 3 ohne neue Funktionen, Vergleich der geplanten Ereignisse, Hörprobe vor jeder Zusammenführung |
| Zu viel Audiolast auf dem Handy durch mehr Spuren und Effekte | Stimmenbegrenzung, ein Hall pro Song, Obergrenzen aus Abschnitt 13, früher Test eines dichten Abschnitts auf dem Handy |
| Das Song-Format muss kurz nach Version 1 geändert werden | Format in Phase 2 zuerst nur intern nutzen, Export erst in Phase 6 freigeben |
| Ein globaler Namensraum führt zu versteckten Abhängigkeiten zwischen Modulen | Tests laden Module einzeln in leere Kontexte (A4, A6) |
| Die Oberfläche wird auf dem Handy zu voll | Mixer und Effekte in aufklappbaren Bereichen, Details erst auf Wunsch |
| Der Speicher im Browser läuft durch gespeicherte Songs voll | Eigener Schlüssel für Songs, Obergrenze für die Anzahl, Hinweis beim Erreichen |

## 17. Offene Fragen

1. **ES-Module:** Bleiben wir bei normalen Skripten mit dem Namensraum `BS`, oder steigen wir in `src/` auf ES-Module um? Dann müsste `build.mjs` sie zu einem Inline-Skript zusammenführen. Dieses Pflichtenheft geht von normalen Skripten aus.
2. **Jazzy Beats als Song:** Bleibt Jazzy Beats eine Endlosschleife wie heute, oder soll es später auch ein Arrangement bekommen?
3. **Akkordlänge in Deep House:** Ein Takt pro Akkord, zwei Takte oder wählbar?
4. **Voicing:** Soll das Voicing immer vom Akkord-Generator kommen, oder dürfen Stile die Lage selbst bestimmen, zum Beispiel tiefere Stabs in Deep House?
5. **Mixer-Einstellungen:** Gelten sie pro Stil (Vorschlag) oder pro gespeichertem Song?
6. **Gemerkte Folgen:** Soll „Merken“ weiter nur die Akkordfolge sichern, oder zusätzlich Stil und Songparameter?
7. **Tonart und Tongeschlecht:** Bleiben sie Einstellungen der App für alle Akkord-Generatoren (Vorschlag), oder darf ein Generator eigene Tonleitern mitbringen?
8. **Umfang Deep House im ersten Wurf:** Reicht ein fester Aufbau mit Varianten, oder soll der Aufbau selbst gewürfelt werden?
9. **Noten bearbeiten:** Ist ein einfacher Editor für später gewünscht? Das hätte Einfluss darauf, ob Patterns stabile IDs brauchen.
10. **Export als Audio oder MIDI:** Wie wichtig ist das, und in welcher Reihenfolge nach Phase 6?
11. **Claude-Artifact:** Soll die zweite Kopie als Artifact weiter gepflegt werden? Dort ist das Speichern von Dateien per Skript nicht möglich, der Export ginge nur über die Zwischenablage.
12. **Name:** Bleibt es bei „Blue Seven“, oder soll die App mit dem Umbau „Jazzy DAW“ heißen?

## 18. Glossar

| Begriff | Bedeutung |
|---|---|
| Akkord-Generator | Modul, das eine Akkordfolge erzeugt, zum Beispiel Jazzy |
| Stil-Generator | Modul, das aus einer Akkordfolge einen Song baut, zum Beispiel Deep House |
| Akkordfolge | Daten im Format `blueseven.chords` |
| Song | Daten im Format `blueseven.song` |
| Spur | Folge von Clips für ein Instrument |
| Pattern | Notenmuster, das mehrfach verwendet werden kann |
| Clip | Platzierung eines Patterns auf der Zeitachse einer Spur |
| Kanal | Mixerzug mit Lautstärke, Panorama, Inserts und Sends |
| Insert | Effekt direkt im Signalweg eines Kanals |
| Send | Abzweig eines Kanals auf eine Effektspur |
| Effektspur | Kanal ohne Noten, der nur über Sends gespeist wird, zum Beispiel der Hall |
| Summe | Letzter Kanal vor dem Ausgang |
| Automation | Zeitlicher Verlauf eines Parameters im Song |
| Engine | Der Teil der App, der ein Song-JSON abspielt |
