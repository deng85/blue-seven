// Tests für den Stil Deep House und für Automation, Ducker, Echo und Springen in der Engine. Laufen mit: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkSong } from '../src/core/format.js';
import { createRng } from '../src/core/rng.js';
import { createRegistry } from '../src/core/registry.js';
import { automationAt } from '../src/engine/timeline.js';
import { createEngine } from '../src/engine/engine.js';
import { deepHouse, voice } from '../src/styles/deep-house.js';
import { jazzy } from '../src/chords/jazzy.js';
import { plain } from './fixtures/plain-chords.js';
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

const jazzyProg = (seed = 7, n = 4) => jazzy.generate({ n, spice: 35, nine: true }, { key: 9, mode: 'moll', rnd: createRng(seed), previous: null, locked: [], avoid: [] });
const make = (prog, params = {}, seed = 5, bpm = 122) => deepHouse.generate(prog, params, { bpm, swing: 0, rnd: createRng(seed), seed });
const minutes = s => s.length * 60 / s.tempo.bpm / 60;

test('Deep House: gültiger Song mit Arrangement in allen Längen (A9)', () => {
  for (const length of ['short', 'medium', 'long']) for (const bars of [1, 2]) for (const n of [3, 4]) {
    const s = make(jazzyProg(3, n), { length, bars });
    assert.deepEqual(checkSong(s), [], `${length}, ${bars}, ${n}`);
    assert.equal(s.loop, false);
    assert.ok(s.sections.length >= 6);
    assert.ok(s.sections.every(x => x.length % 32 === 0), 'Phrasen von 8 oder 16 Takten');
    assert.ok(minutes(s) >= 3 && minutes(s) <= 5, `${length}: ${minutes(s).toFixed(2)} min`);
    for (const id of ['kick', 'clap', 'hat', 'ohat', 'perc', 'bass', 'stabs', 'pad']) assert.ok(s.tracks.find(t => t.id === id).clips.length, id);
    assert.ok(JSON.stringify(s).length < 200000, 'unter 200 kB');
  }
});

test('Deep House: Kick auf jedem Viertel, Clap auf 2 und 4, Bass zwischen den Kicks, Pumpen über den Ducker', () => {
  const s = make(jazzyProg());
  assert.deepEqual(s.patterns.kick.notes.map(n => n.t), [0, 1, 2, 3]);
  assert.deepEqual(s.patterns.clap.notes.map(n => n.t), [1, 3]);
  assert.deepEqual(s.patterns.ohat.notes.map(n => n.t), [0.5, 1.5, 2.5, 3.5]);
  assert.ok(s.patterns.bass.notes.every(n => n.t % 1 !== 0), 'kein Basston auf einem Kick');
  const duck = s.mixer.channels.filter(c => c.inserts.some(x => x.type === 'ducker' && x.params.source === 'kick')).map(c => c.id);
  assert.deepEqual(duck, ['bass', 'stabs', 'pad']);
  // Im Drop spielt alles außer dem Pad, im Break weder Kick noch Bass.
  const active = id => { const sec = s.sections.find(x => x.id === id); return s.tracks.filter(t => t.clips.some(c => c.start < sec.start + sec.length && c.start + c.length > sec.start)).map(t => t.id); };
  assert.deepEqual(active('drop'), ['kick', 'clap', 'hat', 'ohat', 'perc', 'bass', 'stabs']);
  assert.ok(!active('break').includes('kick') && !active('break').includes('bass') && active('break').includes('riser'));
  // Filterfahrt im Aufbau: der Tiefpass der Stabs öffnet sich.
  const lane = s.automation.find(a => a.target === 'channel/stabs/insert/lp/frequency'), b = s.sections.find(x => x.id === 'build');
  assert.ok(automationAt(lane.points, b.start) < 1000 && automationAt(lane.points, b.start + b.length - 0.01) > 6000);
});

