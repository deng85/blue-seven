/* ================= Mixer ================= */
/* Baut aus song.mixer den Signalweg und führt Werte nach.

     Kanal:      Eingang → Inserts → Fader → Panorama → Mute ─┬→ Summe
                                                              └→ Sends → Effektspuren
     Effektspur: Eingang → Inserts → Fader → Mute → Summe
     Summe:      Eingang → Inserts → Fader → Ausgang

   Der Fader eines Kanals arbeitet immer in Stereo. So bleibt ein Mono-Instrument bei Panorama 0
   genauso laut wie bisher, statt durch den StereoPanner 3 dB zu verlieren. */
import {normalize,normalizeValue} from '../core/params.js';

const SMOOTH=.02;   // Glättung für Pegel und Panorama in Sekunden, wie bisher bei den Lautstärkereglern
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,+v||0));

// Ein Effekt im Signalweg, mit Umgehung (bypass) ohne Knacken. Unbekannte Effekte werden durchgereicht.
function createInsert(ac,spec,registry,warn,where,shared){
  const input=ac.createGain(),output=ac.createGain(),wet=ac.createGain(),dry=ac.createGain();
  const mod=registry.get('effects',spec.type);
  let fx=null,params={};
  if(mod){
    params=normalize(mod.params||[],spec.params);fx=mod.create(ac,params);input.connect(fx.input);fx.output.connect(wet);
    // Effekte, die das Tempo brauchen (Echo in Notenwerten) oder auf die Noten einer Spur reagieren (Ducker).
    if(fx.setTempo){fx.setTempo(shared.bpm);shared.tempo.push(fx);}
    const src=spec.params&&spec.params.source;
    if(fx.trigger&&typeof src==='string'){if(!shared.triggers.has(src))shared.triggers.set(src,[]);shared.triggers.get(src).push(fx);}
  }
  else warn(`${where}: Den Effekt „${spec.type}“ gibt es nicht. Er wird übersprungen.`);
  input.connect(dry);wet.connect(output);dry.connect(output);
  const route=(bypass,t)=>{
    const on=!!fx&&!bypass;
    if(t===undefined){wet.gain.value=on?1:0;dry.gain.value=on?0:1;}
    else{wet.gain.setTargetAtTime(on?1:0,t,.01);dry.gain.setTargetAtTime(on?0:1,t,.01);}
  };
  route(!!spec.bypass);
  return {
    input,output,
    setBypass:(b,t)=>route(!!b,t),
    setParam(id,v,t){
      const p=fx&&(mod.params||[]).find(x=>x.id===id);
      if(!p)return false;
      fx.setParam(id,normalizeValue(p,v),t);return true;
    },
    dispose(){if(fx&&fx.dispose)fx.dispose();input.disconnect();output.disconnect();}
  };
}
function createChain(ac,list,registry,warn,where,input,shared){
  let node=input;const map=new Map();
  for(const spec of list||[]){const x=createInsert(ac,spec,registry,warn,`${where}, Effekt „${spec.id}“`,shared);node.connect(x.input);node=x.output;map.set(spec.id,x);}
  return {output:node,inserts:map};
}

