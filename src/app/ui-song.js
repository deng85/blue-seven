/* ================= Songübersicht ================= */
/* Für Songs mit mehreren Abschnitten: eine Leiste mit den Abschnitten im richtigen Längenverhältnis und der
   aktuellen Position, Knöpfe zum Springen und darunter, welche Spur in welchem Abschnitt spielt (nur Anzeige).
   Bei Songs mit einem einzigen Abschnitt (Jazzy Beats) bleibt der Bereich ausgeblendet. */
import {$} from './state.js';
import {esc} from './ui-params.js';

const clock=s=>{const n=Math.max(0,Math.round(s));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');};
const pct=v=>(v*100).toFixed(2)+'%';
let shown=null;   // {length, spb, sections} des gezeichneten Songs

function renderSong(song){
  const box=$('song');
  if(!song||song.sections.length<2){box.hidden=true;shown=null;return;}
  box.hidden=false;
  const L=song.length,spb=60/song.tempo.bpm,bar=song.tempo.beatsPerBar;
  shown={length:L,spb,sections:song.sections};
  const line=song.sections.map((s,i)=>`<i class="${i%2?'odd':''}" style="left:${pct(s.start/L)};width:${pct(s.length/L)}"></i>`).join('');
  const chips=song.sections.map((s,i)=>`<button data-beat="${s.start}" data-i="${i}"><b>${esc(s.name)}</b><span>${Math.round(s.length/bar)} Takte</span></button>`).join('');
  const rows=song.tracks.map(t=>`<div class="lane"><span>${esc(t.name)}</span><div class="laneBar">`+
    t.clips.map(c=>`<i style="left:${pct(c.start/L)};width:${pct(c.length/L)}"></i>`).join('')+'</div></div>').join('');
  $('songBody').innerHTML=`<div class="lab"><span>${esc(song.meta&&song.meta.title||'Song')}</span><output id="songTime">0:00 / ${clock(L*spb)}</output></div>`+
    `<div class="timeline">${line}<u id="songHead"></u></div><div class="chips" id="songChips">${chips}</div>`+
    `<details><summary>Spuren im Verlauf</summary><div class="lanes">${rows}<div class="laneOver"><u id="laneHead"></u></div></div></details>`;
  showPosition(-1);
}
// Zeigt die Position im Song. beat < 0 heißt: läuft nicht.
function showPosition(beat){
  if(!shown)return;
  const on=beat>=0,x=on?Math.min(1,beat/shown.length):0;
  for(const id of ['songHead','laneHead']){const h=$(id);if(h){h.style.left=pct(x);h.style.display=on?'':'none';}}
  $('songTime').textContent=`${clock(on?beat*shown.spb:0)} / ${clock(shown.length*shown.spb)}`;
  const cur=on?shown.sections.findIndex(s=>beat>=s.start&&beat<s.start+s.length):-1;
  $('songChips').querySelectorAll('button').forEach((b,i)=>b.classList.toggle('on',i===cur));
}

export {renderSong,showPosition};
