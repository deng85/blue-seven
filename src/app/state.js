/* ================= Zustand ================= */
import {NOTE_FLAT,NOTE_SHARP,POOL,byId,useSharps,voiceLoop} from '../harmony.js';

const $=id=>document.getElementById(id);
const DEF={key:0,mode:'dur',n:4,bpm:84,swing:55,spice:35,feel:'comp',nine:1,volR:80,volB:60,volD:45,loop:[],locks:[]};
// Exportierte Namen werden nie neu zugewiesen, nur ihr Inhalt ändert sich. So sehen alle Module denselben Stand.
const S=Object.assign({},DEF),favs=[],hist=[],recent=[],voiced=[];
const run={playing:false,active:-1};   // läuft gerade etwas, und welcher Akkord ist dran
const LS='blueseven.v1';
function save(){try{localStorage.setItem(LS,JSON.stringify({S,favs}));}catch(e){}}
function load(d){
  let src=d&&d.S?d:null;
  if(!src){try{src=JSON.parse(localStorage.getItem(LS)||'null');}catch(e){}}
  if(src&&src.S){
    for(const k in S)delete S[k];Object.assign(S,DEF,src.S);
    favs.length=0;if(Array.isArray(src.favs))favs.push(...src.favs);
    if(!POOL[S.mode])S.mode='dur';
    S.n=S.n===3?3:4;
    if(!Array.isArray(S.loop)||S.loop.length!==S.n||S.loop.some(id=>!byId(S.mode,id)))S.loop=[];
  }
  S.locks=Array.from({length:S.n},(_,i)=>!!(S.locks&&S.locks[i]&&S.loop[i]));
}
const keyName=()=>(useSharps(S.key,S.mode)?NOTE_SHARP:NOTE_FLAT)[S.key]+(S.mode==='dur'?'-Dur':'-Moll');
function revoice(){voiced.length=0;voiced.push(...voiceLoop(S.loop.map(id=>byId(S.mode,id)),S.key,S.mode,S.nine));}
function pushHist(){if(S.loop.length){hist.push({key:S.key,mode:S.mode,n:S.n,loop:S.loop.slice()});if(hist.length>30)hist.shift();}}

export {$,S,favs,hist,recent,voiced,run,save,load,keyName,revoice,pushHist};

