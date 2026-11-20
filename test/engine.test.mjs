// Tests für Engine, Mixer, Zeitachse und Instrumente mit einem nachgebauten AudioContext. Laufen mit: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry } from '../src/core/registry.js';
import { createRng } from '../src/core/rng.js';
import { faderToGain } from '../src/core/gain.js';
import { notesBetween, structureKey } from '../src/engine/timeline.js';
import { createEngine } from '../src/engine/engine.js';
import { createVoices } from '../src/instruments/voices.js';
import { rhodes } from '../src/instruments/rhodes.js';
import { bass } from '../src/instruments/bass.js';
import { drums } from '../src/instruments/drums.js';
import { filter } from '../src/effects/filter.js';
import { tremolo } from '../src/effects/tremolo.js';
import { reverb } from '../src/effects/reverb.js';
import { compressor } from '../src/effects/compressor.js';
import { jazzy } from '../src/chords/jazzy.js';
import { jazzyBeats } from '../src/styles/jazzy-beats.js';
import { createLegacyBar } from './fixtures/legacy-bar.js';
import { FakeAudioContext, FakeParam, createClock, pathGain } from './fixtures/fake-audio.js';

const EFFECTS = [filter, tremolo, reverb, compressor];
const bassNote = c => 36 + (c.bass === undefined ? c.root : c.bass);
const jazzyProg = (o = {}) => jazzy.generate({ n: 4, spice: 35, nine: true, ...o.params },
  { key: 0, mode: 'dur', rnd: createRng(o.seed ?? 7), previous: null, locked: [], avoid: [], ...o.ctx });
const beatsSong = (prog, feel = 'comp', bpm = 84, swing = 55) => jazzyBeats.generate(prog, { feel }, { bpm, swing });

// Ein Instrument, das nichts klingt, aber jeden Aufruf mitschreibt.
function recorder(type, log) {
  return {
    type, name: type, params: [{ id: 'level', name: 'Pegel', type: 'number', min: 0, max: 2, default: 1 }],
    create(ac, params) {
      log.push(['create', type, params.level]);
      const output = ac.createGain(); output.gain.value = params.level;
      return {
        output,
        play: (note, t, dur) => log.push(['play', type, note.p, t, dur, note.v]),
        setParam: (id, v, t) => log.push(['param', type, id, v, t]),
        stopAll: () => log.push(['stopAll', type]),
        dispose: () => log.push(['dispose', type]),
      };
    },
  };
}
// Echte Instrumente, deren Ausgang sich der Test merkt.
function spied(mod, outs) {
  return { ...mod, create(ac, p) { const inst = mod.create(ac, p); outs[mod.type] = inst.output; return inst; } };
}

// Engine mit nachgebautem AudioContext und Zeitgebern zum Weiterstellen.
function setup(instruments, opts = {}) {
  let ctx = null;
  const clock = createClock(() => ctx);
  class AC extends FakeAudioContext { constructor(o) { super(o); ctx = this; } }
  const registry = createRegistry({ instruments, effects: EFFECTS });
  const engine = createEngine(registry, { AudioContext: AC, ...clock, ...opts });
  const warnings = [];
  engine.on('warning', m => warnings.push(m));
  return { engine, clock, warnings, ctx: () => ctx };
}
const recordingSetup = () => {
  const log = [];
  return { log, ...setup([recorder('rhodes', log), recorder('bass', log), recorder('drums', log)]) };
};

/* ---------- Zeitachse ---------- */

