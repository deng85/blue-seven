// Tests für die Harmonielogik. Laufen mit: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as H from '../src/harmony.js';
import { createRng } from '../src/core/rng.js';

// Fester Zufallsgenerator, damit Folgen reproduzierbar sind.
const rng = createRng;
const state = o => ({ key: 0, mode: 'dur', n: 4, spice: 35, nine: 1, loop: [], locks: [], ...o });

// Referenzwerte aus der Version vor dem Refactoring (Commit 8623fa8).
// Ändert sich hier etwas, klingt der Generator anders. Das muss Absicht sein.
const GOLDEN = [
  { mode: 'dur', n: 4, spice: 35, nine: 1, loops: ['I-IV-ii-v', 'I-IV-ii-v', 'I-IV-ii-bVII'], voices: ['57,60,64,67', '57,60,62,65', '57,58,62,65', '58,62,63,67'] },
  { mode: 'dur', n: 3, spice: 0, nine: 0, loops: ['I-IV-ii', 'I-IV-ii', 'iii-I-ii'], voices: ['60,64,65,69', '58,62,65,69', '58,62,65,67'] },
  { mode: 'moll', n: 4, spice: 70, nine: 1, loops: ['i-iv-bvii-bIII', 'i-iv-bvii-bIII', 'i-bIII-bVI-v'], voices: ['55,56,60,63', '56,60,61,65', '54,58,61,65', '55,58,60,63'] },
  { mode: 'moll', n: 3, spice: 100, nine: 0, loops: ['i-ii-bII', 'i-ii-bII', 'bII-bvii-bIII'], voices: ['60,63,65,68', '58,62,65,67', '58,61,65,66'] },
  { mode: 'dur', n: 4, spice: 100, nine: 1, loops: ['I-iv-bVII-v', 'I-iv-bVII-v', 'I-bIII-iv-v'], voices: ['57,60,64,67', '60,61,65,68', '58,62,65,67', '58,62,63,67'] },
];

test('Generator und Stimmführung liefern dieselben Folgen wie vor dem Refactoring', () => {
  for (const g of GOLDEN) {
    const r = rng(7), S = state(g);
    const loops = [0, 1, 2].map(() => H.generate(S, [], r).join('-'));
    assert.deepEqual(loops, g.loops, JSON.stringify(g));
    const voices = H.voiceLoop(loops[0].split('-').map(id => H.byId(g.mode, id)), 5, g.mode, g.nine).map(v => v.notes.join(','));
    assert.deepEqual(voices, g.voices, JSON.stringify(g));
  }
});

test('generate liefert für alle Einstellungen gültige Folgen ohne doppelte Akkorde', () => {
  const r = rng(1);
  for (const mode of ['dur', 'moll']) for (const n of [3, 4]) for (const spice of [0, 35, 100]) {
    for (let i = 0; i < 20; i++) {
      const loop = H.generate(state({ mode, n, spice }), [], r);
      assert.equal(loop.length, n);
      assert.equal(new Set(loop).size, n, `doppelt: ${loop}`);
      for (const id of loop) assert.ok(H.byId(mode, id), `${id} fehlt im Pool ${mode}`);
      if (spice === 0) assert.ok(loop.every(id => !H.byId(mode, id).color), `geliehener Akkord bei Würze 0: ${loop}`);
    }
  }
});

test('gehaltene Akkorde bleiben an ihrem Platz', () => {
  const r = rng(2);
  for (let i = 0; i < 30; i++) {
    const loop = H.generate(state({ loop: ['vi', 'ii', 'v', 'I'], locks: [true, false, false, false] }), [], r);
    assert.equal(loop[0], 'vi');
    const loop2 = H.generate(state({ mode: 'moll', n: 3, loop: ['i', 'iv', 'bVI'], locks: [false, false, true] }), [], r);
    assert.equal(loop2[2], 'bVI');
  }
});

test('zuletzt gespielte Folgen werden gemieden', () => {
  const r = rng(3), S = state({ spice: 0 }), recent = [];
  for (let i = 0; i < 12; i++) {
    const key = H.generate(S, recent, r).join('-');
    assert.ok(!recent.includes(key), `Wiederholung ${key}`);
    recent.push(key);
  }
});

test('voiceLoop: vier Töne, aufsteigend, mit den richtigen Tonklassen', () => {
  for (const mode of ['dur', 'moll']) for (const nine of [0, 1]) for (let key = 0; key < 12; key++) {
    const chords = H.POOL[mode];
    const voiced = H.voiceLoop(chords, key, mode, nine);
    voiced.forEach((v, i) => {
      const ch = chords[i], root = (key + ch.off) % 12;
      assert.equal(v.notes.length, 4);
      for (let j = 1; j < 4; j++) assert.ok(v.notes[j] > v.notes[j - 1], `nicht aufsteigend: ${v.notes}`);
      assert.ok(v.notes[0] >= 52 && v.notes[3] <= 80, `außerhalb der Lage: ${v.notes}`);
      const allowed = new Set([...H.QUAL[ch.q], 2].map(x => (root + x) % 12));
      for (const m of v.notes) assert.ok(allowed.has(m % 12), `fremder Ton ${m} in ${ch.id}`);
      assert.equal(v.bass, 36 + root);
    });
  }
});

test('chordName: Vorzeichen und Akkordsymbol', () => {
  const I = H.byId('dur', 'I'), ii = H.byId('dur', 'ii');
  assert.equal(JSON.stringify(H.chordName(I, 0, 'dur', 0)), JSON.stringify({ root: 'C', suf: 'maj7' }));
  assert.equal(JSON.stringify(H.chordName(I, 0, 'dur', 1)), JSON.stringify({ root: 'C', suf: 'maj9' }));
  assert.equal(JSON.stringify(H.chordName(ii, 7, 'dur', 0)), JSON.stringify({ root: 'A', suf: 'm7' }));
  assert.equal(H.chordName(I, 5, 'dur', 0).root, 'F');
  assert.equal(H.chordName(H.byId('dur', 'IV'), 5, 'dur', 0).root, 'Bb');
});