test('Deep House: eigene Lage aus root und tones, Akkorde gestreckt, Reihenfolge unverändert (F-D2, A9a)', () => {
  const prog = jazzyProg();
  const bare = { ...prog, chords: prog.chords.map(({ root, tones, duration }) => ({ root, tones, duration })) };
  const a = make(prog), b = make(bare);
  assert.deepEqual(a.patterns.stabs, b.patterns.stabs, 'voicing, label und source spielen keine Rolle');
  assert.deepEqual(a.meta.chords.chords.map(c => [c.root, c.duration]), prog.chords.map(c => [c.root, 8]));
  let at = 0;
  prog.chords.forEach(ch => {
    const pcs = new Set(ch.tones.map(t => (ch.root + t) % 12));
    for (const n of a.patterns.stabs.notes.filter(x => x.t >= at && x.t < at + 8)) assert.ok(pcs.has(n.p % 12), `Ton ${n.p} gehört nicht zum Akkord`);
    for (const n of a.patterns.bass.notes.filter(x => x.t >= at && x.t < at + 8)) assert.ok(pcs.has(n.p % 12) || (n.p - ch.root) % 12 === 7);
    at += 8;
  });
  assert.deepEqual(voice({ root: 0, tones: [0, 4, 7] }, 64), [60, 64, 67]);
  assert.equal(voice({ root: 0, tones: [0, 3, 7, 10, 14] }, 64).length, 4, 'fünf Töne: der Grundton entfällt');
});

test('Deep House: unabhängig vom Akkord-Generator (A4, A5) und reproduzierbar (A11)', () => {
  const code = readFileSync(new URL('../src/styles/deep-house.js', import.meta.url), 'utf8');
  for (const [, from] of code.matchAll(/from\s*'([^']+)'/g)) assert.match(from, /^\.\.\/core\//);
  for (const long of [false, true]) for (const seed of [1, 2, 3]) {
    const prog = plain.generate({ long }, { key: seed, mode: seed % 2 ? 'dur' : 'moll', rnd: createRng(seed) });
    assert.deepEqual(checkSong(make(prog)), []);
  }
  const one = { format: 'blueseven.chords', version: 1, key: 0, mode: 'dur', chords: [{ root: 0, tones: [0, 4, 7], duration: 4 }] };
  assert.deepEqual(checkSong(make(one)), []);
  assert.deepEqual(make(jazzyProg(), {}, 9), make(jazzyProg(), {}, 9));
  assert.notDeepEqual(make(jazzyProg(), {}, 9).patterns.perc, make(jazzyProg(), {}, 10).patterns.perc);
  assert.deepEqual(make(jazzyProg(), {}, 9).patterns.bass, make(jazzyProg(), {}, 10).patterns.bass, 'gewürfelt wird nur die Percussion');
  assert.equal(make(jazzyProg(), {}, 5, 200).tempo.bpm, 128);
  assert.throws(() => deepHouse.generate({ chords: [] }, {}, {}), /Deep House kann diese Akkordfolge nicht verwenden/);
});

test('automationAt: step, lin, exp, vor dem ersten und nach dem letzten Punkt', () => {
  const pts = [{ t: 4, v: 100, curve: 'step' }, { t: 8, v: 400, curve: 'exp' }, { t: 8, v: 50, curve: 'step' }, { t: 12, v: 150 }];
  assert.equal(automationAt(pts, 0), 100); assert.equal(automationAt(pts, 4), 100);
  assert.ok(Math.abs(automationAt(pts, 6) - 200) < 1e-9);
  assert.equal(automationAt(pts, 8), 50); assert.equal(automationAt(pts, 10), 100); assert.equal(automationAt(pts, 99), 150);
});

function setup() {
  let ctx = null; const clock = createClock(() => ctx);
  class AC extends FakeAudioContext { constructor(o) { super(o); ctx = this; } }
  const registry = createRegistry({ instruments: [rhodes, bass, drums, synth, riser], effects: [filter, tremolo, reverb, compressor, delay, ducker] });
  const engine = createEngine(registry, { AudioContext: AC, ...clock });
  const warnings = []; engine.on('warning', m => warnings.push(m));
  return { engine, clock, warnings, ctx: () => ctx };
}

