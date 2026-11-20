/* ================= Instrument „Drums“ ================= */
/* Kick, Rim und Hi-Hat aus Sinus und gefiltertem Rauschen. Unverändert aus dem früheren audio.js übernommen.
   Welcher Klang spielt, bestimmt die Tonhöhe nach General MIDI: 36 Kick, 37 Rim, 42 Hi-Hat.
   Seit Phase 5 dazu: 39 Clap, 46 offene Hi-Hat, 70 Shaker und der Parameter kit. Mit kit „house“ ist die Kick
   tiefer, länger und lauter. Mit „jazz“ (Standard) klingt alles wie bisher. */
import {createVoices} from './voices.js';

const KICK=36,RIM=37,CLAP=39,HAT=42,OHAT=46,SHAKER=70;

const drums={
  type:'drums',
  name:'Drums',
  params:[
    {id:'level',name:'Pegel',type:'number',min:0,max:2,step:.01,default:1},
    {id:'kit',name:'Art',type:'enum',default:'jazz',options:[{value:'jazz',name:'Jazz'},{value:'house',name:'House'}]}
  ],
  create(ac,params){
    const out=ac.createGain();out.gain.value=params.level;
    let kit=params.kit;
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
    function houseKick(t,vel){
      const src=[],o=osc('sine',170,t,t+.42,src),g=ac.createGain();
      o.frequency.setValueAtTime(170,t);o.frequency.exponentialRampToValueAtTime(46,t+.09);
      g.gain.setValueAtTime(1.1*vel,t);g.gain.exponentialRampToValueAtTime(.001,t+.4);o.connect(g);g.connect(out);
      noise(t,.012,'lowpass',3000,.5,.3*vel,src);
      voices.add(ac.currentTime,t,t+.42,g.gain,src);
    }
    function clap(t,vel){
      const src=[];let g;
      for(const d of [0,.011,.022])noise(t+d,.012,'bandpass',1300,.9,.4*vel,src);
      g=noise(t+.032,.16,'bandpass',1300,.9,.42*vel,src);
      voices.add(ac.currentTime,t,t+.22,g.gain,src);
    }
    function openHat(t,vel){const src=[],g=noise(t,.2,'highpass',7000,.8,.15*vel,src);voices.add(ac.currentTime,t,t+.22,g.gain,src);}
    function shaker(t,vel){const src=[],g=noise(t,.05,'bandpass',5200,1,.14*vel,src);voices.add(ac.currentTime,t,t+.07,g.gain,src);}
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
        if(note.p===KICK)(kit==='house'?houseKick:kick)(t,note.v);
        else if(note.p===CLAP)clap(t,note.v);
        else if(note.p===OHAT)openHat(t,note.v);
        else if(note.p===SHAKER)shaker(t,note.v);
        else if(note.p===HAT)hat(t,note.v);
        else if(note.p===RIM)rim(t,note.v);
      },
      setParam(id,v,time){if(id==='level')out.gain.setTargetAtTime(v,time,.02);else if(id==='kit')kit=v;},
      stopAll(){voices.stopAll();},
      dispose(){voices.stopAll();out.disconnect();}
    };
  }
};

export {drums};
