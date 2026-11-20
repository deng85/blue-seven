# Blue Seven

Kleine Loop-DAW für jazzige Akkordfolgen. Eine einzige HTML-Datei, kein Build, keine Abhängigkeiten, mobile-first.

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

Alles steht in `index.html`: oben die Harmonielogik (Akkordpool, `generate`, `voiceLoop`), darunter Oberfläche, Klangerzeugung und der Takt-Scheduler.