const handSong = () => ({
  format: 'blueseven.song', version: 1, meta: { title: 'Test' },
  tempo: { bpm: 120, swing: 0, beatsPerBar: 4 }, length: 16, loop: false,
  sections: [{ id: 'a', name: 'A', start: 0, length: 16 }],
  patterns: {
    beat: { length: 4, notes: [{ t: 0, d: 0.25, p: 36, v: 1 }, { t: 2, d: 0.25, p: 42, v: 0.5 }] },
    chord: { length: 8, notes: [{ t: 0, d: 4, p: 60, v: 0.7 }, { t: 6, d: 1, p: 64, v: 0.7, o: 0.01 }] },
  },
  tracks: [
    { id: 'kit', name: 'Kit', channel: 'drums', instrument: { type: 'drums' }, clips: [{ pattern: 'beat', start: 0, length: 16 }] },
    { id: 'keys', name: 'Keys', channel: 'keys', instrument: { type: 'rhodes', params: { level: 0.5 } },
      clips: [{ pattern: 'chord', start: 8, length: 7, transpose: -2 }] },
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
  automation: [],
});

test('notesBetween: wiederholt Patterns im Clip, schneidet am Clip-Ende ab, transponiert', () => {
  const s = handSong();
  const all = notesBetween(s, 0, 16).map(n => `${n.track} ${n.beat} ${n.p}`);
  assert.deepEqual(all, [
    'kit 0 36', 'kit 2 42', 'kit 4 36', 'kit 6 42', 'kit 8 36', 'kit 10 42', 'kit 12 36', 'kit 14 42',
    // Der Clip ist 7 Viertel lang: Die Note bei 6 im Pattern (Beat 14) liegt noch drin, transponiert um -2.
    'keys 8 58', 'keys 14 62',
  ]);
  // Halboffene Bereiche: Beginn zählt, Ende nicht. Versatz und Dauer bleiben erhalten.
  assert.deepEqual(notesBetween(s, 8, 14).map(n => `${n.track} ${n.beat}`), ['kit 8', 'kit 10', 'kit 12', 'keys 8']);
  assert.deepEqual(notesBetween(s, 14, 15).find(n => n.track === 'keys'), { track: 'keys', beat: 14, d: 1, p: 62, v: 0.7, o: 0.01 });
  s.tracks[1].clips[0].length = 6;
  assert.ok(!notesBetween(s, 0, 16).some(n => n.track === 'keys' && n.beat === 14), 'Note hinter dem Clip-Ende');
});

test('structureKey: Werte ändern den Aufbau nicht, Spuren und Effekte schon', () => {
  const a = handSong(), k = structureKey(a);
  const b = handSong(); b.mixer.channels[0].gain = 0.1; b.mixer.channels[1].inserts[0].params.frequency = 300;
  b.patterns.beat.notes.pop(); b.tempo.bpm = 90; b.tracks[1].instrument.params.level = 1;
  assert.equal(structureKey(b), k);
  const c = handSong(); c.mixer.master.inserts.push({ id: 'c', type: 'compressor' });
  const d = handSong(); d.tracks[0].instrument.type = 'bass';
  const e = handSong(); e.mixer.channels[0].sends.push({ to: 'hall', gain: 0.1 });
  for (const x of [c, d, e]) assert.notEqual(structureKey(x), k);
});

test('A7: Ein von Hand geschriebener Song mit zwei Spuren, Insert und Effektspur spielt ohne Warnung', () => {
  const { engine, clock, warnings, ctx } = setup([rhodes, bass, drums]);
  engine.init(); engine.load(handSong()); engine.play();
  clock.advance(9000);
  const ev = ctx().events, at = t => ev.filter(e => Math.abs(e.t - 0.15 - t) < 1e-9);
  assert.deepEqual(warnings, []);
  // 120 BPM: Kick (Sinus 130 Hz) auf 0, 2, 4 … s, das Rhodes ab Beat 8 (4 s) mit Ton 58 und ab Beat 14 (7 s) mit Ton 62, 10 ms später.
  assert.deepEqual([0, 2, 4, 6].map(t => at(t).some(e => e.kind === 'osc' && e.node.frequency.value === 130)), [true, true, true, true]);
  const keys = ev.filter(e => e.kind === 'osc' && e.node.type === 'sine' && e.node.frequency.value < 400 && e.node.frequency.value > 200);
  assert.deepEqual(keys.map(e => [+(e.t - 0.15).toFixed(6), +e.node.frequency.value.toFixed(2)]),
    [[4, 233.08], [4, 233.08], [7.01, 293.66], [7.01, 293.66]]);
  assert.ok(!engine.isPlaying(), 'nach 16 Vierteln (8 s) ist Schluss');
});

/* ---------- Ablauf ---------- */

// Was der alte Ablauf aufgerufen hätte, als [Art, Note, Zeit, Dauer, Anschlag], Takt für Takt ab start.
function legacyEvents(chords, { bpm, swing, feel }, bars, start) {
  const out = [], rec = fn => (...a) => out.push(fn === 'rhodes' || fn === 'bass' ? [fn, a[0], a[1], a[2], a[3]] : [fn, null, a[0], null, a[1]]);
  const bar = createLegacyBar({ S: { bpm, swing, feel }, chords, bassNote, rhodes: rec('rhodes'), bass: rec('bass'), hat: rec('hat'), kick: rec('kick'), rim: rec('rim'), queue: [] });
  let t0 = start;
  for (let i = 0; i < bars; i++) { bar(t0, i); t0 += 240 / bpm; }
  return out;
}
const DRUMS = { 36: 'kick', 37: 'rim', 42: 'hat' };
const engineEvents = log => log.filter(e => e[0] === 'play').map(([, type, p, t, d, v]) =>
  type === 'drums' ? [DRUMS[p], null, t, null, v] : [type, p, t, d, v]);
const key = e => e.map(x => typeof x === 'number' ? x.toPrecision(15) : x).join(' ');
const multiset = evs => evs.map(key).sort();

test('Die Engine plant aus dem Jazzy-Beats-Song dieselben Noten zur selben Zeit wie der alte Ablauf', () => {
  let cases = 0;
  for (const feel of ['pad', 'comp', 'arp']) for (const [bpm, swing] of [[84, 55], [56, 0], [132, 100], [97, 35]])
    for (const n of [3, 4]) {
      const prog = jazzyProg({ params: { n, spice: 70 }, ctx: { key: (bpm + n) % 12, mode: n === 3 ? 'moll' : 'dur' }, seed: bpm });
      const { engine, clock, log } = recordingSetup();
      engine.load(beatsSong(prog, feel, bpm, swing));
      engine.init();
      clock.advance(1000);                     // Zeit vergeht vor dem ersten Play
      assert.ok(engine.play());
      const start = 1 + 0.15, bars = n * 3 + 1;   // drei Durchläufe und ein Takt
      clock.advance(Math.ceil(bars * 240 / bpm * 1000));
      const cutoff = start + bars * 240 / bpm - 1e-9;
      const got = engineEvents(log).filter(e => e[2] < cutoff);
      const want = legacyEvents(prog.chords, { bpm, swing, feel }, bars, start);
      assert.deepEqual(multiset(got), multiset(want), `${feel}, ${bpm} BPM, Swing ${swing}, ${n} Akkorde`);
      cases++;
    }
  assert.equal(cases, 24);
});

test('Geplant wird mit 0,6 s Vorausschau, Tempo und neuer Song gelten ab dem nächsten Takt', () => {
  const { engine, clock, log, ctx } = recordingSetup();
  const prog = jazzyProg();
  engine.init(); engine.load(beatsSong(prog, 'pad', 120, 0));
  engine.play();
  // Bei 120 BPM ist ein Takt 2 s lang. Takt 1 beginnt bei 0,15 s und ist sofort geplant, Takt 2 (2,15 s) erst ab 1,55 s.
  const kicks = () => log.filter(e => e[0] === 'play' && e[1] === 'drums' && e[2] === 36 && e[5] === 1).map(e => +e[3].toFixed(6));
  clock.advance(1500); assert.deepEqual(kicks(), [0.15]);
  clock.advance(100); assert.deepEqual(kicks(), [0.15, 2.15]);
  // Tempo auf 60: Takt 2 ist schon geplant und bleibt bei 2 s, Takt 3 beginnt bei 4,15 s und dauert 4 s.
  assert.ok(engine.setParam('tempo/bpm', 60));
  assert.equal(engine.song().tempo.bpm, 60);
  clock.advance(4000);
  assert.deepEqual(kicks(), [0.15, 2.15, 4.15]);
  clock.advance(4000);
  assert.deepEqual(kicks(), [0.15, 2.15, 4.15, 8.15]);
  // Neuer Song im Lauf: Die Position läuft weiter, der nächste Takt kommt aus dem neuen Song.
  const before = log.length, other = beatsSong(jazzyProg({ seed: 99, ctx: { key: 5 } }), 'arp', 60, 0);
  engine.load(other);
  assert.ok(!log.slice(before).some(e => e[0] === 'create'), 'gleicher Aufbau: keine neuen Instrumente');
  clock.advance(4000);
  const firstNew = log.slice(before).find(e => e[0] === 'play' && e[1] === 'rhodes');
  assert.equal(+firstNew[3].toFixed(6), 12.15);
  // Position 12 im Song mit vier Akkorden: Takt 4 (Index 3) des neuen Songs.
  assert.equal(firstNew[2], other.patterns.keys.notes.find(x => x.t === 12).p);
  assert.ok(ctx().currentTime > 12);
});

test('Ein Song mit anderem Aufbau bekommt einen neuen Signalweg, der alte klingt aus', () => {
  const { engine, clock, log } = recordingSetup();
  const song = beatsSong(jazzyProg());
  engine.init(); engine.load(song); engine.play(); clock.advance(500);
  const changed = JSON.parse(JSON.stringify(song));
  changed.mixer.master.inserts = [];
  engine.load(changed);
  assert.equal(log.filter(e => e[0] === 'create').length, 6, 'drei Instrumente neu angelegt');
  assert.ok(!log.some(e => e[0] === 'dispose'), 'der alte Signalweg klingt erst aus');
  clock.advance(4100);
  assert.deepEqual(log.filter(e => e[0] === 'dispose').map(e => e[1]), ['rhodes', 'bass', 'drums']);
  // Ohne laufende Wiedergabe wird sofort abgebaut.
  engine.stop(); clock.advance(200);
  engine.load(song);
  assert.equal(log.filter(e => e[0] === 'dispose').length, 6);
});

test('Ein Song ohne Loop endet: Ereignis ended, danach keine Position mehr', () => {
  const { engine, clock, log } = recordingSetup();
  const song = beatsSong(jazzyProg({ params: { n: 3 } }), 'comp', 120, 0);
  song.loop = false;
  let ended = 0;
  engine.on('ended', () => ended++);
  engine.init(); engine.load(song); engine.play();
  clock.advance(5000);
  assert.ok(engine.isPlaying() && engine.position());
  clock.advance(1500);                       // Songende: 0,15 + 3 Takte zu 2 s = 6,15 s
  assert.equal(ended, 1); assert.ok(!engine.isPlaying()); assert.equal(engine.position(), null);
  const kicks = log.filter(e => e[0] === 'play' && e[2] === 36 && e[5] === 1).map(e => +e[3].toFixed(6));
  assert.deepEqual(kicks, [0.15, 2.15, 4.15]);
  clock.advance(5000); assert.equal(ended, 1);
});

test('position(): Viertel seit Songbeginn mit Ausgleich der Ausgabelatenz, und der Song dieses Takts', () => {
  const { engine, clock, ctx } = recordingSetup();
  const song = beatsSong(jazzyProg(), 'comp', 120, 0);
  engine.init(); engine.load(song);
  assert.equal(engine.position(), null);
  engine.play();
  assert.equal(engine.position(), null, 'vor dem ersten Takt');
  clock.advance(1150);                        // 1 s nach dem Start des ersten Takts: 2 Viertel
  assert.ok(Math.abs(engine.position().beat - 2) < 1e-9);
  ctx().outputLatency = 0.25;
  assert.ok(Math.abs(engine.position().beat - 1.5) < 1e-9);
  ctx().outputLatency = 0;
  clock.advance(16000);                       // 17 s nach Start: 34 Viertel, im dritten Durchlauf bei 2
  const p = engine.position();
  assert.ok(Math.abs(p.beat - 2) < 1e-9, String(p.beat));
  assert.equal(p.song.length, 16);
  engine.stop();
  assert.equal(engine.position(), null);
});

test('stop() blendet in 15 ms aus und beendet nach 90 ms alle Stimmen, play() davor bricht das ab', () => {
  const { engine, clock, log, ctx } = recordingSetup();
  engine.init(); engine.load(beatsSong(jazzyProg())); engine.play(); clock.advance(300);
  const gate = ctx().nodes.find(n => n.kind === 'gain' && n.outputs.includes(ctx().destination));
  engine.stop();
  assert.deepEqual(gate.gain.calls.at(-1), ['target', 0, 0.3, 0.015]);
  clock.advance(80); assert.ok(!log.some(e => e[0] === 'stopAll'));
  clock.advance(20);
  assert.deepEqual(log.filter(e => e[0] === 'stopAll').map(e => e[1]), ['rhodes', 'bass', 'drums']);
  assert.equal(gate.gain.final(), 1);
  // Wieder Play innerhalb der 90 ms: sofort Stille und Pegel zurück, dann neu von vorn.
  engine.play(); clock.advance(300); engine.stop(); clock.advance(30);
  engine.play();
  assert.equal(log.filter(e => e[0] === 'stopAll').length, 6);
  assert.equal(gate.gain.final(), 1);
  clock.advance(200); assert.equal(log.filter(e => e[0] === 'stopAll').length, 6, 'der alte Zeitgeber ist weg');
});

test('audition(): spielt sofort, auch ohne Wiedergabe, mit Versatz und Dauer in Sekunden', () => {
  const { engine, clock, log } = recordingSetup();
  engine.load(beatsSong(jazzyProg()));
  assert.equal(engine.audition([{ track: 'rhodes', notes: [{ p: 60, v: 0.7, s: 1.6 }] }]), false, 'ohne init');
  engine.init(); clock.advance(2000);
  assert.ok(engine.audition([
    { track: 'rhodes', notes: [{ p: 60, v: 0.7, s: 1.6, o: 0 }, { p: 64, v: 0.7, s: 1.6, o: 0.02 }] },
    { track: 'bass', notes: [{ p: 36, v: 0.8, s: 1.4 }] },
    { track: 'gibtsnicht', notes: [{ p: 1, v: 1, s: 1 }] },
  ]));
  assert.deepEqual(log.filter(e => e[0] === 'play').map(e => [e[1], e[2], +e[3].toFixed(9), e[4], e[5]]),
    [['rhodes', 60, 2.03, 1.6, 0.7], ['rhodes', 64, 2.05, 1.6, 0.7], ['bass', 36, 2.03, 1.4, 0.8]]);
});

test('init(): verständliche Fehler ohne Web Audio und wenn der AudioContext scheitert', () => {
  const none = createEngine(createRegistry({}), { AudioContext: undefined });
  assert.throws(() => none.init(), e => e.code === 'unsupported');
  assert.equal(none.ready(), false);
  const broken = createEngine(createRegistry({}), { AudioContext: class { constructor() { throw new Error('kaputt'); } } });
  assert.throws(() => broken.init(), e => e.code === 'failed' && /kaputt/.test(e.message));
  // latencyHint wird versucht, sonst ohne Optionen.
  let made = [];
  class Picky extends FakeAudioContext { constructor(o) { if (o) throw new Error('keine Optionen'); super(); made.push(this); } }
  const ok = createEngine(createRegistry({}), { AudioContext: Picky });
  assert.ok(ok.init()); assert.equal(made.length, 1); assert.equal(made[0].state, 'running');
});

test('load(): ungültige Songs werden abgelehnt, der bisherige bleibt', () => {
  const { engine } = recordingSetup();
  const song = beatsSong(jazzyProg());
  engine.load(song);
  assert.throws(() => engine.load({ format: 'blueseven.song' }), /ungültig/);
  assert.equal(engine.song().length, song.length);
  // Der Song wird kopiert: Änderungen von außen wirken nicht.
  song.tempo.bpm = 200; assert.equal(engine.song().tempo.bpm, 84);
});

/* ---------- Signalweg und Pegel ---------- */

const vol = v => Math.pow(v / 100, 1.6);   // der frühere Regler in audio.js

test('Pegel wie bisher: Instrument-Level mal Kanal-Fader ergibt den alten Bus-Pegel, Sends wie bisher', () => {
  const outs = {};
  const { engine, ctx } = setup([spied(rhodes, outs), spied(bass, outs), spied(drums, outs)]);
  const song = beatsSong(jazzyProg());
  for (const [id, v] of [['rhodes', 70], ['bass', 55], ['drums', 30]]) song.mixer.channels.find(c => c.id === id).gain = faderToGain(v);
  engine.load(song); engine.init();
  const conv = ctx().nodes.find(n => n.kind === 'convolver');
  const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-12, `${msg}: ${a} statt ${b}`);
  // Ohne Hall: früher rBus = vol·1,1, bBus = vol, dBus = vol·0,9, jeweils direkt auf gate und Kompressor.
  close(pathGain(outs.rhodes, null, ['convolver']), vol(70) * 1.1, 'Rhodes trocken');
  close(pathGain(outs.bass, null, ['convolver']), vol(55), 'Bass trocken');
  close(pathGain(outs.drums, null, ['convolver']), vol(30) * 0.9, 'Drums trocken');
  // In den Hall: Rhodes mit 0,24 nach Filter und Tremolo, Drums mit 0,06, Bass gar nicht. Der Hall geht unverändert auf die Summe.
  close(pathGain(outs.rhodes, conv), vol(70) * 1.1 * 0.24, 'Rhodes in den Hall');
  close(pathGain(outs.drums, conv), vol(30) * 0.9 * 0.06, 'Drums in den Hall');
  close(pathGain(outs.bass, conv), 0, 'Bass in den Hall');
  close(pathGain(conv), 1, 'Hall auf die Summe');
  // Die Effekte sitzen wie früher: Rhodes durch Tiefpass 3600 Hz/Q 0,3 und Tremolo 4,4 Hz/0,45, Summe mit Kompressor −16 dB/4:1.
  const lp = ctx().nodes.find(n => n.kind === 'filter' && n.frequency.value === 3600);
  assert.equal(lp.type, 'lowpass'); assert.equal(lp.Q.value, 0.3);
  const lfo = ctx().nodes.find(n => n.kind === 'osc' && n.frequency.value === 4.4);
  assert.equal(lfo.outputs[0].gain.value, 0.45);
  const comp = ctx().nodes.find(n => n.kind === 'compressor');
  assert.deepEqual([comp.threshold.value, comp.ratio.value], [-16, 4]);
  assert.equal(conv.buffer.length, 1.5 * 48000);
  // Die Kanal-Fader arbeiten in Stereo, damit Mono-Instrumente beim Panorama nicht leiser werden.
  const faders = ctx().nodes.filter(n => n.kind === 'gain' && n.channelCountMode === 'explicit');
  assert.equal(faders.length, 3);
  assert.ok(faders.every(f => f.channelCount === 2 && f.channelInterpretation === 'speakers' && f.outputs[0].kind === 'panner'));
});

