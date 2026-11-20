/* ================= Effekt „Filter“ ================= */
const filter={
  type:'filter',
  name:'Filter',
  params:[
    {id:'mode',name:'Art',type:'enum',default:'lowpass',
      options:[{value:'lowpass',name:'Tiefpass'},{value:'highpass',name:'Hochpass'},{value:'bandpass',name:'Bandpass'}]},
    {id:'frequency',name:'Grenzfrequenz',type:'number',min:20,max:20000,step:1,default:3600,unit:'Hz',curve:'exp'},
    {id:'q',name:'Güte',type:'number',min:.1,max:20,default:.7,curve:'exp'}
  ],
  create(ac,p){
    const f=ac.createBiquadFilter();f.type=p.mode;f.frequency.value=p.frequency;f.Q.value=p.q;
    return {
      input:f,output:f,
      setParam(id,v,t){
        if(id==='mode')f.type=v;
        else if(id==='frequency')f.frequency.setTargetAtTime(v,t,.02);
        else if(id==='q')f.Q.setTargetAtTime(v,t,.02);
      },
      dispose(){f.disconnect();}
    };
  }
};

export {filter};
