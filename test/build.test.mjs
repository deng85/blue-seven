// Tests für den Build: Zusammenführen der ES-Module zu einem Skript. Laufen mit: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import vm from 'node:vm';
import { build, bundle } from '../build.mjs';

// Legt einen Wegwerf-Ordner mit den angegebenen Dateien an und gibt seinen Pfad zurück.
function fixture(t, files) {
  const dir = mkdtempSync(join(tmpdir(), 'blueseven-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
  return dir;
}
const run = code => { const box = { out: [] }; vm.runInNewContext(code, box); return box.out; };

test('index.html ist aus src/ gebaut und aktuell', () => {
  const current = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(current === build(), 'index.html passt nicht zu src/. Bitte "node build.mjs" ausführen.');
});

test('index.html enthält ein einziges Inline-Skript ohne import und lädt keine Skriptdatei nach', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0][1].trim(), '', 'das Skript darf weder src noch type="module" haben');
  assert.ok(!/^\s*(import|export)\b/m.test(scripts[0][2]), 'import oder export im gebauten Skript');
  assert.ok(!/\bimport\s*\(/.test(scripts[0][2]), 'import() im gebauten Skript');
  assert.ok(!html.includes('/*@'), 'Platzhalter nicht ersetzt');
  assert.doesNotThrow(() => new vm.Script(scripts[0][2]));
});

test('alle Module außer main.js lassen sich in Node als ES-Module laden', async () => {
  // Das prüft nebenbei, dass jeder exportierte Name wirklich angelegt ist. main.js startet die App und braucht den Browser.
  const dir = new URL('../src/', import.meta.url);
  for (const f of readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'main.js')) {
    const m = await import(new URL(f, dir));
    assert.ok(Object.keys(m).length > 0, `${f} exportiert nichts`);
  }
});

test('bundle: Importe zuerst, jedes Modul nur einmal, auch aus Unterordnern', t => {
  const dir = fixture(t, {
    'core/a.js': "const a=1;out.push('a');\nexport {a};\n",
    'b.js': "import {a} from './core/a.js';\nconst b=a+1;out.push('b');\nexport {b};\n",
    'main.js': "import {b} from './b.js';\nimport {\n  a\n} from './core/a.js';\nout.push('main',a+b);\n",
  });
  assert.deepEqual(run(bundle('main.js', dir)), ['a', 'b', 'main', 3]);
});

test('bundle: gleiche Namen in zwei Modulen stören sich nicht', t => {
  const dir = fixture(t, {
    'a.js': "const hidden='a';const getA=()=>hidden;\nexport {getA};\n",
    'b.js': "const hidden='b';const getB=()=>hidden;\nexport {getB};\n",
    'main.js': "import {getA} from './a.js';\nimport {getB} from './b.js';\nconst hidden='main';out.push(getA(),getB(),hidden);\n",
  });
  assert.deepEqual(run(bundle('main.js', dir)), ['a', 'b', 'main']);
});

test('bundle: verständlicher Abbruch bei nicht erlaubten Formen', t => {
  const bad = (files, pattern) => assert.throws(() => bundle('main.js', fixture(t, files)), pattern);
  bad({ 'main.js': "import {a} from './a.js';\n", 'a.js': "import {m} from './main.js';\nconst a=1;\nexport {a};\n" }, /Importe im Kreis: main\.js → a\.js → main\.js/);
  bad({ 'main.js': "import {x} from './a.js';\n", 'a.js': "const a=1;\nexport {a};\n" }, /"x" wird aus \.\/a\.js importiert, aber a\.js exportiert das nicht/);
  bad({ 'main.js': "import {a} from './fehlt.js';\n" }, /fehlt\.js: Datei nicht gefunden/);
  bad({ 'main.js': "import {a} from 'paket';\n" }, /nur relative Pfade/);
  bad({ 'main.js': "import a from './a.js';\n", 'a.js': '' }, /versteht der Build nicht/);
  bad({ 'main.js': "import * as a from './a.js';\n", 'a.js': '' }, /versteht der Build nicht/);
  bad({ 'main.js': "export default 1;\n" }, /versteht der Build nicht/);
  bad({ 'main.js': "export const a=1;\n" }, /versteht der Build nicht/);
  bad({ 'main.js': "import {a as b} from './a.js';\n", 'a.js': "const a=1;\nexport {a};\n" }, /kein "as"/);
  bad({ 'main.js': "const m=import('./a.js');\n" }, /import\(\) zur Laufzeit/);
  bad({ 'main.js': "import {n} from './a.js';\n", 'a.js': "let m=0,n=1;\nexport {n};\n" }, /mit let oder var angelegt/);
  bad({ 'main.js': "const x=await Promise.resolve(1);\n" }, /kein gültiges JavaScript/);
});

test('build: setzt Styles und Skript in die Vorlage ein', t => {
  const dir = fixture(t, {
    'index.html': "<style>\n/*@include s.css*/\n</style>\n<script>\n/*@bundle main.js*/\n</script>\n",
    's.css': "a{content:'$&'}\n",
    'main.js': "out.push('$1');\n",
  });
  const html = build(dir);
  assert.ok(html.includes("a{content:'$&'}"));
  assert.ok(html.includes("out.push('$1');"));
  assert.ok(!html.includes('/*@'));
});
