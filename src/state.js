/* ================= Zustand ================= */
const $=id=>document.getElementById(id);
const DEF={key:0,mode:'dur',n:4,bpm:84,swing:55,spice:35,feel:'comp',nine:1,volR:80,volB:60,volD:45,loop:[],locks:[]};
let S=Object.assign({},DEF),favs=[],hist=[],recent=[],voiced=[],active=-1;
const LS='blueseven.v1';
function save(){try{localStorage.setItem(LS,JSON.stringify({S,favs}));}catch(e){}}
function load(d){
  let src=d&&d.S?d:null;
  if(!src){try{src=JSON.parse(localStorage.getItem(LS)||'null');}catch(e){}}
  if(src&&src.S){
    S=Object.assign({},DEF,src.S);favs=Array.isArray(src.favs)?src.favs:[];
    if(!POOL[S.mode])S.mode='dur';
    S.n=S.n===3?3:4;
    if(!Array.isArray(S.loop)||S.loop.length!==S.n||S.loop.some(id=>!byId(S.mode,id)))S.loop=[];
  }
  S.locks=Array.from({length:S.n},(_,i)=>!!(S.locks&&S.locks[i]&&S.loop[i]));
}
const keyName=()=>(useSharps(S.key,S.mode)?NOTE_SHARP:NOTE_FLAT)[S.key]+(S.mode==='dur'?'-Dur':'-Moll');
function revoice(){voiced=voiceLoop(S.loop.map(id=>byId(S.mode,id)),S.key,S.mode,S.nine);}
function pushHist(){if(S.loop.length){hist.push({key:S.key,mode:S.mode,n:S.n,loop:S.loop.slice()});if(hist.length>30)hist.shift();}}
function newLoop(){
  S.loop=generate(S,recent);
  recent.push(S.loop.join('-'));if(recent.length>12)recent.shift();
  revoice();render();save();
}

