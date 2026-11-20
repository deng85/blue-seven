/* ================= Registry ================= */
/* Das Verzeichnis aller Module, die die App anbietet. Es wird an genau einer Stelle gefüllt
   und ist der einzige Weg, auf dem die Engine an Instrumente und Effekte kommt.

     const registry=createRegistry({chords:[jazzy], styles:[jazzyBeats], instruments:[rhodes], effects:[reverb]});
     registry.get('styles','jazzy-beats');     // ein Modul oder undefined
     registry.list('chords');                  // alle Akkord-Generatoren in der angegebenen Reihenfolge */

import {checkSpecs} from './params.js';

// Die Arten von Modulen und der Name des Felds, das ein Modul eindeutig benennt.
const KINDS={chords:'id',styles:'id',instruments:'type',effects:'type'};
const KIND_NAMES={chords:'Akkord-Generator',styles:'Stil',instruments:'Instrument',effects:'Effekt'};

function createRegistry(groups){
  const store={};
  for(const kind in KINDS)store[kind]=new Map();
  for(const kind in groups||{}){
    const key=KINDS[kind];
    if(!key)throw new Error(`Registry: unbekannte Modulart „${kind}“. Erlaubt sind ${Object.keys(KINDS).join(', ')}.`);
    for(const m of groups[kind]){
      const name=m&&m[key];
      if(typeof name!=='string'||!/^[a-z][a-z0-9-]*$/.test(name))throw new Error(`Registry: Ein ${KIND_NAMES[kind]} braucht das Feld ${key} in Kleinbuchstaben, Ziffern und Bindestrichen.`);
      if(store[kind].has(name))throw new Error(`Registry: ${KIND_NAMES[kind]} „${name}“ ist doppelt eingetragen.`);
      if(typeof m.name!=='string'||!m.name)throw new Error(`Registry: ${KIND_NAMES[kind]} „${name}“ braucht einen Namen für die Anzeige.`);
      const errors=checkSpecs(m.params||[]);
      if(errors.length)throw new Error(`Registry: ${KIND_NAMES[kind]} „${name}“ hat fehlerhafte Parameter.\n  ${errors.join('\n  ')}`);
      store[kind].set(name,m);
    }
  }
  const of=kind=>{
    if(!store[kind])throw new Error(`Registry: unbekannte Modulart „${kind}“.`);
    return store[kind];
  };
  return {
    get:(kind,name)=>of(kind).get(name),
    has:(kind,name)=>of(kind).has(name),
    list:kind=>[...of(kind).values()]
  };
}

export {createRegistry};
