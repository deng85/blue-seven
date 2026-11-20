/* ================= Zeit im Song ================= */
/* Im Song stehen Zeiten in Vierteln. Erst beim Abspielen werden daraus Sekunden, mit Tempo und Swing. */

// Sekunden ab Songanfang für eine Position in Vierteln. tempo ist song.tempo ({bpm, swing}).
// Swing wie im ursprünglichen Takt-Ablauf: Liegt die Position auf einer Achtel zwischen den Schlägen
// (gerundet), kommt sie um swing/100 × ein Sechstel Viertel später.
function beatToSeconds(beat,tempo){
  const spb=60/tempo.bpm,sw=(tempo.swing||0)/100*spb/6;
  return beat*spb+(Math.round(beat*2)%2?sw:0);
}
// Dauer in Sekunden für eine Länge in Vierteln, ohne Swing.
function beatsToSeconds(beats,tempo){return beats*60/tempo.bpm;}

export {beatToSeconds,beatsToSeconds};
