// Baut aus src/ wieder eine einzelne index.html. Keine Abhängigkeiten, nur Node.
//
//   node build.mjs           schreibt index.html
//   node build.mjs --check   prüft nur, ob index.html zum Stand in src/ passt
//
// In src/index.html stehen zwei Arten von Platzhaltern, jeweils allein in einer Zeile:
//
//   /*@include name*/   wird durch den Inhalt von src/name ersetzt (für styles.css)
//   /*@bundle name*/    wird durch ein einziges Skript ersetzt, das das ES-Modul src/name
//                       und alles, was es importiert, enthält
//
// Die gebaute Datei enthält keine import-Anweisungen und lädt nichts nach. Deshalb läuft sie
// per Doppelklick ohne Server.
//
// Damit das Zusammenführen ohne Parser auskommt, gilt in src/ ein eingeschränkter Modulstil:
//
//   import {a, b} from './datei.js';     nur benannte Importe mit relativem Pfad
//   export {a, b};                       nur eine Liste von Namen, üblicherweise am Dateiende
//
// Nicht erlaubt: export default, export const/function, import * as, Umbenennen mit "as",
// import() zur Laufzeit, await auf oberster Ebene, Importe im Kreis.
// Exportierte Namen dürfen nicht neu zugewiesen werden (also const oder function, kein let),
// weil ein importierendes Modul im gebauten Skript den Wert beim Laden übernimmt.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative, sep } from 'node:path';
import vm from 'node:vm';

const root = dirname(fileURLToPath(import.meta.url));
const SRC = join(root, 'src');
const OUT = join(root, 'index.html');

const IMPORT = /^[ \t]*import\s*\{([^}]*)\}\s*from\s*(['"])([^'"]+)\2[ \t]*;?[ \t]*$/gm;
const EXPORT = /^[ \t]*export\s*\{([^}]*)\}[ \t]*;?[ \t]*$/gm;
const NAME = /^[A-Za-z_$][\w$]*$/;

const fail = msg => { throw new Error(msg); };

function names(list, file, what) {
  return list.split(',').map(s => s.trim()).filter(Boolean).map(n => {
    if (!NAME.test(n)) fail(`${file}: "${n}" geht nicht in einer ${what}-Liste. Erlaubt sind nur einfache Namen, kein "as" und kein "default".`);
    return n;
  });
}

// Liest ein Modul und trennt Importe, Exporte und den restlichen Code.
function parse(path, srcDir) {
  const file = relative(srcDir, path).split(sep).join('/');
  let code;
  try { code = readFileSync(path, 'utf8'); } catch { fail(`${file}: Datei nicht gefunden.`); }

  const imports = [], exports = [];
  code = code.replace(IMPORT, (_, list, q, from) => {
    if (!from.startsWith('./') && !from.startsWith('../')) fail(`${file}: Import von "${from}" geht nicht. Erlaubt sind nur relative Pfade wie './datei.js'.`);
    imports.push({ names: names(list, file, 'import'), path: resolve(dirname(path), from), from });
    return '';
  });
  code = code.replace(EXPORT, (_, list) => { exports.push(...names(list, file, 'export')); return ''; });

  // Was jetzt noch nach import oder export aussieht, ist eine nicht erlaubte Form.
  const rest = code.match(/^[ \t]*(import|export)\b.*$/m);
  if (rest) fail(`${file}: Diese Zeile versteht der Build nicht:\n  ${rest[0].trim()}\nErlaubt sind nur  import {a, b} from './datei.js';  und  export {a, b};`);
  if (/\bimport\s*\(/.test(code)) fail(`${file}: import() zur Laufzeit ist nicht erlaubt.`);

  for (const n of exports) {
    const reassignable = new RegExp(`\\b(?:let|var)\\s+(?:[\\w$]+\\s*(?:=[^,;]*)?,\\s*)*${n.replace(/\$/g, '\\$')}\\b`);
    if (reassignable.test(code)) fail(`${file}: "${n}" wird exportiert, ist aber mit let oder var angelegt. Exportierte Namen müssen const oder function sein.`);
  }
  const twice = exports.find((n, i) => exports.indexOf(n) !== i);
  if (twice) fail(`${file}: "${twice}" wird zweimal exportiert.`);

  return { path, file, code: code.replace(/^\n+/, '').replace(/\s+$/, ''), imports, exports };
}

// Führt das Modul entry und alle seine Importe zu einem Skript zusammen.
// Jedes Modul wird eine eigene Funktion, die ihre Exporte zurückgibt. Reihenfolge: erst die Importe, dann das Modul selbst.
export function bundle(entry, srcDir = SRC) {
  const mods = new Map(), order = [], open = [];
  (function visit(path) {
    if (open.includes(path)) {
      const loop = [...open.slice(open.indexOf(path)), path].map(p => relative(srcDir, p).split(sep).join('/'));
      fail(`Importe im Kreis: ${loop.join(' → ')}`);
    }
    if (mods.has(path)) return;
    const m = parse(path, srcDir);
    open.push(path);
    for (const im of m.imports) visit(im.path);
    open.pop();
    mods.set(path, m);
    order.push(m);
  })(resolve(srcDir, entry));

  const id = m => `__mod${order.indexOf(m)}`;
  const parts = order.map(m => {
    const head = m.imports.map(im => {
      const dep = mods.get(im.path);
      const missing = im.names.find(n => !dep.exports.includes(n));
      if (missing) fail(`${m.file}: "${missing}" wird aus ${im.from} importiert, aber ${dep.file} exportiert das nicht.`);
      return `const {${im.names.join(',')}}=${id(dep)};\n`;
    }).join('');
    return `/* ---------- ${m.file} ---------- */\nconst ${id(m)}=(function(){\n${head}${m.code}\nreturn {${m.exports.join(',')}};\n})();`;
  });
  const out = `(function(){\n'use strict';\n${parts.join('\n\n')}\n})();`;

  try { new vm.Script(out); }
  catch (e) { fail(`Das zusammengeführte Skript ist kein gültiges JavaScript: ${e.message}`); }
  return out;
}

export function build(srcDir = SRC) {
  const template = readFileSync(join(srcDir, 'index.html'), 'utf8');
  // Ersetzung per Funktion, damit Zeichen wie $ im eingesetzten Text nichts auslösen.
  return template
    .replace(/^[ \t]*\/\*@include ([\w./-]+)\*\/[ \t]*$/gm, (_, name) => readFileSync(join(srcDir, name), 'utf8').replace(/\n$/, ''))
    .replace(/^[ \t]*\/\*@bundle ([\w./-]+)\*\/[ \t]*$/gm, (_, name) => bundle(name, srcDir));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let html;
  try { html = build(); }
  catch (e) { console.error('Build abgebrochen.\n' + e.message); process.exit(1); }
  if (process.argv.includes('--check')) {
    let current = '';
    try { current = readFileSync(OUT, 'utf8'); } catch {}
    if (current !== html) {
      console.error('index.html passt nicht zu src/. Bitte "node build.mjs" ausführen.');
      process.exit(1);
    }
    console.log('index.html ist aktuell.');
  } else {
    writeFileSync(OUT, html);
    console.log(`index.html gebaut (${html.length} Zeichen).`);
  }
}
