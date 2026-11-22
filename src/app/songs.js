/* ================= Songs sichern ================= */
/* Speichert Songs in diesem Browser, gibt sie als Datei oder Text weiter und lädt sie wieder (F-U10, F-P6).
   Ein geladener Song wird so gespielt, wie er ist, mit seinem eigenen Mixer (F-P11). Solange er offen ist,
   ruht der Generator. Die Songs liegen unter einem eigenen Schlüssel, damit blueseven.v1 klein bleibt. */
import {$,S,run,setProg,revoice} from './state.js';
import {registry} from './modules.js';
import {esc} from './ui-params.js';
import {render,renderModules} from './ui.js';
import {renderMixer} from './ui-mixer.js';
import {currentSong,openSong,closeSong} from './player.js';
import {checkChords} from '../core/format.js';
import {MAX_SONGS,readSong,missingModules,packSong,titleOf,fileName,readLibrary,putSong} from '../core/songfile.js';

const KEY='blueseven.songs.v1';
const songs=[];   // gespeicherte Songs, neueste zuerst: {name, saved, song}
let timer=0;
const HINT='Akkord antippen zum Anhören. Mit „Halten“ bleibt er bei der nächsten Folge stehen.';

const msg=text=>{$('songMsg').textContent=text;};
// Schreibt Sammlung und geladenen Song in den Browser. false, wenn der Speicher voll oder gesperrt ist.
function write(){
  const f=run.fixed;
  try{localStorage.setItem(KEY,JSON.stringify({current:f?{song:f.song,ov:f.ov}:null,songs}));return true;}
  catch(e){return false;}
}
// Hält den geladenen Song nach einer Änderung an Mixer oder Tempo fest, mit etwas Abstand zum Ziehen am Regler.
function storeSong(){
  if(!run.fixed)return;
  clearTimeout(timer);timer=setTimeout(write,400);
}
// Die Akkordfolge eines Songs, wenn sie sich als Kacheln zeigen lässt, sonst null.
function chordsOf(song){
  const c=song.meta&&song.meta.chords,str=x=>typeof x==='string';
  if(!c||checkChords(c).length)return null;
  return c.chords.every(x=>x.label&&str(x.label.roman)&&str(x.label.root)&&str(x.label.suffix)&&Array.isArray(x.voicing))?c:null;
}
// Zeichnet alles neu, nachdem ein Song geöffnet oder geschlossen wurde.
function show(){
  if(run.fixed)setProg(chordsOf(run.fixed.song));else revoice();
  renderModules();render();renderMixer(currentSong());renderList();
  $('hint').textContent=run.fixed?'Dieser Song ist geladen und spielt so, wie er gesichert wurde. Mixer, Effekte und Tempo lassen sich weiter ändern.':HINT;
}
function open(song,ov,text){
  if(!openSong(song,ov)){show();msg('Der Song ließ sich nicht laden.');return;}
  show();write();
  msg([text,...missingModules(song,(kind,type)=>registry.has(kind,type))].join(' '));
  $('loaded').scrollIntoView({block:'nearest'});
}
function close(){
  revoice();closeSong();show();write();
  msg('Song geschlossen. Es gilt wieder der Generator mit deinen Einstellungen.');
}
function tryOpen(text,from){
  let song;
  try{song=readSong(text);}catch(e){msg(e.message);return;}
  open(song,[],`„${titleOf(song)}“ ${from} geladen.`);
}
// Der aktuelle Song zum Sichern, mit dem Namen aus dem Feld. Ohne Namen behält er seinen Titel.
function packed(){
  const song=currentSong();
  return song?packSong(song,run.fixed?run.fixed.ov:S.ov,$('songName').value.trim()):null;
}
function saveCurrent(){
  const song=packed();if(!song)return;
  let name=titleOf(song);
  // Ohne eigenen Namen wird nichts überschrieben: Der Titel bekommt eine Nummer.
  if(!$('songName').value.trim()){
    const base=name;
    for(let n=2;songs.some(x=>x.name===name);n++)name=`${base} ${n}`;
    song.meta.title=name;
  }
  const before=songs.slice(),r=putSong(songs,name,song,Date.now());
  if(r==='full'){msg(`Es sind schon ${MAX_SONGS} Songs gespeichert. Bitte erst einen löschen oder als Datei sichern.`);return;}
  if(!write()){
    songs.length=0;songs.push(...before);
    msg('Der Speicher des Browsers ist voll oder gesperrt, der Song wurde nicht gespeichert. Als Datei sichern geht trotzdem.');return;
  }
  $('songName').value='';renderList();
  msg(r==='replaced'?`„${name}“ überschrieben.`:`Gespeichert als „${name}“.`);
}
function download(){
  const song=packed();if(!song)return;
  const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(song)],{type:'application/json'}));
  a.href=url;a.download=fileName(song);document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
  msg(`Die Datei ${fileName(song)} liegt bei den Downloads.`);
}
function copyText(){
  const song=packed();if(!song)return;
  const text=JSON.stringify(song),done=()=>msg('Der Song liegt als Text in der Zwischenablage.');
  // Ohne Zugriff auf die Zwischenablage steht der Text markiert im Feld zum Kopieren von Hand.
  const byHand=()=>{
    const t=$('songText');$('pasteBox').open=true;t.value=text;t.focus();t.select();
    let ok=false;try{ok=document.execCommand('copy');}catch(e){}
    if(ok)done();else msg('Kopieren ging nicht von allein. Der Text steht unten im Feld und ist markiert.');
  };
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(done,byHand);else byHand();
}
function readFile(file){
  if(!file)return;
  if(file.size>2000000){msg('Die Datei ist zu groß für einen Song.');return;}
  const r=new FileReader();
  r.onload=()=>tryOpen(String(r.result),'aus der Datei');
  r.onerror=()=>msg('Die Datei ließ sich nicht lesen.');
  r.readAsText(file);
}
const clock=s=>{const n=Math.round(s);return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');};
function renderList(){
  const el=$('songList');
  if(!songs.length){el.innerHTML='';return;}
  el.innerHTML=songs.map((e,i)=>{
    const s=e.song,len=s.loop?'Loop':clock(s.length*60/s.tempo.bpm);
    return `<div class="fav"><button class="load" data-i="${i}"><b>${esc(e.name)}</b><span>${Math.round(s.tempo.bpm)} BPM · ${len}</span></button>`+
      `<button class="del" data-i="${i}" aria-label="${esc(e.name)} löschen">×</button></div>`;
  }).join('');
}
// Liest die Sammlung, öffnet den zuletzt geladenen Song wieder (F-P12) und verbindet die Bedienung.
function initSongs(){
  let text=null;
  try{text=localStorage.getItem(KEY);}catch(e){}
  const lib=readLibrary(text);
  songs.length=0;songs.push(...lib.songs);
  $('saveSong').addEventListener('click',saveCurrent);
  $('exportFile').addEventListener('click',download);
  $('copySong').addEventListener('click',copyText);
  $('importFile').addEventListener('click',()=>$('songFile').click());
  $('songFile').addEventListener('change',e=>{readFile(e.target.files[0]);e.target.value='';});
  $('loadText').addEventListener('click',()=>tryOpen($('songText').value,'aus dem Text'));
  $('closeSong').addEventListener('click',close);
  $('songList').addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;const i=+b.dataset.i,entry=songs[i];if(!entry)return;
    if(b.classList.contains('del')){songs.splice(i,1);write();renderList();msg(`„${entry.name}“ gelöscht.`);}
    else open(JSON.parse(JSON.stringify(entry.song)),[],`„${entry.name}“ geladen.`);
  });
  if(lib.current&&openSong(lib.current.song,lib.current.ov))show();else renderList();
}

export {initSongs,storeSong};
