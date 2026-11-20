/* ================= Instrument „Synth“ ================= */
/* Zwei leicht gegeneinander verstimmte Oszillatoren mit einer Hüllkurve. Mit kurzem Abklingen ergibt das
   Akkord-Stabs, mit langem Einschwingen ein Pad. Den Klangfilter liefert der Kanal als Effekt. */
import {midiToHz} from '../core/notes.js';
import {createVoices} from './voices.js';

const time=(id,name,def)=>({id,name,type:'number',min:.001,max:4,default:def,unit:'s',curve:'exp'});
const synth={
  type:'synth',
  name:'Synth',
  params:[
    {id:'level',name:'Pegel',type:'number',min:0,max:2,step:.01,default:1},
    {id:'wave',name:'Wellenform',type:'enum',default:'sawtooth',
      options:[{value:'sawtooth',name:'Sägezahn'},{value:'square',name:'Rechteck'},{value:'triangle',name:'Dreieck'}]},
    time('attack','Einschwingen',.005),time('decay','Abklingen',.25),
    {id:'sustain',name:'Haltepegel',type:'number',min:0,max:1,step:.01,default:.2},
    time('release','Ausklingen',.2),
    {id:'detune',name:'Verstimmung',type:'number',min:0,max:40,step:1,default:12,unit:'Cent'}
  ],
  create(ac,params){
    const p=Object.assign({},params),out=ac.createGain();out.gain.value=p.level;
    const voices=createVoices(16);
    return {
      output:out,
      play(note,t,dur){
        const f=midiToHz(note.p),end=t+dur+p.release*1.5+.05,g=ac.createGain(),peak=.11*note.v,src=[];
        for(const d of [-p.detune/2,p.detune/2]){
          const o=ac.createOscillator();o.type=p.wave;o.frequency.value=f;o.detune.value=d;o.connect(g);o.start(t);o.stop(end);src.push(o);
        }
        g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+p.attack);
        g.gain.setTargetAtTime(peak*p.sustain,t+p.attack,p.decay/3);
        g.gain.setTargetAtTime(0,t+Math.max(dur,p.attack),p.release/3);
        g.connect(out);
        voices.add(ac.currentTime,t,end,g.gain,src);
      },
      setParam(id,v,time){if(id==='level')out.gain.setTargetAtTime(v,time,.02);else p[id]=v;},
      stopAll(){voices.stopAll();},
      dispose(){voices.stopAll();out.disconnect();}
    };
  }
};

export {synth};
