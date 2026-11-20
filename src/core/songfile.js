/* ================= Songs lesen, schreiben und sammeln ================= */
/* Alles, was zum Sichern von Songs gehört und ohne Browser auskommt: einen Song aus Text lesen und prüfen,
   ältere Formatversionen auf die aktuelle heben (F-V2), einen Song zum Weitergeben fertig machen und die Liste
   der gespeicherten Songs pflegen. Speichern im Browser und Dateien liegen in app/songs.js. */
import {CHORDS_FORMAT,SONG_FORMAT,SONG_VERSION,checkSong} from './format.js';

// Migrationen: unter n steht die Funktion, die einen Song von Version n auf n+1 hebt. Sie bekommt eine Kopie und
// gibt den geänderten Song zurück, version setzt migrateSong selbst. Bisher gibt es nur Version 1.
const MIGRATIONS={};
const MAX_SONGS=20,MAX_TEXT=2000000;
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const copy=x=>JSON.parse(JSON.stringify(x));

// Hebt einen Song auf die Zielversion. Wirft einen Fehler mit verständlicher Meldung, wenn das nicht geht.
// table und target sind nur für Tests anders als MIGRATIONS und SONG_VERSION.
function migrateSong(song,table,target){
  const steps=table||MIGRATIONS,goal=target||SONG_VERSION;
  if(!isObj(song))throw new Error('Das ist kein Song: Erwartet wird ein JSON-Objekt.');
  if(song.format===CHORDS_FORMAT)throw new Error('Das ist eine Akkordfolge, kein Song.');
  if(song.format!==SONG_FORMAT)throw new Error('Das ist kein Song von Blue Seven. Das Feld format fehlt oder nennt ein anderes Format.');
  if(!Number.isInteger(song.version)||song.version<1)throw new Error('Der Song nennt keine gültige Formatversion.');
  if(song.version>goal)throw new Error(`Der Song hat Formatversion ${song.version}, diese App versteht nur bis Version ${goal}. Mit einer neueren Version der App lässt er sich laden.`);
  let s=copy(song);
  while(s.version<goal){
    const step=steps[s.version],from=s.version;
    if(!step)throw new Error(`Für Formatversion ${from} gibt es keine Umwandlung.`);
    s=step(s);s.version=from+1;
  }
  return s;
}
// Liest einen Song aus Text oder aus einem Objekt, hebt ihn auf die aktuelle Version und prüft ihn.
// Liefert den Song oder wirft einen Fehler mit einer Meldung für den Nutzer.
function readSong(input){
  let data=input;
  if(typeof input==='string'){
    const text=input.trim();
    if(!text)throw new Error('Da steht nichts. Bitte den Text eines Songs einfügen.');
    if(text.length>MAX_TEXT)throw new Error('Der Text ist zu groß für einen Song.');
    try{data=JSON.parse(text);}
    catch(e){throw new Error('Das ist kein gültiges JSON. Vielleicht fehlt ein Teil des Textes.');}
  }
  const song=migrateSong(data),errors=checkSong(song);
  if(errors.length)throw new Error('Der Song ist ungültig: '+errors.slice(0,3).join(' ')+(errors.length>3?` Und ${errors.length-3} weitere Fehler.`:''));
  return song;
}
// Hinweise auf Instrumente und Effekte, die diese App nicht kennt (F-V5). has(kind, type) fragt die Registry.
function missingModules(song,has){
  const out=[],seen=new Set();
  const note=(kind,type,text)=>{if(has(kind,type)||seen.has(kind+type))return;seen.add(kind+type);out.push(text);};
  for(const t of song.tracks)note('instruments',t.instrument.type,`Das Instrument „${t.instrument.type}“ gibt es in dieser App nicht, die Spur „${t.name||t.id}“ bleibt stumm.`);
  const mx=song.mixer;
  for(const owner of [...mx.channels,...(mx.returns||[]),mx.master])for(const x of owner.inserts||[])
    note('effects',x.type,`Den Effekt „${x.type}“ gibt es in dieser App nicht, er wird übersprungen.`);
  return out;
}
// Macht einen Song zum Sichern fertig: Werte, die der Nutzer von Hand gesetzt hat, stehen schon im Song. Damit sie
// auch nach dem Laden gelten, entfällt die Automation auf diesen Adressen. Mit title bekommt der Song einen Namen.
function packSong(song,overrides,title){
  const s=copy(song),set=new Set(overrides||[]);
  if(Array.isArray(s.automation))s.automation=s.automation.filter(a=>!set.has(a.target));
  if(title){s.meta=isObj(s.meta)?s.meta:{};s.meta.title=title;}
  return s;
}
const titleOf=song=>song&&isObj(song.meta)&&typeof song.meta.title==='string'&&song.meta.title.trim()||'Song';
// Dateiname ohne Zeichen, die ein Dateisystem stören.
function fileName(song){
  const base=titleOf(song).normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/ß/g,'ss').replace(/[^A-Za-z0-9]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase();
  return (base||'song')+'.blueseven.json';
}

/* ---------- Sammlung der gespeicherten Songs ---------- */
// Liest die Sammlung aus dem gespeicherten Text. Unbrauchbare Einträge entfallen, statt die App zu blockieren.
function readLibrary(text){
  const lib={current:null,songs:[]};
  let d=null;
  try{d=JSON.parse(text||'null');}catch(e){}
  if(!isObj(d))return lib;
  const song=x=>{try{return readSong(x);}catch(e){return null;}};
  for(const e of Array.isArray(d.songs)?d.songs:[]){
    const s=isObj(e)&&typeof e.name==='string'&&e.name?song(e.song):null;
    if(s&&lib.songs.length<MAX_SONGS&&!lib.songs.some(x=>x.name===e.name))lib.songs.push({name:e.name,saved:Number(e.saved)||0,song:s});
  }
  if(isObj(d.current)){
    const s=song(d.current.song);
    if(s)lib.current={song:s,ov:Array.isArray(d.current.ov)?d.current.ov.filter(a=>typeof a==='string'):[]};
  }
  return lib;
}
// Legt einen Song unter name in die Sammlung, neueste zuerst. Ein gleichnamiger Song wird ersetzt.
// Liefert 'added', 'replaced' oder 'full' (dann bleibt die Sammlung unverändert).
function putSong(songs,name,song,now){
  const i=songs.findIndex(x=>x.name===name);
  if(i<0&&songs.length>=MAX_SONGS)return 'full';
  if(i>=0)songs.splice(i,1);
  songs.unshift({name,saved:now||0,song:copy(song)});
  return i>=0?'replaced':'added';
}

export {MIGRATIONS,MAX_SONGS,migrateSong,readSong,missingModules,packSong,titleOf,fileName,readLibrary,putSong};
