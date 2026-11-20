// Tests für das Song-Format und die Hilfen im Kern rund um Songs. Laufen mit: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSong, checkAddress } from '../src/core/format.js';
import { beatToSeconds, beatsToSeconds } from '../src/core/time.js';
import { faderToGain, gainToFader } from '../src/core/gain.js';
import { voiceChords } from '../src/core/voicing.js';

// Ein kleiner, von Hand geschriebener Song mit zwei Spuren, einem Insert und einer Effektspur (wie in A7).
const song = () => ({
  format: 'blueseven.song', version: 1, meta: { title: 'Test' },
  tempo: { bpm: 120, swing: 0, beatsPerBar: 4 },
  length: 16, loop: false,
  sections: [{ id: 'a', name: 'A', start: 0, length: 8 }, { id: 'b', name: 'B', start: 8, length: 8 }],
  patterns: {
    beat: { length: 4, notes: [{ t: 0, d: 0.25, p: 36, v: 1 }, { t: 2, d: 0.25, p: 36, v: 1 }] },
    chord: { length: 8, notes: [{ t: 0, d: 4, p: 60, v: 0.7 }, { t: 0, d: 4, p: 64, v: 0.7, o: 0.01 }] },
  },
  tracks: [
    { id: 'kick', name: 'Kick', channel: 'drums', instrument: { type: 'drums', params: {} }, clips: [{ pattern: 'beat', start: 0, length: 16 }] },
    { id: 'keys', name: 'Keys', channel: 'keys', instrument: { type: 'rhodes' }, clips: [{ pattern: 'chord', start: 8, length: 8, transpose: -2 }] },
  ],
  mixer: {
    channels: [
      { id: 'drums', name: 'Drums', gain: 0.5, pan: 0, mute: false, solo: false, inserts: [], sends: [] },
      { id: 'keys', name: 'Keys', gain: 0.8, pan: -0.2, mute: false, solo: false,
        inserts: [{ id: 'lp', type: 'filter', params: { frequency: 2000 } }], sends: [{ to: 'hall', gain: 0.3 }] },
    ],
    returns: [{ id: 'hall', name: 'Hall', gain: 1, mute: false, inserts: [{ id: 'rev', type: 'reverb', params: { seconds: 2 } }] }],
    master: { gain: 1, inserts: [] },
  },
  automation: [{ target: 'channel/keys/insert/lp/frequency', points: [{ t: 8, v: 400 }, { t: 16, v: 4000, curve: 'exp' }] }],
});

test('checkSong: von Hand geschriebener Song ist gültig, unbekannte Felder stören nicht', () => {
  assert.deepEqual(checkSong(song()), []);
  const s = song(); s.extra = 1; s.tracks[0].farbe = 'rot'; delete s.automation; delete s.meta;
  assert.deepEqual(checkSong(s), []);
});

