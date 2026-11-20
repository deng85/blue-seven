/* ================= Engine ================= */
/* Spielt jeden gültigen Song ab. Kennt weder die Oberfläche noch den App-Zustand, Instrumente und Effekte
   nur über die Registry.

     const engine=createEngine(registry);
     engine.init();                    // AudioContext anlegen, nur nach einer Nutzeraktion
     engine.load(song);                // Song übernehmen (im Lauf: ab dem nächsten Takt)
     engine.play(); engine.stop();
     engine.setParam('channel/rhodes/gain',.5);
     engine.audition([{track:'rhodes',notes:[{p:60,v:.7,s:1.6,o:0}]}]);
     engine.position();                // {beat, song} oder null
     engine.on('warning',msg=>…); engine.on('ended',()=>…);

   Geplant wird wie bisher taktweise mit Vorausschau: Alle 50 ms wird jeder Takt geplant, der in den
   nächsten 0,6 s beginnt. Tempo, Swing und ein neuer Song wirken deshalb ab dem nächsten Takt. */
import {normalize,normalizeValue} from '../core/params.js';
import {checkSong,checkAddress} from '../core/format.js';
import {notesBetween,structureKey} from './timeline.js';
import {buildMixer} from './mixer.js';

const LOOKAHEAD=.6,TICK_MS=50,START_DELAY=.15,FADE=.015,KILL_MS=90,TAIL_MS=4000;

