/* ================= Effekt „Echo“ ================= */
/* Echo im Takt: Die Zeit steht als Notenwert im Song, die Engine meldet das Tempo über setTempo.
   Die Rückkopplung läuft durch einen Tiefpass, damit die Wiederholungen dunkler werden.
   Mit Anteil 100 % kommt nur das Echo heraus. So gehört es auf eine Effektspur. */
const BEATS={'1/16':.25,'1/8':.5,'1/8p':.75,'1/4':1};

const delay={
  type:'delay',
  name:'Echo',
  params:[
    {id:'time',name:'Zeit',type:'enum',default:'1/8p',
      options:[{value:'1/16',name:'1/16'},{value:'1/8',name:'1/8'},{value:'1/8p',name:'1/8 punktiert'},{value:'1/4',name:'1/4'}]},
    {id:'feedback',name:'Rückkopplung',type:'number',min:0,max:.9,step:.01,default:.4},
    {id:'damp',name:'Höhendämpfung',type:'number',min:500,max:12000,step:1,default:3000,unit:'Hz',curve:'exp'},
    {id:'mix',name:'Anteil',type:'number',min:0,max:1,step:.01,default:1}
  ],
  create(ac,p){
    const input=ac.createGain(),output=ac.createGain(),d=ac.createDelay(2),lp=ac.createBiquadFilter(),fb=ac.createGain(),wet=ac.createGain(),dry=ac.createGain();
    let time=p.time,bpm=120;
    const seconds=()=>Math.min(2,BEATS[time]*60/bpm);
    lp.type='lowpass';lp.frequency.value=p.damp;fb.gain.value=p.feedback;wet.gain.value=p.mix;dry.gain.value=1-p.mix;d.delayTime.value=seconds();
    input.connect(d);d.connect(lp);lp.connect(fb);fb.connect(d);lp.connect(wet);wet.connect(output);input.connect(dry);dry.connect(output);
    const retime=t=>{if(t===undefined)d.delayTime.value=seconds();else d.delayTime.setTargetAtTime(seconds(),t,.05);};
    return {
      input,output,
      setTempo(v,t){bpm=v;retime(t);},
      setParam(id,v,t){
        if(id==='time'){time=v;retime(t);}
        else if(id==='feedback')fb.gain.setTargetAtTime(v,t,.02);
        else if(id==='damp')lp.frequency.setTargetAtTime(v,t,.02);
        else if(id==='mix'){wet.gain.setTargetAtTime(v,t,.02);dry.gain.setTargetAtTime(1-v,t,.02);}
      },
      dispose(){fb.disconnect();input.disconnect();output.disconnect();}
    };
  }
};

export {delay};
