/* ================= WAV-Export ================= */
/* Rechnet den aktuellen Song ohne Echtzeit als WAV-Datei (F-U12): so oft hintereinander wie eingestellt, am Ende
   mit Ausklang oder hart abgeschnitten. Es klingt wie die Wiedergabe, weil dieselbe Engine rechnet. */
import {$,run,save} from './state.js';
import {registry} from './modules.js';
import {stop,currentSong} from './player.js';
import {packedSong} from './songs.js';
import {WAV_RATE,wavSettings,setWav,renderExport,clock,megabytes} from './ui-export.js';
import {repeatSong,fileName} from '../core/songfile.js';
import {audioEnd,encodeWav} from '../core/wav.js';
import {renderAudio} from '../engine/render.js';

let cancel=false;
const msg=text=>{$('wavMsg').textContent=text;};
function busy(on){
  run.exporting=on;
  $('wavGo').textContent=on?'Abbrechen':'WAV-Datei rechnen';
  $('wavProg').hidden=!on;$('wavProg').value=0;
  $('wavReps').disabled=on;document.querySelectorAll('#wavEnd button').forEach(b=>{b.disabled=on;});
}
function go(){
  if(run.exporting){cancel=true;return;}
  const song=packedSong();if(!song)return;
  const w=wavSettings(song),name=fileName(song,`-${Math.round(song.tempo.bpm)}bpm.wav`);
  // Die Wiedergabe hält an: Auf dem Handy reicht die Rechenleistung nicht für beides.
  if(run.playing)stop();
  cancel=false;busy(true);msg('Der Song wird gerechnet …');
  renderAudio(registry,repeatSong(song,w.reps),{
    OfflineAudioContext:window.OfflineAudioContext||window.webkitOfflineAudioContext,
    sampleRate:WAV_RATE,tail:w.tail,
    onProgress:p=>{$('wavProg').value=p;},
    cancelled:()=>cancel
  }).then(r=>{
    const ch=[r.buffer.getChannelData(0),r.buffer.getChannelData(1)],end=audioEnd(ch,r.lead+r.body,w.tail);
    // Ein Ausklang, der bis zur Obergrenze reicht, wird in 50 ms ausgeblendet.
    const wav=encodeWav(ch,WAV_RATE,r.lead,end,w.tail&&end===ch[0].length?Math.round(.05*WAV_RATE):0);
    const a=document.createElement('a'),url=URL.createObjectURL(new Blob([wav],{type:'audio/wav'}));
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    msg([`Die Datei ${name} liegt bei den Downloads: ${clock((end-r.lead)/WAV_RATE)} Minuten, ${megabytes(wav.byteLength)} MB.`,...r.warnings].join(' '));
  },e=>msg(e.code==='cancelled'?'Der Export wurde abgebrochen.':e.message||'Der Export ist gescheitert.'))
    .then(()=>{busy(false);renderExport(currentSong());});
}
function initExport(){
  $('wavGo').addEventListener('click',go);
  $('wavReps').addEventListener('input',e=>{const s=currentSong();if(!s)return;setWav(s,'reps',+e.target.value);renderExport(s);save();});
  $('wavEnd').addEventListener('click',e=>{
    const b=e.target.closest('button'),s=currentSong();if(!b||!s)return;
    setWav(s,'tail',+b.dataset.v);renderExport(s);save();
  });
  renderExport(currentSong());
}

export {initExport};