function createEngine(registry,options){
  const env=Object.assign({
    AudioContext:globalThis.AudioContext||globalThis.webkitAudioContext,
    setInterval:(f,ms)=>setInterval(f,ms),clearInterval:id=>clearInterval(id),
    setTimeout:(f,ms)=>setTimeout(f,ms),clearTimeout:id=>clearTimeout(id)
  },options);
  const listeners={warning:[],ended:[]};
  const emit=(ev,arg)=>listeners[ev].forEach(f=>f(arg));
  const warn=msg=>emit('warning',msg);

  let ac=null,gate=null,graph=null,song=null;
  let playing=false,timer=0,fadeTimer=0,pos=0,nextTime=0,anchors=[],endTime=-1;

  /* ---------- Signalweg ---------- */
  function buildGraph(s){
    // Reihenfolge wie bisher: erst die Effekte (Hall), dann die Instrumente (Rauschen der Drums).
    const mixer=buildMixer(ac,s.mixer,registry,warn);
    mixer.output.connect(gate);
    const tracks=new Map();
    for(const tr of s.tracks){
      const mod=registry.get('instruments',tr.instrument.type);
      if(!mod){warn(`Spur „${tr.name}“ bleibt stumm: Das Instrument „${tr.instrument.type}“ gibt es nicht.`);continue;}
      const inst=mod.create(ac,normalize(mod.params||[],tr.instrument.params));
      inst.output.connect(mixer.channelInput(tr.channel));
      tracks.set(tr.id,{inst,mod});
    }
    return {
      key:structureKey(s),mixer,tracks,
      stopAll(){for(const t of tracks.values())t.inst.stopAll();},
      dispose(){for(const t of tracks.values())t.inst.dispose();mixer.dispose();}
    };
  }
  // Übernimmt den Song in den Signalweg. Bei gleichem Aufbau werden nur Werte nachgeführt,
  // sonst wird neu gebaut und der alte Signalweg klingt aus.
  function attach(next,prev){
    if(!ac)return;
    if(graph&&prev&&graph.key===structureKey(next)){
      const t=ac.currentTime;
      graph.mixer.apply(prev.mixer,next.mixer,t);
      next.tracks.forEach((tr,i)=>{
        const g=graph.tracks.get(tr.id),old=prev.tracks[i].instrument.params||{};
        if(!g)return;
        for(const k in tr.instrument.params||{})if(tr.instrument.params[k]!==old[k])setInstrumentParam(g,k,tr.instrument.params[k],t);
      });
      return;
    }
    const old=graph;
    graph=buildGraph(next);
    if(old){
      if(playing)env.setTimeout(()=>old.dispose(),TAIL_MS);
      else{old.stopAll();old.dispose();}
    }
  }
  function setInstrumentParam(g,id,value,t){
    const p=(g.mod.params||[]).find(x=>x.id===id);
    if(!p)return false;
    g.inst.setParam(id,normalizeValue(p,value),t);return true;
  }

  /* ---------- Ablauf ---------- */
  function scheduleChunk(){
    const s=song,tp=s.tempo,spb=60/tp.bpm,sw=tp.swing/100*spb/6;
    const from=pos,to=Math.min(pos+tp.beatsPerBar,s.length),t0=nextTime;
    for(const n of notesBetween(s,from,to)){
      const g=graph&&graph.tracks.get(n.track);
      if(!g)continue;
      // Wie im bisherigen Ablauf: Achtel zwischen den Schlägen kommen um sw später.
      const t=t0+(n.beat-from)*spb+(Math.round(n.beat*2)%2?sw:0)+n.o;
      g.inst.play({p:n.p,v:n.v},t,n.d*spb);
    }
    anchors.push({time:t0,beat:from,bpm:tp.bpm,song:s});
    nextTime=t0+(to-from)*60/tp.bpm;
    pos=to;
    if(pos>=s.length-1e-9){
      if(s.loop)pos=0;
      else endTime=nextTime;
    }
  }
  function tick(){
    if(!playing)return;
    const now=ac.currentTime;
    while(endTime<0&&nextTime<now+LOOKAHEAD)scheduleChunk();
    // Takte, die längst vorbei sind, braucht position() nicht mehr, auch wenn die App gerade nicht fragt.
    while(anchors.length>2&&anchors[1].time<now-1)anchors.shift();
    if(endTime>=0&&now>=endTime){
      playing=false;env.clearInterval(timer);
      emit('ended');
    }
  }
  function silence(){
    if(graph)graph.stopAll();
    fadeTimer=0;
    if(ac){gate.gain.cancelScheduledValues(ac.currentTime);gate.gain.setValueAtTime(1,ac.currentTime);}
  }
  function cancelFade(){if(fadeTimer){env.clearTimeout(fadeTimer);silence();}}

  /* ---------- Schnittstelle ---------- */
  const api={
    // Legt den AudioContext an. Wirft einen Fehler mit code 'unsupported' oder 'failed'.
    init(){
      if(ac){if(ac.state!=='running')ac.resume();return true;}
      const AC=env.AudioContext;
      if(!AC){const e=new Error('Web Audio fehlt.');e.code='unsupported';throw e;}
      try{
        try{ac=new AC({latencyHint:'playback'});}catch(e){ac=new AC();}
        gate=ac.createGain();gate.connect(ac.destination);
        if(song)graph=buildGraph(song);
        ac.resume();
        return true;
      }catch(e){
        ac=null;graph=null;
        const err=new Error('Der Ton ließ sich nicht starten: '+e.message);err.code='failed';throw err;
      }
    },
    ready:()=>!!ac,
    isPlaying:()=>playing,
    // Übernimmt einen Song. Im Lauf gilt er ab dem nächsten Takt, die Position läuft weiter.
    load(next){
      const errors=checkSong(next);
      if(errors.length)throw new Error('Der Song ist ungültig.\n  '+errors.join('\n  '));
      const prev=song;
      song=JSON.parse(JSON.stringify(next));
      attach(song,prev);
      if(playing&&pos>=song.length)pos=song.loop?pos%song.length:song.length;
    },
    song:()=>song&&JSON.parse(JSON.stringify(song)),
    play(opts){
      if(!ac||!song||playing)return false;
      cancelFade();
      playing=true;anchors=[];endTime=-1;
      pos=Math.min(Math.max(0,(opts&&opts.from)||0),song.length);
      nextTime=ac.currentTime+START_DELAY;
      tick();timer=env.setInterval(tick,TICK_MS);
      return true;
    },
    stop(){
      if(!ac)return;
      playing=false;env.clearInterval(timer);anchors=[];
      gate.gain.setTargetAtTime(0,ac.currentTime,FADE);
      if(fadeTimer)env.clearTimeout(fadeTimer);
      fadeTimer=env.setTimeout(silence,KILL_MS);
    },
    // Setzt einen Wert über seine Adresse (Abschnitt 9.4) und schreibt ihn in den Song.
    setParam(address,value){
      if(!song)return false;
      const bad=checkAddress(song,address);
      if(bad){warn(bad);return false;}
      const parts=address.split('/'),t=ac?ac.currentTime:0;
      let ok=true;
      if(parts[0]==='tempo'){
        if(typeof value!=='number'||!Number.isFinite(value))return false;
        song.tempo[parts[1]]=parts[1]==='bpm'?Math.min(400,Math.max(20,value)):Math.min(100,Math.max(0,value));
        return true;
      }
      if(parts[0]==='track'){
        const tr=song.tracks.find(x=>x.id===parts[1]),g=graph&&graph.tracks.get(parts[1]);
        if(g)ok=setInstrumentParam(g,parts[3],value,t);
        if(ok)(tr.instrument.params=tr.instrument.params||{})[parts[3]]=value;
        return ok;
      }
      if(graph)ok=graph.mixer.set(parts,value,t);
      if(ok)writeMixer(song.mixer,parts,value);
      return ok;
    },
    // Spielt Noten sofort an, auch ohne laufende Wiedergabe. parts: [{track, notes:[{p, v, s, o}]}],
    // s ist die Dauer und o der Versatz, beides in Sekunden.
    audition(parts){
      if(!ac||!graph)return false;
      cancelFade();
      const t=ac.currentTime+.03;
      for(const part of parts){
        const g=graph.tracks.get(part.track);if(!g)continue;
        for(const n of part.notes)g.inst.play({p:n.p,v:n.v},t+(n.o||0),n.s);
      }
      return true;
    },
    // Was gerade zu hören ist, mit Ausgleich der Ausgabelatenz: Position in Vierteln und der Song,
    // aus dem dieser Takt geplant wurde. null, solange noch nichts klingt.
    position(){
      if(!ac||!playing)return null;
      const now=ac.currentTime-(ac.outputLatency||ac.baseLatency||0);
      while(anchors.length>1&&anchors[1].time<=now)anchors.shift();
      const a=anchors[0];
      if(!a||a.time>now)return null;
      return {beat:a.beat+(now-a.time)*a.bpm/60,song:a.song};
    },
    on(ev,fn){if(listeners[ev])listeners[ev].push(fn);}
  };
  return api;
}

// Schreibt einen Mixer-Wert in den Song, damit der Song immer den gehörten Stand beschreibt (F-P8).
function writeMixer(mx,parts,value){
  const [kind,id,what,sub,param]=parts,find=(l,x)=>(l||[]).find(e=>e.id===x);
  const owner=kind==='master'?mx.master:find(kind==='channel'?mx.channels:mx.returns,id);
  const prop=kind==='master'?id:what,ins=kind==='master'?what:sub,key=kind==='master'?sub:param;
  if(prop==='insert'){
    const x=find(owner.inserts,ins);
    if(key==='bypass')x.bypass=!!value;else (x.params=x.params||{})[key]=value;
  }else if(prop==='send'){const s=owner.sends.find(e=>e.to===sub);if(s)s.gain=value;}
  else owner[prop]=prop==='mute'||prop==='solo'?!!value:value;
}

export {createEngine};
