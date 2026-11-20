// Tests für den Stil Jazzy Beats. Laufen mit: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSong, checkChords } from '../src/core/format.js';
import { beatToSeconds } from '../src/core/time.js';
import { faderToGain } from '../src/core/gain.js';
import { createRng } from '../src/core/rng.js';
import { jazzyBeats, arpOrder } from '../src/styles/jazzy-beats.js';
import { jazzy } from '../src/chords/jazzy.js';
import { plain } from './fixtures/plain-chords.js';
import { createLegacyBar } from './fixtures/legacy-bar.js';

const FEELS = ['pad', 'comp', 'arp'];
const bassNote = c => 36 + (c.bass === undefined ? c.root : c.bass);
const jazzyProg = (o = {}) => jazzy.generate({ n: 4, spice: 35, nine: true, ...o.params },
  { key: 0, mode: 'dur', rnd: createRng(o.seed ?? 7), previous: null, locked: [], avoid: [], ...o.ctx });

// Was der alte Ablauf für eine Folge aufruft: jeder Aufruf als [Funktion, Note, Zeit, Dauer, Anschlag].
function legacyEvents(chords, { bpm, swing, feel }, loops) {
  const out = [], rec = fn => (...a) => out.push(fn === 'rhodes' || fn === 'bass' ? [fn, a[0], a[1], a[2], a[3]] : [fn, null, a[0], null, a[1]]);
  const bar = createLegacyBar({ S: { bpm, swing, feel }, chords, bassNote, rhodes: rec('rhodes'), bass: rec('bass'), hat: rec('hat'), kick: rec('kick'), rim: rec('rim'), queue: [] });
  for (let i = 0; i < chords.length * loops; i++) bar(i * 240 / bpm, i);
  return out;
}
// Was eine Engine aus dem Song abspielen würde, in derselben Form. Wiederholt Patterns innerhalb der Clips
// und den Song selbst loops-mal.
const DRUMS = { 36: 'kick', 37: 'rim', 42: 'hat' };
function songEvents(song, loops) {
  const out = [], spb = 60 / song.tempo.bpm;
  for (let l = 0; l < loops; l++) for (const tr of song.tracks) for (const c of tr.clips) {
    const pt = song.patterns[c.pattern];
    for (let rep = 0; rep * pt.length < c.length; rep++) for (const n of pt.notes) {
      const local = rep * pt.length + n.t;
      if (local >= c.length) continue;
      const t = beatToSeconds(l * song.length + c.start + local, song.tempo) + (n.o || 0), p = n.p + (c.transpose || 0);
      if (tr.id === 'drums') out.push([DRUMS[p], null, t, null, n.v]);
      else out.push([tr.id, p, t, n.d * spb, n.v]);
    }
  }
  return out;
}
const norm = evs => evs.map(e => e.map(x => typeof x === 'number' ? x.toFixed(6) : x).join(' ')).sort();

test('Jazzy Beats erzeugt dieselben Noten wie der bisherige Takt-Ablauf, für alle Spielweisen', () => {
  const progs = [];
  for (const mode of ['dur', 'moll']) for (const n of [3, 4]) for (const nine of [true, false]) for (const key of [0, 7, 10])
    progs.push(jazzyProg({ params: { n, nine, spice: 70 }, ctx: { key, mode }, seed: key + n }));
  // Ein einzelner Akkord: Der Durchgangston führt dann zum eigenen Grundton.
  progs.push({ format: 'blueseven.chords', version: 1, key: 2, mode: 'moll', chords: [{ root: 2, tones: [0, 3, 7, 10], duration: 4, voicing: [53, 57, 60, 62] }] });
  let checked = 0;
  for (const prog of progs) for (const feel of FEELS) for (const [bpm, swing] of [[84, 55], [56, 0], [132, 100], [97, 35]]) {
    const song = jazzyBeats.generate(prog, { feel }, { bpm, swing });
    assert.deepEqual(checkSong(song), []);
    const want = norm(legacyEvents(prog.chords, { bpm, swing, feel }, 2)), got = norm(songEvents(song, 2));
    assert.equal(got.length, want.length, `${feel} ${bpm} ${swing}: Anzahl`);
    assert.deepEqual(got, want, `${feel} ${bpm} ${swing}`);
    checked += want.length;
  }
  assert.ok(checked > 10000, `nur ${checked} Ereignisse verglichen`);
});

