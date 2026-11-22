/* ================= WAV-Export in der Oberfläche ================= */
/* Zeigt die Einstellungen für den WAV-Export zum aktuellen Song: Wiederholungen, Ende und was dabei herauskommt.
   Gerechnet wird in app/export.js. Die Einstellungen stehen als zusätzliches Feld wav in S: loop und song sind
   die Wiederholungen für Loops und für Songs mit Ende, tail 1 heißt mit Ausklang. */
import {$,S,run} from './state.js';
import {wavBytes} from '../core/wav.js';

const WAV_RATE=44100,MAX_REPS=16,BIG=100e6,MAX_SECONDS=1800;
const clock=s=>{const n=Math.round(s);return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');};
const megabytes=b=>b<10e6?(b/1e6).toFixed(1).replace('.',','):String(Math.round(b/1e6));

// Die Einstellungen für diesen Song: Loops werden als Standard viermal wiederholt, Songs mit Ende einmal.
function wavSettings(song){
  const w=S.wav&&typeof S.wav==='object'?S.wav:{},raw=song.loop?w.loop:w.song;
  const reps=Number.isInteger(raw)?Math.min(MAX_REPS,Math.max(1,raw)):song.loop?4:1;
  return {reps,tail:w.tail!==0,seconds:song.length*60/song.tempo.bpm*reps};
}
function setWav(song,key,value){
  S.wav=S.wav&&typeof S.wav==='object'?S.wav:{};
  S.wav[key==='reps'?(song.loop?'loop':'song'):key]=value;
}
function renderExport(song){
  if(!song)return;
  const w=wavSettings(song),bytes=wavBytes(w.seconds,WAV_RATE,2),long=w.seconds>MAX_SECONDS;
  $('wavReps').value=w.reps;$('wavRepsOut').textContent=w.reps===1?'einmal':w.reps+' mal';
  document.querySelectorAll('#wavEnd button').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.v==='1')===w.tail)));
  $('wavInfo').textContent=`Ergibt ${clock(w.seconds)} Minuten${w.tail?' plus Ausklang von Hall und Echo':', genau bis zum Ende des letzten Takts'}, etwa ${megabytes(bytes)} MB.`+
    (long?' Das ist zu lang für den Browser, bitte weniger Wiederholungen wählen.':bytes>BIG?' Das ist eine große Datei: Das Rechnen braucht viel Speicher und kann auf dem Handy scheitern.':'');
  if(!run.exporting)$('wavGo').disabled=long;
}

export {WAV_RATE,wavSettings,setWav,renderExport,clock,megabytes};
