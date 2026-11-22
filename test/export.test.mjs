// Tests für den WAV-Export: Song aufrollen, ohne Echtzeit rechnen, WAV schreiben. Laufen mit: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSong } from '../src/core/format.js';
import { repeatSong, fileName } from '../src/core/songfile.js';
import { audioEnd, encodeWav, wavBytes } from '../src/core/wav.js';
import { createRng } from '../src/core/rng.js';
import { createRegistry } from '../src/core/registry.js';
import { automationAt } from '../src/engine/timeline.js';
import { createEngine, START_DELAY } from '../src/engine/engine.js';
import { renderAudio, MAX_TAIL } from '../src/engine/render.js';
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
import { FakeAudioContext, FakeOfflineAudioContext, createClock } from './fixtures/fake-audio.js';

const registry = () => createRegistry({ instruments: [rhodes, bass, drums, synth, riser], effects: [filter, tremolo, reverb, compressor, delay, ducker] });
const prog = () => jazzy.generate({ n: 4, spice: 35, nine: true }, { key: 0, mode: 'moll', rnd: createRng(7), previous: null, locked: [], avoid: [] });
const beats = () => jazzyBeats.generate(prog(), { feel: 'comp' }, { bpm: 84, swing: 55 });
const house = () => deepHouse.generate(prog(), { length: 'short', energy: 60, stab: 'classic', bars: 2 }, { bpm: 122, swing: 0, rnd: createRng(3), seed: 3 });
// Art, Zeit und Frequenz jeder gestarteten Klangquelle. Die Verstimmung des Rhodes ist Zufall und zählt nicht mit.
const events = ctx => ctx.events.map(e => [e.kind, e.t.toFixed(6), e.node.frequency ? e.node.frequency.value.toFixed(3) : '']);
// Alle Pegelfahrten, die auf AudioParams geplant wurden, für den Vergleich von Ducker und Automation.
const paramCalls = ctx => ctx.nodes.flatMap(n => ['gain', 'frequency'].filter(k => n[k] && n[k].calls).flatMap(k => n[k].calls.map(c => [n.kind, k, ...c.map(x => typeof x === 'number' ? x.toFixed(6) : x)].join(' ')))).sort();
function live(song, ms) {
  let ctx = null;
  const clock = createClock(() => ctx);
  class AC extends FakeAudioContext { constructor(o) { super(o); ctx = this; } }
  const engine = createEngine(registry(), { AudioContext: AC, ...clock });
  engine.init(); engine.load(song); engine.play(); clock.advance(ms);
  return ctx;
}
async function offline(song, opts = {}) {
  let ctx = null;
  class OAC extends FakeOfflineAudioContext { constructor(...a) { super(...a); ctx = this; } }
  const r = await renderAudio(registry(), song, { OfflineAudioContext: OAC, sampleRate: 44100, ...opts });
  return { ...r, ctx };
}

test('repeatSong: n Durchgänge als ein Song mit Ende, Clips, Abschnitte und Automation versetzt', () => {
  const song = house(), L = song.length, three = repeatSong(song, 3);
  assert.deepEqual(checkSong(three), []);
  assert.equal(three.length, 3 * L);
  assert.equal(three.loop, false);
  assert.equal(three.sections.length, 3 * song.sections.length);
  assert.equal(new Set(three.sections.map(s => s.id)).size, three.sections.length, 'Abschnitte behalten eindeutige IDs');
  three.tracks.forEach((t, i) => {
    const c = song.tracks[i].clips;
    assert.deepEqual(t.clips, [0, 1, 2].flatMap(k => c.map(x => ({ ...x, start: x.start + k * L }))));
  });
  // Die Automation hat in jedem Durchgang an jeder Stelle denselben Wert wie im einzelnen Song.
  for (const [i, lane] of song.automation.entries()) {
    for (let b = 0; b < L; b += 0.25) for (const k of [0, 1, 2]) {
      assert.equal(automationAt(three.automation[i].points, b + k * L), automationAt(lane.points, b), `${lane.target} bei ${b} im Durchgang ${k + 1}`);
    }
  }
  assert.deepEqual(song, house(), 'der Song selbst bleibt unverändert');
  const one = repeatSong(beats(), 1);
  assert.deepEqual({ ...one, loop: true }, beats(), 'einmal: nur loop wird false');
  assert.equal(repeatSong(song, 0).length, L);
  assert.equal(repeatSong(song, 2.7).length, 2 * L);
});

test('renderAudio: rechnet einen Loop zweimal mit denselben Klängen zur selben Zeit wie die Wiedergabe', async () => {
  const song = beats(), sec = song.length * 60 / song.tempo.bpm;
  const r = await offline(repeatSong(song, 2));
  assert.equal(r.lead, Math.round(START_DELAY * 44100));
  assert.equal(r.body, Math.round(2 * sec * 44100), 'genau zwei Durchgänge');
  assert.equal(r.buffer.length, r.lead + r.body, 'ohne Ausklang endet die Rechnung am letzten Takt');
  assert.deepEqual(r.warnings, []);
  // Die Wiedergabe als Schleife plant im dritten Durchgang weiter. Bis dahin muss alles gleich sein.
  const end = START_DELAY + 2 * sec - 1e-6;
  const want = events(live(song, 2 * sec * 1000)).filter(e => +e[1] < end), got = events(r.ctx);
  assert.ok(got.length > 100);
  assert.deepEqual(got, want);
});

