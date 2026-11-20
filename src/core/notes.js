/* ================= Tonnamen ================= */
const NOTE_FLAT=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const NOTE_SHARP=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const MODES=['dur','moll'];

// Schreibt man diese Tonart mit Kreuzen? Sonst mit Bs.
function useSharps(key,mode){return [7,2,9,4,11,6].includes(mode==='dur'?key:(key+3)%12);}
// Name einer Tonklasse (0 bis 11) in der Schreibweise der Tonart.
function noteName(pc,key,mode){return (useSharps(key,mode)?NOTE_SHARP:NOTE_FLAT)[((pc%12)+12)%12];}

// Frequenz einer MIDI-Note in Hertz (69 = A4 = 440 Hz).
const midiToHz=m=>440*Math.pow(2,(m-69)/12);

export {NOTE_FLAT,NOTE_SHARP,MODES,useSharps,noteName,midiToHz};
