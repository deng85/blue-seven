// Tests für das Sichern von Songs: Lesen und Prüfen, Formatversionen, Weitergeben und die Sammlung im Browser.
// Laufen mit: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SONG_VERSION, checkSong } from '../src/core/format.js';
import { MIGRATIONS, MAX_SONGS, migrateSong, readSong, missingModules, packSong, titleOf, fileName, readLibrary, putSong } from '../src/core/songfile.js';
import { createRng } from '../src/core/rng.js';
import { createRegistry } from '../src/core/registry.js';
import { createEngine } from '../src/engine/engine.js';
import { jazzy } from '../src/chords/jazzy.js';
import { jazzyBeats } from '../src/styles/jazzy-beats.js';
import { deepHouse } from '../src/styles/deep-house.js';
import { rhodes } from '../src/instruments/rhodes.js';
import { bass } from '../src/instruments/bass.js';
import { drums } from '../src/instruments/drums.js';
import { synth } from '../src/instruments/synth.js';
import { riser } from '../src/instruments/riser.js';
import { filter } from '../src/effects/filter.js';
import { tremolo } from '../src/effects/tremolo.js';
import { reverb } from '../src/effects/reverb.js';
import { compressor } from '../src/effects/compressor.js';
import { delay } from '../src/effects/delay.js';
import { ducker } from '../src/effects/ducker.js';
import { FakeAudioContext, createClock } from './fixtures/fake-audio.js';

const V1 = readFileSync(new URL('./fixtures/song-v1.json', import.meta.url), 'utf8');
const copy = x => JSON.parse(JSON.stringify(x));
const registry = () => createRegistry({ instruments: [rhodes, bass, drums, synth, riser], effects: [filter, tremolo, reverb, compressor, delay, ducker] });
function setup() {
  let ctx = null;
  const clock = createClock(() => ctx);
  class AC extends FakeAudioContext { constructor(o) { super(o); ctx = this; } }
  const engine = createEngine(registry(), { AudioContext: AC, ...clock });
  const warnings = [];
  engine.on('warning', m => warnings.push(m));
  return { engine, clock, warnings, ctx: () => ctx };
}
// Was die Engine in den ersten ms eines Songs startet: Art, Zeit und Frequenz jeder Klangquelle.
function played(song, overrides, ms = 20000) {
  const { engine, clock, warnings, ctx } = setup();
  engine.init(); engine.load(song, { overrides }); engine.play();
  clock.advance(ms);
  return { warnings, events: ctx().events.map(e => [e.kind, e.t.toFixed(6), e.node.frequency ? e.node.frequency.value.toFixed(3) : '']) };
}
const prog = () => jazzy.generate({ n: 4, spice: 35, nine: true }, { key: 0, mode: 'moll', rnd: createRng(7), previous: null, locked: [], avoid: [] });
const house = () => deepHouse.generate(prog(), { length: 'short', energy: 60, stab: 'classic', bars: 2 }, { bpm: 122, swing: 0, rnd: createRng(3), seed: 3 });

test('Ein mit Formatversion 1 gespeicherter Song wird unverändert gelesen und ohne Warnung gespielt', () => {
  const song = readSong(V1);
  assert.deepEqual(song, JSON.parse(V1), 'Version 1 braucht keine Umwandlung');
  assert.equal(song.version, 1);
  assert.equal(titleOf(song), 'Gespeichert mit Version 1');
  const { warnings, events } = played(song, [], 6000);
  assert.deepEqual(warnings, []);
  assert.ok(events.length > 20, 'es klingt etwas');
});

test('F-V2: Migrationen laufen der Reihe nach bis zur Zielversion, das Original bleibt unberührt', () => {
  assert.deepEqual(Object.keys(MIGRATIONS).map(Number).sort(), Array.from({ length: SONG_VERSION - 1 }, (_, i) => i + 1),
    'für jeden Versionssprung bis zur aktuellen Version gibt es eine Migration');
  const v1 = JSON.parse(V1), before = JSON.stringify(v1);
  const table = {
    1: s => { s.tempo.bars = s.tempo.beatsPerBar; return s; },
    2: s => { s.meta.note = 'v3'; return s; },
  };
  const v3 = migrateSong(v1, table, 3);
  assert.equal(v3.version, 3);
  assert.equal(v3.tempo.bars, 4);
  assert.equal(v3.meta.note, 'v3');
  assert.equal(JSON.stringify(v1), before);
  assert.equal(migrateSong(v1, table, 2).version, 2);
  assert.throws(() => migrateSong(v1, { 2: s => s }, 3), /Für Formatversion 1 gibt es keine Umwandlung/);
});