test('Jazzy Beats: Aufbau, Mixer und Klangparameter wie im bisherigen Signalweg', () => {
  const song = jazzyBeats.generate(jazzyProg(), {}, { bpm: 84, swing: 55 });
  assert.equal(song.loop, true);
  assert.equal(song.length, 16);
  assert.deepEqual(song.sections, [{ id: 'loop', name: 'Loop', start: 0, length: 16 }]);
  assert.deepEqual(song.tracks.map(t => [t.id, t.channel, t.instrument.type, t.instrument.params.level]), [['rhodes', 'rhodes', 'rhodes', 1.1], ['bass', 'bass', 'bass', 1], ['drums', 'drums', 'drums', 0.9]]);
  assert.equal(song.patterns.drums.length, 4, 'Drums als ein Takt, der wiederholt wird');
  assert.deepEqual(song.meta.style, { id: 'jazzy-beats', version: 1, params: { feel: 'comp' } });
  assert.equal(song.meta.title, 'Jazzy Beats in C-Dur');
  const ch = Object.fromEntries(song.mixer.channels.map(c => [c.id, c]));
  assert.deepEqual([ch.rhodes.gain, ch.bass.gain, ch.drums.gain], [faderToGain(80), faderToGain(60), faderToGain(45)]);
  assert.deepEqual(ch.rhodes.inserts.map(i => [i.type, i.params]), [['filter', { mode: 'lowpass', frequency: 3600, q: 0.3 }], ['tremolo', { rate: 4.4, depth: 0.45 }]]);
  assert.deepEqual(ch.rhodes.sends, [{ to: 'hall', gain: 0.24 }]);
  assert.deepEqual(ch.bass.sends, []);
  assert.deepEqual(ch.drums.sends, [{ to: 'hall', gain: 0.06 }]);
  assert.deepEqual(song.mixer.returns[0].inserts, [{ id: 'rev', type: 'reverb', params: { seconds: 1.5 } }]);
  assert.deepEqual(song.mixer.master.inserts, [{ id: 'comp', type: 'compressor', params: { threshold: -16, ratio: 4 } }]);
});

test('Jazzy Beats: Tempo, Swing und Parameter werden begrenzt und ergänzt', () => {
  const prog = jazzyProg();
  const a = jazzyBeats.generate(prog, { feel: 'walzer' }, { bpm: 300, swing: -5 });
  assert.equal(a.meta.style.params.feel, 'comp');
  assert.deepEqual(a.tempo, { bpm: 132, swing: 0, beatsPerBar: 4 });
  const b = jazzyBeats.generate(prog, undefined, undefined);
  assert.deepEqual(b.tempo, { bpm: 84, swing: 55, beatsPerBar: 4 });
});

test('Jazzy Beats: gleiche Eingaben ergeben denselben Song, und der Song ist reines JSON', () => {
  const prog = jazzyProg({ params: { n: 3 } });
  for (const feel of FEELS) {
    const a = jazzyBeats.generate(prog, { feel }, { bpm: 90, swing: 40 }), b = jazzyBeats.generate(prog, { feel }, { bpm: 90, swing: 40 });
    assert.deepEqual(a, b);
    assert.deepEqual(JSON.parse(JSON.stringify(a)), a);
  }
});

