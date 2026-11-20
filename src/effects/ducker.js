/* ================= Effekt „Ducker“ ================= */
/* Senkt den Pegel kurz bei jeder Note einer anderen Spur und lässt ihn wieder hochkommen. Das ergibt das
   Pumpen aus dem House, ohne ein Audiosignal zu analysieren: Die Engine ruft trigger(zeit) für jede Note der
   Quellspur auf. Welche Spur das ist, steht im Song unter params.source. */
const ducker={
  type:'ducker',
  name:'Ducker',
  params:[
    {id:'depth',name:'Tiefe',type:'number',min:0,max:1,step:.01,default:.6},
    {id:'release',name:'Erholzeit',type:'number',min:.05,max:.6,step:.01,default:.22,unit:'s'}
  ],
  create(ac,p){
    const g=ac.createGain();let depth=p.depth,release=p.release;
    return {
      input:g,output:g,
      trigger(t){g.gain.setTargetAtTime(1-depth,t,.004);g.gain.setTargetAtTime(1,t+.03,release/3);},
      setParam(id,v){if(id==='depth')depth=v;else if(id==='release')release=v;},
      dispose(){g.disconnect();}
    };
  }
};

export {ducker};