test('F-V3 und A12: Neuere Version, fremde Formate und kaputter Text ergeben eine verständliche Meldung', () => {
  const s = JSON.parse(V1);
  assert.throws(() => readSong(JSON.stringify({ ...s, version: SONG_VERSION + 1 })), /hat Formatversion \d+, diese App versteht nur bis Version/);
  assert.throws(() => readSong(''), /Da steht nichts/);
  assert.throws(() => readSong('   '), /Da steht nichts/);
  assert.throws(() => readSong(V1.slice(0, 500)), /kein gültiges JSON/);
  assert.throws(() => readSong('[1,2]'), /kein Song/);
  assert.throws(() => readSong('{"a":1}'), /kein Song von Blue Seven/);
  assert.throws(() => readSong(JSON.stringify(prog())), /Akkordfolge, kein Song/);
  assert.throws(() => readSong(JSON.stringify({ ...s, version: 'eins' })), /keine gültige Formatversion/);
  assert.throws(() => readSong(JSON.stringify({ ...s, tracks: [{ ...s.tracks[0], channel: 'gibtsnicht' }] })), /Der Song ist ungültig: .*unbekannten Kanal/);
  assert.throws(() => readSong('x'.repeat(2000001)), /zu groß/);
  // Ein Objekt statt Text geht auch.
  assert.equal(readSong(s).format, 'blueseven.song');
});

test('F-V4: Unbekannte Felder bleiben beim Lesen und erneuten Sichern erhalten', () => {
  const s = JSON.parse(V1);
  s.zukunft = { a: 1 }; s.tracks[0].farbe = 'blau'; s.mixer.master.extra = [1, 2];
  const back = readSong(JSON.stringify(packSong(readSong(JSON.stringify(s)), [], null)));
  assert.deepEqual(back.zukunft, { a: 1 });
  assert.equal(back.tracks[0].farbe, 'blau');
  assert.deepEqual(back.mixer.master.extra, [1, 2]);
});

test('F-V5 und A12: Unbekannte Instrumente und Effekte ergeben Hinweise, keinen Fehler', () => {
  const s = JSON.parse(V1), reg = registry(), has = (k, t) => reg.has(k, t);
  assert.deepEqual(missingModules(s, has), []);
  s.tracks[0].instrument.type = 'theremin'; s.tracks[1].instrument.type = 'theremin';
  s.mixer.master.inserts.push({ id: 'x', type: 'phaser', params: {} });
  s.mixer.returns[0].inserts.push({ id: 'y', type: 'phaser', params: {} });
  const notes = missingModules(readSong(JSON.stringify(s)), has);
  assert.equal(notes.length, 2, 'jeder fehlende Typ wird einmal genannt');
  assert.match(notes[0], /Instrument „theremin“ gibt es in dieser App nicht/);
  assert.match(notes[1], /Effekt „phaser“ gibt es in dieser App nicht/);
  const { warnings, events } = played(s, [], 4000);
  assert.ok(warnings.length >= 2 && events.length > 0, 'die Engine warnt und spielt den Rest');
});

test('A14: Ein gesicherter Song ergibt nach dem Laden dasselbe JSON und dieselbe Wiedergabe', () => {
  for (const song of [house(), jazzyBeats.generate(prog(), { feel: 'comp' }, { bpm: 84, swing: 55 })]) {
    const text = JSON.stringify(packSong(song, [], null)), back = readSong(text);
    assert.deepEqual(back, song);
    assert.equal(JSON.stringify(packSong(back, [], null)), text, 'Sichern, Laden, Sichern ändert nichts');
    assert.deepEqual(played(back, []).events, played(song, []).events);
  }
});

