/* ================= Instrument „Rauschanstieg“ ================= */
/* Rauschen durch einen Bandpass, der über die Dauer der Note nach oben fährt, dabei lauter wird und am Ende
   abreißt. Für Übergänge vor einem neuen Abschnitt. Die Tonhöhe der Note spielt keine Rolle. */
import {createVoices} from './voices.js';

const riser={
  type:'riser',
  name:'Rauschanstieg',
  params:[{id:'level',name:'Pegel',type:'number',min:0,max:2,step:.01,default:1}],
  create(ac,params){
    const out=ac.createGain();out.gain.value=params.level;
    const voices=createVoices(2);
    const buf=ac.createBuffer(1,ac.sampleRate,ac.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    return {
      output:out,
      play(note,t,dur){
        const s=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain(),end=t+dur;
        s.buffer=buf;s.loop=true;f.type='bandpass';f.Q.value=1.2;
        f.frequency.setValueAtTime(300,t);f.frequency.exponentialRampToValueAtTime(9000,end);
        g.gain.setValueAtTime(.0008,t);g.gain.exponentialRampToValueAtTime(.3*note.v,end);g.gain.setTargetAtTime(0,end,.02);
        s.connect(f);f.connect(g);g.connect(out);s.start(t);s.stop(end+.15);
        voices.add(ac.currentTime,t,end+.15,g.gain,[s]);
      },
      setParam(id,v,time){if(id==='level')out.gain.setTargetAtTime(v,time,.02);},
      stopAll(){voices.stopAll();},
      dispose(){voices.stopAll();out.disconnect();}
    };
  }
};

export {riser};
