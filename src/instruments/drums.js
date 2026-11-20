/* ================= Instrument „Drums“ ================= */
/* Kick, Rim und Hi-Hat aus Sinus und gefiltertem Rauschen. Unverändert aus dem früheren audio.js übernommen.
   Welcher Klang spielt, bestimmt die Tonhöhe nach General MIDI: 36 Kick, 37 Rim, 42 Hi-Hat. */
import {createVoices} from './voices.js';

const KICK=36,RIM=37,HAT=42;

const drums={
  type:'drums',
  name:'Drums',
  params:[{id:'level',name:'Pegel',type:'number',min:0,max:2,step:.01,default:1}],
  create(ac,params){
    const out=ac.createGain();out.gain.value=params.level;
    const voices=createVoices(16);
    const noiseBuf=ac.createBuffer(1,ac.sampleRate*.5,ac.sampleRate);
    const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    function noise(t,len,type,freq,q,gain,src){
      const s=ac.createBufferSource(),fl=ac.createBiquadFilter(),g=ac.createGain();
      s.buffer=noiseBuf;fl.type=type;fl.frequency.value=freq;fl.Q.value=q;
      g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.0008,t+len);
      s.connect(fl);fl.connect(g);g.connect(out);s.start(t,Math.random()*.3);s.stop(t+len+.02);src.push(s);
      return g;
    }
    function osc(type,f,t,end,src){const o=ac.createOscillator();o.type=type;o.frequency.value=f;o.start(t);o.stop(end);src.push(o);return o;}
    function kick(t,vel){
      const src=[],o=osc('sine',130,t,t+.32,src),g=ac.createGain();
      o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(48,t+.11);
      g.gain.setValueAtTime(.9*vel,t);g.gain.exponentialRampToValueAtTime(.001,t+.3);o.connect(g);g.connect(out);
      noise(t,.02,'lowpass',1800,.5,.25*vel,src);
      voices.add(ac.currentTime,t,t+.32,g.gain,src);
    }
    function hat(t,vel){const src=[],g=noise(t,.045,'highpass',7500,.8,.22*vel,src);voices.add(ac.currentTime,t,t+.065,g.gain,src);}
    function rim(t,vel){
      const src=[],g0=noise(t,.07,'bandpass',1900,1.4,.5*vel,src);
      const o=osc('triangle',420,t,t+.06,src),g=ac.createGain();g.gain.setValueAtTime(.22*vel,t);g.gain.exponentialRampToValueAtTime(.001,t+.05);o.connect(g);g.connect(out);
      voices.add(ac.currentTime,t,t+.09,g0.gain,src);
    }
    return {
      output:out,
      play(note,t){
        if(note.p===KICK)kick(t,note.v);
        else if(note.p===HAT)hat(t,note.v);
        else if(note.p===RIM)rim(t,note.v);
      },
      setParam(id,v,time){if(id==='level')out.gain.setTargetAtTime(v,time,.02);},
      stopAll(){voices.stopAll();},
      dispose(){voices.stopAll();out.disconnect();}
    };
  }
};

export {drums};
