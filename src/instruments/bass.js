/* ================= Instrument „Bass“ ================= */
/* Dreieck plus etwas Sägezahn durch einen Tiefpass. Unverändert aus dem früheren audio.js übernommen. */
import {midiToHz} from '../core/notes.js';
import {createVoices} from './voices.js';

const bass={
  type:'bass',
  name:'Bass',
  params:[{id:'level',name:'Pegel',type:'number',min:0,max:2,step:.01,default:1}],
  create(ac,params){
    const out=ac.createGain();out.gain.value=params.level;
    const voices=createVoices(8);
    function osc(type,f,t,end,list){const o=ac.createOscillator();o.type=type;o.frequency.value=f;o.start(t);o.stop(end);list.push(o);return o;}
    return {
      output:out,
      play(note,t,dur){
        const vel=note.v,f=midiToHz(note.p),end=t+dur+.3,g=ac.createGain(),lp=ac.createBiquadFilter(),src=[];lp.type='lowpass';lp.frequency.value=650;
        const a=osc('triangle',f,t,end,src),b=osc('sawtooth',f,t,end,src),bg=ac.createGain();bg.gain.value=.22;
        a.connect(lp);b.connect(bg);bg.connect(lp);lp.connect(g);
        g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.5*vel,t+.012);g.gain.setTargetAtTime(.32*vel,t+.012,.3);g.gain.setTargetAtTime(0,t+dur,.05);
        g.connect(out);
        voices.add(ac.currentTime,t,end,g.gain,src);
      },
      setParam(id,v,time){if(id==='level')out.gain.setTargetAtTime(v,time,.02);},
      stopAll(){voices.stopAll();},
      dispose(){voices.stopAll();out.disconnect();}
    };
  }
};

export {bass};
