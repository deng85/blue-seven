/* ================= Stimmenverwaltung für Instrumente ================= */
/* Merkt sich alle geplanten und klingenden Stimmen eines Instruments. Damit lassen sie sich beim Stopp
   beenden, und bei zu vielen gleichzeitigen Stimmen wird die älteste ausgeblendet (F-I3). */

function createVoices(limit){
  let list=[];   // {start, end, gain (AudioParam), sources}
  // Eine Stimme ausblenden, die bei time noch klingt.
  function steal(v,time){
    v.gain.cancelScheduledValues(time);
    v.gain.setTargetAtTime(0,time,.005);
    for(const s of v.sources){try{s.stop(time+.05);}catch(e){}}
    v.end=time+.05;
  }
  return {
    add(now,start,end,gain,sources){
      list=list.filter(v=>v.end>now);
      const active=list.filter(v=>v.start<=start&&v.end>start);
      if(active.length>=limit)steal(active.reduce((a,b)=>b.start<a.start?b:a),start);
      list.push({start,end,gain,sources});
    },
    // Alle Stimmen sofort beenden, auch die schon geplanten.
    stopAll(){
      for(const v of list)for(const s of v.sources){try{s.stop();}catch(e){}}
      list=[];
    },
    count:()=>list.length
  };
}

export {createVoices};