test('setParam(): Adressen aus Abschnitt 9.4 wirken im Signalweg und landen im Song', () => {
  const outs = {};
  const { engine, ctx, warnings } = setup([spied(rhodes, outs), spied(bass, outs), spied(drums, outs)]);
  engine.load(beatsSong(jazzyProg())); engine.init();
  const dry = id => pathGain(outs[id], null, ['convolver']);
  const conv = () => ctx().nodes.find(n => n.kind === 'convolver');
  assert.ok(engine.setParam('channel/rhodes/gain', faderToGain(50)));
  assert.ok(Math.abs(dry('rhodes') - vol(50) * 1.1) < 1e-12);
  assert.equal(engine.song().mixer.channels[0].gain, faderToGain(50));
  // Solo: nur der Bass bleibt, auch der Hall-Anteil der anderen verstummt (Sends liegen hinter Mute).
  assert.ok(engine.setParam('channel/bass/solo', true));
  assert.equal(dry('rhodes'), 0); assert.equal(dry('drums'), 0); assert.ok(dry('bass') > 0);
  assert.equal(pathGain(outs.rhodes, conv()), 0);
  assert.ok(engine.setParam('channel/bass/mute', true));
  assert.equal(dry('bass'), 0, 'Mute schlägt Solo');
  engine.setParam('channel/bass/solo', false); engine.setParam('channel/bass/mute', false);
  assert.ok(dry('rhodes') > 0 && dry('bass') > 0 && dry('drums') > 0);
  assert.deepEqual([engine.song().mixer.channels[1].mute, engine.song().mixer.channels[1].solo], [false, false]);
  // Send, Effektspur, Summe
  assert.ok(engine.setParam('channel/rhodes/send/hall', 0.5));
  assert.ok(Math.abs(pathGain(outs.rhodes, conv()) - vol(50) * 1.1 * 0.5) < 1e-12);
  assert.ok(engine.setParam('return/hall/mute', true));
  assert.equal(pathGain(conv()), 0);
  assert.ok(engine.setParam('return/hall/gain', 0.5) && engine.setParam('return/hall/mute', false));
  assert.equal(pathGain(conv()), 0.5);
  assert.ok(engine.setParam('master/gain', 0.5));
  assert.ok(Math.abs(dry('bass') - vol(60) * 0.5) < 1e-12);
  const s = engine.song();
  assert.deepEqual([s.mixer.channels[0].sends[0].gain, s.mixer.returns[0].gain, s.mixer.returns[0].mute, s.mixer.master.gain], [0.5, 0.5, false, 0.5]);
  // Effektparameter, mit Begrenzung auf den erlaubten Bereich, und Umgehung
  const lp = ctx().nodes.find(n => n.kind === 'filter' && n.frequency.value === 3600);
  assert.ok(engine.setParam('channel/rhodes/insert/lp/frequency', 50000));
  assert.equal(lp.frequency.final(), 20000);
  assert.equal(engine.song().mixer.channels[0].inserts[0].params.frequency, 50000, 'im Song steht der gesetzte Wert');
  const before = dry('rhodes');
  assert.ok(engine.setParam('master/insert/comp/bypass', true));
  assert.equal(engine.song().mixer.master.inserts[0].bypass, true);
  assert.ok(Math.abs(dry('rhodes') - before) < 1e-12, 'Umgehung lässt den Pegel gleich');
  const comp = ctx().nodes.find(n => n.kind === 'compressor');
  assert.equal(pathGain(comp), 0, 'umgangener Kompressor ist nicht mehr im Weg');
  assert.ok(engine.setParam('master/insert/comp/threshold', -30));
  assert.equal(comp.threshold.final(), -30);
  // Instrument-Parameter
  assert.ok(engine.setParam('track/rhodes/instrument/level', 0.5));
  assert.equal(outs.rhodes.gain.final(), 0.5);
  assert.equal(engine.song().tracks[0].instrument.params.level, 0.5);
  // Falsche Adressen: false und eine Warnung, nichts geändert
  const n = warnings.length;
  assert.equal(engine.setParam('channel/gibtsnicht/gain', 1), false);
  assert.equal(engine.setParam('channel/rhodes/insert/lp/gibtsnicht', 1), false);
  assert.equal(engine.setParam('track/rhodes/instrument/gibtsnicht', 1), false);
  assert.equal(engine.setParam('tempo/bpm', 'schnell'), false);
  assert.equal(warnings.length, n + 1, 'nur die Adresse ohne Kanal ist schon im Format falsch');
  assert.equal(engine.song().tracks[0].instrument.params.gibtsnicht, undefined);
});

