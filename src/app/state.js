/* ================= Zustand ================= */
import {MODES,noteName} from '../core/notes.js';
import {normalize} from '../core/params.js';
import {randomSeed} from '../core/rng.js';
import {registry} from './modules.js';

const $=id=>document.getElementById(id);
// Seit Phase 4 zusätzlich: chordGen und style (gewählte Module), sp (Stilparameter pro Stil) und mix
// (Mixer des aktuellen Songs, erst vorhanden, wenn der Nutzer etwas verstellt hat). Seit Phase 5: seed (Zufallsstartwert
// des Songs) und ov (Adressen, die der Nutzer gesetzt hat und die Vorrang vor der Automation haben).
// Die alten Felder behalten ihre Bedeutung.
const DEF={key:0,mode:'dur',n:4,bpm:84,swing:55,spice:35,feel:'comp',nine:1,volR:80,volB:60,volD:45,loop:[],locks:[],chordGen:'jazzy',style:'jazzy-beats'};
// Exportierte Namen werden nie neu zugewiesen, nur ihr Inhalt ändert sich. So sehen alle Module denselben Stand.
// chords sind die Akkorde der aktuellen Folge im Format blueseven.chords, recent die zuletzt erzeugten Folgen.
const S=Object.assign({},DEF),favs=[],hist=[],recent=[],chords=[];
let current=null;   // die ganze aktuelle Folge, nur über progression() lesbar
// läuft gerade etwas, und welcher Akkord ist dran. fixed: ein geladener Song {song, ov, orig}, der statt des
// Generators gespielt wird (Phase 6). ov sind die von Hand gesetzten Adressen, orig der Stand beim Laden.
const run={playing:false,active:-1,fixed:null,exporting:false};
const LS='blueseven.v1';

/* ---------- Akkord-Generator ---------- */
const chordGen=()=>registry.get('chords',S.chordGen)||registry.list('chords')[0];
const genParams=()=>normalize(chordGen().params,{n:S.n,spice:S.spice,nine:S.nine});
// Unter blueseven.v1 und in den gemerkten Folgen steht eine Folge als Liste von Stufen-IDs.
// Das hier macht daraus wieder eine Akkordfolge: über update des Generators, der nur die IDs liest.
function fromIds(ids,key,mode){
  if(!ids.length)return null;
  return chordGen().update({chords:ids.map(id=>({source:{id}}))},genParams(),{key,mode});
}
const idsOf=p=>p.chords.map(c=>c.source.id);
/* ---------- Stil ---------- */
const styleMod=()=>registry.get('styles',S.style)||registry.list('styles')[0];
// Parameter des gewählten Stils. Die Spielweise von Jazzy Beats steht weiter in S.feel, alles andere unter S.sp.
function styleParams(){
  const st=styleMod(),own=S.sp&&S.sp[st.id];
  return normalize(st.params||[],Object.assign({},own,st.id==='jazzy-beats'?{feel:S.feel}:null));
}
function setStyleParam(id,value){
  const st=styleMod();
  if(st.id==='jazzy-beats'&&id==='feel'){S.feel=value;return;}
  S.sp=S.sp||{};(S.sp[st.id]=S.sp[st.id]||{})[id]=value;
}
// Basston eines Akkords als MIDI-Note in der tiefen Oktave.
const bassNote=c=>36+(c.bass===undefined?c.root:c.bass);

function save(){try{localStorage.setItem(LS,JSON.stringify({S,favs}));}catch(e){}}
function load(d){
  let src=d&&d.S?d:null;
  if(!src){try{src=JSON.parse(localStorage.getItem(LS)||'null');}catch(e){}}
  if(src&&src.S){
    for(const k in S)delete S[k];Object.assign(S,DEF,src.S);
    favs.length=0;if(Array.isArray(src.favs))favs.push(...src.favs);
    if(!MODES.includes(S.mode))S.mode='dur';
    S.n=S.n===3?3:4;
    if(!registry.has('chords',S.chordGen))S.chordGen=DEF.chordGen;
    if(!registry.has('styles',S.style))S.style=DEF.style;
    if(!S.mix||typeof S.mix!=='object'||Array.isArray(S.mix))delete S.mix;
    if(!S.sp||typeof S.sp!=='object'||Array.isArray(S.sp))delete S.sp;
    if(!Array.isArray(S.ov))delete S.ov;
    if(!S.wav||typeof S.wav!=='object'||Array.isArray(S.wav))delete S.wav;
    if(!Array.isArray(S.loop)||S.loop.length!==S.n||!fromIds(S.loop,S.key,S.mode))S.loop=[];
  }
  S.locks=Array.from({length:S.n},(_,i)=>!!(S.locks&&S.locks[i]&&S.loop[i]));
  // Zufallsstartwert des Songs: Stile, die würfeln, liefern damit bei jeder Änderung denselben Song.
  if(typeof S.seed!=='number'||!Number.isFinite(S.seed))S.seed=randomSeed();
}
const keyLabel=(key,mode)=>noteName(key,key,mode)+(mode==='dur'?'-Dur':'-Moll');
const keyName=()=>keyLabel(S.key,S.mode);
// Tempo und Swing dessen, was gerade gilt: des geladenen Songs oder der Einstellungen für den Generator.
const tempo=()=>run.fixed?run.fixed.song.tempo:{bpm:S.bpm,swing:S.swing};
// Übernimmt eine Akkordfolge als aktuelle Folge.
function setProg(p){current=p||null;chords.length=0;if(p)chords.push(...p.chords);}
// Die aktuelle Folge im Format blueseven.chords, oder null.
const progression=()=>current;
// Die aktuelle Folge neu ausgeben, zum Beispiel nach Tonartwechsel oder None an/aus.
function revoice(){setProg(fromIds(S.loop,S.key,S.mode));}
function pushHist(){if(S.loop.length){hist.push({key:S.key,mode:S.mode,n:S.n,loop:S.loop.slice()});if(hist.length>30)hist.shift();}}

export {$,S,favs,hist,recent,chords,run,chordGen,genParams,styleMod,styleParams,setStyleParam,fromIds,idsOf,bassNote,save,load,keyLabel,keyName,tempo,setProg,progression,revoice,pushHist};

