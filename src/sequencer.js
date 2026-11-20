/* ================= Ablauf ================= */
import {$,S,voiced,run} from './state.js';
import {setActive,showNotes} from './ui.js';
import {initAudio,rhodes,bass,kick,hat,rim,audioNow,latency,prune,cancelFade,fadeOut} from './audio.js';

let timer=0,nextBar=0,barIdx=0,queue=[];
function scheduleBar(t0,i){
  const spb=60/S.bpm,sw=S.swing/100*spb/6,n=voiced.length;
  const T=b=>t0+b*spb+(Math.round(b*2)%2?sw:0);     // Achtel zwischen den Schlägen kommen etwas später
  const v=voiced[i%n],nx=voiced[(i+1)%n];
  if(S.feel==='pad')v.notes.forEach((m,k)=>rhodes(m,T(0)+k*.016,3.8*spb,.6+(k===3?.1:0)));
  else if(S.feel==='comp')[[0,1.3,.75],[1.5,.7,.52],[2.5,1.25,.66]].forEach(([b,d,ve])=>v.notes.forEach((m,k)=>rhodes(m,T(b)+k*.008,d*spb,ve+(k===3?.08:0))));
  else[0,1,2,3,2,1,2,3].forEach((k,j)=>rhodes(v.notes[k],T(j/2),1.7*spb,j%2?.5:.7));
  bass(v.bass,T(0),2.2*spb,.9);bass(v.bass,T(2.5),.7*spb,.7);bass(nx.bass-1,T(3.5),.4*spb,.6);
  for(let j=0;j<8;j++)hat(T(j/2),j%2?.4:.7);
  kick(T(0),1);kick(T(2.5),.75);rim(T(1),.7);rim(T(3),.8);
  queue.push({t:t0,i:i%n});
}
function tick(){
  const now=audioNow();
  prune();
  while(nextBar<now+.6){scheduleBar(nextBar,barIdx);nextBar+=240/S.bpm;barIdx=(barIdx+1)%voiced.length;}
}
function frame(){
  if(!run.playing)return;
  const now=audioNow()-latency();
  while(queue.length>1&&queue[1].t<=now)queue.shift();
  const cur=queue.length&&queue[0].t<=now?queue[0].i:-1;
  if(cur!==run.active)setActive(cur);
  requestAnimationFrame(frame);
}
function start(){
  if(!initAudio())return;
  cancelFade();
  run.playing=true;queue=[];barIdx=0;nextBar=audioNow()+.15;
  tick();timer=setInterval(tick,50);requestAnimationFrame(frame);
  $('playTxt').textContent='Stop';$('playIco').innerHTML='<path d="M6 5h12v14H6z"/>';
}
function stop(){
  run.playing=false;clearInterval(timer);queue=[];
  fadeOut();
  setActive(-1);
  $('playTxt').textContent='Play';$('playIco').innerHTML='<path d="M7 4v16l13-8z"/>';
}
function audition(i){
  if(!initAudio())return;
  cancelFade();
  const v=voiced[i],t=audioNow()+.03;
  v.notes.forEach((m,k)=>rhodes(m,t+k*.02,1.6,.7));bass(v.bass,t,1.4,.8);
  document.querySelectorAll('.tile').forEach((el,j)=>el.classList.toggle('on',j===i));showNotes(i);
}


export {start,stop,audition};
