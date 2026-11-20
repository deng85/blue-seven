/* ================= Effekt „Kompressor“ ================= */
const compressor={
  type:'compressor',
  name:'Kompressor',
  params:[
    {id:'threshold',name:'Schwelle',type:'number',min:-60,max:0,step:1,default:-16,unit:'dB'},
    {id:'ratio',name:'Verhältnis',type:'number',min:1,max:20,step:.5,default:4}
  ],
  create(ac,p){
    const c=ac.createDynamicsCompressor();c.threshold.value=p.threshold;c.ratio.value=p.ratio;
    return {
      input:c,output:c,
      setParam(id,v,t){
        if(id==='threshold')c.threshold.setTargetAtTime(v,t,.02);
        else if(id==='ratio')c.ratio.setTargetAtTime(v,t,.02);
      },
      dispose(){c.disconnect();}
    };
  }
};

export {compressor};
