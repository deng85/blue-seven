// Tests für die Schnittstelle Akkordfolge: Format, Jazzy als Modul, zweiter Generator als Beweis. Laufen mit: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkChords } from '../src/core/format.js';
import { createRng } from '../src/core/rng.js';
import { defaults, normalize } from '../src/core/params.js';
import { createRegistry } from '../src/core/registry.js';
import { jazzy, generate, voiceLoop, byId } from '../src/chords/jazzy.js';
import { plain } from './fixtures/plain-chords.js';

const ids = p => p.chords.map(c => c.source.id);
const ctx = o => ({ key: 0, mode: 'dur', rnd: createRng(7), previous: null, locked: [], avoid: [], ...o });
const good = () => ({ format: 'blueseven.chords', version: 1, key: 0, mode: 'dur', chords: [{ root: 0, tones: [0, 4, 7], duration: 4 }] });

test('checkChords: kleinste gültige Folge und eine mit allen Feldern', () => {
  assert.deepEqual(checkChords(good()), []);
  const full = good();
  full.generator = { id: 'x', version: 1, params: {} };
  full.chords = [{ root: 5, tones: [0, 3, 7, 10, 14], duration: 2.5, voicing: [53, 56, 60, 63, 67], bass: 0, label: { roman: 'iv' }, source: { egal: true }, extra: 1 }];
  assert.deepEqual(checkChords(full), []);
});

test('checkChords: meldet Fehler verständlich', () => {
  const bad = (change, pattern) => { const p = good(); change(p); const e = checkChords(p); assert.ok(e.some(m => pattern.test(m)), `${pattern} fehlt in ${JSON.stringify(e)}`); };
  assert.match(checkChords(null)[0], /kein Objekt/);
  bad(p => { p.format = 'x'; }, /format muss „blueseven\.chords“/);
  bad(p => { p.version = 2; }, /Version 2, diese App versteht nur bis Version 1/);
  bad(p => { delete p.version; }, /version muss eine ganze Zahl/);
  bad(p => { p.key = 12; }, /key muss eine Tonklasse/);
  bad(p => { p.mode = 'lydisch'; }, /mode muss eines von dur, moll/);
  bad(p => { p.generator = {}; }, /generator braucht eine id/);
  bad(p => { p.chords = []; }, /mindestens einem Akkord/);
  bad(p => { p.chords[0] = 5; }, /Akkord 1: ist kein Objekt/);
  bad(p => { p.chords[0].root = -1; }, /Akkord 1: root/);
  bad(p => { p.chords[0].tones = [0]; }, /mindestens zwei/);
  bad(p => { p.chords[0].tones = [4, 7]; }, /mit 0 für den Grundton/);
  bad(p => { p.chords[0].tones = [0, 7, 4]; }, /aufsteigend/);
  bad(p => { p.chords[0].duration = 0; }, /duration/);
  bad(p => { p.chords[0].voicing = [60, 64]; }, /mindestens drei MIDI-Noten/);
  bad(p => { p.chords[0].voicing = [64, 60, 67]; }, /tiefste Note zuerst/);
  bad(p => { p.chords[0].voicing = [60, 63, 67]; }, /mit 63 einen Ton, der nicht zu root und tones gehört/);
  bad(p => { p.chords[0].bass = 40; }, /bass muss eine Tonklasse/);
  bad(p => { p.chords[0].label = 'C'; }, /label muss ein Objekt/);
  bad(p => { p.chords.push({ root: 0, tones: [0, 4, 7] }); }, /Akkord 2: duration/);
});

test('Jazzy: Parameterbeschreibung passt zur Registry', () => {
  const r = createRegistry({ chords: [jazzy, plain] });
  assert.deepEqual(r.list('chords').map(m => m.id), ['jazzy', 'plain']);
  assert.deepEqual(defaults(jazzy.params), { n: 4, spice: 35, nine: true });
  // Die App speichert None als 0 oder 1. Das muss als Wahrheitswert ankommen.
  assert.deepEqual(normalize(jazzy.params, { n: 3, spice: 80, nine: 0 }), { n: 3, spice: 80, nine: false });
});

