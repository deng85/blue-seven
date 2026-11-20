// Tests für den Kern: Zufall mit Startwert, Parameterbeschreibung, Registry. Laufen mit: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, randomSeed } from '../src/core/rng.js';
import { checkSpecs, normalizeValue, defaults, normalize } from '../src/core/params.js';
import { createRegistry } from '../src/core/registry.js';

test('createRng: gleicher Startwert, gleiche Folge, Werte von 0 bis unter 1', () => {
  const a = createRng(7), b = createRng(7), c = createRng(8);
  const xs = Array.from({ length: 200 }, a);
  assert.deepEqual(xs, Array.from({ length: 200 }, b));
  assert.notDeepEqual(xs.slice(0, 5), Array.from({ length: 5 }, c));
  assert.ok(xs.every(x => x >= 0 && x < 1));
  // Feste Referenz, damit sich das Verfahren nicht unbemerkt ändert. Gespeicherte Startwerte hängen daran.
  assert.deepEqual(Array.from({ length: 3 }, createRng(1)).map(x => x.toFixed(6)), ['0.627074', '0.002736', '0.527447']);
});

test('randomSeed: ganze Zahl im 32-Bit-Bereich', () => {
  const s = randomSeed(createRng(3));
  assert.ok(Number.isInteger(s) && s >= 0 && s < 2 ** 32);
  assert.equal(randomSeed(() => 0), 0);
});

const SPECS = [
  { id: 'frequency', name: 'Grenzfrequenz', type: 'number', min: 80, max: 12000, step: 1, default: 3600, unit: 'Hz', curve: 'exp' },
  { id: 'depth', name: 'Tiefe', type: 'number', min: 0, max: 1, step: 0.1, default: 0.5 },
  { id: 'free', name: 'Frei', type: 'number', min: -1, max: 1, default: 0 },
  { id: 'feel', name: 'Spielweise', type: 'enum', default: 'comp', options: [{ value: 'pad', name: 'Liegend' }, { value: 'comp', name: 'Comping' }] },
  { id: 'nine', name: 'Mit None', type: 'bool', default: true },
];

test('checkSpecs: gültige Beschreibung ohne Fehler', () => {
  assert.deepEqual(checkSpecs(SPECS), []);
  assert.deepEqual(checkSpecs([]), []);
});

test('checkSpecs: meldet Fehler verständlich', () => {
  const one = (p, pattern) => { const e = checkSpecs([p]); assert.equal(e.length, 1, JSON.stringify(e)); assert.match(e[0], pattern); };
  assert.match(checkSpecs({})[0], /muss eine Liste sein/);
  one(null, /Nr\. 1: ist kein Objekt/);
  one({ id: '1x', name: 'X', type: 'bool', default: true }, /braucht eine id/);
  one({ id: 'x', type: 'bool', default: true }, /„x“: braucht einen Namen/);
  one({ id: 'x', name: 'X', type: 'text' }, /unbekannten Typ „text“/);
  one({ id: 'x', name: 'X', type: 'number', min: 2, max: 1, default: 1 }, /min nicht größer als max/);
  one({ id: 'x', name: 'X', type: 'number', min: 0, max: 1, default: 2 }, /Standardwert zwischen min und max/);
  one({ id: 'x', name: 'X', type: 'number', min: 0, max: 1, default: 0, step: 0 }, /Schrittweite/);
  one({ id: 'x', name: 'X', type: 'number', min: 0, max: 1, default: 0, curve: 'exp' }, /nicht bei 0/);
  one({ id: 'x', name: 'X', type: 'number', min: 1, max: 2, default: 1, curve: 'log' }, /unbekannte Kurve/);
  one({ id: 'x', name: 'X', type: 'enum', default: 'a', options: [] }, /braucht options/);
  one({ id: 'x', name: 'X', type: 'enum', default: 'c', options: [{ value: 'a', name: 'A' }] }, /unter den Optionen/);
  one({ id: 'x', name: 'X', type: 'enum', default: 'a', options: [{ value: 'a', name: 'A' }, { value: 'a', name: 'B' }] }, /Option doppelt/);
  one({ id: 'x', name: 'X', type: 'bool', default: 1 }, /true oder false/);
  assert.match(checkSpecs([SPECS[4], SPECS[4]])[0], /„nine“: kommt doppelt vor/);
});

test('defaults und normalize: füllen, begrenzen, Unbekanntes weglassen', () => {
  assert.deepEqual(defaults(SPECS), { frequency: 3600, depth: 0.5, free: 0, feel: 'comp', nine: true });
  assert.deepEqual(normalize(SPECS, undefined), defaults(SPECS));
  assert.deepEqual(normalize(SPECS, { frequency: 99999, depth: 0.34, free: 0.123, feel: 'pad', nine: false, fremd: 1 }),
    { frequency: 12000, depth: 0.3, free: 0.123, feel: 'pad', nine: false });
  assert.deepEqual(normalize(SPECS, { frequency: 'laut', depth: -5, free: NaN, feel: 'x', nine: 'ja' }),
    { frequency: 3600, depth: 0, free: 0, feel: 'comp', nine: true });
  assert.equal(normalizeValue(SPECS[0], 440.4), 440);
  assert.equal(normalizeValue(SPECS[1], 0.1 + 0.2), 0.3);
  assert.equal(normalizeValue(SPECS[4], 0), false);
  assert.equal(normalizeValue(SPECS[4], 1), true);
});

test('createRegistry: get, has, list in der angegebenen Reihenfolge', () => {
  const jazzy = { id: 'jazzy', name: 'Jazzy', params: SPECS }, plain = { id: 'plain', name: 'Schlicht' };
  const rhodes = { type: 'rhodes', name: 'Rhodes' };
  const r = createRegistry({ chords: [jazzy, plain], instruments: [rhodes] });
  assert.equal(r.get('chords', 'jazzy'), jazzy);
  assert.equal(r.get('instruments', 'rhodes'), rhodes);
  assert.equal(r.get('chords', 'fehlt'), undefined);
  assert.equal(r.has('chords', 'plain'), true);
  assert.equal(r.has('styles', 'plain'), false);
  assert.deepEqual(r.list('chords'), [jazzy, plain]);
  assert.deepEqual(r.list('effects'), []);
  assert.deepEqual(createRegistry().list('styles'), []);
});

test('createRegistry: verständlicher Abbruch bei fehlerhaften Einträgen', () => {
  assert.throws(() => createRegistry({ plugins: [] }), /unbekannte Modulart „plugins“/);
  assert.throws(() => createRegistry({ chords: [{ name: 'Ohne' }] }), /Akkord-Generator braucht das Feld id/);
  assert.throws(() => createRegistry({ effects: [{ id: 'reverb', name: 'Hall' }] }), /Effekt braucht das Feld type/);
  assert.throws(() => createRegistry({ styles: [{ id: 'Deep House', name: 'Deep House' }] }), /Kleinbuchstaben/);
  assert.throws(() => createRegistry({ styles: [{ id: 'a', name: 'A' }, { id: 'a', name: 'B' }] }), /Stil „a“ ist doppelt/);
  assert.throws(() => createRegistry({ styles: [{ id: 'a' }] }), /braucht einen Namen/);
  assert.throws(() => createRegistry({ instruments: [{ type: 'x', name: 'X', params: [{ id: 'p', name: 'P', type: 'zahl' }] }] }), /fehlerhafte Parameter[\s\S]*unbekannten Typ/);
  assert.throws(() => createRegistry().list('plugins'), /unbekannte Modulart/);
});
