// Tests für die Übernahme von Mixer-Einstellungen (F-P9) und die Regler aus Parameterbeschreibungen. Laufen mit: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeMixer } from '../src/core/mixmerge.js';
import { checkSong } from '../src/core/format.js';
import { createRng } from '../src/core/rng.js';
import { jazzy } from '../src/chords/jazzy.js';
import { jazzyBeats } from '../src/styles/jazzy-beats.js';
import { filter } from '../src/effects/filter.js';
import { reverb } from '../src/effects/reverb.js';
import { controlHtml, formatValue } from '../src/app/ui-params.js';

const song = () => jazzyBeats.generate(jazzy.generate({ n: 4, spice: 35, nine: true },
  { key: 0, mode: 'dur', rnd: createRng(7), previous: null, locked: [], avoid: [] }), { feel: 'comp' }, { bpm: 84, swing: 55 });

test('mergeMixer: Werte des Nutzers bleiben, zugeordnet über IDs', () => {
  const fresh = song().mixer, user = JSON.parse(JSON.stringify(fresh));
  Object.assign(user.channels[0], { gain: 0.3, pan: -0.5, mute: true, solo: true });
  user.channels[0].sends[0].gain = 0.9;
  user.channels[0].inserts[0].params.frequency = 800; user.channels[0].inserts[1].bypass = true;
  user.returns[0].gain = 0.4; user.returns[0].mute = true; user.returns[0].inserts[0].params.seconds = 3;
  user.master.gain = 0.7; user.master.inserts[0].params.ratio = 8;
  user.channels.reverse();                                   // Reihenfolge spielt keine Rolle
  const out = mergeMixer(fresh, user);
  assert.deepEqual(out.channels.map(c => c.id), ['rhodes', 'bass', 'drums']);
  assert.deepEqual(out.channels[0], user.channels[2]);
  assert.deepEqual(out.returns, user.returns); assert.deepEqual(out.master, user.master);
  assert.equal(fresh.channels[0].gain, song().mixer.channels[0].gain, 'der frische Mixer bleibt unberührt');
  const s = song(); s.mixer = out; assert.deepEqual(checkSong(s), []);
});

test('mergeMixer: Unbekanntes entfällt, Fehlendes und Unbrauchbares behält den neuen Wert', () => {
  const fresh = song().mixer;
  assert.deepEqual(mergeMixer(fresh, null), fresh);
  assert.deepEqual(mergeMixer(fresh, { channels: 'x', returns: [null], master: 3 }), fresh);
  const user = {
    channels: [
      { id: 'rhodes', gain: 'laut', pan: NaN, mute: 1, sends: [{ to: 'echo', gain: 1 }],
        inserts: [{ id: 'lp', type: 'reverb', params: { seconds: 5 } }, { id: 'trem', type: 'tremolo', params: { rate: 2 } }] },
      { id: 'strings', gain: 0.1 },
    ],
  };
  const out = mergeMixer(fresh, user);
  assert.equal(out.channels.length, 3);
  assert.equal(out.channels[0].gain, fresh.channels[0].gain);
  assert.equal(out.channels[0].mute, false);
  assert.deepEqual(out.channels[0].sends, fresh.channels[0].sends);
  assert.deepEqual(out.channels[0].inserts[0], fresh.channels[0].inserts[0], 'anderer Effekttyp unter derselben ID zählt nicht');
  assert.deepEqual(out.channels[0].inserts[1].params, { rate: 2, depth: 0.45 });
});

test('Regler aus der Parameterbeschreibung: Zahl, Auswahl, Kurve exp, Anzeige', () => {
  const freq = filter.params.find(p => p.id === 'frequency'), mode = filter.params.find(p => p.id === 'mode');
  assert.equal(formatValue(freq, 3600), '3,6 kHz'); assert.equal(formatValue(freq, 632), '632 Hz');
  assert.equal(formatValue(reverb.params[0], 1.5), '1,5 s'); assert.equal(formatValue(mode, 'highpass'), 'Hochpass');
  const html = controlHtml(freq, 20000, 'x', 'data-addr="a/b"');
  assert.match(html, /min="0" max="1000" step="1" value="1000"/);
  assert.match(html, /data-addr="a\/b"/);
  assert.match(controlHtml(freq, 20, 'x'), /value="0"/);
  assert.match(controlHtml(reverb.params[0], 99, 'x'), /min="0.2" max="6" step="0.1" value="6" data-live="0"/);
  const seg = controlHtml(mode, 'bandpass', 'x');
  assert.equal((seg.match(/<button/g) || []).length, 3);
  assert.match(seg, /aria-pressed="true">Bandpass/);
  assert.match(controlHtml({ id: 'a', name: '<b>', type: 'bool', default: true }, undefined, 'x'), /&lt;b&gt;.*aria-pressed="true"/);
});
