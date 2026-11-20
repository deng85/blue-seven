/* ================= Zeitachse eines Songs ================= */
/* Reine Funktionen ohne Web Audio: Welche Noten liegen in einem Zeitraum, und wie sieht der Song
   in seiner Struktur aus. Laufen in Node und werden dort getestet. */

// Alle Noten mit Beginn in [from, to), in Vierteln ab Songanfang. Wiederholt Patterns innerhalb ihrer Clips.
// Ergebnis: [{track, beat, d, p, v, o}], in der Reihenfolge der Spuren, Clips und Pattern-Noten.
function notesBetween(song,from,to){
  const out=[];
  for(const tr of song.tracks){
    for(const c of tr.clips){
      const pt=song.patterns[c.pattern];
      if(!pt||!pt.notes.length)continue;
      const cs=c.start,ce=c.start+c.length;
      if(ce<=from||cs>=to)continue;
      const first=Math.max(0,Math.floor((from-cs)/pt.length)),last=Math.ceil((Math.min(to,ce)-cs)/pt.length);
      for(let r=first;r<last;r++)for(const n of pt.notes){
        const local=r*pt.length+n.t;
        if(local>=c.length)continue;
        const beat=cs+local;
        if(beat<from||beat>=to)continue;
        out.push({track:tr.id,beat,d:n.d,p:n.p+(c.transpose||0),v:n.v,o:n.o||0});
      }
    }
  }
  return out;
}

// Ein Schlüssel für den Aufbau eines Songs: Spuren mit Instrument und Kanal, Kanäle, Effektspuren und
// Summe mit ihren Effekten und Sends. Bei gleichem Schlüssel kann die Engine ihren Signalweg behalten
// und muss nur Werte nachführen.
function structureKey(song){
  const fx=list=>(list||[]).map(i=>[i.id,i.type]);
  const m=song.mixer;
  return JSON.stringify({
    tracks:song.tracks.map(t=>[t.id,t.instrument.type,t.channel]),
    channels:m.channels.map(c=>[c.id,fx(c.inserts),(c.sends||[]).map(s=>s.to)]),
    returns:m.returns.map(r=>[r.id,fx(r.inserts)]),
    master:fx(m.master.inserts)
  });
}

export {notesBetween,structureKey};
