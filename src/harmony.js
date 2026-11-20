/* ================= Harmonie: Akkordpool, Bewertung, Stimmführung ================= */
const NOTE_FLAT=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const NOTE_SHARP=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const QUAL={maj:[0,4,7,11],min:[0,3,7,10]};
const SCALE={dur:[0,2,4,5,7,9,11],moll:[0,2,3,5,7,8,10]};
const C=(id,off,q,rn,color)=>({id,off,q,rn,color:color?1:0});
const POOL={
  dur:[C('I',0,'maj','I'),C('ii',2,'min','ii'),C('iii',4,'min','iii'),C('IV',5,'maj','IV'),C('vi',9,'min','vi'),
       C('bII',1,'maj','♭II',1),C('bIII',3,'maj','♭III',1),C('iv',5,'min','iv',1),C('v',7,'min','v',1),C('bVI',8,'maj','♭VI',1),C('bVII',10,'maj','♭VII',1)],
  moll:[C('i',0,'min','i'),C('bIII',3,'maj','♭III'),C('iv',5,'min','iv'),C('v',7,'min','v'),C('bVI',8,'maj','♭VI'),C('bVII',10,'maj','♭VII'),
        C('ii',2,'min','ii',1),C('bII',1,'maj','♭II',1),C('bvii',10,'min','♭vii',1)]
};
const TONIC={dur:{main:'I',subs:['vi','iii']},moll:{main:'i',subs:['bIII']}};
const byId=(mode,id)=>POOL[mode].find(c=>c.id===id);

/* Wie gut klingt der Schritt a -> b? Grundtonbewegung plus gemeinsame Töne. */
const MOVE={5:1,2:.8,10:.8,11:.78,8:.7,9:.7,3:.6,4:.6,7:.62,1:.5,6:.15};
function trans(a,b){
  const d=((b.off-a.off)%12+12)%12;
  let s=d===0?((a.q==='maj'&&b.q==='min')?.7:.15):MOVE[d];
  const A=QUAL[a.q].map(x=>(x+a.off)%12),B=QUAL[b.q].map(x=>(x+b.off)%12);
  s+=.1*A.filter(x=>B.includes(x)).length;
  if(d===7&&a.q==='min'&&b.q==='maj')s+=.15;
  return s;
}
function scoreLoop(seq,sp,mode,maxC){
  const n=seq.length;let s=0;
  for(let i=0;i<n;i++)s+=trans(seq[i],seq[(i+1)%n]);   // inklusive Rücksprung zum Anfang
  s/=n;
  const colors=seq.filter(c=>c.color).length;
  if(colors>maxC)return -99;
  s+=colors*(sp-.55)*.35;
  const ids=seq.map(c=>c.id),T=TONIC[mode];
  if(ids.includes(T.main))s+=.25;else if(ids.some(i=>T.subs.includes(i)))s+=.1;
  if(seq.some(c=>c.q==='maj')&&seq.some(c=>c.q==='min'))s+=.15;
  if(ids[0]===T.main)s+=.12;
  return s;
}
/* Alle möglichen Folgen durchrechnen, bewerten, aus den besten zufällig ziehen. */
function generate(S,avoid,rnd){
  rnd=rnd||Math.random;
  const n=S.n,sp=S.spice/100,mode=S.mode;
  const fixed=[];for(let i=0;i<n;i++)fixed.push(S.locks[i]&&S.loop[i]?byId(mode,S.loop[i]):null);
  const lockedC=fixed.filter(c=>c&&c.color).length;
  const maxC=Math.max(Math.ceil(sp*n*.75),lockedC);
  const pool=POOL[mode].filter(c=>!c.color||sp>0);
  let res=[];const seq=[];
  (function rec(i){
    if(i===n){const s=scoreLoop(seq,sp,mode,maxC);if(s>-9)res.push([s,seq.map(c=>c.id)]);return;}
    for(const c of (fixed[i]?[fixed[i]]:pool)){
      if(seq.includes(c)||(!fixed[i]&&fixed.includes(c)))continue;
      seq.push(c);rec(i+1);seq.pop();
    }
  })(0);
  if(!res.length)return S.loop.slice(0,n);
  const fresh=res.filter(r=>!avoid.includes(r[1].join('-')));
  if(fresh.length)res=fresh;
  res.sort((a,b)=>b[0]-a[0]);
  res=res.slice(0,40);
  const best=res[0][0],w=res.map(r=>Math.exp((r[0]-best)/.06));
  let x=rnd()*w.reduce((a,b)=>a+b,0);
  for(let i=0;i<res.length;i++){x-=w[i];if(x<=0)return res[i][1];}
  return res[0][1];
}
function useSharps(key,mode){return [7,2,9,4,11,6].includes(mode==='dur'?key:(key+3)%12);}
function hasNine(ch,mode,nine){return !!nine&&(ch.q==='maj'||SCALE[mode].includes((ch.off+2)%12));}
function chordName(ch,key,mode,nine){
  const root=(useSharps(key,mode)?NOTE_SHARP:NOTE_FLAT)[(key+ch.off)%12],n=hasNine(ch,mode,nine);
  return {root,suf:ch.q==='maj'?(n?'maj9':'maj7'):(n?'m9':'m7')};
}
function closeVoicings(pcs){
  const out=[];
  for(let low=52;low<=64;low++){
    if(!pcs.includes(low%12))continue;
    const rest=pcs.filter(p=>p!==low%12).map(p=>low+((p-low%12+12)%12)).sort((a,b)=>a-b);
    out.push([low,...rest]);
  }
  return out;
}
/* Stimmführung: jede Lage so wählen, dass die Finger möglichst wenig wandern. Zwei Runden, damit auch der Rücksprung passt. */
function voiceLoop(chords,key,mode,nine){
  const mean=v=>v.reduce((a,b)=>a+b,0)/v.length;
  const cands=chords.map(ch=>{
    const root=(key+ch.off)%12,t=QUAL[ch.q].map(x=>(root+x)%12);
    return closeVoicings(hasNine(ch,mode,nine)?[t[1],t[2],t[3],(root+2)%12]:[t[1],t[2],t[3],t[0]]);
  });
  let prev=null,out=[];
  for(let pass=0;pass<2;pass++){
    out=cands.map(list=>{
      let best=null,bc=1e9;
      for(const v of list){
        let c=prev?v.reduce((a,x,i)=>a+Math.abs(x-prev[i]),0)+.4*Math.abs(mean(v)-63):Math.abs(mean(v)-63);
        if(v[3]-v[2]===1)c+=3;                      // kleine Sekunde ganz oben klingt hart
        if(c<bc){bc=c;best=v;}
      }
      prev=best;return best;
    });
  }
  return chords.map((ch,i)=>({notes:out[i],bass:36+(key+ch.off)%12,rn:ch.rn,name:chordName(ch,key,mode,nine)}));
}
/*--UI--*/