test('packSong: Von Hand gesetzte Werte gelten nach dem Laden weiter, weil ihre Automation entfällt', () => {
  const { engine } = setup(), song = house(), addr = song.automation[0].target;
  assert.match(addr, /^channel\/\w+\/insert\/lp\/frequency$/);
  engine.load(song);
  assert.ok(engine.setParam(addr, 5000));
  assert.ok(engine.setParam('channel/kick/gain', 0.3));
  const packed = packSong(engine.song(), engine.overrides(), 'Mein Song');
  assert.equal(titleOf(packed), 'Mein Song');
  assert.ok(!packed.automation.some(a => a.target === addr), 'die Automation auf dem gesetzten Wert ist weg');
  assert.equal(packed.automation.length, song.automation.length - 1, 'die übrige Automation bleibt');
  const [, ch] = addr.split('/');
  assert.equal(packed.mixer.channels.find(c => c.id === ch).inserts.find(x => x.id === 'lp').params.frequency, 5000);
  assert.equal(packed.mixer.channels.find(c => c.id === 'kick').gain, 0.3);
  assert.deepEqual(checkSong(packed), []);
  // Der gesicherte Song klingt ohne die Liste der gesetzten Adressen so wie der Song mit ihr.
  assert.deepEqual(played(readSong(JSON.stringify(packed)), []).events, played(engine.song(), engine.overrides()).events);
  // Ohne Titel bleibt der bisherige, ein Song ohne meta bekommt eines.
  assert.equal(titleOf(packSong(song, [], '')), song.meta.title);
  const bare = copy(song); delete bare.meta;
  assert.equal(titleOf(bare), 'Song');
  assert.equal(packSong(bare, [], 'Neu').meta.title, 'Neu');
});

test('fileName: Titel ohne Sonderzeichen, mit fester Endung', () => {
  assert.equal(fileName({ meta: { title: 'Deep House in C♯-Moll' } }), 'deep-house-in-c-moll.blueseven.json');
  assert.equal(fileName({ meta: { title: 'Größe & Maß / Übung' } }), 'grosse-mass-ubung.blueseven.json');
  assert.equal(fileName({ meta: { title: '…' } }), 'song.blueseven.json');
  assert.equal(fileName({}), 'song.blueseven.json');
});

test('Sammlung: neueste zuerst, gleicher Name ersetzt, Obergrenze, Kopien statt Verweise', () => {
  const songs = [], s = JSON.parse(V1);
  assert.equal(putSong(songs, 'A', s, 1), 'added');
  assert.equal(putSong(songs, 'B', s, 2), 'added');
  s.tempo.bpm = 99;
  assert.equal(songs[0].song.tempo.bpm, 122, 'die Sammlung hält eine eigene Kopie');
  assert.equal(putSong(songs, 'A', s, 3), 'replaced');
  assert.deepEqual(songs.map(x => [x.name, x.saved, x.song.tempo.bpm]), [['A', 3, 99], ['B', 2, 122]]);
  for (let i = songs.length; i < MAX_SONGS; i++) putSong(songs, 'S' + i, s, i);
  assert.equal(songs.length, MAX_SONGS);
  assert.equal(putSong(songs, 'zu viel', s, 9), 'full');
  assert.equal(songs.length, MAX_SONGS);
  assert.equal(putSong(songs, 'B', s, 9), 'replaced', 'Ersetzen geht auch bei voller Sammlung');
});

test('readLibrary: liest die Sammlung und den geladenen Song, verwirft Unbrauchbares', () => {
  const s = JSON.parse(V1);
  assert.deepEqual(readLibrary(null), { current: null, songs: [] });
  assert.deepEqual(readLibrary('kaputt'), { current: null, songs: [] });
  assert.deepEqual(readLibrary('[]'), { current: null, songs: [] });
  const text = JSON.stringify({
    current: { song: s, ov: ['channel/kick/gain', 5] },
    songs: [{ name: 'Gut', saved: 5, song: s }, { name: 'Gut', saved: 6, song: s }, { name: '', song: s }, { name: 'Kaputt', song: { format: 'x' } },
      { name: 'Zukunft', song: { ...s, version: SONG_VERSION + 1 } }, null, 7],
  });
  const lib = readLibrary(text);
  assert.deepEqual(lib.songs.map(x => [x.name, x.saved]), [['Gut', 5]]);
  assert.deepEqual(lib.songs[0].song, s);
  assert.deepEqual(lib.current, { song: s, ov: ['channel/kick/gain'] });
  assert.equal(readLibrary(JSON.stringify({ current: { song: { format: 'x' } }, songs: 'nein' })).current, null);
});