test('Jazzy: generate liefert über die Schnittstelle dieselben Folgen und Lagen wie die Harmonielogik direkt', () => {
  for (const mode of ['dur', 'moll']) for (const n of [3, 4]) for (const spice of [0, 35, 100]) for (const nine of [true, false]) for (const key of [0, 5, 10]) {
    const direct = generate({ n, spice, mode, loop: [], locks: [] }, [], createRng(7));
    const voiced = voiceLoop(direct.map(id => byId(mode, id)), key, mode, nine);
    const p = jazzy.generate({ n, spice, nine }, ctx({ key, mode }));
    assert.deepEqual(checkChords(p), [], JSON.stringify({ mode, n, spice, nine, key }));
    assert.deepEqual(ids(p), direct);
    assert.deepEqual(p.chords.map(c => c.voicing), voiced.map(v => v.notes));
    assert.deepEqual(p.chords.map(c => 36 + c.root), voiced.map(v => v.bass));
    assert.deepEqual(p.chords.map(c => c.label.root + c.label.suffix), voiced.map(v => v.name.root + v.name.suf));
    assert.ok(p.chords.every(c => c.duration === 4));
    assert.deepEqual(p.generator, { id: 'jazzy', version: 1, params: { n, spice, nine } });
    for (const c of p.chords) assert.equal(c.tones.includes(14), /9$/.test(c.label.suffix), 'None in tones genau dann, wenn sie im Namen steht');
  }
});

test('Jazzy: die Referenzfolge vom Stand vor dem Umbau kommt auch über die Schnittstelle heraus', () => {
  // Gleiche Werte wie der erste Eintrag in GOLDEN in harmony.test.mjs.
  const p = jazzy.generate({ n: 4, spice: 35, nine: true }, ctx({ key: 5 }));
  assert.equal(ids(p).join('-'), 'I-IV-ii-v');
  assert.deepEqual(p.chords.map(c => c.voicing.join(',')), ['57,60,64,67', '57,60,62,65', '57,58,62,65', '58,62,63,67']);
});

test('Jazzy: gehaltene Plätze bleiben, zuletzt erzeugte Folgen werden gemieden', () => {
  const rnd = createRng(2), params = { n: 4, spice: 35, nine: true };
  let prev = jazzy.generate(params, ctx({ rnd }));
  for (let i = 0; i < 30; i++) {
    const next = jazzy.generate(params, ctx({ rnd, previous: prev, locked: [false, true, false, false] }));
    assert.equal(ids(next)[1], ids(prev)[1]);
    prev = next;
  }
  const recent = [];
  for (let i = 0; i < 12; i++) {
    const p = jazzy.generate({ n: 4, spice: 0, nine: true }, ctx({ rnd, avoid: recent }));
    assert.ok(!recent.some(r => ids(r).join('-') === ids(p).join('-')), `Wiederholung ${ids(p)}`);
    recent.push(p);
  }
});

test('Jazzy: update gibt dieselbe Folge in anderer Tonart und ohne None neu aus', () => {
  const a = jazzy.generate({ n: 4, spice: 35, nine: true }, ctx());
  const b = jazzy.update(a, { n: 4, spice: 35, nine: false }, { key: 7, mode: 'dur' });
  assert.deepEqual(checkChords(b), []);
  assert.deepEqual(ids(b), ids(a));
  assert.equal(b.key, 7);
  assert.deepEqual(b.chords.map(c => c.root), a.chords.map(c => (c.root + 7) % 12));
  assert.ok(b.chords.every(c => !c.tones.includes(14)));
  // update liest nur die Stufen-IDs. So stellt die App gespeicherte Folgen wieder her.
  const c = jazzy.update({ chords: ids(a).map(id => ({ source: { id } })) }, { n: 4, spice: 35, nine: true }, { key: 0, mode: 'dur' });
  assert.deepEqual(c, a);
});

test('Jazzy: update lehnt fremde oder unpassende Folgen mit null ab', () => {
  const params = defaults(jazzy.params);
  assert.equal(jazzy.update(plain.generate({ long: false }, ctx()), params, { key: 0, mode: 'dur' }), null);
  assert.equal(jazzy.update({ chords: [{ source: { id: 'I' } }] }, params, { key: 0, mode: 'moll' }), null, 'I gibt es im Moll-Pool nicht');
  assert.equal(jazzy.update({ chords: [] }, params, { key: 0, mode: 'dur' }), null);
  assert.equal(jazzy.update(null, params, { key: 0, mode: 'dur' }), null);
});

test('Jazzy: fremde Folge als previous stört generate nicht', () => {
  const p = jazzy.generate(defaults(jazzy.params), ctx({ previous: plain.generate({ long: false }, ctx()), locked: [true, true, true, true] }));
  assert.deepEqual(checkChords(p), []);
  assert.equal(p.chords.length, 4);
});

test('zweiter Akkord-Generator: gültige Folgen ohne Lage, Beschriftung und update', () => {
  const rnd = createRng(4);
  for (const mode of ['dur', 'moll']) for (let key = 0; key < 12; key++) for (const long of [false, true]) {
    const p = plain.generate({ long }, ctx({ key, mode, rnd }));
    assert.deepEqual(checkChords(p), [], JSON.stringify(p));
    assert.ok(p.chords.every(c => c.voicing === undefined && c.label === undefined && c.tones.length === 3));
    assert.equal(p.chords.at(-1).duration, long ? 8 : 4);
  }
  assert.equal(plain.update, undefined);
});