test('Werte aus einem neuen Song werden nachgeführt, ohne den Signalweg neu zu bauen', () => {
  const outs = {};
  const { engine, ctx } = setup([spied(rhodes, outs), spied(bass, outs), spied(drums, outs)]);
  const song = beatsSong(jazzyProg());
  engine.load(song); engine.init();
  const nodes = ctx().nodes.length;
  const next = JSON.parse(JSON.stringify(song));
  next.mixer.channels[2].gain = 0.2; next.mixer.channels[2].mute = true; next.tracks[1].instrument.params.level = 0.7;
  next.mixer.channels[0].inserts[1].params.depth = 0.1;
  engine.load(next);
  assert.equal(ctx().nodes.length, nodes, 'keine neuen Knoten');
  assert.equal(pathGain(outs.drums, null, ['convolver']), 0);
  assert.equal(outs.bass.gain.final(), 0.7);
  const lfo = ctx().nodes.find(n => n.kind === 'osc' && n.frequency.value === 4.4);
  assert.equal(lfo.outputs[0].gain.final(), 0.1);
});

test('Unbekannte Instrumente und Effekte: Warnung, die Spur bleibt stumm, der Effekt wird durchgereicht', () => {
  const log = [];
  const { engine, warnings, clock } = setup([recorder('rhodes', log), recorder('bass', log)]);
  const song = beatsSong(jazzyProg());
  song.mixer.channels[1].inserts.push({ id: 'x', type: 'flanger' });
  engine.load(song); engine.init(); engine.play(); clock.advance(500);
  assert.ok(warnings.some(w => /Drums/.test(w) && /drums/.test(w)), warnings.join('\n'));
  assert.ok(warnings.some(w => /flanger/.test(w)));
  assert.ok(log.some(e => e[0] === 'play' && e[1] === 'bass'));
  assert.equal(engine.setParam('channel/bass/insert/x/rate', 1), false);
});

