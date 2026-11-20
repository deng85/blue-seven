/* ================= Stimmführung für beliebige Akkordfolgen ================= */
/* Für Stile, die eine Lage brauchen, wenn der Akkord-Generator keine mitliefert (chords[].voicing fehlt),
   oder die bewusst eine eigene wollen. Gleiches Vorgehen wie bei Jazzy: enge Lagen um eine Mitte,
   möglichst kleine Bewegung von Akkord zu Akkord, zwei Runden, damit auch der Rücksprung passt. */

// Welche Tonklassen klingen sollen. Bei mehr als max Tönen fällt zuerst der Grundton weg (den spielt der Bass),
// dann die Quinte, dann die höchsten Erweiterungen.
function pickTones(chord,max){
  let ts=[...new Set(chord.tones.map(t=>t%12))];
  const drop=t=>{if(ts.length>max&&ts.includes(t))ts=ts.filter(x=>x!==t);};
  drop(0);drop(7);
  ts=ts.slice(0,max);
  return ts.map(t=>(chord.root+t)%12);
}
// Alle engen Lagen dieser Tonklassen mit der tiefsten Note zwischen low und low+12.
function closeVoicings(pcs,low){
  const out=[];
  for(let b=low;b<=low+12;b++){
    if(!pcs.includes(b%12))continue;
    const rest=pcs.filter(p=>p!==b%12).map(p=>b+((p-b%12+12)%12)).sort((x,y)=>x-y);
    out.push([b,...rest]);
  }
  return out;
}
const mean=v=>v.reduce((a,b)=>a+b,0)/v.length;
// Wie weit wandern die Finger von prev nach v? Bei gleicher Stimmenzahl Stimme für Stimme, sonst zum nächsten Ton.
function distance(prev,v){
  if(prev.length===v.length)return v.reduce((a,x,i)=>a+Math.abs(x-prev[i]),0);
  const near=(a,b)=>a.reduce((s,x)=>s+Math.min(...b.map(y=>Math.abs(x-y))),0);
  return (near(v,prev)+near(prev,v))/2;
}

// Liefert für jeden Akkord eine Lage als aufsteigende MIDI-Noten.
// opts: max (höchstens so viele Töne, Standard 4), low (tiefste erlaubte Unterkante, Standard 52), center (Mitte, Standard 63).
function voiceChords(chords,opts){
  const o=Object.assign({max:4,low:52,center:63},opts);
  const cands=chords.map(c=>closeVoicings(pickTones(c,o.max),o.low));
  let prev=null,out=[];
  for(let pass=0;pass<2;pass++){
    out=cands.map(list=>{
      let best=null,bc=Infinity;
      for(const v of list){
        let c=prev?distance(prev,v)+.4*Math.abs(mean(v)-o.center):Math.abs(mean(v)-o.center);
        if(v.length>2&&v[v.length-1]-v[v.length-2]===1)c+=3;   // kleine Sekunde ganz oben klingt hart
        if(c<bc){bc=c;best=v;}
      }
      prev=best;return best;
    });
  }
  return out;
}

export {voiceChords};