test('renderAudio: Deep House mit Ducker und Automation wie in der Wiedergabe, mit Ausklang 10 s länger', async () => {
  const song = house(), sec = song.length * 60 / song.tempo.bpm;
  const steps = [];
  const r = await offline(song, { tail: true, onProgress: p => steps.push(p) });
  assert.equal(r.buffer.length, r.lead + r.body + MAX_TAIL * 44100);
  assert.equal(r.body, Math.round(sec * 44100));
  const ctx = live(song, (sec + 2) * 1000);
  assert.deepEqual(events(r.ctx), events(ctx));
  assert.deepEqual(paramCalls(r.ctx), paramCalls(ctx), 'Hüllkurven, Pumpen und Filterfahrten sind gleich geplant');
  assert.ok(steps.length > 1000 && steps.every((p, i) => p > 0 && p < 1 && (!i || p > steps[i - 1])), 'der Fortschritt steigt stetig');
});

test('renderAudio: Abbrechen, fehlender OfflineAudioContext und zu wenig Speicher ergeben klare Fehler', async () => {
  let n = 0;
  await assert.rejects(offline(repeatSong(beats(), 2), { cancelled: () => ++n > 5 }), e => e.code === 'cancelled');
  assert.equal(n, 6, 'nach dem Abbruch wird nicht weitergerechnet');
  await assert.rejects(renderAudio(registry(), repeatSong(beats(), 1), {}), e => e.code === 'unsupported');
  await assert.rejects(renderAudio(registry(), repeatSong(beats(), 1), { OfflineAudioContext: class { } }), e => e.code === 'unsupported');
  class Full { constructor() { throw new RangeError('zu groß'); } suspend() { } }
  await assert.rejects(renderAudio(registry(), repeatSong(beats(), 1), { OfflineAudioContext: Full }), e => e.code === 'memory' && /Speicher/.test(e.message));
});

test('audioEnd: hart genau am letzten Takt, mit Ausklang bis unter −60 dB', () => {
  const l = new Float32Array(1000), r = new Float32Array(1000);
  l.fill(0.5, 0, 600); r.fill(0.0005, 0, 1000); r[700] = -0.002;
  assert.equal(audioEnd([l, r], 500, false), 500);
  assert.equal(audioEnd([l, r], 500, true), 701, 'bis zum letzten Sample über −60 dB, auf irgendeinem Kanal');
  r[700] = 0;
  assert.equal(audioEnd([l, r], 500, true), 600);
  assert.equal(audioEnd([new Float32Array(1000), new Float32Array(1000)], 500, true), 500, 'nie kürzer als der Song');
  l.fill(0.5);
  assert.equal(audioEnd([l, r], 500, true), 1000, 'klingt es bis zum Schluss, gilt die Obergrenze');
  assert.equal(audioEnd([l, r], 2000, false), 1000);
});

test('encodeWav: gültiger Kopf, 16 Bit Stereo, Ausschnitt und Ausblenden', () => {
  const l = Float32Array.from([0, 1, -1, 0.5, 2, -2, 0.25, 0.25]), r = Float32Array.from([0, -0.5, 0.5, 0, 0, 0, 1, 1]);
  const buf = encodeWav([l, r], 44100, 1, 7), v = new DataView(buf), txt = (o, n) => String.fromCharCode(...new Uint8Array(buf, o, n));
  assert.equal(buf.byteLength, 44 + 6 * 4);
  assert.deepEqual([txt(0, 4), txt(8, 4), txt(12, 4), txt(36, 4)], ['RIFF', 'WAVE', 'fmt ', 'data']);
  assert.deepEqual([v.getUint32(4, true), v.getUint32(16, true), v.getUint16(20, true), v.getUint16(22, true), v.getUint32(24, true), v.getUint32(28, true), v.getUint16(32, true), v.getUint16(34, true), v.getUint32(40, true)],
    [36 + 24, 16, 1, 2, 44100, 176400, 4, 16, 24]);
  const s = new Int16Array(buf, 44);
  assert.deepEqual([...s], [32767, -16384, -32768, 16384, 16384, 0, 32767, 0, -32768, 0, 8192, 32767], 'begrenzt statt überzulaufen');
  // Ganzes Feld, Mono, und 4 Samples Ausblenden am Ende.
  const m = new Int16Array(encodeWav([Float32Array.from([1, 1, 1, 1, 1, 1])], 8000, 0, undefined, 4), 44);
  assert.deepEqual([...m], [32767, 32767, 32767, 24575, 16384, 8192]);
  assert.equal(encodeWav([l, r], 44100, 3, 3).byteLength, 44);
  assert.equal(wavBytes(1, 44100, 2), 44 + 176400);
});

test('fileName: mit anderer Endung für die WAV-Datei', () => {
  assert.equal(fileName({ meta: { title: 'Deep House in A-Moll' } }, '-122bpm.wav'), 'deep-house-in-a-moll-122bpm.wav');
});
