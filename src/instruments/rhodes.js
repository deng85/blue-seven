/* ================= Instrument „Rhodes“ ================= */
/* Sinus-Träger, ein Modulator für den „Bark“, ein hoher für den Glockenanschlag der Tine.
   Die Klangerzeugung ist unverändert aus dem früheren audio.js übernommen. */
import {midiToHz} from '../core/notes.js';
import {createVoices} from './voices.js';

const rhodes={
  type:'rhodes',
  name:'Rhodes',
  params:[{id:'level',name:'Pegel',type:'number',min:0,max:2,step:.01,default:1}],
  create(ac,params){
    const out=ac.createGain();out.gain.value=params.level;
    const voices=createVoices(24);
    function osc(type,f,t,end,list){const o=ac.createOscillator();o.type=type;o.frequency.value=f;o.start(t);o.stop(end);list.push(o);return o;}
    return {
      output:out,
      // note = {p, v}, t in AudioContext-Zeit, dur in Sekunden
      play(note,t,dur){
        const vel=note.v,f=midiToHz(note.p),end=t+dur+.45,ks=Math.pow(Math.min(1,300/f),.6),src=[];
        const car=osc('sine',f,t,end,src);car.detune.value=(Math.random()-.5)*7;
        const mod=osc('sine',f,t,end,src),mg=ac.createGain(),idx=f*(.3+1.5*vel)*ks;
        mg.gain.setValueAtTime(idx,t);mg.gain.setTargetAtTime(idx*.2,t,.28);mod.connect(mg);mg.connect(car.frequency);
        const tine=osc('sine',f*14,t,t+.4,src),tg=ac.createGain();
        tg.gain.setValueAtTime(f*.7*vel*ks,t);tg.gain.setTargetAtTime(0,t,.03);tine.connect(tg);tg.connect(car.frequency);
        const g=ac.createGain(),peak=.17*vel;
        g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+.006);g.gain.setTargetAtTime(peak*.22,t+.006,1.1);g.gain.setTargetAtTime(0,t+dur,.09);
        car.connect(g);g.connect(out);
        voices.add(ac.currentTime,t,end,g.gain,src);
      },
      setParam(id,v,time){if(id==='level')out.gain.setTargetAtTime(v,time,.02);},
      stopAll(){voices.stopAll();},
      dispose(){voices.stopAll();out.disconnect();}
    };
  }
};

export {rhodes};
