/* ================= Parameterbeschreibung ================= */
/* Generatoren, Instrumente und Effekte beschreiben ihre Parameter alle im selben Format:

     {id:'frequency', name:'Grenzfrequenz', type:'number', min:80, max:12000, step:1, default:3600, unit:'Hz', curve:'exp'}
     {id:'feel', name:'Spielweise', type:'enum', default:'comp', options:[{value:'pad', name:'Liegend'}, …]}
     {id:'nine', name:'Mit None', type:'bool', default:true}

   Die Oberfläche baut daraus die Regler, und hier werden Werte damit geprüft. */

const TYPES=['number','enum','bool'];
const CURVES=['lin','exp'];
const isNum=v=>typeof v==='number'&&Number.isFinite(v);

// Prüft eine Liste von Parameterbeschreibungen. Liefert eine Liste verständlicher Fehler, leer heißt in Ordnung.
function checkSpecs(specs){
  if(!Array.isArray(specs))return ['Die Parameterbeschreibung muss eine Liste sein.'];
  const errors=[],seen=[];
  specs.forEach((p,i)=>{
    const where=p&&typeof p.id==='string'&&p.id?`Parameter „${p.id}“`:`Parameter Nr. ${i+1}`;
    const err=msg=>errors.push(`${where}: ${msg}`);
    if(!p||typeof p!=='object'){err('ist kein Objekt.');return;}
    if(typeof p.id!=='string'||!/^[A-Za-z][\w-]*$/.test(p.id))err('braucht eine id aus Buchstaben, Ziffern, - und _.');
    else if(seen.includes(p.id))err('kommt doppelt vor.');
    else seen.push(p.id);
    if(typeof p.name!=='string'||!p.name)err('braucht einen Namen für die Anzeige.');
    if(!TYPES.includes(p.type)){err(`hat den unbekannten Typ „${p.type}“. Erlaubt sind ${TYPES.join(', ')}.`);return;}
    if(p.type==='number'){
      if(!isNum(p.min)||!isNum(p.max)||p.min>p.max)err('braucht min und max als Zahlen, mit min nicht größer als max.');
      else if(!isNum(p.default)||p.default<p.min||p.default>p.max)err('braucht einen Standardwert zwischen min und max.');
      if(p.step!==undefined&&(!isNum(p.step)||p.step<=0))err('hat eine ungültige Schrittweite.');
      if(p.curve!==undefined&&!CURVES.includes(p.curve))err(`hat die unbekannte Kurve „${p.curve}“.`);
      if(p.curve==='exp'&&isNum(p.min)&&p.min<=0)err('kann mit Kurve exp nicht bei 0 oder darunter beginnen.');
    }else if(p.type==='enum'){
      const ok=Array.isArray(p.options)&&p.options.length>0&&p.options.every(o=>o&&o.value!==undefined&&typeof o.name==='string'&&o.name);
      if(!ok)err('braucht options als Liste aus {value, name}.');
      else if(new Set(p.options.map(o=>o.value)).size!==p.options.length)err('hat eine Option doppelt.');
      else if(!p.options.some(o=>o.value===p.default))err('braucht einen Standardwert, der unter den Optionen vorkommt.');
    }else if(typeof p.default!=='boolean')err('braucht true oder false als Standardwert.');
  });
  return errors;
}

// Bringt einen einzelnen Wert in den erlaubten Bereich. Unbrauchbare Werte werden zum Standardwert.
function normalizeValue(p,v){
  if(p.type==='number'){
    if(!isNum(v))return p.default;
    if(p.step)v=p.min+Math.round((v-p.min)/p.step)*p.step;
    v=Math.min(p.max,Math.max(p.min,v));
    return p.step?+v.toFixed(10):v;                 // Rundungsreste wie 0.30000000000000004 vermeiden
  }
  if(p.type==='enum')return p.options.some(o=>o.value===v)?v:p.default;
  return typeof v==='boolean'?v:(v===0||v===1?!!v:p.default);
}
// Die Standardwerte als Objekt {id: wert}.
function defaults(specs){const out={};for(const p of specs)out[p.id]=p.default;return out;}
// Füllt fehlende Werte mit dem Standard und begrenzt alle anderen. Unbekannte Werte fallen weg.
function normalize(specs,values){
  const out={},src=values&&typeof values==='object'?values:{};
  for(const p of specs)out[p.id]=p.id in src?normalizeValue(p,src[p.id]):p.default;
  return out;
}

export {checkSpecs,normalizeValue,defaults,normalize};