function buildMixer(ac,mx,registry,warn,bpm){
  const nodes=[],track=n=>(nodes.push(n),n);
  const shared={bpm:bpm||120,tempo:[],triggers:new Map()};
  // Summe
  const masterIn=track(ac.createGain());
  const mc=createChain(ac,mx.master.inserts,registry,warn,'Summe',masterIn,shared);
  const masterOut=track(ac.createGain());masterOut.gain.value=mx.master.gain;mc.output.connect(masterOut);
  const master={inserts:mc.inserts,fader:masterOut};
  // Effektspuren
  const returns=new Map();
  for(const r of mx.returns){
    const input=track(ac.createGain()),c=createChain(ac,r.inserts,registry,warn,`Effektspur „${r.name}“`,input,shared);
    const fader=track(ac.createGain()),mute=track(ac.createGain());
    fader.gain.value=r.gain;mute.gain.value=r.mute?0:1;
    c.output.connect(fader);fader.connect(mute);mute.connect(masterIn);
    returns.set(r.id,{input,inserts:c.inserts,fader,mute});
  }
  // Kanäle
  const channels=new Map(),state=new Map();
  for(const ch of mx.channels){
    const input=track(ac.createGain()),c=createChain(ac,ch.inserts,registry,warn,`Kanal „${ch.name}“`,input,shared);
    const fader=track(ac.createGain());
    fader.channelCount=2;fader.channelCountMode='explicit';fader.channelInterpretation='speakers';
    fader.gain.value=ch.gain;c.output.connect(fader);
    let out=fader,panner=null;
    if(ac.createStereoPanner){panner=track(ac.createStereoPanner());panner.pan.value=ch.pan;fader.connect(panner);out=panner;}
    const mute=track(ac.createGain());out.connect(mute);mute.connect(masterIn);
    const sends=new Map();
    for(const s of ch.sends||[]){
      const ret=returns.get(s.to);if(!ret)continue;
      const g=track(ac.createGain());g.gain.value=s.gain;mute.connect(g);g.connect(ret.input);sends.set(s.to,g);
    }
    channels.set(ch.id,{input,inserts:c.inserts,fader,panner,mute,sends});
    state.set(ch.id,{mute:!!ch.mute,solo:!!ch.solo});
  }
  // Mute und Solo: Ist irgendein Kanal auf Solo, hört man nur die Kanäle mit Solo. Effektspuren bleiben hörbar.
  function updateMutes(t){
    const anySolo=[...state.values()].some(s=>s.solo);
    for(const [id,ch] of channels){
      const s=state.get(id),on=!s.mute&&(!anySolo||s.solo)?1:0;
      if(t===undefined)ch.mute.gain.value=on;else ch.mute.gain.setTargetAtTime(on,t,.01);
    }
  }
  updateMutes();

  const insertOf=(owner,id)=>owner&&owner.inserts.get(id);
  // Setzt einen Wert. parts ist die Adresse ohne Wert, zum Beispiel ['channel','rhodes','gain'].
  // Liefert false, wenn es das Ziel nicht gibt.
  function set(parts,value,t){
    const [kind,id,what,sub,param]=parts;
    if(kind==='master'){
      if(id==='gain'){masterOut.gain.setTargetAtTime(clamp(value,0,4),t,SMOOTH);return true;}
      if(id==='insert'){const x=insertOf(master,what);return !!x&&(sub==='bypass'?(x.setBypass(value,t),true):x.setParam(sub,value,t));}
      return false;
    }
    const owner=kind==='channel'?channels.get(id):kind==='return'?returns.get(id):null;
    if(!owner)return false;
    if(what==='gain'){owner.fader.gain.setTargetAtTime(clamp(value,0,4),t,SMOOTH);return true;}
    if(what==='insert'){const x=insertOf(owner,sub);return !!x&&(param==='bypass'?(x.setBypass(value,t),true):x.setParam(param,value,t));}
    if(kind==='return'){
      if(what==='mute'){owner.mute.gain.setTargetAtTime(value?0:1,t,.01);return true;}
      return false;
    }
    if(what==='pan'){if(owner.panner)owner.panner.pan.setTargetAtTime(clamp(value,-1,1),t,SMOOTH);return true;}
    if(what==='mute'||what==='solo'){state.get(id)[what]=!!value;updateMutes(t);return true;}
    if(what==='send'){const g=owner.sends.get(sub);if(!g)return false;g.gain.setTargetAtTime(clamp(value,0,4),t,SMOOTH);return true;}
    return false;
  }
  // Führt alle Werte nach, die sich zwischen prev und next unterscheiden. Beide haben denselben Aufbau.
  function apply(prev,next,t){
    const differ=(a,b)=>JSON.stringify(a)!==JSON.stringify(b);
    const chain=(base,a,b)=>(b||[]).forEach((x,i)=>{
      const y=(a||[])[i]||{};
      if(!!x.bypass!==!!y.bypass)set([...base,'insert',x.id,'bypass'],x.bypass,t);
      for(const k in x.params||{})if(differ(x.params[k],(y.params||{})[k]))set([...base,'insert',x.id,k],x.params[k],t);
    });
    next.channels.forEach((c,i)=>{
      const o=prev.channels[i];
      for(const k of ['gain','pan','mute','solo'])if(c[k]!==o[k])set(['channel',c.id,k],c[k],t);
      (c.sends||[]).forEach((s,j)=>{if(s.gain!==o.sends[j].gain)set(['channel',c.id,'send',s.to],s.gain,t);});
      chain(['channel',c.id],o.inserts,c.inserts);
    });
    next.returns.forEach((r,i)=>{
      const o=prev.returns[i];
      for(const k of ['gain','mute'])if(r[k]!==o[k])set(['return',r.id,k],r[k],t);
      chain(['return',r.id],o.inserts,r.inserts);
    });
    if(next.master.gain!==prev.master.gain)set(['master','gain'],next.master.gain,t);
    chain(['master'],prev.master.inserts,next.master.inserts);
  }
  return {
    output:masterOut,
    channelInput:id=>{const c=channels.get(id);return c&&c.input;},
    set,apply,
    // Gibt das Tempo an alle Effekte weiter, die es brauchen.
    setTempo(v,t){for(const fx of shared.tempo)fx.setTempo(v,t);},
    // Effekte, die bei jeder Note der Spur trackId ausgelöst werden wollen.
    triggersFor:trackId=>shared.triggers.get(trackId)||[],
    dispose(){
      for(const owner of [master,...returns.values(),...channels.values()])for(const x of owner.inserts.values())x.dispose();
      for(const n of nodes){try{n.disconnect();}catch(e){}}
    }
  };
}

export {buildMixer};
