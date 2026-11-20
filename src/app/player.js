/* ================= Wiedergabe ================= */
/* Verbindet die Bedienung mit der Engine. Baut aus der aktuellen Folge und den Einstellungen den Song,
   startet und stoppt, spielt einen Akkord zum Anhören an und zeigt, welcher Akkord gerade klingt.
   Die Engine selbst kennt die Oberfläche nicht. */
import {$,S,chords,run,progression,bassNote} from './state.js';
import {setActive,showNotes} from './ui.js';
import {registry} from './modules.js';
import {createEngine} from '../engine/engine.js';
import {faderToGain} from '../core/gain.js';

const engine=createEngine(registry);
engine.on('warning',msg=>{$('hint').textContent=msg;});
engine.on('ended',()=>{if(run.playing)stop();});

// Welcher Lautstärkeregler zu welchem Kanal gehört.
const VOLUMES=[['rhodes','volR'],['bass','volB'],['drums','volD']];

function iosUnmute(){
  // iPhone: ein stummes <audio> schaltet Web Audio auch bei aktivem Stummschalter frei
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  if(!ios)return;
  try{
    const n=4000,buf=new ArrayBuffer(44+n),v=new DataView(buf),str=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};
    str(0,'RIFF');v.setUint32(4,36+n,true);str(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
    v.setUint32(24,8000,true);v.setUint32(28,8000,true);v.setUint16(32,1,true);v.setUint16(34,8,true);str(36,'data');v.setUint32(40,n,true);
    for(let i=0;i<n;i++)v.setUint8(44+i,128);
    const a=document.createElement('audio');a.loop=true;a.src=URL.createObjectURL(new Blob([buf],{type:'audio/wav'}));
    const p=a.play();if(p&&p.catch)p.catch(()=>{});
  }catch(e){}
}
// Startet den Ton beim ersten Antippen. Liefert false und zeigt einen Hinweis, wenn das nicht geht.
function initAudio(){
  if(engine.ready())return engine.init();
  try{engine.init();iosUnmute();return true;}
  catch(e){
    $('hint').textContent=e.code==='unsupported'?'Dieser Browser kann keinen Ton erzeugen (Web Audio fehlt).':'Der Ton ließ sich nicht starten. Seite neu laden und noch einmal auf Play tippen.';
    return false;
  }
}

// Der Song zur aktuellen Folge: Stil Jazzy Beats mit Spielweise, Tempo und Swing aus den Einstellungen,
// die Kanalpegel aus den Lautstärkereglern.
function buildSong(){
  const p=progression();
  if(!p)return null;
  const song=registry.get('styles','jazzy-beats').generate(p,{feel:S.feel},{bpm:S.bpm,swing:S.swing,rnd:Math.random});
  for(const [id,key] of VOLUMES){const ch=song.mixer.channels.find(c=>c.id===id);if(ch)ch.gain=faderToGain(S[key]);}
  return song;
}
// Gibt der Engine den Song zur aktuellen Folge. Im Lauf gilt er ab dem nächsten Takt.
function refresh(){
  try{const song=buildSong();if(song)engine.load(song);}
  catch(e){$('hint').textContent=e.message;console.error(e);}
}
function setVolumes(){for(const [id,key] of VOLUMES)engine.setParam(`channel/${id}/gain`,faderToGain(S[key]));}

// Nummer des Akkords, der bei beat im Song klingt, oder -1.
function chordAt(song,beat){
  const list=song.meta&&song.meta.chords&&song.meta.chords.chords;
  if(!list||!list.length||!(song.length>0))return -1;
  const b=(beat%song.length+song.length)%song.length;
  let at=0;
  for(let i=0;i<list.length;i++){at+=list[i].duration;if(b<at)return i;}
  return list.length-1;
}
function frame(){
  if(!run.playing)return;
  const pos=engine.position(),cur=pos?chordAt(pos.song,pos.beat):-1;
  if(cur!==run.active)setActive(cur);
  requestAnimationFrame(frame);
}
function start(){
  if(!initAudio())return;
  if(!engine.play())return;
  run.playing=true;requestAnimationFrame(frame);
  $('playTxt').textContent='Stop';$('playIco').innerHTML='<path d="M6 5h12v14H6z"/>';
}
function stop(){
  run.playing=false;engine.stop();
  setActive(-1);
  $('playTxt').textContent='Play';$('playIco').innerHTML='<path d="M7 4v16l13-8z"/>';
}
// Spielt Akkord i an: die Töne leicht gebrochen auf dem Rhodes, dazu den Basston.
function audition(i){
  if(!initAudio())return;
  const c=chords[i];if(!c)return;
  engine.audition([
    {track:'rhodes',notes:c.voicing.map((m,k)=>({p:m,v:.7,s:1.6,o:k*.02}))},
    {track:'bass',notes:[{p:bassNote(c),v:.8,s:1.4,o:0}]}
  ]);
  document.querySelectorAll('.tile').forEach((el,j)=>el.classList.toggle('on',j===i));showNotes(i);
}

export {start,stop,audition,refresh,setVolumes,chordAt};
