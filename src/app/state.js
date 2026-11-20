/* ================= Zustand ================= */
import {MODES,noteName} from '../core/notes.js';
import {normalize} from '../core/params.js';
import {registry} from './modules.js';

const $=id=>document.getElementById(id);
const DEF={key:0,mode:'dur',n:4,bpm:84,swing:55,spice:35,feel:'comp',nine:1,volR:80,volB:60,volD:45,loop:[],locks:[]};
// Exportierte Namen werden nie neu zugewiesen, nur ihr Inhalt ändert sich. So sehen alle Module denselben Stand.
// chords sind die Akkorde der aktuellen Folge im Format blueseven.chords, recent die zuletzt erzeugten Folgen.
const S=Object.assign({},DEF),favs=[],hist=[],recent=[],chords=[];
let current=null;   // die ganze aktuelle Folge, nur über progression() lesbar
const run={playing:false,active:-1};   // läuft gerade etwas, und welcher Akkord ist dran
const LS='blueseven.v1';

/* ---------- Akkord-Generator ---------- */
// Vorerst fest Jazzy. Die Auswahl in der Oberfläche kommt mit Phase 4.
const chordGen=()=>registry.get('chords','jazzy');
const genParams=()=>normalize(chordGen().params,{n:S.n,spice:S.spice,nine:S.nine});
// Unter blueseven.v1 und in den gemerkten Folgen steht eine Folge als Liste von Stufen-IDs.
// Das hier macht daraus wieder eine Akkordfolge: über update des Generators, der nur die IDs liest.
function fromIds(ids,key,mode){
  if(!ids.length)return null;
  return chordGen().update({chords:ids.map(id=>({source:{id}}))},genParams(),{key,mode});
}
const idsOf=p=>p.chords.map(c=>c.source.id);
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
    if(!Array.isArray(S.loop)||S.loop.length!==S.n||!fromIds(S.loop,S.key,S.mode))S.loop=[];
  }
  S.locks=Array.from({length:S.n},(_,i)=>!!(S.locks&&S.locks[i]&&S.loop[i]));
}
const keyLabel=(key,mode)=>noteName(key,key,mode)+(mode==='dur'?'-Dur':'-Moll');
const keyName=()=>keyLabel(S.key,S.mode);
// Übernimmt eine Akkordfolge als aktuelle Folge.
function setProg(p){current=p||null;chords.length=0;if(p)chords.push(...p.chords);}
// Die aktuelle Folge im Format blueseven.chords, oder null.
const progression=()=>current;
// Die aktuelle Folge neu ausgeben, zum Beispiel nach Tonartwechsel oder None an/aus.
function revoice(){setProg(fromIds(S.loop,S.key,S.mode));}
function pushHist(){if(S.loop.length){hist.push({key:S.key,mode:S.mode,n:S.n,loop:S.loop.slice()});if(hist.length>30)hist.shift();}}

export {$,S,favs,hist,recent,chords,run,chordGen,genParams,fromIds,idsOf,bassNote,save,load,keyLabel,keyName,setProg,progression,revoice,pushHist};

