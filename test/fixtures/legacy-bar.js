// Wörtliche Kopie von scheduleBar aus src/sequencer.js, Stand vor Phase 2 (main 68d102a).
// Sie ist die Referenz dafür, was Jazzy Beats erzeugen muss, auch nachdem sequencer.js in Phase 3 entfällt.
// Die Abhängigkeiten kommen über env herein, damit die Funktion in Node läuft und jeden Aufruf aufzeichnen kann.
// Ein Test prüft, dass die Kopie Zeichen für Zeichen mit sequencer.js übereinstimmt, solange es die Datei gibt.

export function createLegacyBar(env) {
  const { S, chords, bassNote, rhodes, bass, hat, kick, rim, queue } = env;
  function scheduleBar(t0,i){
    const spb=60/S.bpm,sw=S.swing/100*spb/6,n=chords.length;
    const T=b=>t0+b*spb+(Math.round(b*2)%2?sw:0);     // Achtel zwischen den Schlägen kommen etwas später
    const v=chords[i%n],nx=chords[(i+1)%n],notes=v.voicing,low=bassNote(v);
    if(S.feel==='pad')notes.forEach((m,k)=>rhodes(m,T(0)+k*.016,3.8*spb,.6+(k===3?.1:0)));
    else if(S.feel==='comp')[[0,1.3,.75],[1.5,.7,.52],[2.5,1.25,.66]].forEach(([b,d,ve])=>notes.forEach((m,k)=>rhodes(m,T(b)+k*.008,d*spb,ve+(k===3?.08:0))));
    else[0,1,2,3,2,1,2,3].forEach((k,j)=>rhodes(notes[k],T(j/2),1.7*spb,j%2?.5:.7));
    bass(low,T(0),2.2*spb,.9);bass(low,T(2.5),.7*spb,.7);bass(bassNote(nx)-1,T(3.5),.4*spb,.6);
    for(let j=0;j<8;j++)hat(T(j/2),j%2?.4:.7);
    kick(T(0),1);kick(T(2.5),.75);rim(T(1),.7);rim(T(3),.8);
    queue.push({t:t0,i:i%n});
  }
  return scheduleBar;
}
