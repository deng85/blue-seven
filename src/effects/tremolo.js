/* ================= Effekt „Tremolo“ ================= */
/* Das typische Rhodes-Tremolo: Der Klang wandert zwischen links und rechts.
   Ohne StereoPanner (sehr alte Browser) wird der Effekt durchgereicht, wie bisher. */
const tremolo={
  type:'tremolo',
  name:'Tremolo',
  params:[
    {id:'rate',name:'Tempo',type:'number',min:.1,max:20,default:4.4,unit:'Hz',curve:'exp'},
    {id:'depth',name:'Tiefe',type:'number',min:0,max:1,default:.45}
  ],
  create(ac,p){
    if(!ac.createStereoPanner){const g=ac.createGain();return {input:g,output:g,setParam(){},dispose(){g.disconnect();}};}
    const pan=ac.createStereoPanner(),lfo=ac.createOscillator(),lg=ac.createGain();
    lfo.frequency.value=p.rate;lg.gain.value=p.depth;lfo.connect(lg);lg.connect(pan.pan);lfo.start();
    return {
      input:pan,output:pan,
      setParam(id,v,t){
        if(id==='rate')lfo.frequency.setTargetAtTime(v,t,.05);
        else if(id==='depth')lg.gain.setTargetAtTime(v,t,.05);
      },
      dispose(){try{lfo.stop();}catch(e){}pan.disconnect();}
    };
  }
};

export {tremolo};