test('checkSong: meldet Fehler verständlich', () => {
  const bad = (change, pattern) => {
    const s = song(); change(s); const e = checkSong(s);
    assert.ok(e.some(m => pattern.test(m)), `${pattern} fehlt in ${JSON.stringify(e)}`);
  };
  assert.match(checkSong([])[0], /kein Objekt/);
  bad(s => { s.format = 'midi'; }, /format muss „blueseven\.song“/);
  bad(s => { s.version = 2; }, /Version 2, diese App versteht nur bis Version 1/);
  bad(s => { s.meta = 'x'; }, /meta muss ein Objekt/);
  bad(s => { delete s.tempo; }, /tempo fehlt/);
  bad(s => { s.tempo.bpm = 0; }, /tempo\.bpm/);
  bad(s => { s.tempo.swing = 120; }, /tempo\.swing/);
  bad(s => { s.tempo.beatsPerBar = 3.5; }, /beatsPerBar/);
  bad(s => { s.length = 0; }, /length muss eine Länge/);
  bad(s => { s.loop = 'ja'; }, /loop muss true oder false/);
  bad(s => { s.sections = []; }, /mindestens einem Abschnitt/);
  bad(s => { s.sections[1].start = 9; }, /Abschnitt 2 beginnt bei 9, erwartet ist 8/);
  bad(s => { s.sections[1].length = 4; }, /enden bei 12, der Song aber bei 16/);
  bad(s => { s.sections[1].id = 'a'; }, /Abschnitt „a“ kommt doppelt/);
  bad(s => { s.sections[0].name = ''; }, /Abschnitt 1 braucht einen Namen/);
  bad(s => { s.patterns = []; }, /patterns muss ein Objekt/);
  bad(s => { s.patterns['mit leer'] = { length: 1, notes: [] }; }, /Der Name darf nur/);
  bad(s => { s.patterns.beat.length = 0; }, /Pattern „beat“ braucht eine length/);
  bad(s => { s.patterns.beat.notes[1].t = 4; }, /Note 2: t=4 liegt hinter dem Ende des Patterns/);
  bad(s => { s.patterns.beat.notes[0].d = 0; }, /Note 1: d muss/);
  bad(s => { s.patterns.beat.notes[0].p = 128; }, /p muss eine MIDI-Note/);
  bad(s => { s.patterns.beat.notes[0].v = 1.5; }, /v muss zwischen 0 und 1/);
  bad(s => { s.patterns.beat.notes[0].o = 2; }, /o muss ein Versatz/);
  bad(s => { s.tracks[0].id = 'keys'; }, /Spur „keys“ kommt doppelt/);
  bad(s => { s.tracks[0].channel = 'nirgends'; }, /unbekannten Kanal „nirgends“/);
  bad(s => { delete s.tracks[0].instrument; }, /braucht ein instrument mit type/);
  bad(s => { s.tracks[1].clips[0].pattern = 'stabB'; }, /Spur „keys“, Clip 1 verweist auf das unbekannte Pattern „stabB“/);
  bad(s => { s.tracks[1].clips[0].pattern = 'toString'; }, /unbekannte Pattern „toString“/);
  bad(s => { s.tracks[1].clips[0].length = 9; }, /endet bei 17, hinter dem Ende des Songs/);
  bad(s => { s.tracks[1].clips[0].transpose = 0.5; }, /transpose muss eine ganze Zahl/);
  bad(s => { delete s.mixer; }, /mixer fehlt/);
  bad(s => { s.mixer.channels[0].gain = -1; }, /Kanal „drums“: gain/);
  bad(s => { s.mixer.channels[0].pan = 2; }, /pan muss zwischen -1 und 1/);
  bad(s => { s.mixer.channels[0].solo = 1; }, /solo muss true oder false/);
  bad(s => { s.mixer.channels[1].id = 'drums'; }, /Kanal „drums“ kommt doppelt/);
  bad(s => { s.mixer.channels[0].id = 'hall'; s.tracks[0].channel = 'hall'; }, /heißt wie eine Effektspur/);
  bad(s => { s.mixer.channels[1].sends[0].to = 'delay'; }, /Send auf die unbekannte Effektspur „delay“/);
  bad(s => { s.mixer.channels[1].inserts.push({ id: 'lp', type: 'filter' }); }, /Effekt „lp“ kommt doppelt/);
  bad(s => { s.mixer.channels[1].inserts[0].bypass = 'aus'; }, /bypass muss true oder false/);
  bad(s => { delete s.mixer.returns[0].inserts[0].type; }, /Effekt „rev“ braucht einen type/);
  bad(s => { delete s.mixer.master; }, /master fehlt/);
  bad(s => { s.automation[0].target = 'channel/keys/insert/hp/frequency'; }, /Kanal „keys“ hat keinen Effekt „hp“/);
  bad(s => { s.automation[0].points = []; }, /mindestens einen Stützpunkt/);
  bad(s => { s.automation[0].points.reverse(); }, /nach Zeit sortiert/);
  bad(s => { s.automation[0].points[1].curve = 'sinus'; }, /curve muss eines von step, lin, exp/);
});

