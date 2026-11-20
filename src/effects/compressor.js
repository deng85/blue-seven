/* ================= Effekt „Kompressor“ ================= */
/* Das Knie ist der Bereich oberhalb der Schwelle, in dem die Kompression weich einsetzt. 30 dB ist der
   Standard des Browsers und damit der bisherige Klang.
   graph(params) beschreibt die Kennlinie für die Oberfläche: Eingangspegel gegen Ausgangspegel in dB.
   Sie ist eine Näherung (quadratisches Knie) und zeigt die automatische Pegelanhebung des Browsers nicht. */
const FLOOR=-60;
// Ausgangspegel in dB zu einem Eingangspegel in dB.
function transfer(p,x){
  const t=p.threshold,k=p.knee,s=1/p.ratio;
  if(x<=t)return x;
  if(x<t+k)return x+(s-1)*(x-t)*(x-t)/(2*k);
  return t+k*(1+s)/2+(x-t-k)*s;
}
const compressor={
  type:'compressor',
  name:'Kompressor',
  params:[
    {id:'threshold',name:'Schwelle',type:'number',min:-60,max:0,step:1,default:-16,unit:'dB'},
    {id:'knee',name:'Knie',type:'number',min:0,max:40,step:1,default:30,unit:'dB'},
    {id:'ratio',name:'Verhältnis',type:'number',min:1,max:20,step:.5,default:4}
  ],
  graph(p){
    const points=[];
    for(let x=FLOOR;x<=0;x+=1)points.push([x,transfer(p,x)]);
    return {kind:'transfer',min:FLOOR,max:0,points,marks:[{x:p.threshold,name:'Schwelle'},{x:Math.min(0,p.threshold+p.knee),name:'Knie'}],
      note:`${String(p.ratio).replace('.',',')} : 1 oberhalb des Knies`};
  },
  create(ac,p){
    const c=ac.createDynamicsCompressor();c.threshold.value=p.threshold;c.knee.value=p.knee;c.ratio.value=p.ratio;
    return {
      input:c,output:c,
      setParam(id,v,t){
        if(id==='threshold')c.threshold.setTargetAtTime(v,t,.02);
        else if(id==='knee')c.knee.setTargetAtTime(v,t,.02);
        else if(id==='ratio')c.ratio.setTargetAtTime(v,t,.02);
      },
      dispose(){c.disconnect();}
    };
  }
};

export {compressor,transfer};
