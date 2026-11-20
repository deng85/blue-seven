/* ================= Bedienung ================= */
import {$,S,favs,hist,recent,run,chordGen,genParams,fromIds,idsOf,save,load,setProg,revoice,pushHist,styleMod,setStyleParam} from './state.js';
import {buildKeys,render,renderFavs,renderModules} from './ui.js';
import {renderMixer,bindMixer} from './ui-mixer.js';
import {readControl} from './ui-params.js';
import {randomSeed} from '../core/rng.js';
import {start,stop,audition,refresh,setMix,resetMix,currentSong,jump} from './player.js';

function newLoop(){
  const p=chordGen().generate(genParams(),{key:S.key,mode:S.mode,rnd:Math.random,previous:fromIds(S.loop,S.key,S.mode),locked:S.locks,avoid:recent});
  S.loop=idsOf(p);setProg(p);refresh();
  recent.push(p);if(recent.length>12)recent.shift();
  render();save();
}
function bind(){
  $('keys12').innerHTML=['C','D♭','D','E♭','E','F','F♯','G','A♭','A','B♭','B'].map((n,i)=>`<button data-v="${i}">${n}</button>`).join('');
  $('tiles').addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;const i=+b.dataset.i;
    if(b.classList.contains('lock')){S.locks[i]=!S.locks[i];render();save();}
    else if(!run.playing)audition(i);
  });
  $('play').addEventListener('click',()=>run.playing?stop():start());
  $('gen').addEventListener('click',()=>{pushHist();newLoop();});
  $('back').addEventListener('click',()=>{
    const h=hist.pop();if(!h)return;
    S.key=h.key;S.mode=h.mode;S.n=h.n;S.loop=h.loop;S.locks=Array(S.n).fill(false);revoice();refresh();render();save();
  });
  $('fav').addEventListener('click',()=>{
    const f={key:S.key,mode:S.mode,loop:S.loop.slice()},same=x=>x.key===f.key&&x.mode===f.mode&&x.loop.join()===f.loop.join();
    if(!favs.some(same)){favs.unshift(f);if(favs.length>24)favs.pop();}
    renderFavs();save();$('hint').textContent='Gemerkt. Die Folge liegt unten bei den gemerkten Folgen.';
  });
  $('favs').addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;const i=+b.dataset.i;
    if(b.classList.contains('del'))favs.splice(i,1);
    else{const f=favs[i];pushHist();S.key=f.key;S.mode=f.mode;S.n=f.loop.length;S.loop=f.loop.slice();S.locks=Array(S.n).fill(false);revoice();refresh();}
    render();save();
  });
  $('segN').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||+b.dataset.v===S.n)return;
    pushHist();S.n=+b.dataset.v;S.loop=S.loop.slice(0,S.n);S.locks=Array.from({length:S.n},(_,i)=>!!S.locks[i]&&!!S.loop[i]);newLoop();});
  $('segMode').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.dataset.v===S.mode)return;
    pushHist();S.mode=b.dataset.v;S.loop=[];S.locks=Array(S.n).fill(false);newLoop();});
  // Stilparameter: Die Regler kommen aus der Parameterbeschreibung des Stils. Sie gelten ab dem nächsten Takt.
  const styleControl=e=>{
    const t=e.target.closest('[data-style-param]'),b=e.target.closest('button');
    if(!t||e.type==='click'&&!b)return;
    const p=styleMod().params.find(x=>x.id===t.dataset.styleParam);
    setStyleParam(p.id,readControl(p,e.type==='click'?b:t));refresh();save();
  };
  $('styleParams').addEventListener('click',styleControl);
  $('styleParams').addEventListener('input',styleControl);
  // Ein anderer Stil ist ein neuer Song: Er beginnt mit den Standardwerten des Stils im Mixer (F-P10).
  $('selStyle').addEventListener('change',e=>{
    S.style=e.target.value;delete S.mix;delete S.ov;
    const tp=styleMod().tempo;if(tp){S.bpm=tp.default;S.swing=tp.swing;}
    renderModules();refresh();renderMixer(currentSong());render();save();
  });
  // Gleiche Akkordfolge, neu gewürfelter Stil. Es bleibt derselbe Song, der Mixer bleibt (F-U9).
  $('rebuild').addEventListener('click',()=>{S.seed=randomSeed();refresh();save();});
  // Antippen eines Abschnitts springt dorthin.
  $('songBody').addEventListener('click',e=>{const b=e.target.closest('button[data-beat]');if(b)jump(+b.dataset.beat);});
  // Ein anderer Akkord-Generator würfelt eine neue Folge. Zurück gilt nur innerhalb eines Generators.
  $('selChords').addEventListener('change',e=>{S.chordGen=e.target.value;hist.length=0;recent.length=0;S.loop=[];S.locks=Array(S.n).fill(false);newLoop();});
  bindMixer({
    set(address,value){setMix(address,value);save();},
    song:currentSong,
    reset(path){resetMix(path);renderMixer(currentSong());save();}
  });
  $('segNine').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;S.nine=+b.dataset.v;revoice();refresh();render();save();});
  $('keys12').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;S.key=+b.dataset.v;revoice();refresh();render();save();});
  // Tempo und Swing gelten ab dem nächsten Takt. Würze wirkt erst bei der nächsten Folge.
  for(const id of ['spice','bpm','swing'])$(id).addEventListener('input',e=>{
    S[id]=+e.target.value;
    if(id!=='spice')refresh();
    render();save();
  });
}
function boot(d){
  load(d);buildKeys();renderModules();bind();
  if(S.loop.length){revoice();refresh();render();}else newLoop();
  renderMixer(currentSong());
}
if(window.claude&&window.claude.hot){
  window.claude.hot.snapshot&&window.claude.hot.snapshot(()=>({S,favs}));
  window.claude.hot.ready?window.claude.hot.ready(boot):boot(window.claude.hot.data||{});
}else boot({});
