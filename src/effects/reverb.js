/* ================= Effekt „Hall“ ================= */
/* Faltungshall mit einer erzeugten Impulsantwort aus abklingendem Rauschen, wie bisher. */
function impulse(ac,sec){
  const n=Math.floor(ac.sampleRate*sec),b=ac.createBuffer(2,n,ac.sampleRate);
  for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,2.6);}
  return b;
}
const reverb={
  type:'reverb',
  name:'Hall',
  params:[{id:'seconds',name:'Dauer',type:'number',min:.2,max:6,step:.1,default:1.5,unit:'s'}],
  create(ac,p){
    const rev=ac.createConvolver();rev.buffer=impulse(ac,p.seconds);
    return {
      input:rev,output:rev,
      setParam(id,v){if(id==='seconds')rev.buffer=impulse(ac,v);},
      dispose(){rev.disconnect();}
    };
  }
};

export {reverb};