test('Engine spielt Deep House: Automation, Ducker bei jeder Kick, Echo im Tempo, Vorrang für Werte des Nutzers', () => {
  const { engine, clock, warnings, ctx } = setup();
  const s = make(jazzyProg(), { length: 'short' });
  engine.init(); engine.load(s);
  const build = s.sections.find(x => x.id === 'build'), spb = 60 / 122;
  assert.ok(engine.play({ from: build.start }));
  clock.advance(8 * 4 * spb * 1000 + 500);                       // der ganze Aufbau
  assert.deepEqual(warnings, []);
  const lps = ctx().nodes.filter(n => n.kind === 'filter' && n.frequency.calls.some(c => c[0] === 'target'));
  assert.equal(lps.length, 2, 'Tiefpass von Stabs und Pad werden gefahren');
  const sweep = lps[0].frequency.calls.filter(c => c[0] === 'target').map(c => c[1]);
  assert.ok(sweep.length > 50 && sweep.every((v, i) => i === 0 || v >= sweep[i - 1] || v === 7000), 'steigt durch den Aufbau');
  assert.ok(sweep[0] < 700 && Math.max(...sweep) > 6500);
  // Ducker: drei Kanäle, jeder bekommt pro Kick zwei Aufrufe (runter, wieder hoch). 7 Takte Kick im Aufbau, danach der Drop.
  const ducks = ctx().nodes.filter(n => n.kind === 'gain' && n.gain.calls.some(c => c[0] === 'target' && c[3] === 0.004));
  assert.equal(ducks.length, 3);
  const firstBar = ducks[0].gain.calls.filter(c => c[2] < 0.15 + 4 * spb - 1e-6);
  assert.equal(firstBar.length, 8);
  assert.ok(Math.abs(firstBar[0][1] - 0.3) < 1e-12, 'Bass: Tiefe 0,7');
  // Echo: punktierte Achtel bei 122 BPM, und es folgt dem Tempo.
  const dl = ctx().nodes.find(n => n.kind === 'delay');
  assert.ok(Math.abs(dl.delayTime.value - 0.75 * spb) < 1e-12);
  engine.setParam('tempo/bpm', 116); clock.advance(3000);
  assert.ok(Math.abs(dl.delayTime.final() - 0.75 * 60 / 116) < 1e-12);
  // Stellt der Nutzer den Filter selbst, lässt die Automation ihn in Ruhe.
  engine.setParam('channel/stabs/insert/lp/frequency', 1234);
  const n = lps[0].frequency.calls.length; clock.advance(8000);
  assert.equal(lps[0].frequency.calls.length, n);
  assert.deepEqual(engine.overrides(), ['channel/stabs/insert/lp/frequency']);
  engine.load(s, { overrides: [] }); clock.advance(3000);
  assert.ok(lps[0].frequency.calls.length > n, 'nach dem Zurücksetzen fährt die Automation wieder');
});

test('seek(): springt im Lauf auf den Taktanfang, der Song endet ohne Loop', () => {
  const { engine, clock } = setup();
  const s = make(jazzyProg(), { length: 'short' });
  let ended = 0; engine.on('ended', () => ended++);
  engine.init(); engine.load(s);
  assert.equal(engine.seek(100), false, 'ohne Wiedergabe');
  engine.play(); clock.advance(1000);
  assert.ok(engine.seek(s.length - 6)); clock.advance(700);
  const p = engine.position();
  assert.ok(p.beat >= s.length - 8 && p.beat < s.length - 6, String(p.beat));
  clock.advance(5000);
  assert.equal(ended, 1); assert.ok(!engine.isPlaying());
});

test('Drums: Jazz-Kit unverändert, House-Kit mit Clap, offener Hi-Hat und Shaker', () => {
  const ac = new FakeAudioContext();
  const d = drums.create(ac, { level: 1, kit: 'house' });
  for (const p of [36, 39, 46, 70]) d.play({ p, v: 1 }, 1, 0.1);
  assert.deepEqual(ac.events.map(e => e.kind), ['osc', 'buffer', 'buffer', 'buffer', 'buffer', 'buffer', 'buffer', 'buffer']);
  assert.equal(ac.events[0].node.frequency.value, 170);
  const j = drums.create(ac, { level: 1, kit: 'jazz' }); const n = ac.events.length;
  j.play({ p: 36, v: 1 }, 1, 0.1);
  assert.equal(ac.events[n].node.frequency.value, 130);
  assert.equal(drums.params.find(x => x.id === 'kit').default, 'jazz');
});