/* ---------- Instrumente ---------- */

test('Stimmen: Bei zu vielen gleichzeitigen wird die älteste ausgeblendet', () => {
  const v = createVoices(2), mk = () => ({ gain: new FakeParam(null, 1), src: [{ stop(t) { this.at = t; } }] });
  const a = mk(), b = mk(), c = mk(), d = mk();
  v.add(0, 1, 3, a.gain, a.src); v.add(0, 1.5, 3, b.gain, b.src);
  v.add(0, 4, 5, d.gain, d.src);            // a und b sind dann vorbei
  assert.equal(a.src[0].at, undefined);
  v.add(0, 2, 3, c.gain, c.src);            // bei 2 klingen a und b: a wird ausgeblendet
  assert.deepEqual(a.gain.calls, [['cancel', 2], ['target', 0, 2, 0.005]]);
  assert.equal(a.src[0].at, 2.05);
  assert.equal(b.src[0].at, undefined);
  v.add(3.5, 4.2, 5, mk().gain, mk().src);  // fertige Stimmen fliegen raus
  assert.equal(v.count(), 2);
  v.stopAll(); assert.equal(v.count(), 0); assert.equal(d.src[0].at, undefined, 'stop() ohne Zeit');
});

test('Instrumente spielen Noten zur geplanten Zeit, Drums nach General-MIDI-Nummer', () => {
  const ac = new FakeAudioContext();
  const r = rhodes.create(ac, { level: 1.1 }), b = bass.create(ac, { level: 1 }), d = drums.create(ac, { level: 0.9 });
  assert.equal(r.output.gain.value, 1.1); assert.equal(d.output.gain.value, 0.9);
  r.play({ p: 69, v: 0.7 }, 1, 0.5);
  const oscs = ac.events.filter(e => e.kind === 'osc').map(e => [e.node.frequency.value, e.t, e.node.stopTime]);
  assert.deepEqual(oscs, [[440, 1, 1.95], [440, 1, 1.95], [440 * 14, 1, 1.4]]);
  b.play({ p: 33, v: 0.8 }, 2, 1);
  assert.deepEqual(ac.events.slice(3).map(e => [e.node.type, e.node.frequency.value, e.t, e.node.stopTime]),
    [['triangle', 55, 2, 3.3], ['sawtooth', 55, 2, 3.3]]);
  const n = ac.events.length;
  for (const p of [36, 37, 42, 99]) d.play({ p, v: 1 }, 3, 0.1);
  // Kick: Sinus und Rauschen, Rim: Rauschen und Dreieck, Hi-Hat: Rauschen, 99: nichts
  assert.deepEqual(ac.events.slice(n).map(e => e.kind), ['osc', 'buffer', 'buffer', 'osc', 'buffer']);
  assert.ok(ac.events.slice(n).every(e => e.t === 3));
  r.stopAll(); d.stopAll();
  assert.ok(ac.events.filter(e => e.node.stops).length >= 6);
});
