// Baut aus src/ wieder eine einzelne index.html. Keine Abhängigkeiten, nur Node.
//
//   node build.mjs           schreibt index.html
//   node build.mjs --check   prüft nur, ob index.html zum Stand in src/ passt
//
// In src/index.html steht für jede Datei eine Zeile /*@include name*/.
// Diese Zeile wird durch den Inhalt von src/name ersetzt, sonst bleibt alles wie es ist.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src');
const out = join(root, 'index.html');

export function build() {
  const template = readFileSync(join(src, 'index.html'), 'utf8');
  return template.replace(/^[ \t]*\/\*@include ([\w.-]+)\*\/[ \t]*$/gm, (_, name) =>
    readFileSync(join(src, name), 'utf8').replace(/\n$/, ''));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const html = build();
  if (process.argv.includes('--check')) {
    let current = '';
    try { current = readFileSync(out, 'utf8'); } catch {}
    if (current !== html) {
      console.error('index.html passt nicht zu src/. Bitte "node build.mjs" ausführen.');
      process.exit(1);
    }
    console.log('index.html ist aktuell.');
  } else {
    writeFileSync(out, html);
    console.log(`index.html gebaut (${html.length} Zeichen).`);
  }
}