test('Jazzy Beats: von Hand geschriebene Folge ohne Lage, Beschriftung und Herkunft', () => {
  // Kein Akkord-Generator beteiligt. Der Stil muss die Lage selbst bilden.
  const prog = { format: 'blueseven.chords', version: 1, key: 9, mode: 'moll', chords: [
    { root: 9, tones: [0, 3, 7], duration: 4 }, { root: 2, tones: [0, 3, 7, 10], duration: 4 },
    { root: 4, tones: [0, 4, 7, 10, 13], duration: 4, bass: 4 }] };
  for (const feel of FEELS) {
    const song = jazzyBeats.generate(prog, { feel }, { bpm: 84, swing: 55 });
    assert.deepEqual(checkSong(song), []);
    for (const n of song.patterns.keys.notes) {
      const c = prog.chords[Math.floor(n.t / 4)];
      assert.ok(c.tones.some(t => (c.root + t) % 12 === n.p % 12), `${n.p} gehört nicht zu Akkord ${Math.floor(n.t / 4) + 1}`);
    }
  }
});

test('Jazzy Beats: beliebige Längen und Anzahlen aus einem anderen Akkord-Generator', () => {
  const rnd = createRng(9);
  const cases = [
    plain.generate({ long: false }, { key: 0, mode: 'dur', rnd }),
    plain.generate({ long: true }, { key: 5, mode: 'moll', rnd }),
    { format: 'blueseven.chords', version: 1, key: 0, mode: 'dur', chords: [{ root: 0, tones: [0, 4, 7], duration: 4 }] },
    { format: 'blueseven.chords', version: 1, key: 0, mode: 'dur', chords: [4, 8, 2, 2.5, 6, 0.5, 1, 3].map((duration, i) => ({ root: (i * 5) % 12, tones: [0, 4, 7, 11], duration })) },
  ];
  for (const n of [1, 3, 4, 8]) cases.push({ format: 'blueseven.chords', version: 1, key: 3, mode: 'dur', chords: Array.from({ length: n }, (_, i) => ({ root: (3 + i * 7) % 12, tones: [0, 3, 7, 10], duration: 4 })) });
  for (const prog of cases) for (const feel of FEELS) {
    assert.deepEqual(checkChords(prog), []);
    const song = jazzyBeats.generate(prog, { feel }, { bpm: 100, swing: 20 });
    assert.deepEqual(checkSong(song), [], JSON.stringify(prog.chords.map(c => c.duration)));
    const total = prog.chords.reduce((a, c) => a + c.duration, 0);
    assert.equal(song.length, total);
    // Jeder Akkordton beginnt innerhalb seines Akkords, jeder Akkord ist zu hören, der Bass beginnt jeden Akkord mit seinem Grundton.
    let at = 0;
    prog.chords.forEach((c, i) => {
      const inside = n => n.t >= at - 1e-9 && n.t < at + c.duration - 1e-9;
      const ks = song.patterns.keys.notes.filter(inside);
      assert.ok(ks.length > 0, `Akkord ${i + 1} ohne Töne`);
      assert.ok(ks.every(n => c.tones.some(t => (c.root + t) % 12 === n.p % 12)), `fremder Ton in Akkord ${i + 1}`);
      assert.ok(song.patterns.bass.notes.some(n => Math.abs(n.t - at) < 1e-9 && n.p === bassNote(c)), `Bass fehlt auf Akkord ${i + 1}`);
      at += c.duration;
    });
  }
});

test('Jazzy Beats: ungültige Akkordfolge führt zu einer verständlichen Meldung', () => {
  assert.throws(() => jazzyBeats.generate({ format: 'blueseven.chords', version: 1, key: 0, mode: 'dur', chords: [] }, {}, {}), /Jazzy Beats kann diese Akkordfolge nicht verwenden[\s\S]*mindestens einem Akkord/);
  assert.throws(() => jazzyBeats.generate(null, {}, {}), /kein Objekt/);
});

test('arpOrder: vier Töne wie bisher, andere Anzahlen sinnvoll verallgemeinert', () => {
  assert.deepEqual(arpOrder(4, 8), [0, 1, 2, 3, 2, 1, 2, 3]);
  assert.deepEqual(arpOrder(3, 8), [0, 1, 2, 1, 2, 1, 2, 1]);
  assert.deepEqual(arpOrder(5, 8), [0, 1, 2, 3, 4, 3, 2, 1]);
  assert.deepEqual(arpOrder(6, 8), [0, 1, 2, 3, 4, 5, 4, 3]);
});
