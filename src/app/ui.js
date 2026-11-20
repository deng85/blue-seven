/* ================= Oberfläche ================= */
import {$,S,favs,hist,chords,run,fromIds,bassNote,keyLabel,keyName,styleMod,styleParams} from './state.js';
import {registry} from './modules.js';
import {esc,controlHtml} from './ui-params.js';

function buildKeys(){
  const W=10,H=46,white=[0,2,4,5,7,9,11];let wi=0,ws='',bs='';
  for(let m=36;m<=79;m++){
    if(white.includes(m%12)){ws+=`<rect class="w" id="k${m}" x="${wi*W+.5}" y="0" width="${W-1}" height="${H}" rx="1"/>`;wi++;}
    else bs+=`<rect class="b" id="k${m}" x="${wi*W-3}" y="0" width="6" height="${H*.6}" rx="1"/>`;
  }
  const k=$('keys');k.setAttribute('viewBox',`0 0 ${wi*W} ${H}`);k.innerHTML=ws+bs;
}
function showNotes(i){
  document.querySelectorAll('#keys .on,#keys .bass').forEach(e=>e.classList.remove('on','bass'));
  const c=chords[i];if(!c)return;
  c.voicing.forEach(m=>{const e=$('k'+m);if(e)e.classList.add('on');});
  const b=$('k'+bassNote(c));if(b)b.classList.add('bass');
}
function setActive(i){
  run.active=i;
  document.querySelectorAll('.tile').forEach((t,j)=>t.classList.toggle('on',j===i));
  showNotes(i<0?0:i);
}
function seg(id,val){document.querySelectorAll('#'+id+' button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===String(val))));}
function render(){
  const tiles=$('tiles');tiles.style.gridTemplateColumns=`repeat(${S.n},minmax(0,1fr))`;
  tiles.innerHTML=chords.map((c,i)=>`<div class="slot">
    <button class="tile" data-i="${i}" aria-label="${c.label.root}${c.label.suffix} anhören"><span class="rn">${c.label.roman}</span><span class="root">${c.label.root}</span><span class="suf">${c.label.suffix}</span></button>
    <button class="lock" data-i="${i}" aria-pressed="${!!S.locks[i]}">${S.locks[i]?'Gehalten':'Halten'}</button></div>`).join('');
  setActive(run.playing?run.active:-1);
  $('status').innerHTML=`${keyName()}<br>${S.bpm} BPM`;
  seg('segN',S.n);seg('segMode',S.mode);seg('segNine',S.nine);
  document.querySelectorAll('#keys12 button').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.v===S.key)));
  for(const id of ['spice','bpm','swing'])$(id).value=S[id];
  $('spiceOut').textContent=S.spice===0?'pur':S.spice+' %';
  $('bpmOut').textContent=S.bpm+' BPM';$('swingOut').textContent=S.swing+' %';
  $('back').disabled=!hist.length;
  renderFavs();
}
// Auswahl von Akkord-Generator und Stil aus der Registry, dazu die Regler des gewählten Stils aus dessen
// Parameterbeschreibung und der Tempobereich des Stils. Wird beim Start und nach einem Stilwechsel gezeichnet.
function renderModules(){
  const opts=(list,cur)=>list.map(m=>`<option value="${esc(m.id)}"${m.id===cur?' selected':''}>${esc(m.name)}</option>`).join('');
  $('selChords').innerHTML=opts(registry.list('chords'),S.chordGen);
  $('selStyle').innerHTML=opts(registry.list('styles'),S.style);
  const st=styleMod(),p=styleParams();
  $('styleParams').innerHTML=(st.params||[]).map(x=>controlHtml(x,p[x.id],'sp-'+x.id,`data-style-param="${esc(x.id)}"`)).join('');
  $('rebuild').hidden=!st.random;
  if(st.tempo){
    $('bpm').min=st.tempo.min;$('bpm').max=st.tempo.max;
    S.bpm=Math.min(st.tempo.max,Math.max(st.tempo.min,S.bpm));
  }
}
function renderFavs(){
  const el=$('favs');
  if(!favs.length){el.innerHTML='<p class="hint">Noch nichts gemerkt. Das Herz unten rechts legt die aktuelle Folge hier ab.</p>';return;}
  el.innerHTML=favs.map((f,i)=>{
    const kn=keyLabel(f.key,f.mode),p=fromIds(f.loop,f.key,f.mode);
    const names=p?p.chords.map(c=>c.label.root+c.label.suffix).join(' · '):'';
    return `<div class="fav"><button class="load" data-i="${i}"><b>${kn}</b>${names}</button><button class="del" data-i="${i}" aria-label="Folge ${i+1} löschen">×</button></div>`;
  }).join('');
}


export {buildKeys,showNotes,setActive,render,renderFavs,renderModules};
