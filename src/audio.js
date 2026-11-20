/* ================= Klang ================= */
let ctx,gate,rBus,bBus,dBus,noiseBuf,live=[],killTimer=0;
const vol=v=>Math.pow(v/100,1.6);
function impulse(sec){
  const n=Math.floor(ctx.sampleRate*sec),b=ctx.createBuffer(2,n,ctx.sampleRate);
  for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,2.6);}
  return b;
}
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
function initAudio(){
  if(ctx){if(ctx.state!=='running')ctx.resume();return true;}
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC){$('hint').textContent='Dieser Browser kann keinen Ton erzeugen (Web Audio fehlt).';return false;}
  try{
    try{ctx=new AC({latencyHint:'playback'});}catch(e){ctx=new AC();}iosUnmute();
    const comp=ctx.createDynamicsCompressor();comp.threshold.value=-16;comp.ratio.value=4;comp.connect(ctx.destination);
    gate=ctx.createGain();gate.connect(comp);
    rBus=ctx.createGain();bBus=ctx.createGain();dBus=ctx.createGain();
    const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=3600;lp.Q.value=.3;rBus.connect(lp);
    let out=lp;
    if(ctx.createStereoPanner){                      // das typische Rhodes-Tremolo, wandert zwischen links und rechts
      const pan=ctx.createStereoPanner(),lfo=ctx.createOscillator(),lg=ctx.createGain();
      lfo.frequency.value=4.4;lg.gain.value=.45;lfo.connect(lg);lg.connect(pan.pan);lfo.start();lp.connect(pan);out=pan;
    }
    out.connect(gate);
    const rev=ctx.createConvolver(),send=ctx.createGain();rev.buffer=impulse(1.5);send.gain.value=.24;
    out.connect(send);send.connect(rev);rev.connect(gate);
    const dsend=ctx.createGain();dsend.gain.value=.06;dBus.connect(dsend);dsend.connect(rev);
    bBus.connect(gate);dBus.connect(gate);
    noiseBuf=ctx.createBuffer(1,ctx.sampleRate*.5,ctx.sampleRate);
    const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    setVols();ctx.resume();return true;
  }catch(e){ctx=null;$('hint').textContent='Der Ton ließ sich nicht starten. Seite neu laden und noch einmal auf Play tippen.';return false;}
}
function setVols(){if(!ctx)return;const t=ctx.currentTime;rBus.gain.setTargetAtTime(vol(S.volR)*1.1,t,.02);bBus.gain.setTargetAtTime(vol(S.volB),t,.02);dBus.gain.setTargetAtTime(vol(S.volD)*.9,t,.02);}
const hz=m=>440*Math.pow(2,(m-69)/12);
function keep(node,end){live.push([node,end]);}
function osc(type,f,t,end){const o=ctx.createOscillator();o.type=type;o.frequency.value=f;o.start(t);o.stop(end);keep(o,end);return o;}

/* Rhodes: Sinus-Träger, ein Modulator für den „Bark“, ein hoher für den Glockenanschlag der Tine */
function rhodes(m,t,dur,vel){
  const f=hz(m),end=t+dur+.45,ks=Math.pow(Math.min(1,300/f),.6);
  const car=osc('sine',f,t,end);car.detune.value=(Math.random()-.5)*7;
  const mod=osc('sine',f,t,end),mg=ctx.createGain(),idx=f*(.3+1.5*vel)*ks;
  mg.gain.setValueAtTime(idx,t);mg.gain.setTargetAtTime(idx*.2,t,.28);mod.connect(mg);mg.connect(car.frequency);
  const tine=osc('sine',f*14,t,t+.4),tg=ctx.createGain();
  tg.gain.setValueAtTime(f*.7*vel*ks,t);tg.gain.setTargetAtTime(0,t,.03);tine.connect(tg);tg.connect(car.frequency);
  const g=ctx.createGain(),peak=.17*vel;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+.006);g.gain.setTargetAtTime(peak*.22,t+.006,1.1);g.gain.setTargetAtTime(0,t+dur,.09);
  car.connect(g);g.connect(rBus);
}
function bass(m,t,dur,vel){
  const f=hz(m),end=t+dur+.3,g=ctx.createGain(),lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=650;
  const a=osc('triangle',f,t,end),b=osc('sawtooth',f,t,end),bg=ctx.createGain();bg.gain.value=.22;
  a.connect(lp);b.connect(bg);bg.connect(lp);lp.connect(g);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.5*vel,t+.012);g.gain.setTargetAtTime(.32*vel,t+.012,.3);g.gain.setTargetAtTime(0,t+dur,.05);
  g.connect(bBus);
}
function noise(t,len,type,freq,q,gain){
  const s=ctx.createBufferSource(),fl=ctx.createBiquadFilter(),g=ctx.createGain();
  s.buffer=noiseBuf;fl.type=type;fl.frequency.value=freq;fl.Q.value=q;
  g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.0008,t+len);
  s.connect(fl);fl.connect(g);g.connect(dBus);s.start(t,Math.random()*.3);s.stop(t+len+.02);keep(s,t+len+.02);
}
function kick(t,vel){
  const o=osc('sine',130,t,t+.32),g=ctx.createGain();
  o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(48,t+.11);
  g.gain.setValueAtTime(.9*vel,t);g.gain.exponentialRampToValueAtTime(.001,t+.3);o.connect(g);g.connect(dBus);
  noise(t,.02,'lowpass',1800,.5,.25*vel);
}
const hat=(t,vel)=>noise(t,.045,'highpass',7500,.8,.22*vel);
function rim(t,vel){
  noise(t,.07,'bandpass',1900,1.4,.5*vel);
  const o=osc('triangle',420,t,t+.06),g=ctx.createGain();g.gain.setValueAtTime(.22*vel,t);g.gain.exponentialRampToValueAtTime(.001,t+.05);o.connect(g);g.connect(dBus);
}