test('checkAddress: alle Adressarten aus Abschnitt 9.4', () => {
  const s = song();
  for (const a of ['tempo/bpm', 'tempo/swing', 'channel/keys/gain', 'channel/keys/pan', 'channel/keys/mute', 'channel/keys/solo',
    'channel/keys/send/hall', 'channel/keys/insert/lp/frequency', 'return/hall/gain', 'return/hall/mute',
    'return/hall/insert/rev/seconds', 'master/gain', 'track/keys/instrument/level'])
    assert.equal(checkAddress(s, a), null, a);
  const no = (a, pattern) => assert.match(checkAddress(s, a) || '', pattern, a);
  no('tempo/key', /gibt es nicht/);
  no('channel/bass/gain', /keinen Kanal „bass“/);
  no('channel/drums/send/hall', /keinen Send auf „hall“/);
  no('channel/keys/insert/lp', /genau ein Parametername/);
  no('channel/keys/volume', /gibt es nicht/);
  no('return/delay/gain', /keine Effektspur „delay“/);
  no('master/insert/comp/ratio', /Summe hat keinen Effekt „comp“/);
  no('track/bass/instrument/level', /keine Spur „bass“/);
  no('track/keys/level', /gibt es nicht/);
  no('mixer', /gibt es nicht/);
  assert.match(checkAddress(s, 5), /kein Text/);
});

test('beatToSeconds: Tempo und Swing wie im bisherigen Ablauf', () => {
  const tempo = { bpm: 120, swing: 60 };
  assert.equal(beatToSeconds(0, tempo), 0);
  assert.equal(beatToSeconds(1, tempo), 0.5);
  assert.equal(beatToSeconds(1.5, tempo), 0.75 + 0.6 * 0.5 / 6, 'Achtel zwischen den Schlägen kommt später');
  assert.equal(beatToSeconds(2, { bpm: 120, swing: 0 }), 1);
  assert.equal(beatToSeconds(0.5, { bpm: 60 }), 0.5, 'ohne swing kein Versatz');
  assert.equal(beatsToSeconds(4, { bpm: 84 }), 240 / 84);
});

test('faderToGain und gainToFader: Exponent 1,6 wie bisher, umkehrbar, begrenzt', () => {
  assert.equal(faderToGain(100), 1);
  assert.equal(faderToGain(0), 0);
  assert.equal(faderToGain(80), Math.pow(0.8, 1.6));
  assert.equal(faderToGain(150), 1);
  for (const v of [0, 1, 33, 45, 60, 80, 100]) assert.ok(Math.abs(gainToFader(faderToGain(v)) - v) < 1e-9);
});

test('voiceChords: aufsteigende Lagen aus den richtigen Tonklassen, kleine Bewegungen', () => {
  const chords = [
    { root: 0, tones: [0, 4, 7] }, { root: 9, tones: [0, 3, 7, 10] }, { root: 2, tones: [0, 3, 7, 10, 14] },
    { root: 7, tones: [0, 4, 7, 10, 14, 21] }, { root: 5, tones: [0, 4, 7, 11] },
  ];
  const v = voiceChords(chords);
  assert.equal(v.length, chords.length);
  v.forEach((notes, i) => {
    const c = chords[i], pcs = c.tones.map(t => (c.root + t) % 12);
    assert.equal(notes.length, Math.min(4, new Set(c.tones.map(t => t % 12)).size), `Akkord ${i + 1}: ${notes}`);
    for (let j = 1; j < notes.length; j++) assert.ok(notes[j] > notes[j - 1]);
    assert.ok(notes.every(m => pcs.includes(m % 12)), `Akkord ${i + 1}: fremder Ton in ${notes}`);
    assert.ok(notes[0] >= 52 && notes[0] <= 64 && notes.at(-1) - notes[0] < 12, `Akkord ${i + 1}: Lage ${notes}`);
  });
  // Bei mehr als vier Tönen fällt zuerst der Grundton weg.
  assert.ok(!v[2].some(m => m % 12 === 2), 'Grundton D bleibt bei Dm9 nicht in der Lage');
  // Benachbarte Lagen liegen nah beieinander.
  for (let i = 1; i < v.length; i++) assert.ok(Math.abs(v[i][0] - v[i - 1][0]) <= 7, `Sprung zwischen ${v[i - 1]} und ${v[i]}`);
  // Optionen: weniger Töne, andere Lage.
  const low = voiceChords(chords, { max: 3, low: 40, center: 48 });
  assert.ok(low.every(n => n.length === 3 && n[0] >= 40 && n[0] <= 52));
});
